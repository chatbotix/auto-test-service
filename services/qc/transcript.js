const { buildConversationTurns } = require('./conversation_turns')

const NO_INPUT = '==== NO-INPUT ===='

const mmss = (seconds) => {
    const s = Math.max(0, Math.round(seconds))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// conversations ชั้นนอกของ session -> รูปที่ buildConversationTurns ใช้
const normalizeTopLevel = (conversations = []) =>
    conversations.map((c) => ({
        conversation_id: c.conversation_id,
        sender: c.sender,
        utterance: c.message?.utterance,
        audios: c.message?.audios,
        created_at: c.created_at,
        listened_at: c.listened_at,
    }))

// แปลงสายเป็นบรรทัด "Bot: ..." / "{ani}: ..." ตามลำดับ turn กลาง (buildConversationTurns)
// ต่อท้ายด้วยเวลาจากต้นสาย [mm:ss] ให้ Gemini เทียบกับเสียงได้; NO-INPUT ใช้ [after mm:ss]
// เวลาไว้ท้ายบรรทัด เพราะ prompt ใช้ "ตัวเลข + colon ต้นบรรทัด" ระบุว่าเป็นลูกค้า
const buildTranscript = (session = {}) => {
    const customerLabel = session.payload?.ani || 'Customer'
    const callStart = session.created_at ? new Date(session.created_at).getTime() : null
    const stamp = (date, prefix = '') =>
        callStart && date ? `  [${prefix}${mmss((date.getTime() - callStart) / 1000)}]` : ''

    const turns = buildConversationTurns(
        session.bot_session?.conversations || [],
        normalizeTopLevel(session.conversations),
    )
    return turns
        .map((t) =>
            t.sender === 'bot'
                ? `Bot: ${t.utterance}${stamp(t.at)}`
                : t.no_input
                  ? `${customerLabel}: ${NO_INPUT}${stamp(t.after, 'after ')}`
                  : `${customerLabel}: ${t.utterance}${stamp(t.at)}`,
        )
        .join('\n')
}

// https://storage.googleapis.com/<bucket>/<path> -> gs://<bucket>/<path>
const toGsUri = (url = '') => {
    if (url.startsWith('gs://')) return url
    const match = url.match(/^https?:\/\/storage\.(?:cloud\.)?googleapis\.com\/([^/]+)\/(.+)$/)
    if (!match) throw new Error(`transcript: unsupported recording url: ${url}`)
    return `gs://${match[1]}/${decodeURIComponent(match[2].split('?')[0])}`
}

module.exports = { buildTranscript, toGsUri, NO_INPUT }
