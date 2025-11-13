const log = require("../../utils/log")
const GoogleSheetService = require("../sheet/google_sheet.service")
const googleSheetService = new GoogleSheetService()
const ai = require("../../services/gen_ai/gen_ai.service")
const testSession = require('../../session/session')

class intentService {
   async testCreate(sheetID = '', sessionId, totalSheet = 0) {
        try {
            const limit = 50
            const headerRows = 1
            const footerRows = 1
            const total = (totalSheet - headerRows - footerRows)
            const batch = Math.ceil(total / limit)
            testSession.updateSession(sessionId, {status: 'load_sheet_name' })
            const sheetName = (await googleSheetService.read({sheetID, range: 'Summary!B3'}))?.data?.values?.[0]?.[0]
            const aiNameRange = 'Summary!B1'
            log.info({ message:`📜 Creating test intent for sheetID: ${sheetID},`, sessionId})
            testSession.updateSession(sessionId, {sheetName, status: 'load_ai_name' })
            const aiName  = (await googleSheetService.read({sheetID, range: aiNameRange}))?.data?.values?.[0]?.[0]
            for (let i = 0; i < batch; i++) {
                try {
                    const session = testSession.getSession(sessionId);
                    if (!session || session.stopped) {
                      log.warn({ message: `🛑 Session ${sessionId} stopped at batch ${i}`, sessionId })
                      testSession.updateSession(sessionId, { status: 'stopped' })
                      return;
                    }
                    const intents = []
                    log.info({message:`🔄 Processing batch ${i + 1} of ${batch}`, sessionId})
                    testSession.updateSession(sessionId, {aiName, batch: `${i + 1}/${batch}`, status: 'load_context' })
                    const start = headerRows + 1 + i * limit
                    const end = Math.min(start + limit - 1, total + headerRows)
                    const range = `${sheetName}!A${start}:A${end}`
                    log.info({message:`📥 Loading contexts from range: ${range}`, sessionId})
                    let contexts  = (await googleSheetService.read({sheetID, range: range}))?.data?.values || []
                    contexts = contexts.filter(item => item[0] && item[0].toLowerCase() != 'context' && item[0].toLowerCase() != 'accuracy')
                    let progress = {
                        "current": 0,
                        "total": contexts.length,
                    }
                    testSession.updateSession(sessionId, { status: 'generate_intents', progress })
                    for (const context of contexts) {
                        try {
                            progress.current += 1
                            const intent = await ai.getIntentByContext(context[0] || '', aiName)
                            intents.push({intent})
                            log.info({message:`✅ context: ${context} - Intent: ${intent}`, sessionId})
                        } catch (e) {
                            intents.push({intent: 'error generating intent'})
                            log.error({message: `❌ failed to get intent context: ${context} : ${e.message}`, sessionId})
                        } finally {
                            testSession.updateSession(sessionId, {progress})
                        }
                    }
                    testSession.updateSession(sessionId, {status: 'update_sheet' })
                    const updateRange = `${sheetName}!C${start}`
                    log.info({message:`📤 Updating intents to range: ${updateRange}`, sessionId})
                    const dataUpdate = intents.map(item => [item.intent])
                    await googleSheetService.update({sheetID, range: updateRange, data: dataUpdate})
                } catch (e) {
                    log.error(`error in batch ${i + 1}: ${e.message}`)
                }
            }
            testSession.updateSession(sessionId, {status: 'completed',})
            log.info({message:`🚀 Successfully created test intents for sheetID: ${sheetID}`, sessionId})
        } catch (error) {
            testSession.updateSession(sessionId, {status: 'fail' })
            log.error(`intentService: Failed to create test intent: ${error.message}`)
        }
    }
}

module.exports =  intentService