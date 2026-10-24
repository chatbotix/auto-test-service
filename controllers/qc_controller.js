const Joi = require('joi')
const qcJob = require('../services/qc/qc_job')
const { listQcSessions } = require('../services/qc/qc_session_service')
const { getQcConfig } = require('../services/qc/qc_config')
const QcSession = require('../models/qc_session_model')
const log = require('../utils/log')

const listSchema = Joi.object({
  start: Joi.date().iso().required(),
  end: Joi.date().iso().min(Joi.ref('start')).default(() => new Date()),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('DONE', 'FAILED'),
  problem: Joi.string()
    .valid('NEEDS_REVIEW', 'NONE', 'STT_ERROR', 'BOT_LOGIC_FAIL', 'NLU_MISCLASSIFICATION', 'POOR_UX', 'TTS_STREAMING_FAIL', 'HIGH_LATENCY')
    .allow(''),
})

// ไม่ส่งค่าไหนมา ใช้ค่าจาก env ของ job
const runSchema = Joi.object({
  lookbackHours: Joi.number().positive(),
  samplePercent: Joi.number().greater(0).max(100),
  minDurationSeconds: Joi.number().min(0),
})

class qcController {
  async run(req, res) {
    const { error, value: options } = runSchema.validate(req.body || {})
    if (error) return res.status(400).json({ message: error.details[0].message })
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

  // ค่าตั้งของงานตรวจ (อ่านอย่างเดียว ไม่มีค่าลับ) สำหรับหน้า "ระบบ"
  async config(req, res) {
    try {
      res.json({ message: 'Success', data: getQcConfig() })
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
