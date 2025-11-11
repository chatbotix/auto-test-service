const express = require('express')
const router = express.Router()
const AgenticController  = require('../controllers/agentic.controller')
const agenticController = new AgenticController()

router.post('/agentic/test/create', agenticController.testCreate)
router.post('/agentic/test/status/:session', agenticController.testStatus)
router.delete('/agentic/test/stop/:session', agenticController.testStop)

module.exports = router