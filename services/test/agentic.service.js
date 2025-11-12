const log = require("../../utils/log")
const GoogleSheetService = require("../sheet/google_sheet.service")
const googleSheetService = new GoogleSheetService()
const ai = require("../../services/gen_ai/gen_ai.service")
const testSession = require('../../session/session')

class agenticService {
   async testCreate(sheetID = '', sessionId, sheet = '' , testName = 'AUTO DRIVE') {  
        try {
            const sheetName = sheet
            const aiNameRange = 'Summary!B1'
            log.info({ message:`📜 Creating test agentic for sheetID: ${sheetID},`, sessionId})
            testSession.updateSession(sessionId, {sheetName, status: 'load_ai_name' })
            const aiName  = (await googleSheetService.read({sheetID, range: aiNameRange}))?.data?.values?.[0]?.[0]
            const session = testSession.getSession(sessionId);
            if (!session || session.stopped) {
                      log.warn({ message: `🛑 Session ${sessionId} stopped `, sessionId })
                      testSession.updateSession(sessionId, { status: 'stopped' })
                      return;
                }
            testSession.updateSession(sessionId, {aiName, status: 'load_test_steps' })
            const range = `${sheetName}!B4:C`
            let testSteps  = (await googleSheetService.read({sheetID, range: range}))?.data?.values || []
            testSteps = testSteps.filter(item => item[0] && item[0].toLowerCase() != 'context' && item[0].toLowerCase() != 'accuracy')
            let progress = {
                    "current": 0,
                    "total": testSteps.length,
                    }
            testSession.updateSession(sessionId, { status: 'generate_ai_response', progress })
            const testResult = []
            let history = []
            for (const testStep of testSteps) {
                        try {
                            progress.current += 1
                            const input = testStep[0]
                            const result = await ai.getResultByInput(input || '', aiName, history)
                            testResult.push({input, actually: result.conversation[0].message.utterance})
                            if (result.history.length)  history = result.history
                        } catch (e) {
                            testResult.push({ actually:{ message: 'error generating result'}})
                            log.error({message: `❌ failed to get result input: ${input} : ${e.message}`, sessionId})
                        } finally {
                            testSession.updateSession(sessionId, {progress})
                        }
                    }
                    testSession.updateSession(sessionId, {status: 'compare_faq' })
                    for (let i = 0; i < testResult.length; i++) {
                        try {
                        const input = testResult[i].input
                        const actually = JSON.parse(testResult[i].actually)
                        if (actually.message == 'error generating result') continue;
                        const expected =  JSON.parse(testSteps[i][1])
                        const compareFaqResult = await ai.getIntentByContext(`Question: ${input}\n Expected answer: ${expected.message}\n Actual answer: ${actually.message}`, testName)
                        testResult[i].expected = expected
                        testResult[i].compareFaq = JSON.parse(compareFaqResult)
                    } catch (e) {
                        log.error({message: `❌ failed to compare faq for input: ${input} : ${e.message}`, sessionId})
                    }
                    }
                    testSession.updateSession(sessionId, {status: 'update_sheet' })
                    const updateRange = `${sheetName}!D4`
                    const dataUpdate = testResult.map(item => { return [item.actually, item.compareFaq.result, item.compareFaq.similarity_score, item.compareFaq.reason] })
                    await googleSheetService.update({sheetID, range: updateRange, data: dataUpdate})
               
            testSession.updateSession(sessionId, {status: 'completed'})
            log.info({message:`🚀 Successfully created test agentic for sheetID: ${sheetID}`, sessionId})
        } catch (e) {
            testSession.updateSession(sessionId, {status: 'fail' })
            throw new Error(`agenticService: Failed to create test agentic: ${e.message}, sessionId: ${sessionId}`)
        }
    }
}

module.exports =  agenticService