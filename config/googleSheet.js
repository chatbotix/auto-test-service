const { google } = require('googleapis')
const path = require('path')
let sheetsInstance = null;
const SERVICE_ACCOUNT_FILE = process.env.SERVICE_ACCOUNT_FILE || 'service-account.json'

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..','key', SERVICE_ACCOUNT_FILE),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
})

const getSheetsInstance = async () => {
  if (!sheetsInstance) {
    const client = await auth.getClient()
    sheetsInstance = google.sheets({ version: 'v4', auth: client })
  }
  return sheetsInstance;
}

module.exports = getSheetsInstance