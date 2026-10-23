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
