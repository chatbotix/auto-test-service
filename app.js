const path = require('path')
require('dotenv').config({path: path.join(__dirname, '.env')})
const { PORT = '3000' } = process.env
const log = require('./utils/log')
const mongo = require('./db/mongo')
const express = require('express')
const app = express()

require('./setup/index')(app)

const shutdown = async () => {
    await mongo.disconnect()
    process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

;(async () => {
    try {
        await mongo.connect()
        await require('./models/qc_session_model').init()
    } catch (err) {
        log.error(err, 'Failed to connect MongoDB')
        process.exit(1)
    }
    require('./services/qc/qc_job').start()
    app.listen(PORT, () => {
        log.info(`Server is running on port ${PORT}`)
    })
})()
