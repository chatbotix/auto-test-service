const { expect } = require('chai')
const { buildConversationTurns } = require('../services/qc/conversation_turns')

// โครงเดียวกับ session 20261022000064: bot_session มี customer NO-INPUT, ชั้นนอกไม่มี
const botSession = [
    { conversation_id: 'a', sender: 'bot', payload: { audios: [{ type: 'tts', text: 'สวัสดีค่ะ' }] } },
    { conversation_id: 'b', sender: 'customer', payload: { utterance: null } },
    { conversation_id: 'b', sender: 'bot', payload: { audios: [{ type: 'tts', text: 'พูดเรื่องที่ต้องการ ||| ได้เลยค่ะ' }, { type: 'file' }] } },
    { conversation_id: 'c', sender: 'customer', payload: { utterance: 'ซื้อแพ็กเกจ' } },
    { conversation_id: 'c', sender: 'bot', payload: { audios: [{ type: 'tts', text: 'ได้ค่ะ' }] } },
    { conversation_id: 'd', sender: 'customer', payload: { utterance: null } },
    { conversation_id: 'd', sender: 'bot', payload: {} }, // disconnect
]

const topLevel = [
    { conversation_id: 'a', sender: 'bot', utterance: 'สวัสดีค่ะ', audios: ['ws://x/1'], created_at: 't1' },
    { conversation_id: 'b', sender: 'bot', utterance: 'พูดเรื่องที่ต้องการ ได้เลยค่ะ', audios: ['ws://x/2'], created_at: 't2' },
    { conversation_id: 'c', sender: 'customer', utterance: 'ซื้อแพ็กเกจ', audios: ['https://storage.googleapis.com/b/u.wav'], created_at: 't3' },
    { conversation_id: 'c', sender: 'bot', utterance: 'ได้ค่ะ', audios: ['ws://x/3'], created_at: 't4' },
]

describe('qc conversation turns', () => {
    const turns = buildConversationTurns(botSession, topLevel)
    const customers = turns.filter((t) => t.sender === 'customer')

    it('keeps NO-INPUT customer turns and numbers them like the transcript', () => {
        expect(customers.map((t) => [t.turn_id, t.no_input, t.utterance])).to.deep.equal([
            [1, true, null],
            [2, false, 'ซื้อแพ็กเกจ'],
            [3, true, null],
        ])
    })

    it('keeps transcript order and skips bot turns without speech', () => {
        expect(turns.map((t) => `${t.sender}:${t.conversation_id}`)).to.deep.equal([
            'bot:a',
            'customer:b',
            'bot:b',
            'customer:c',
            'bot:c',
            'customer:d',
        ])
    })

    it('takes text, audio and time from the matching top-level entry', () => {
        const captured = customers[1]
        expect(captured.audios).to.deep.equal(['https://storage.googleapis.com/b/u.wav'])
        expect(captured.created_at).to.equal('t3')
        expect(turns[2]).to.include({ utterance: 'พูดเรื่องที่ต้องการ ได้เลยค่ะ', created_at: 't2' })
    })

    it('falls back to bot TTS text when there is no top-level match', () => {
        const turnsNoTop = buildConversationTurns(botSession, [])
        expect(turnsNoTop[2]).to.include({ utterance: 'พูดเรื่องที่ต้องการ ได้เลยค่ะ', created_at: null })
    })
})

describe('qc conversation turns: listening rule', () => {
    // โครงเดียวกับสาย 20261021000083: คำทักทาย action none ตามด้วย customer ว่าง (บอทไม่ได้ฟัง)
    const convs = [
        { conversation_id: 'g', sender: 'bot', payload: { action: 'none', audios: [{ type: 'tts', text: 'สวัสดีค่ะ' }] } },
        { conversation_id: 'h', sender: 'customer', payload: { utterance: null } },
        { conversation_id: 'h', sender: 'bot', payload: { action: 'continue', audios: [{ type: 'tts', text: 'พูดได้เลยค่ะ' }] } },
        { conversation_id: 'i', sender: 'customer', payload: { utterance: 'สอบถาม' } },
        { conversation_id: 'i', sender: 'bot', payload: { action: 'continue', audios: [{ type: 'tts', text: 'ได้ค่ะ' }] } },
        { conversation_id: 'j', sender: 'customer', payload: { utterance: null } },
        { conversation_id: 'j', sender: 'bot', payload: { action: 'disconnect' } },
    ]

    it('drops the empty customer entry after a bot line that was not listening', () => {
        const customers = buildConversationTurns(convs, []).filter((t) => t.sender === 'customer')
        expect(customers.map((t) => [t.turn_id, t.conversation_id, t.no_input])).to.deep.equal([
            [1, 'i', false],
            [2, 'j', true],
        ])
    })

    it('keeps a spoken customer entry even after a non-listening bot line', () => {
        const spoken = [convs[0], { conversation_id: 'h', sender: 'customer', payload: { utterance: 'ฮัลโหล' } }]
        expect(buildConversationTurns(spoken, []).filter((t) => t.sender === 'customer')).to.have.length(1)
    })
})
