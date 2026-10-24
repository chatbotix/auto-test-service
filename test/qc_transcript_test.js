const { expect } = require('chai')
const { buildTranscript, toGsUri } = require('../services/qc/transcript')

const session = {
    bot_session_id: '20261022000064',
    payload: { ani: '201' },
    bot_session: {
        conversations: [
            { sender: 'bot', payload: { audios: [{ type: 'tts', text: 'สวัสดีค่ะ มะลิพร้อมดูแลคุณค่ะ' }] } },
            { sender: 'customer', payload: { utterance: null } },
            {
                sender: 'bot',
                payload: {
                    audios: [
                        { type: 'tts', text: 'พูดเรื่องที่ต้องการ  ||| เช่น เช็กแพ็กเกจค่ะ' },
                        { type: 'file', path: 'beep/Beep_tone_53.wav', transcription: '' },
                    ],
                },
            },
            { sender: 'customer', payload: { utterance: 'ซื้อแพ็กเกจเสริมบริการโรมมิ่ง' } },
            { sender: 'customer', payload: { utterance: '' } },
            { sender: 'bot', payload: { action: 'disconnect' } },
        ],
    },
}

describe('qc transcript', () => {
    it('builds Bot / ani lines with NO-INPUT and skips non-tts bot turns', () => {
        expect(buildTranscript(session)).to.equal(
            [
                'Bot: สวัสดีค่ะ มะลิพร้อมดูแลคุณค่ะ',
                '201: ==== NO-INPUT ====',
                'Bot: พูดเรื่องที่ต้องการ เช่น เช็กแพ็กเกจค่ะ',
                '201: ซื้อแพ็กเกจเสริมบริการโรมมิ่ง',
                '201: ==== NO-INPUT ====',
            ].join('\n'),
        )
    })

    it('falls back to Customer label without ani', () => {
        const noAni = { ...session, payload: {} }
        expect(buildTranscript(noAni).split('\n')[1]).to.equal('Customer: ==== NO-INPUT ====')
    })

    it('converts storage url to gs uri', () => {
        expect(
            toGsUri(
                'https://storage.googleapis.com/mari-reborn-dev/utterance/2026/10/22/call-20261022000064-1792648572254-306562365.wav',
            ),
        ).to.equal('gs://mari-reborn-dev/utterance/2026/10/22/call-20261022000064-1792648572254-306562365.wav')
        expect(toGsUri('gs://b/a.wav')).to.equal('gs://b/a.wav')
        expect(() => toGsUri('http://10.0.0.1/a.wav')).to.throw()
    })
})

describe('qc transcript timestamps', () => {
    const start = '2026-10-21T16:50:16.900Z'
    const at = (s) => new Date(new Date(start).getTime() + s * 1000).toISOString()
    const session = {
        created_at: start,
        payload: { ani: '201' },
        bot_session: {
            conversations: [
                { conversation_id: 'g', sender: 'bot', payload: { action: 'none', audios: [{ type: 'tts', text: 'สวัสดีค่ะ' }] } },
                { conversation_id: 'h', sender: 'customer', payload: { utterance: null } },
                { conversation_id: 'h', sender: 'bot', payload: { action: 'continue', audios: [{ type: 'tts', text: 'พูดได้เลยค่ะ' }] } },
                { conversation_id: 'i', sender: 'customer', payload: { utterance: 'สอบถามสัญญาณโทร' } },
                { conversation_id: 'i', sender: 'bot', payload: { action: 'continue', audios: [{ type: 'tts', text: 'ได้ค่ะ' }] } },
                { conversation_id: 'j', sender: 'customer', payload: { utterance: null } },
                { conversation_id: 'j', sender: 'bot', payload: { action: 'disconnect' } },
            ],
        },
        conversations: [
            { conversation_id: 'g', sender: 'bot', message: { utterance: 'สวัสดีค่ะ' }, created_at: at(2.5) },
            { conversation_id: 'h', sender: 'bot', message: { utterance: 'พูดได้เลยค่ะ' }, created_at: at(6.4) },
            { conversation_id: 'i', sender: 'customer', message: { utterance: 'สอบถามสัญญาณโทร' }, created_at: at(19.9), listened_at: at(18.2) },
            { conversation_id: 'i', sender: 'bot', message: { utterance: 'ได้ค่ะ' }, created_at: at(41.8) },
        ],
    }

    it('adds [mm:ss] at line end, [after mm:ss] for NO-INPUT, and skips the non-listening turn', () => {
        expect(buildTranscript(session)).to.equal(
            [
                'Bot: สวัสดีค่ะ  [00:03]',
                'Bot: พูดได้เลยค่ะ  [00:06]',
                '201: สอบถามสัญญาณโทร  [00:18]',
                'Bot: ได้ค่ะ  [00:42]',
                '201: ==== NO-INPUT ====  [after 00:42]',
            ].join('\n'),
        )
    })
})
