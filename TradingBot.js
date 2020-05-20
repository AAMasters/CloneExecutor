exports.newTradingBot = function newTradingBot(bot, logger, UTILITIES, FILE_STORAGE) {
    const FULL_LOG = true
    const LOG_FILE_CONTENT = false
    const ONE_DAY_IN_MILISECONDS = 24 * 60 * 60 * 1000

    const MODULE_NAME = 'Trading Bot'

    let thisObject = {
        initialize: initialize,
        finalize: finalize,
        start: start
    }

    let utilities = UTILITIES.newCloudUtilities(logger)
    let fileStorage = FILE_STORAGE.newFileStorage(logger)

    const COMMONS = require('./Commons.js')
    let commons = COMMONS.newCommons(bot, logger, UTILITIES, FILE_STORAGE)

    let exchangeAPI

    return thisObject

    function finalize() {
        thisObject = undefined
        utilities = undefined
        fileStorage = undefined
        commons = undefined
    }

    function initialize(pExchangeAPI, callBackFunction) {
        try {
            logger.fileName = MODULE_NAME
            logger.initialize()

            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] initialize -> Entering function.') }

            exchangeAPI = pExchangeAPI
            callBackFunction(global.DEFAULT_OK_RESPONSE)
        } catch (err) {
            logger.write(MODULE_NAME, '[ERROR] initialize -> err = ' + err.stack)
            callBackFunction(global.DEFAULT_FAIL_RESPONSE)
        }
    }

    function start(multiPeriodDataFiles, timeFrame, timeFrameLabel, currentDay, variable, callBackFunction) {
        try {
            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> Entering function.') }

            let chart = {}
            let mainDependency = {}

            /* The first phase here is about checking that we have everything we need at the definition level. */
            let dataDependencies = bot.processNode.referenceParent.processDependencies.dataDependencies
            if (commons.validateDataDependencies(dataDependencies, callBackFunction) !== true) { return }

            let outputDatasets = bot.processNode.referenceParent.processOutput.outputDatasets
            if (commons.validateOutputDatasets(outputDatasets, callBackFunction) !== true) { return }

            /* The second phase is about transforming the inputs into a format that can be used to apply the user defined code. */
            for (let j = 0; j < global.marketFilesPeriods.length; j++) {
                let timeFrameLabel = marketFilesPeriods[j][1]
                let dataFiles = multiPeriodDataFiles.get(timeFrameLabel)
                let products = {}

                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> Inflating Data Files for timeFrame = ' + timeFrameLabel) }

                if (dataFiles !== undefined) {
                    commons.inflateDatafiles(dataFiles, dataDependencies, products, mainDependency, timeFrame)

                    let propertyName = 'at' + timeFrameLabel.replace('-', '')
                    chart[propertyName] = products
                }
            }

            for (let j = 0; j < global.dailyFilePeriods.length; j++) {
                let timeFrameLabel = global.dailyFilePeriods[j][1]
                let dataFiles = multiPeriodDataFiles.get(timeFrameLabel)
                let products = {}

                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> Inflating Data Files for timeFrame = ' + timeFrameLabel) }

                if (dataFiles !== undefined) {
                    commons.inflateDatafiles(dataFiles, dataDependencies, products, mainDependency, timeFrame)

                    let propertyName = 'at' + timeFrameLabel.replace('-', '')
                    chart[propertyName] = products
                }
            }

            /* Single Files */

            let dataFiles = multiPeriodDataFiles.get('Single Files')
            let products = {}

            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> Inflating Data Files from Single Files.') }

            if (dataFiles !== undefined) {
                commons.inflateDatafiles(dataFiles, dataDependencies, products, mainDependency, timeFrame)

                let propertyName = 'atAnyTimeFrame'
                chart[propertyName] = products
            }

            /* Simulation */

            const TRADING_SIMULATION = require('./TradingSimulation.js')
            let tradingSimulation = TRADING_SIMULATION.newTradingSimulation(bot, logger, UTILITIES)

            let market = bot.market

            const SIMULATED_RECORDS_FOLDER_NAME = 'Trading-Simulation'
            const CONDITIONS_FOLDER_NAME = 'Simulation-Conditions'
            const STRATEGIES_FOLDER_NAME = 'Simulation-Strategies'
            const TRADES_FOLDER_NAME = 'Simulation-Trades'
            const SNAPSHOTS_FOLDER_NAME = 'Snapshots'

            const ONE_DAY_IN_MILISECONDS = 24 * 60 * 60 * 1000

            let recordsArray
            let conditionsArray
            let strategiesArray
            let positionsArray

            let snapshotHeaders
            let triggerOnSnapshot
            let takePositionSnapshot

            let tradingSystem = {}

            tradingSimulation.runSimulation(
                chart,
                dataDependencies,
                timeFrame,
                timeFrameLabel,
                currentDay,
                variable,
                exchangeAPI,
                writeFiles,
                callBackFunction)

            function writeFiles(pTradingSystem, pRecordsArray, pConditionsArray, pStrategiesArray, pPositionsArray, pSnapshotHeaders, pTriggerOnSnapshot, pTakePositionSnapshot) {
                tradingSystem = pTradingSystem
                recordsArray = pRecordsArray
                conditionsArray = pConditionsArray
                strategiesArray = pStrategiesArray
                positionsArray = pPositionsArray

                snapshotHeaders = pSnapshotHeaders
                triggerOnSnapshot = pTriggerOnSnapshot
                takePositionSnapshot = pTakePositionSnapshot

                if (timeFrame > global.dailyFilePeriods[0][0]) {
                    writeMarketFiles()
                } else {
                    writeDailyFiles()
                }
            }

            function writeMarketFiles() {
                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> Entering function.') }

                writeRecordsFile()

                function writeRecordsFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeRecordsFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < recordsArray.length; i++) {
                            let record = recordsArray[i]

                            fileContent = fileContent + separator + '[' +
                                record.begin + ',' +
                                record.end + ',' +
                                record.variable_current_balance_baseAsset + ',' +
                                record.variable_current_balance_quotedAsset + ',' +
                                record.variable_episode_stat_profitLoss + ',' +
                                record.variable_last_position_profitLoss + ',' +
                                record.variable_current_position_stopLoss_value + ',' +
                                record.variable_episode_count_positions + ',' +
                                record.variable_episode_count_hits + ',' +
                                record.variable_episode_count_fails + ',' +
                                record.variable_episode_stat_hitRatio + ',' +
                                record.variable_episode_stat_ROI + ',' +
                                record.variable_episode_count_periods + ',' +
                                record.variable_episode_stat_days + ',' +
                                record.variable_episode_stat_anualizedRateOfReturn + ',' +
                                record.variable_current_position_rate + ',' +
                                record.variable_last_position_ROI + ',' +
                                record.variable_current_strategy_index + ',' +
                                record.variable_current_position_takeProfit_value + ',' +
                                record.variable_current_position_stopLoss_phase + ',' +
                                record.variable_current_position_stopLoss_phase + ',' +
                                record.variable_current_position_size + ',' +
                                record.variable_episode_parameters_initial_balance_baseAsset + ',' +
                                record.variable_episode_parameters_minimum_balance_baseAsset + ',' +
                                record.variable_episode_parameters_maximum_balance_baseAsset + ',' +
                                record.variable_episode_parameters_initial_balance_quotedAsset + ',' +
                                record.variable_episode_parameters_minimum_balance_quotedAsset + ',' +
                                record.variable_episode_parameters_maximum_balance_quotedAsset + ',' +
                                record.variable_episode_parameters_baseAsset + ',' +
                                record.variable_episode_parameters_quotedAsset + ',' +
                                record.variable_episode_parameters_marketBaseAsset + ',' +
                                record.variable_episode_parameters_marketQuotedAsset + ',' +
                                record.variable_current_position_periods + ',' +
                                record.variable_current_position_days + ',' +
                                record.variable_current_distance_toEvent_triggerOn + ',' +
                                record.variable_current_distance_toEvent_triggerOff + ',' +
                                record.variable_current_distance_toEvent_takePosition + ',' +
                                record.variable_current_distance_toEvent_closePosition + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'

                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + SIMULATED_RECORDS_FOLDER_NAME + '/' + 'Multi-Period-Market' + '/' + timeFrameLabel
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeRecordsFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeRecordsFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeRecordsFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeRecordsFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeRecordsFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writeConditionsFile()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeRecordsFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeRecordsFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writeConditionsFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeConditionsFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < conditionsArray.length; i++) {
                            let record = conditionsArray[i]

                            let conditions = ''
                            let conditionsSeparator = ''

                            for (let j = 0; j < record.length - 3; j++) {
                                conditions = conditions + conditionsSeparator + record[j]
                                if (conditionsSeparator === '') { conditionsSeparator = ',' }
                            }

                            conditions = conditions + conditionsSeparator + '[' + record[record.length - 3] + ']'   // The last item contains an Array of condition values.
                            conditions = conditions + conditionsSeparator + '[' + record[record.length - 2] + ']'   // The last item contains an Array of formulaErrors.
                            conditions = conditions + conditionsSeparator + '[' + record[record.length - 1] + ']'   // The last item contains an Array of formulaValues.

                            fileContent = fileContent + separator + '[' + conditions + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'
                        fileContent = '[' + JSON.stringify(tradingSystem) + ',' + fileContent + ']'

                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + CONDITIONS_FOLDER_NAME + '/' + 'Multi-Period-Market' + '/' + timeFrameLabel
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeConditionsFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeConditionsFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeConditionsFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeConditionsFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeConditionsFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writeStrategiesFile()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeConditionsFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeConditionsFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writeStrategiesFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeStrategiesFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < strategiesArray.length; i++) {
                            let record = strategiesArray[i]

                            fileContent = fileContent + separator + '[' +
                                record.begin + ',' +
                                record.end + ',' +
                                record.status + ',' +
                                record.number + ',' +
                                record.beginRate + ',' +
                                record.endRate + ',' +
                                '"' + record.situationName + '"' + ',' +
                                '"' + record.name + '"' + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'

                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + STRATEGIES_FOLDER_NAME + '/' + 'Multi-Period-Market' + '/' + timeFrameLabel
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeStrategiesFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeStrategiesFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeStrategiesFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeStrategiesFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeStrategiesFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writePositionsFile()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeStrategiesFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeStrategiesFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writePositionsFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writePositionsFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < positionsArray.length; i++) {
                            let record = positionsArray[i]
                            if (record.stopRate === undefined) { record.stopRate = 0 }

                            fileContent = fileContent + separator + '[' +
                                record.begin + ',' +
                                record.end + ',' +
                                record.status + ',' +
                                record.ROI + ',' +
                                record.beginRate + ',' +
                                record.endRate + ',' +
                                record.exitType + ',' +
                                '"' + record.situationName + '"' + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'

                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + TRADES_FOLDER_NAME + '/' + 'Multi-Period-Market' + '/' + timeFrameLabel
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writePositionsFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writePositionsFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writePositionsFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writePositionsFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writePositionsFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writeSnapshotFiles()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writePositionsFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writePositionsFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writeSnapshotFiles() {
                    writeSnapshotFile(triggerOnSnapshot, 'Trigger-On', onFinish)

                    function onFinish() {
                        writeSnapshotFile(takePositionSnapshot, 'Take-Position', callBackFunction)
                    }
                }

                function writeSnapshotFile(snapshotArray, pFileName, callBack) {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeSnapshotFile -> Entering function.') }

                        let fileRecordCounter = 0

                        let fileContent = ''
                        let separator = '\r\n'

                        parseRecord(snapshotHeaders)

                        for (let i = 0; i < snapshotArray.length; i++) {
                            let record = snapshotArray[i]
                            parseRecord(record)
                            fileRecordCounter++
                        }

                        function parseRecord(record) {
                            for (let j = 0; j < record.length; j++) {
                                let property = record[j]

                                fileContent = fileContent + '' + property
                                if (j !== record.length - 1) {
                                    fileContent = fileContent + ','
                                }
                            }
                            fileContent = fileContent + separator
                        }

                        fileContent = '' + fileContent + ''

                        let fileName = pFileName + '.csv'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + SNAPSHOTS_FOLDER_NAME + '/' + 'Multi-Period-Market' + '/' + timeFrameLabel
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeSnapshotFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeMarketFiles -> writeSnapshotFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeSnapshotFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeSnapshotFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeSnapshotFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                callBack(global.DEFAULT_OK_RESPONSE)
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeSnapshotFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeMarketFiles -> writeSnapshotFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }
            }

            function writeDailyFiles() {
                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> Entering function.') }

                writeRecordsFile()

                function writeRecordsFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeRecordsFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < recordsArray.length; i++) {
                            let record = recordsArray[i]

                            /* Will only add to the file the records of the current day */

                            if (record.begin < currentDay.valueOf()) { continue }

                            fileContent = fileContent + separator + '[' +
                                record.begin + ',' +
                                record.end + ',' +
                                record.variable_current_balance_baseAsset + ',' +
                                record.variable_current_balance_quotedAsset + ',' +
                                record.variable_episode_stat_profitLoss + ',' +
                                record.variable_last_position_profitLoss + ',' +
                                record.variable_current_position_stopLoss_value + ',' +
                                record.variable_episode_count_positions + ',' +
                                record.variable_episode_count_hits + ',' +
                                record.variable_episode_count_fails + ',' +
                                record.variable_episode_stat_hitRatio + ',' +
                                record.variable_episode_stat_ROI + ',' +
                                record.variable_episode_count_periods + ',' +
                                record.variable_episode_stat_days + ',' +
                                record.variable_episode_stat_anualizedRateOfReturn + ',' +
                                record.variable_current_position_rate + ',' +
                                record.variable_last_position_ROI + ',' +
                                record.variable_current_strategy_index + ',' +
                                record.variable_current_position_takeProfit_value + ',' +
                                record.variable_current_position_stopLoss_phase + ',' +
                                record.variable_current_position_stopLoss_phase + ',' +
                                record.variable_current_position_size + ',' +
                                record.variable_episode_parameters_initial_balance_baseAsset + ',' +
                                record.variable_episode_parameters_minimum_balance_baseAsset + ',' +
                                record.variable_episode_parameters_maximum_balance_baseAsset + ',' +
                                record.variable_episode_parameters_initial_balance_quotedAsset + ',' +
                                record.variable_episode_parameters_minimum_balance_quotedAsset + ',' +
                                record.variable_episode_parameters_maximum_balance_quotedAsset + ',' +
                                record.variable_episode_parameters_baseAsset + ',' +
                                record.variable_episode_parameters_quotedAsset + ',' +
                                record.variable_episode_parameters_marketBaseAsset + ',' +
                                record.variable_episode_parameters_marketQuotedAsset + ',' +
                                record.variable_current_position_periods + ',' +
                                record.variable_current_position_days + ',' +
                                record.variable_current_distance_toEvent_triggerOn + ',' +
                                record.variable_current_distance_toEvent_triggerOff + ',' +
                                record.variable_current_distance_toEvent_takePosition + ',' +
                                record.variable_current_distance_toEvent_closePosition + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'

                        let dateForPath = currentDay.getUTCFullYear() + '/' + utilities.pad(currentDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(currentDay.getUTCDate(), 2)
                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + SIMULATED_RECORDS_FOLDER_NAME + '/' + 'Multi-Period-Daily' + '/' + timeFrameLabel + '/' + dateForPath
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeRecordsFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeRecordsFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeRecordsFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeRecordsFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeRecordsFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writeConditionsFile()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeRecordsFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeRecordsFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writeConditionsFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeConditionsFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < conditionsArray.length; i++) {
                            let record = conditionsArray[i]

                            /* Will only add to the file the records of the current day */

                            if (record.begin < currentDay.valueOf()) { continue }

                            let conditions = ''
                            let conditionsSeparator = ''

                            /* Will only add to the file the records of the current day */

                            if (record.begin < currentDay.valueOf()) { continue }

                            for (let j = 0; j < record.length - 3; j++) {
                                conditions = conditions + conditionsSeparator + record[j]
                                if (conditionsSeparator === '') { conditionsSeparator = ',' }
                            }

                            conditions = conditions + conditionsSeparator + '[' + record[record.length - 3] + ']'   // The last item contains an Array of condition values.
                            conditions = conditions + conditionsSeparator + '[' + record[record.length - 2] + ']'   // The last item contains an Array of formulaErrors.
                            conditions = conditions + conditionsSeparator + '[' + record[record.length - 1] + ']'   // The last item contains an Array of formulaValues.

                            fileContent = fileContent + separator + '[' + conditions + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'
                        fileContent = '[' + JSON.stringify(tradingSystem) + ',' + fileContent + ']'

                        let dateForPath = currentDay.getUTCFullYear() + '/' + utilities.pad(currentDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(currentDay.getUTCDate(), 2)
                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + CONDITIONS_FOLDER_NAME + '/' + 'Multi-Period-Daily' + '/' + timeFrameLabel + '/' + dateForPath
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeConditionsFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeConditionsFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeConditionsFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeConditionsFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeConditionsFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writeStrategiesFile()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeConditionsFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeConditionsFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writeStrategiesFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeStrategiesFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < strategiesArray.length; i++) {
                            let record = strategiesArray[i]

                            /* Will only add to the file the records of the current day. In this case since objects can span more than one day, we add all of the objects that ends
                            at the current date. */

                            if (record.end < currentDay.valueOf()) { continue }

                            fileContent = fileContent + separator + '[' +
                                record.begin + ',' +
                                record.end + ',' +
                                record.status + ',' +
                                record.number + ',' +
                                record.beginRate + ',' +
                                record.endRate + ',' +
                                '"' + record.situationName + '"' + ',' +
                                '"' + record.name + '"' + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'

                        let dateForPath = currentDay.getUTCFullYear() + '/' + utilities.pad(currentDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(currentDay.getUTCDate(), 2)
                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + STRATEGIES_FOLDER_NAME + '/' + 'Multi-Period-Daily' + '/' + timeFrameLabel + '/' + dateForPath
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeStrategiesFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeStrategiesFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeStrategiesFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeStrategiesFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeStrategiesFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writePositionsFile()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeStrategiesFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeStrategiesFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writePositionsFile() {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writePositionsFile -> Entering function.') }

                        let separator = ''
                        let fileRecordCounter = 0

                        let fileContent = ''

                        for (let i = 0; i < positionsArray.length; i++) {
                            let record = positionsArray[i]

                            /* Will only add to the file the records of the current day. In this case since objects can span more than one day, we add all of the objects that ends
                            at the current date. */

                            if (record.end < currentDay.valueOf()) { continue }
                            if (record.stopRate === undefined) { record.stopRate = 0 }

                            fileContent = fileContent + separator + '[' +
                                record.begin + ',' +
                                record.end + ',' +
                                record.status + ',' +
                                record.ROI + ',' +
                                record.beginRate + ',' +
                                record.endRate + ',' +
                                record.exitType + ',' +
                                '"' + record.situationName + '"' + ']'

                            if (separator === '') { separator = ',' }

                            fileRecordCounter++
                        }

                        fileContent = '[' + fileContent + ']'

                        let dateForPath = currentDay.getUTCFullYear() + '/' + utilities.pad(currentDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(currentDay.getUTCDate(), 2)
                        let fileName = 'Data.json'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + TRADES_FOLDER_NAME + '/' + 'Multi-Period-Daily' + '/' + timeFrameLabel + '/' + dateForPath
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writePositionsFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writePositionsFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writePositionsFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writePositionsFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writePositionsFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                writeSnapshotFiles()
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writePositionsFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writePositionsFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }

                function writeSnapshotFiles() {
                    writeSnapshotFile(triggerOnSnapshot, 'Trigger-On', onFinish)

                    function onFinish() {
                        writeSnapshotFile(takePositionSnapshot, 'Take-Position', callBackFunction)
                    }
                }

                function writeSnapshotFile(snapshotArray, pFileName, callBack) {
                    try {
                        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeSnapshotFile -> Entering function.') }

                        let fileRecordCounter = 0

                        let fileContent = ''
                        let separator = '\r\n'

                        parseRecord(snapshotHeaders)

                        for (let i = 0; i < snapshotArray.length; i++) {
                            let record = snapshotArray[i]
                            parseRecord(record)
                            fileRecordCounter++
                        }

                        function parseRecord(record) {
                            for (let j = 0; j < record.length; j++) {
                                let property = record[j]

                                fileContent = fileContent + '' + property
                                if (j !== record.length - 1) {
                                    fileContent = fileContent + ','
                                }
                            }
                            fileContent = fileContent + separator
                        }

                        fileContent = '' + fileContent + ''

                        let dateForPath = currentDay.getUTCFullYear() + '/' + utilities.pad(currentDay.getUTCMonth() + 1, 2) + '/' + utilities.pad(currentDay.getUTCDate(), 2)
                        let fileName = pFileName + '.csv'
                        let filePath = bot.filePathRoot + '/Output/' + bot.SESSION.folderName + '/' + SNAPSHOTS_FOLDER_NAME + '/' + 'Multi-Period-Daily' + '/' + timeFrameLabel + '/' + dateForPath
                        filePath += '/' + fileName

                        fileStorage.createTextFile(filePath, fileContent + '\n', onFileCreated)

                        function onFileCreated(err) {
                            try {
                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeSnapshotFile -> onFileCreated -> Entering function.') }
                                if (LOG_FILE_CONTENT === true) { logger.write(MODULE_NAME, '[INFO] start -> writeDailyFiles -> writeSnapshotFile -> onFileCreated -> fileContent = ' + fileContent) }

                                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeSnapshotFile -> onFileCreated -> err = ' + err.stack)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeSnapshotFile -> onFileCreated -> filePath = ' + filePath)
                                    logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeSnapshotFile -> onFileCreated -> market = ' + market.baseAsset + '_' + market.quotedAsset)

                                    callBackFunction(err)
                                    return
                                }

                                callBack(global.DEFAULT_OK_RESPONSE)
                            } catch (err) {
                                logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeSnapshotFile -> onFileCreated -> err = ' + err.stack)
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                            }
                        }
                    } catch (err) {
                        logger.write(MODULE_NAME, '[ERROR] start -> writeDailyFiles -> writeSnapshotFile -> err = ' + err.stack)
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE)
                    }
                }
            }
        } catch (err) {
            logger.write(MODULE_NAME, '[ERROR] start -> err = ' + err.stack)
            callBackFunction(global.DEFAULT_FAIL_RESPONSE)
        }
    }
}
