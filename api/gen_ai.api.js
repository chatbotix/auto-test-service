const axios = require("axios");
const path = require("path");
require('dotenv').config({path: path.join(__dirname, '../.env')})
const { BACKEND_BASE_URL = '', BACKEND_AUTH = 'api',} = process.env

const req = async ({
  input_message = ``,
  gen_ai_name = ``,
  history = [],
} = {}) => {
  try {
    let data = ({
        input_message,
        gen_ai_name,
        history
      })
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${BACKEND_BASE_URL}/api/gen_ai/test_gen_ai`,
      headers: {
        Authorization: `Bearer ${BACKEND_AUTH}`,
        "Content-Type": "application/json",
      },
      data: data,
    }
    let response = await axios.request(config)
    return response;
  } catch (e) {
    throw new Error(`gen_ai_api: failed to call gen ai api: ${e.message}`)
  }
}

module.exports = { req }