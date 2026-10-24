const botText = (payload = {}) =>
    (payload.audios || [])
        .filter((audio) => audio.type === 'tts' && audio.text)
        .map((audio) => audio.text.replace(/\|\|\|/g, ' ').replace(/\s+/g, ' ').trim())
        .join(' ')

// บอทส่ง action 'none' = พูดอย่างเดียวไม่เปิดรับเสียง (เช่นคำทักทาย)
// bot_session ยังบันทึก customer ว่างตามหลัง แต่ลูกค้าไม่มีจังหวะพูดจริง จึงไม่นับเป็น turn
const isListening = (botTurn) => !botTurn || botTurn.payload?.action !== 'none'

const toDate = (value) => (value ? new Date(value) : null)

// ลำดับ turn กลางที่ทั้ง transcript (ส่ง Gemini) และแท็บบทสนทนาในหน้า UI ใช้ร่วมกัน
// เดินตาม bot_session.conversations และเติมข้อความ/เสียง/เวลาจาก conversations ชั้นนอก (conversation_id + sender)
// topLevelConvs ต้องอยู่ในรูป { conversation_id, sender, utterance, audios, created_at, listened_at }
// at = เวลาที่เริ่มพูด: ลูกค้า = listened_at, บอท = created_at หรือ flowDecisionAt
// after = turn NO-INPUT: เวลาที่บอทเริ่มพูดประโยคก่อนหน้า (ช่วงที่รอฟังอยู่หลังจากนั้น)
const buildConversationTurns = (botSessionConvs = [], topLevelConvs = []) => {
    const topLevel = new Map(topLevelConvs.map((c) => [`${c.conversation_id}:${c.sender}`, c]))
    const turns = []
    let turnId = 0
    let lastBot = null
    let lastBotAt = null

    for (const c of botSessionConvs) {
        const match = topLevel.get(`${c.conversation_id}:${c.sender}`)
        if (c.sender === 'bot') {
            const text = botText(c.payload)
            if (!text) continue // ข้าม turn ที่ไม่มีเสียงพูด เช่น disconnect
            lastBot = c
            lastBotAt = toDate(match?.created_at || c.payload?.flowDecisionAt)
            turns.push({
                conversation_id: c.conversation_id,
                sender: 'bot',
                utterance: match?.utterance?.trim() || text,
                audios: match?.audios || [],
                created_at: match?.created_at || null,
                at: lastBotAt,
            })
        } else if (c.sender === 'customer') {
            const utterance = (match?.utterance || c.payload?.utterance || '').trim()
            if (!utterance && !isListening(lastBot)) continue
            turnId += 1
            turns.push({
                conversation_id: c.conversation_id,
                sender: 'customer',
                turn_id: turnId,
                no_input: !utterance,
                utterance: utterance || null,
                audios: match?.audios || [],
                created_at: match?.created_at || null,
                at: utterance ? toDate(match?.listened_at || match?.created_at) : null,
                after: utterance ? null : lastBotAt,
            })
        }
    }
    return turns
}

module.exports = { buildConversationTurns, botText }
