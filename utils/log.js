const bunyan = require('bunyan')
const path = require('path')
require('dotenv').config({path: path.join(__dirname, '../../.env')})
const { NODE_ENV = 'local', NAME = 'api', LOG_LEVEL = 'info' } = process.env

const log = bunyan.createLogger({
    name: NAME,
    level: LOG_LEVEL,
    serializers: bunyan.stdSerializers,
})

module.exports = log
