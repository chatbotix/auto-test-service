const getSheetsInstance = require('../../config/googleSheet')

class googleSheetService {
  async read({sheetID = '', range = ''} = {}) {
    try {
      const sheets = await getSheetsInstance()
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetID,
        range: range,
      })
      return response
    } catch (error) {
      throw new Error(`googleSheetService: Failed to read data for google sheet: ${error.message}`)
    }
  }
  
  async update({sheetID = '', range = '', data = []} = {}) {
    try {
      const sheets = await getSheetsInstance()
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: sheetID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: data 
        }
      })
      return response
    } catch (error) {
      throw new Error(`googleSheetService: Failed to write data to google sheet: ${error.message}`)
    }
  }
}

module.exports =  googleSheetService