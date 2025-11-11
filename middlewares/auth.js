const path = require('path')
require('dotenv').config({path:path.join(__dirname, '../.env')})
const { AUTH_TOKEN  } = process.env

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization']
    if (!authHeader) {
        return res.status(401).json({ message: 'Missing Authorization header' })
    }
    const token = authHeader.split(' ')[1]
    const expectedToken = AUTH_TOKEN
    if (!token || token !== expectedToken) {
        return res.status(403).json({ message: 'Invalid or expired token' })
    }
    next()
}
