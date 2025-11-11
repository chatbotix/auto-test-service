const path = require('path')
require('dotenv').config({path: path.join(__dirname, '../.env')})
const express = require('express')
const intentRoutes = require('../router/intent.route')
const pjson = require('../package.json')
const helmet = require('helmet')
const auth = require('../middlewares/auth')
const log = require('../utils/log')
const os = require('os')
const { v4: uuidv4 } = require('uuid')
const { NODE_ENV = 'local' } = process.env
const isProduction = NODE_ENV === 'prod'

module.exports = (app) => {
  app.use((req, res, next) => {
    const uuid = uuidv4()
    const startTime = process.hrtime()
    req.headers['sipheadercallerid'] = req.headers['sipheadercallerid'] || uuid
    const sanitizedHeaders = { ...req.headers }
    // delete sanitizedHeaders['authorization']

    log.info(
      {
        callerId: req.headers.sipheadercallerid,
        method: req.method,
        url: req.originalUrl,
        headers: isProduction ? 'Hidden in production' : sanitizedHeaders,
        body: isProduction ? 'Hidden in production' : req.body,
      },
      'Request',
    )

    const oldSend = res.send
    res.send = function (body) {
      const diff = process.hrtime(startTime)
      const responseTime = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2)
      let parsedBody = body
      try {
        if (typeof body === 'string') {
          parsedBody = JSON.parse(body)
        }
      } catch (e) {}
      log.info(
        {
          callerId: req.headers.sipheadercallerid || uuid,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime: `${responseTime}ms`,
          responseBody: isProduction ? 'Hidden in production' : parsedBody,
        },
        'Response',
      )
      return oldSend.call(this, body)
    }
    next()
  })
  app.use((req, res, next) => {
    auth(req, res, next)
  })
  app.use(helmet())
  app.use((req, res, next) => {
    res.setHeader('X-XSS-Protection', '1; mode=block')
    next()
  })
  app.use((req, res, next) => {
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.header('Access-Control-Allow-Origin', '*')
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, SipHeaderCallerId',
    )
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE')
    next()
  })
  app.use('/version', (req, res) => {
    res.send({
      hostname: os.hostname(),
      service: pjson.name,
      version: pjson.version,
      NODE_ENV: process.env.NODE_ENV,
    })
  })
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use('/api/', intentRoutes)
}
