const Joi = require('joi')
const qcJob = require('../services/qc/qc_job')
const { listQcSessions } = require('../services/qc/qc_session_service')
const QcSession = require('../models/qc_session_model')
const log = require('../utils/log')

const listSchema = Joi.object({
  start: Joi.date().iso().required(),
  end: Joi.date().iso().min(Joi.ref('start')).default(() => new Date()),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('DONE', 'FAILED'),
})

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

  async list(req, res) {
    const { error, value } = listSchema.validate(req.body || {})
    if (error) return res.status(400).json({ message: error.details[0].message })
    try {
      const data = await listQcSessions(value)
      res.json({ message: 'Success', data })
    } catch (e) {
      log.error({ error: 'Controller: qcController ' + e?.message })
      res.status(500).json({ message: 'Internal Server Error' })
    }
  }

  async result(req, res) {
    const { bot_session_id: botSessionId } = req.params
    try {
      const result = await QcSession.findOne({ bot_session_id: botSessionId }).select('-error').lean()
      if (!result) return res.status(404).json({ message: 'Data Not Found' })
      res.json({ message: 'Success', data: result })
    } catch (e) {
      log.error({ error: 'Controller: qcController ' + e?.message })
      res.status(500).json({ message: 'Internal Server Error' })
    }
  }
}

module.exports = qcController
