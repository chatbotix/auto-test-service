const express = require('express')
const router = express.Router()
const IntentController  = require('../controllers/intent.controller')
const intentController = new IntentController()

router.post('/intent/test/create', intentController.testCreate)
router.post('/intent/test/status/:session', intentController.testStatus)
router.delete('/intent/test/stop/:session', intentController.testStop)

module.exports = router