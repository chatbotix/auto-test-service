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
// คืนทั้ง transcript และรายการ turn ลูกค้าที่โค้ดนับเอง (ใช้บอก Gemini ว่าต้องประเมิน turn ไหน และใช้ตรวจผล)
const buildTranscriptWithTurns = (session = {}) => {
    const customerLabel = session.payload?.ani || 'Customer'
    const callStart = session.created_at ? new Date(session.created_at).getTime() : null
    const stamp = (date, prefix = '') =>
        callStart && date ? `  [${prefix}${mmss((date.getTime() - callStart) / 1000)}]` : ''

    const turns = buildConversationTurns(
        session.bot_session?.conversations || [],
        normalizeTopLevel(session.conversations),
    )
    const transcript = turns
        .map((t) =>
            t.sender === 'bot'
                ? `Bot: ${t.utterance}${stamp(t.at)}`
                : t.no_input
                  ? `${customerLabel}: ${NO_INPUT}${stamp(t.after, 'after ')}`
                  : `${customerLabel}: ${t.utterance}${stamp(t.at)}`,
        )
        .join('\n')
    const customerTurns = turns
        .filter((t) => t.sender === 'customer')
        .map((t) => ({ turn_id: t.turn_id, speaker: customerLabel, text: t.no_input ? NO_INPUT : t.utterance }))
    return { transcript, customerTurns }
}

const buildTranscript = (session = {}) => buildTranscriptWithTurns(session).transcript

// https://storage.googleapis.com/<bucket>/<path> -> gs://<bucket>/<path>
const toGsUri = (url = '') => {
    if (url.startsWith('gs://')) return url
    const match = url.match(/^https?:\/\/storage\.(?:cloud\.)?googleapis\.com\/([^/]+)\/(.+)$/)
    if (!match) throw new Error(`transcript: unsupported recording url: ${url}`)
    return `gs://${match[1]}/${decodeURIComponent(match[2].split('?')[0])}`
}

module.exports = { buildTranscript, buildTranscriptWithTurns, toGsUri, NO_INPUT }
