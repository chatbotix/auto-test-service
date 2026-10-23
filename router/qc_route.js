const express = require('express')
const router = express.Router()
const QcController = require('../controllers/qc_controller')
const qcController = new QcController()

router.post('/qc/run', qcController.run)
router.get('/qc/results/:bot_session_id', qcController.result)

module.exports = router
