const NO_INPUT = '==== NO-INPUT ===='

const botText = (payload = {}) =>
    (payload.audios || [])
        .filter((audio) => audio.type === 'tts' && audio.text)
        .map((audio) => audio.text.replace(/\|\|\|/g, ' ').replace(/\s+/g, ' ').trim())
        .join(' ')

// แปลง bot_session.conversations เป็นบรรทัด "Bot: ..." / "{ani}: ..." ตามลำดับ
const buildTranscript = (session = {}) => {
    const customerLabel = session.payload?.ani || 'Customer'
    const conversations = session.bot_session?.conversations || []
    const lines = []

    for (const turn of conversations) {
        if (turn.sender === 'bot') {
            const text = botText(turn.payload)
            if (text) lines.push(`Bot: ${text}`)
        } else if (turn.sender === 'customer') {
            const utterance = (turn.payload?.utterance || '').trim()
            lines.push(`${customerLabel}: ${utterance || NO_INPUT}`)
        }
    }
    return lines.join('\n')
}

// https://storage.googleapis.com/<bucket>/<path> -> gs://<bucket>/<path>
const toGsUri = (url = '') => {
    if (url.startsWith('gs://')) return url
    const match = url.match(/^https?:\/\/storage\.(?:cloud\.)?googleapis\.com\/([^/]+)\/(.+)$/)
    if (!match) throw new Error(`transcript: unsupported recording url: ${url}`)
    return `gs://${match[1]}/${decodeURIComponent(match[2].split('?')[0])}`
}

module.exports = { buildTranscript, toGsUri, NO_INPUT }
