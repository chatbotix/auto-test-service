const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { GoogleGenAI } = require('@google/genai')
const {
    SERVICE_ACCOUNT_FILE = 'service-account.json',
    GCP_PROJECT_ID,
    GCP_LOCATION = 'global',
    GEMINI_MODEL = 'gemini-2.5-flash',
    GEMINI_TEMPERATURE = '0',
    QC_PROMPT_FILE = 'prompts/qc_judge.txt',
    QC_SCHEMA_FILE = 'prompts/qc_result.schema.json',
} = process.env

const ROOT = path.join(__dirname, '..')
const keyFile = path.join(ROOT, 'key', SERVICE_ACCOUNT_FILE)
let client = null
let prompt = null
let schema = null

const getClient = () => {
    if (!client) {
        const project = GCP_PROJECT_ID || JSON.parse(fs.readFileSync(keyFile, 'utf8')).project_id
        client = new GoogleGenAI({
            vertexai: true,
            project,
            location: GCP_LOCATION,
            googleAuthOptions: { keyFile, scopes: ['https://www.googleapis.com/auth/cloud-platform'] },
        })
    }
    return client
}

const loadPrompt = () => {
    if (!prompt) prompt = fs.readFileSync(path.resolve(ROOT, QC_PROMPT_FILE), 'utf8')
    if (!schema) schema = JSON.parse(fs.readFileSync(path.resolve(ROOT, QC_SCHEMA_FILE), 'utf8'))
    return { prompt, schema }
}

const nowText = () =>
    new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok', hour12: false }) + ' (Asia/Bangkok)'

// ส่ง transcript + ไฟล์เสียงใน GCS ให้ Gemini ประเมิน แล้วคืน JSON ตาม schema
const evaluate = async ({ transcript, audioUri, mimeType = 'audio/wav' }) => {
    const { prompt, schema } = loadPrompt()
    const response = await getClient().models.generateContent({
        model: GEMINI_MODEL,
        contents: [
            {
                role: 'user',
                parts: [
                    { text: `Current datetime: ${nowText()}\n\nText transcript:\n${transcript}` },
                    { fileData: { fileUri: audioUri, mimeType } },
                ],
            },
        ],
        config: {
            systemInstruction: prompt,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            temperature: Number(GEMINI_TEMPERATURE),
        },
    })
    if (!response.text) {
        throw new Error(`gemini_api: empty response (finishReason=${response.candidates?.[0]?.finishReason})`)
    }
    return JSON.parse(response.text)
}

module.exports = { evaluate, model: GEMINI_MODEL }
