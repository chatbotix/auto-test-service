const { expect } = require('chai')
const { findTurnMismatch } = require('../services/qc/turn_check')
const { buildTranscriptWithTurns } = require('../services/qc/transcript')

const customerTurns = [
    { turn_id: 1, speaker: '201', text: 'ต้องการซื้อแพ็กเกจมือถือ' },
    { turn_id: 2, speaker: '201', text: '==== NO-INPUT ====' },
]
const row = (turn_id, system_transcript) => ({ turn_id, system_transcript })
const result = (rows) => ({ stt_discrepancy_report: rows, stt_accuracy_metrics: { total_turns: rows.length } })

describe('qc turn check', () => {
    it('accepts a report that matches the customer turns (ignoring spaces)', () => {
        const ok = result([row(1, 'ต้องการซื้อ แพ็กเกจมือถือ'), row(2, '==== NO-INPUT ====')])
        expect(findTurnMismatch(ok, customerTurns)).to.equal(null)
    })

    it('rejects bot lines counted as turns (20261022000055 shape)', () => {
        const bad = result([
            row(1, 'สวัสดีค่ะ มะลิพร้อมดูแลคุณค่ะ'),
            row(2, 'พูดเรื่องที่ต้องการใช้บริการกับมะลิ'),
            row(3, 'ต้องการซื้อแพ็กเกจมือถือ'),
            row(4, 'ได้ค่ะ มะลิจะช่วยดูแลเรื่อง'),
            row(5, '==== NO-INPUT ===='),
        ])
        expect(findTurnMismatch(bad, customerTurns)).to.match(/expected 2 customer turns, got report=5/)
    })

    it('rejects a bot line in place of a customer turn even when the count matches', () => {
        const swapped = result([row(1, 'ได้ค่ะ มะลิจะช่วยดูแลเรื่อง'), row(2, '==== NO-INPUT ====')])
        expect(findTurnMismatch(swapped, customerTurns)).to.match(/turn 1 mismatch/)
    })

    it('returns customer turns alongside the transcript', () => {
        const { customerTurns: turns } = buildTranscriptWithTurns({
            payload: { ani: '201' },
            bot_session: {
                conversations: [
                    { conversation_id: 'a', sender: 'bot', payload: { action: 'none', audios: [{ type: 'tts', text: 'สวัสดีค่ะ' }] } },
                    { conversation_id: 'b', sender: 'customer', payload: { utterance: null } },
                    { conversation_id: 'b', sender: 'bot', payload: { action: 'continue', audios: [{ type: 'tts', text: 'พูดได้เลยค่ะ' }] } },
                    { conversation_id: 'c', sender: 'customer', payload: { utterance: 'ต้องการซื้อแพ็กเกจมือถือ' } },
                    { conversation_id: 'c', sender: 'bot', payload: { action: 'continue', audios: [{ type: 'tts', text: 'ได้ค่ะ' }] } },
                    { conversation_id: 'd', sender: 'customer', payload: { utterance: null } },
                ],
            },
        })
        expect(turns).to.deep.equal(customerTurns)
    })
})
