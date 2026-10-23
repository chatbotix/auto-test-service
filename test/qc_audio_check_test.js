const { expect } = require('chai')
const { checkAudio } = require('../services/qc/audio_check')

const opts = { tokensPerSecond: 25, tolerancePct: 20, toleranceMinSeconds: 3 }

describe('qc audio check', () => {
    it('is OK when audio length matches the call duration', () => {
        const r = checkAudio({ ...opts, audioTokens: 1375, callDurationSeconds: 54 })
        expect(r).to.include({ status: 'OK', estimated_audio_seconds: 55, diff_seconds: 1, diff_pct: 1.9 })
    })

    it('flags NO_AUDIO when the model got no audio tokens', () => {
        expect(checkAudio({ ...opts, audioTokens: 0, callDurationSeconds: 54 }).status).to.equal('NO_AUDIO')
        expect(checkAudio({ ...opts, callDurationSeconds: 54 }).status).to.equal('NO_AUDIO')
    })

    it('flags DURATION_MISMATCH beyond the percent tolerance', () => {
        // 30s ที่ได้รับ vs สาย 54s = ต่าง 24s > 20% (10.8s)
        const r = checkAudio({ ...opts, audioTokens: 750, callDurationSeconds: 54 })
        expect(r).to.include({ status: 'DURATION_MISMATCH', diff_seconds: -24 })
    })

    it('uses the minimum seconds tolerance for short calls', () => {
        // สาย 5s ได้ 7s: ต่าง 2s (40%) แต่ไม่เกิน 3s
        expect(checkAudio({ ...opts, audioTokens: 175, callDurationSeconds: 5 }).status).to.equal('OK')
        // ได้ 9s: ต่าง 4s เกิน 3s
        expect(checkAudio({ ...opts, audioTokens: 225, callDurationSeconds: 5 }).status).to.equal('DURATION_MISMATCH')
    })

    it('returns NO_DURATION when the call has no duration', () => {
        expect(checkAudio({ ...opts, audioTokens: 500 }).status).to.equal('NO_DURATION')
    })
})
