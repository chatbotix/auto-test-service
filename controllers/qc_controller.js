const qcJob = require('../services/qc/qc_job')
const QcSession = require('../models/qc_session_model')
const log = require('../utils/log')

class qcController {
  async run(req, res) {
    const { lookbackHours, samplePercent } = req.body || {}
    const options = {}
    if (lookbackHours) options.lookbackHours = Number(lookbackHours)
    if (samplePercent) options.samplePercent = Number(samplePercent)
    try {
      const summary = await qcJob.runQcJob(options)
      res.json({ message: 'Success', data: summary })
    } catch (e) {
      log.error({ error: 'Controller: qcController ' + e?.message })
      res.status(500).json({ message: 'Internal Server Error' })
    }
  }

  async result(req, res) {
    const { bot_session_id: botSessionId } = req.params
    try {
      const result = await QcSession.findOne({ bot_session_id: botSessionId }).lean()
      if (!result) return res.status(404).json({ message: 'Data Not Found' })
      res.json({ message: 'Success', data: result })
    } catch (e) {
      log.error({ error: 'Controller: qcController ' + e?.message })
      res.status(500).json({ message: 'Internal Server Error' })
    }
  }
}

module.exports = qcController
