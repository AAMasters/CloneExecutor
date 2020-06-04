exports.newTradingSystem = function newTradingSystem(bot, logger) {

    const MODULE_NAME = 'Trading System'
    const FULL_LOG = true

    let thisObject = {
        evalConditions: evalConditions,
        evalFormulas: evalFormulas,
        checkTriggerOn: checkTriggerOn,
        checkTriggerOff: checkTriggerOff,
        checkTakePosition: checkTakePosition,
        checkStopPhases: checkStopPhases,
        calculateStopLoss: calculateStopLoss,
        checkTakeProfitPhases: checkTakeProfitPhases,
        calculateTakeProfit: calculateTakeProfit,
        initialize: initialize,
        finalize: finalize
    }

    let chart
    let tradingSystem
    let tradingEngine

    let conditions = new Map()
    let conditionsValues = []
    let conditionsErrors = []

    let formulas = new Map()
    let formulasValues = []
    let formulasErrors = []

    return thisObject

    function initialize(pChart) {
        chart = pChart
        tradingSystem = bot.TRADING_SYSTEM
        tradingEngine = bot.TRADING_ENGINE
    }

    function finalize() {
        chart = undefined
        tradingSystem = undefined
        tradingEngine = undefined

        conditions = undefined
        conditionsValues = undefined
        conditionsErrors = undefined

        formulas = undefined
        formulasValues = undefined
        formulasErrors = undefined
    }

    function evalConditions() {
        evalNode(bot.TRADING_SYSTEM, 'Conditions')
    }

    function evalFormulas() {
        evalNode(bot.TRADING_SYSTEM, 'Formulas')
    }

    function evalNode(node, evaluating) {
        if (node === undefined) { return }

        /* Here we check if there is a codition to be evaluated */
        if (node.type === 'Condition' && evaluating === 'Conditions') {
            if (node.code !== undefined) {
                /* We will eval this condition */
                evalCondition(node)
            }
        }

        /* Here we check if there is a formula to be evaluated */
        if (node.type === 'Formula' && evaluating === 'Formulas') {
            if (node.code !== undefined) {
                /* We will eval this condition */
                evalFormula(node)
            }
        }

        /* Now we go down through all this node children */
        let nodeDefinition = bot.APP_SCHEMA_MAP.get(node.type)
        if (nodeDefinition === undefined) { return }

        if (nodeDefinition.properties !== undefined) {
            let previousPropertyName // Since there are cases where there are many properties with the same name,because they can hold nodes of different types but only one at the time, we have to avoind counting each property of those as individual children.
            for (let i = 0; i < nodeDefinition.properties.length; i++) {
                let property = nodeDefinition.properties[i]

                switch (property.type) {
                    case 'node': {
                        if (property.name !== previousPropertyName) {
                            if (node[property.name] !== undefined) {
                                evalNode(node[property.name])
                            }
                            previousPropertyName = property.name
                        }
                        break
                    }
                    case 'array': {
                        if (node[property.name] !== undefined) {
                            let nodePropertyArray = node[property.name]
                            object[property.name] = []
                            for (let m = 0; m < nodePropertyArray.length; m++) {
                                evalNode(nodePropertyArray[m])
                            }
                        }
                        break
                    }
                }
            }
        }
    }

    function evalCondition(node) {
        let value
        let error

        try {
            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] evalCondition -> code = ' + node.code) }

            value = eval(node.code)
        } catch (err) {
            /*
                One possible error is that the conditions references a .previous that is undefined. This
                will not be considered an error.
            */
            value = false

            if (node.code.indexOf('previous') > -1 && err.message.indexOf('of undefined') > -1 ||
                node.code.indexOf('chart') > -1 && err.message.indexOf('of undefined') > -1
            ) {
                /*
                    We are not going to set an error for the casess we are using previous and the error is that the indicator is undefined.
                */
            } else {
                error = err.message
                node.error = error
            }
        }

        conditions.set(node.id, value)

        if (value === true) {
            conditionsValues.push(1)
        } else {
            conditionsValues.push(0)
        }

        formulasErrors.push(error)

        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] evalCondition -> value = ' + value) }
        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] evalCondition -> error = ' + error) }
    }

    function evalFormula(node) {
        let value
        let error

        try {
            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] evalFormula -> code = ' + node.code) }
            value = eval(node.code)
        } catch (err) {
            /*
                One possible error is that the formula references a .previous that is undefined. This
                will not be considered an error.
            */
            value = false

            if (node.code.indexOf('previous') > -1 && err.message.indexOf('of undefined') > -1 ||
                node.code.indexOf('chart') > -1 && err.message.indexOf('of undefined') > -1
            ) {
                /*
                    We are not going to set an error for the casess we are using previous and the error is that the indicator is undefined.
                */
            } else {
                error = err.message
                node.error = error
            }
        }

        formulas.set(node.id, value)

        if (value === true) {
            formulaValues.push(1)
        } else {
            formulaValues.push(0)
        }

        formulasErrors.push(error)

        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] evalFormula -> value = ' + value) }
        if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] evalFormula -> error = ' + error) }
    }

    function checkTriggerOn() {
        /* Trigger On Conditions */
        if (
            tradingEngine.current.strategy.stageType.value === 'No Stage' &&
            tradingEngine.current.strategy.index.value === -1
        ) {

            /*
            Here we need to pick a strategy, or if there is not suitable strategy for the current
            market conditions, we pass until the next period.
 
            To pick a new strategy we will evaluate what we call the trigger on. Once we enter
            into one strategy, we will ignore market conditions for others. However there is also
            a strategy trigger off which can be hit before taking a position. If hit, we would
            be outside a strategy again and looking for the condition to enter all over again.
            */

            for (let j = 0; j < tradingSystem.strategies.length; j++) {
                if ( // If a strategy was already picked during the loop, we exit it
                    tradingEngine.current.strategy.stageType.value !== 'No Stage' ||
                    tradingEngine.current.strategy.index.value !== -1
                ) { continue }

                let strategy = tradingSystem.strategies[j]
                let triggerStage = strategy.triggerStage

                if (triggerStage !== undefined) {
                    if (triggerStage.triggerOn !== undefined) {
                        for (let k = 0; k < triggerStage.triggerOn.situations.length; k++) {
                            let situation = triggerStage.triggerOn.situations[k]
                            let passed
                            if (situation.conditions.length > 0) {
                                passed = true
                            }

                            for (let m = 0; m < situation.conditions.length; m++) {

                                let condition = situation.conditions[m]
                                let value = false
                                if (conditions.get(condition.id) !== undefined) {
                                    value = conditions.get(condition.id).value
                                }

                                if (value === false) { passed = false }
                            }

                            if (passed) {

                                tradingEngine.current.strategy.stageType.value = 'Trigger Stage'
                                checkAnnouncements(triggerStage)

                                tradingEngine.current.strategy.index.value = j
                                tradingEngine.current.strategy.begin.value = candle.begin
                                tradingEngine.current.strategy.beginRate.value = candle.min
                                tradingEngine.current.strategy.endRate.value = candle.min // In case the strategy does not get exited
                                tradingEngine.current.strategy.situationName.value = situation.name
                                tradingEngine.current.strategy.strategyName.value = strategy.name

                                tradingEngine.current.distanceToEvent.triggerOn.value = 1

                                checkAnnouncements(triggerStage.triggerOn)
                                saveAsLastTriggerOnSnapshot = true

                                if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] runSimulation -> loop -> Entering into Strategy: ' + strategy.name) }
                                break
                            }
                        }
                    }
                }
            }
        }
    }

    function checkTriggerOff() {
        /* Trigger Off Condition */
        if (tradingEngine.current.strategy.stageType.value === 'Trigger Stage') {
            let strategy = tradingSystem.strategies[tradingEngine.current.strategy.index.value]
            let triggerStage = strategy.triggerStage

            if (triggerStage !== undefined) {
                if (triggerStage.triggerOff !== undefined) {
                    for (let k = 0; k < triggerStage.triggerOff.situations.length; k++) {
                        let situation = triggerStage.triggerOff.situations[k]
                        let passed
                        if (situation.conditions.length > 0) {
                            passed = true
                        }

                        for (let m = 0; m < situation.conditions.length; m++) {
                            let condition = situation.conditions[m]
                            let value = false
                            if (conditions.get(condition.id) !== undefined) {
                                value = conditions.get(condition.id).value
                            }

                            if (value === false) { passed = false }
                        }

                        if (passed) {
                            tradingEngine.current.strategy.end.value = candle.end
                            tradingEngine.current.strategy.endRate.value = candle.min
                            tradingEngine.current.strategy.status.value = 'Closed'
                            tradingEngine.current.strategy.stageType.value = 'No Stage'
                            tradingEngine.current.strategy.index.value = -1

                            tradingEngine.current.distanceToEvent.triggerOff.value = 1

                            checkAnnouncements(triggerStage.triggerOff)

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] runSimulation -> loop -> Exiting Strategy: ' + strategy.name) }
                            break
                        }
                    }
                }
            }
        }

    }

    function checkTakePosition() {
        /* Take Position Condition */
        if (tradingEngine.current.strategy.stageType.value === 'Trigger Stage') {
            let strategy = tradingSystem.strategies[tradingEngine.current.strategy.index.value]

            let triggerStage = strategy.triggerStage

            if (triggerStage !== undefined) {
                if (triggerStage.takePosition !== undefined) {
                    for (let k = 0; k < triggerStage.takePosition.situations.length; k++) {
                        let situation = triggerStage.takePosition.situations[k]
                        let passed
                        if (situation.conditions.length > 0) {
                            passed = true
                        }

                        for (let m = 0; m < situation.conditions.length; m++) {
                            let condition = situation.conditions[m]
                            let value = false
                            if (conditions.get(condition.id) !== undefined) {
                                value = conditions.get(condition.id).value
                            }

                            if (value === false) { passed = false }
                        }

                        if (passed) {
                            tradingEngine.current.strategy.stageType.value = 'Open Stage'
                            checkAnnouncements(strategy.openStage)

                            tradingEngine.current.position.stopLossStage.value = 'Open Stage'
                            tradingEngine.current.position.takeProfitStage.value = 'Open Stage'
                            tradingEngine.current.position.stopLossPhase.value = 0
                            tradingEngine.current.position.takeProfitPhase.value = 0

                            takePositionNow = true
                            tradingEngine.current.position.situationName.value = situation.name

                            checkAnnouncements(triggerStage.takePosition)
                            saveAsLastTakePositionSnapshot = true

                            if (FULL_LOG === true) { logger.write(MODULE_NAME, '[INFO] runSimulation -> loop -> Conditions at the Take Position Event were met.') }
                            break
                        }
                    }
                }
            }
        }
    }

    function checkStopPhases() {
        let strategy = tradingSystem.strategies[tradingEngine.current.strategy.index.value]

        let openStage = strategy.openStage
        let manageStage = strategy.manageStage
        let parentNode
        let j = tradingEngine.current.strategy.index.value
        let p

        if (tradingEngine.current.position.stopLoss.stopLossStage.value === 'Open Stage' && openStage !== undefined) {
            if (openStage.initialDefinition !== undefined) {
                if (openStage.initialDefinition.stopLoss !== undefined) {
                    parentNode = openStage.initialDefinition
                    p = tradingEngine.current.position.stopLoss.stopLossPhase.value
                }
            }
        }

        if (tradingEngine.current.position.stopLoss.stopLossStage.value === 'Manage Stage' && manageStage !== undefined) {
            if (manageStage.stopLoss !== undefined) {
                parentNode = manageStage
                p = tradingEngine.current.position.stopLoss.stopLossPhase.value - 1
            }
        }

        if (parentNode !== undefined) {
            let phase = parentNode.stopLoss.phases[p]

            /* Check the next Phase Event. */
            let nextPhaseEvent = phase.nextPhaseEvent
            if (nextPhaseEvent !== undefined) {
                for (let k = 0; k < nextPhaseEvent.situations.length; k++) {
                    let situation = nextPhaseEvent.situations[k]
                    let passed
                    if (situation.conditions.length > 0) {
                        passed = true
                    }

                    for (let m = 0; m < situation.conditions.length; m++) {
                        let condition = situation.conditions[m]
                        let value = false
                        if (conditions.get(condition.id) !== undefined) {
                            value = conditions.get(condition.id).value
                        }

                        if (value === false) { passed = false }
                    }

                    if (passed) {
                        tradingEngine.current.position.stopLoss.stopLossPhase.value++
                        tradingEngine.current.position.stopLoss.stopLossStage.value = 'Manage Stage'
                        if (tradingEngine.current.position.takeProfit.takeProfitPhase.value > 0) {
                            tradingEngine.current.strategy.stageType.value = 'Manage Stage'
                            checkAnnouncements(manageStage, 'Take Profit')
                        }

                        checkAnnouncements(nextPhaseEvent)
                        return
                    }
                }
            }

            /* Check the Move to Phase Events. */
            for (let n = 0; n < phase.moveToPhaseEvents.length; n++) {
                let moveToPhaseEvent = phase.moveToPhaseEvents[n]
                if (moveToPhaseEvent !== undefined) {
                    for (let k = 0; k < moveToPhaseEvent.situations.length; k++) {
                        let situation = moveToPhaseEvent.situations[k]
                        let passed
                        if (situation.conditions.length > 0) {
                            passed = true
                        }

                        for (let m = 0; m < situation.conditions.length; m++) {

                            let condition = situation.conditions[m]
                            let value = false
                            if (conditions.get(condition.id) !== undefined) {
                                value = conditions.get(condition.id).value
                            }

                            if (value === false) { passed = false }
                        }

                        if (passed) {

                            let moveToPhase = moveToPhaseEvent.referenceParent
                            if (moveToPhase !== undefined) {
                                for (let q = 0; q < parentNode.stopLoss.phases.length; q++) {
                                    if (parentNode.stopLoss.phases[q].id === moveToPhase.id) {
                                        tradingEngine.current.position.stopLoss.stopLossPhase.value = q + 1
                                    }
                                }
                            } else {
                                moveToPhaseEvent.error = 'This Node needs to reference a Phase.'
                                continue
                            }

                            tradingEngine.current.position.stopLoss.stopLossStage.value = 'Manage Stage'
                            if (tradingEngine.current.position.takeProfit.takeProfitPhase.value > 0) {
                                tradingEngine.current.strategy.stageType.value = 'Manage Stage'
                                checkAnnouncements(manageStage, 'Take Profit')
                            }

                            checkAnnouncements(moveToPhaseEvent)
                            return
                        }
                    }
                }
            }
        }
    }

    function calculateStopLoss() {
        let strategy = tradingSystem.strategies[tradingEngine.current.strategy.index.value]
        let openStage = strategy.openStage
        let manageStage = strategy.manageStage
        let phase
        let key

        if (tradingEngine.current.position.stopLoss.stopLossStage.value === 'Open Stage' && openStage !== undefined) {
            if (openStage.initialDefinition !== undefined) {
                if (openStage.initialDefinition.stopLoss !== undefined) {
                    phase = openStage.initialDefinition.stopLoss.phases[tradingEngine.current.position.stopLoss.stopLossPhase.value]
                    key = tradingEngine.current.strategy.index.value + '-' + 'openStage' + '-' + 'initialDefinition' + '-' + 'stopLoss' + '-' + (tradingEngine.current.position.stopLoss.stopLossPhase.value)
                }
            }
        }

        if (tradingEngine.current.position.stopLoss.stopLossStage.value === 'Manage Stage' && manageStage !== undefined) {
            if (manageStage.stopLoss !== undefined) {
                phase = manageStage.stopLoss.phases[tradingEngine.current.position.stopLoss.stopLossPhase.value - 1]
                key = tradingEngine.current.strategy.index.value + '-' + 'manageStage' + '-' + 'stopLoss' + '-' + (tradingEngine.current.position.stopLoss.stopLossPhase.value - 1)
            }
        }

        if (phase !== undefined) {
            if (phase.formula !== undefined) {
                let previousValue = tradingEngine.current.position.stopLoss.value

                tradingEngine.current.position.stopLoss.value = formulas.get(key)

                if (tradingEngine.current.position.stopLoss.value !== previousValue) {
                    checkAnnouncements(phase, tradingEngine.current.position.stopLoss.value)
                }
            }
        }
    }


    function checkTakeProfitPhases() {
        let strategy = tradingSystem.strategies[tradingEngine.current.strategy.index.value]

        let openStage = strategy.openStage
        let manageStage = strategy.manageStage
        let parentNode
        let j = tradingEngine.current.strategy.index.value
        let p

        if (tradingEngine.current.position.takeProfit.takeProfitStage.value === 'Open Stage' && openStage !== undefined) {
            if (openStage.initialDefinition !== undefined) {
                if (openStage.initialDefinition.takeProfit !== undefined) {
                    parentNode = openStage.initialDefinition
                    p = tradingEngine.current.position.takeProfit.takeProfitPhase.value
                }
            }
        }

        if (tradingEngine.current.position.takeProfit.takeProfitStage.value === 'Manage Stage' && manageStage !== undefined) {
            if (manageStage.takeProfit !== undefined) {
                parentNode = manageStage
                p = tradingEngine.current.position.takeProfit.takeProfitPhase.value - 1
            }
        }

        if (parentNode !== undefined) {
            let phase = parentNode.takeProfit.phases[p]
            if (phase === undefined) { return } // trying to jump to a phase that does not exists.

            /* Check the next Phase Event. */
            let nextPhaseEvent = phase.nextPhaseEvent
            if (nextPhaseEvent !== undefined) {
                for (let k = 0; k < nextPhaseEvent.situations.length; k++) {
                    let situation = nextPhaseEvent.situations[k]
                    let passed
                    if (situation.conditions.length > 0) {
                        passed = true
                    }

                    for (let m = 0; m < situation.conditions.length; m++) {
                        let condition = situation.conditions[m]
                        let value = false
                        if (conditions.get(condition.id) !== undefined) {
                            value = conditions.get(condition.id).value
                        }

                        if (value === false) { passed = false }
                    }

                    if (passed) {
                        tradingEngine.current.position.takeProfit.takeProfitPhase.value++
                        tradingEngine.current.position.takeProfit.takeProfitStage.value = 'Manage Stage'
                        if (tradingEngine.current.position.stopLoss.stopLossPhase.value > 0) {
                            tradingEngine.current.strategy.stageType.value = 'Manage Stage'
                            checkAnnouncements(manageStage, 'Stop')
                        }

                        checkAnnouncements(nextPhaseEvent)
                        return
                    }
                }
            }

            /* Check the Move to Phase Events. */
            for (let n = 0; n < phase.moveToPhaseEvents.length; n++) {
                let moveToPhaseEvent = phase.moveToPhaseEvents[n]
                if (moveToPhaseEvent !== undefined) {
                    for (let k = 0; k < moveToPhaseEvent.situations.length; k++) {
                        let situation = moveToPhaseEvent.situations[k]
                        let passed
                        if (situation.conditions.length > 0) {
                            passed = true
                        }

                        for (let m = 0; m < situation.conditions.length; m++) {

                            let condition = situation.conditions[m]
                            let value = false
                            if (conditions.get(condition.id) !== undefined) {
                                value = conditions.get(condition.id).value
                            }

                            if (value === false) { passed = false }
                        }

                        if (passed) {

                            let moveToPhase = moveToPhaseEvent.referenceParent
                            if (moveToPhase !== undefined) {
                                for (let q = 0; q < parentNode.takeProfit.phases.length; q++) {
                                    if (parentNode.takeProfit.phases[q].id === moveToPhase.id) {
                                        tradingEngine.current.position.takeProfit.takeProfitPhase.value = q + 1
                                    }
                                }
                            } else {
                                moveToPhaseEvent.error = 'This Node needs to reference a Phase.'
                                continue
                            }

                            tradingEngine.current.position.takeProfit.takeProfitStage.value = 'Manage Stage'
                            if (tradingEngine.current.position.stopLoss.stopLossPhase.value > 0) {
                                tradingEngine.current.strategy.stageType.value = 'Manage Stage'
                                checkAnnouncements(manageStage, 'Stop')
                            }

                            checkAnnouncements(moveToPhaseEvent)
                            return
                        }
                    }
                }
            }
        }
    }

    function calculateTakeProfit() {
        let strategy = tradingSystem.strategies[tradingEngine.current.strategy.index.value]
        let openStage = strategy.openStage
        let manageStage = strategy.manageStage
        let phase
        let key

        if (tradingEngine.current.position.takeProfit.takeProfitStage.value === 'Open Stage' && openStage !== undefined) {
            if (openStage.initialDefinition !== undefined) {
                if (openStage.initialDefinition.takeProfit !== undefined) {
                    phase = openStage.initialDefinition.takeProfit.phases[tradingEngine.current.position.takeProfit.takeProfitPhase.value]
                    key = tradingEngine.current.strategy.index.value + '-' + 'openStage' + '-' + 'initialDefinition' + '-' + 'takeProfit' + '-' + (tradingEngine.current.position.takeProfit.takeProfitPhase.value)
                }
            }
        }

        if (tradingEngine.current.position.takeProfit.takeProfitStage.value === 'Manage Stage' && manageStage !== undefined) {
            if (manageStage.takeProfit !== undefined) {
                phase = manageStage.takeProfit.phases[tradingEngine.current.position.takeProfit.takeProfitPhase.value - 1]
                key = tradingEngine.current.strategy.index.value + '-' + 'manageStage' + '-' + 'takeProfit' + '-' + (tradingEngine.current.position.takeProfit.takeProfitPhase.value - 1)
            }
        }

        if (phase !== undefined) {
            if (phase.formula !== undefined) {
                let previousValue = tradingEngine.current.position.stopLoss.value

                tradingEngine.current.position.takeProfit.value = formulas.get(key)

                if (tradingEngine.current.position.takeProfit.value !== previousValue) {
                    checkAnnouncements(phase, tradingEngine.current.position.takeProfit.value)
                }
            }
        }
    }
}
