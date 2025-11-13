const IntentService = require('../services/test/intent.service')
const testSession = require('../session/session')
const intentService = new IntentService()
const log = require('../utils/log')
const { v4: uuidv4 } = require('uuid')

class intentController {
  async testCreate(req, res) {
    const { sheetID, total } = req.body
    try {
      if (!total) {return res.status(400).json({ message: 'Bad Request: total is required' }) }
      const sessionId = uuidv4()
      intentService.testCreate(sheetID ,sessionId, total)
      testSession.setSession(sessionId, {sessionId, type: 'intent', sheetID: sheetID, total, status: 'created', stopped: false, createdAt: new Date().toISOString()})
        res.json({
          message: 'Success',
          sessionId: sessionId,
      })
    } catch (e) {
      log.error({
        sessionId: sessionId,
        error: 'Controller: intentController ' + e?.message,
      })
      res.status(500).json({ massage: 'Internal Server Error' })
    }
  }

  async testStatus(req, res) {
    const { session: sessionId } = req.params
    try {
      const results = testSession.getSession(sessionId)
      if (results && Object.keys(results).length > 0) {
        res.json({
          message: 'Success',
          data: results,
        })
      } else {
        res.status(404).json({ message: 'Data Not Found' })
      }
    } catch (e) {
      log.error({
        error: 'Controller: intentController ' + e?.message,
      })
      res.status(500).json({ massage: ' Internal Server Error' })
    }
  }

  async testStop(req, res) {
    const { session: sessionId } = req.params
    try {
      const session = testSession.getSession(sessionId)
      if (session && Object.keys(session).length > 0) {
        testSession.updateSession(sessionId, { stopped: true })
        res.json({
          message: 'Success',
          data: { sessionId, stopped: true },
        })
      } else {
        res.status(404).json({ message: 'Data Not Found' })
      }
    } catch (e) {
      log.error({
        error: 'Controller: intentController ' + e?.message,
      })
      res.status(500).json({ massage: ' Internal Server Error' })
    }
  }

}

module.exports = intentController