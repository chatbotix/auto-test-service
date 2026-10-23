const {
    GEMINI_AUDIO_TOKENS_PER_SECOND = '25',
    QC_AUDIO_TOLERANCE_PCT = '20',
    QC_AUDIO_TOLERANCE_MIN_SECONDS = '3',
} = process.env

// เทียบความยาวเสียงที่ Gemini ได้รับ (จาก audio token) กับความยาวสายใน sessions
// status: OK | NO_AUDIO (โมเดลไม่ได้รับเสียง) | DURATION_MISMATCH (ยาวต่างกันเกินเกณฑ์) | NO_DURATION (ไม่มีความยาวสายให้เทียบ)
const checkAudio = ({
    audioTokens = 0,
    callDurationSeconds,
    tokensPerSecond = Number(GEMINI_AUDIO_TOKENS_PER_SECOND),
    tolerancePct = Number(QC_AUDIO_TOLERANCE_PCT),
    toleranceMinSeconds = Number(QC_AUDIO_TOLERANCE_MIN_SECONDS),
} = {}) => {
    const estimated = Math.round((audioTokens / tokensPerSecond) * 10) / 10
    const base = {
        audio_tokens: audioTokens,
        estimated_audio_seconds: estimated,
        call_duration_seconds: callDurationSeconds ?? null,
        diff_seconds: null,
        diff_pct: null,
    }
    if (!audioTokens) return { ...base, status: 'NO_AUDIO' }
    if (!callDurationSeconds) return { ...base, status: 'NO_DURATION' }

    const diff = Math.round((estimated - callDurationSeconds) * 10) / 10
    const diffPct = Math.round((Math.abs(diff) / callDurationSeconds) * 1000) / 10
    // สายสั้นใช้เกณฑ์ขั้นต่ำเป็นวินาที ไม่งั้นต่างกันนิดเดียวก็เกิน %
    const allowed = Math.max((callDurationSeconds * tolerancePct) / 100, toleranceMinSeconds)
    return {
        ...base,
        diff_seconds: diff,
        diff_pct: diffPct,
        status: Math.abs(diff) > allowed ? 'DURATION_MISMATCH' : 'OK',
    }
}

module.exports = { checkAudio }
