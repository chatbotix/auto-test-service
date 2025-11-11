const aiApi = require('../../api/gen_ai.api') 

const getIntentByContext = async (context = '', ai = '') => {
    const response = await aiApi.req({
        input_message: context,
        gen_ai_name: ai,
      })
    return response.data.conversation[0].message.utterance
}

const getResultByInput = async (context = '', ai = '' , history) => {
    const response = await aiApi.req({
        input_message: context,
        gen_ai_name: ai,
        history
      })
    return response.data
}

module.exports = {
    getIntentByContext,
    getResultByInput
}