const path = require('path')
require('dotenv').config({path: path.join(__dirname, '.env')})
const { PORT = '3000' } = process.env
const log = require('./utils/log')
const express = require('express')
const app = express()

require('./setup/index')(app)

app.listen(PORT, () => {
    log.info(`Server is running on port ${PORT}`)
})