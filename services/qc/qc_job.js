const cron = require('node-cron')
const log = require('../../utils/log')
const gemini = require('../../api/gemini_api')
const QcSession = require('../../models/qc_session_model')
const { sampleEndedSessions } = require('./session_repo')
const { buildTranscriptWithTurns, toGsUri } = require('./transcript')
const { checkAudio } = require('./audio_check')
const { findTurnMismatch } = require('./turn_check')
const { isRetryable, backoffDelayMs } = require('./retry_policy')
const {
    QC_JOB_ENABLED = 'false',
    QC_JOB_CRON = '0 * * * *',
    QC_CONCURRENCY = '3',
    QC_MAX_RETRY = '2',
} = process.env

let running = false

const evaluateWithRetry = async (input) => {
    const maxAttempts = Number(QC_MAX_RETRY) + 1
    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let output
        try {
            output = await gemini.evaluate(input)
        } catch (e) {
            // retry เฉพาะ error จากการเรียก Gemini ที่ลองใหม่แล้วมีโอกาสผ่าน (network, timeout, quota, 5xx, response ว่าง)
            lastError = e
            const retryable = isRetryable(e)
            log.warn({ attempt, status: e.status, retryable, error: e.message }, 'QC: gemini evaluate failed')
            if (!retryable) {
                e.attempts = attempt
                throw e
            }
            if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, backoffDelayMs(attempt, e)))
            continue
        }
        // นับ turn ไม่ตรง (เช่นเอาบรรทัด Bot มาเป็น turn ลูกค้า): ไม่ retry เพื่อประหยัด token, บันทึกเป็น FAILED แทนผลที่ผิด
        const mismatch = findTurnMismatch(output.result, input.customerTurns)
        if (mismatch) {
            const error = new Error(`turn check failed: ${mismatch}`)
            error.attempts = attempt
            throw error
        }
        return { ...output, attempts: attempt }
    }
    lastError.attempts = maxAttempts
    throw lastError
}

const evaluateSession = async (session, jobRunAt) => {
    const base = {
        session_id: session._id,
        call_recording_url: session.call_recording_url,
        call_created_at: session.created_at,
        model: gemini.model,
        job_run_at: jobRunAt,
    }
    let update
    try {
        const { transcript, customerTurns } = buildTranscriptWithTurns(session)
        base.transcript = transcript
        const { result, usage, attempts } = await evaluateWithRetry({
            transcript,
            customerTurns,
            audioUri: toGsUri(session.call_recording_url),
        })
        const audioCheck = checkAudio({ audioTokens: usage.audio_tokens, callDurationSeconds: session.duration })
        if (audioCheck.status !== 'OK') {
            log.warn({ bot_session_id: session.bot_session_id, audio_check: audioCheck }, 'QC: audio check flagged')
        }
        update = {
            ...base,
            status: 'DONE',
            qc_result: result,
            usage,
            audio_check: audioCheck,
            error: null,
            attempts,
        }
    } catch (e) {
        update = { ...base, status: 'FAILED', error: e.message, attempts: e.attempts || 1 }
    }
    await QcSession.findOneAndUpdate({ bot_session_id: session.bot_session_id }, update, { upsert: true })
    return update.status
}

// รัน worker พร้อมกันตาม QC_CONCURRENCY
const runPool = async (items, worker) => {
    const results = []
    let index = 0
    const next = async () => {
        while (index < items.length) {
            const item = items[index++]
            results.push(await worker(item))
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, Number(QC_CONCURRENCY)) }, next))
    return results
}

const runQcJob = async (options = {}) => {
    if (running) {
        log.warn('QC: previous run still in progress, skip')
        return { skippedRun: true }
    }
    running = true
    const jobRunAt = new Date()
    try {
        const { total, docs } = await sampleEndedSessions({ ...options, now: jobRunAt })
        const ids = docs.map((doc) => doc.bot_session_id)
        const done = await QcSession.find({ bot_session_id: { $in: ids }, status: 'DONE' }).distinct('bot_session_id')
        const doneSet = new Set(done)
        const todo = docs.filter((doc) => doc.bot_session_id && !doneSet.has(doc.bot_session_id))

        const statuses = await runPool(todo, (session) => evaluateSession(session, jobRunAt))
        const summary = {
            total,
            sampled: docs.length,
            skipped: docs.length - todo.length,
            done: statuses.filter((s) => s === 'DONE').length,
            failed: statuses.filter((s) => s === 'FAILED').length,
            durationMs: Date.now() - jobRunAt.getTime(),
        }
        log.info(summary, 'QC: job finished')
        return summary
    } catch (e) {
        log.error(e, 'QC: job failed')
        throw e
    } finally {
        running = false
    }
}

const start = () => {
    if (QC_JOB_ENABLED !== 'true') {
        log.info('QC: job disabled (QC_JOB_ENABLED != true)')
        return
    }
    cron.schedule(QC_JOB_CRON, () => runQcJob().catch(() => {}), { timezone: 'Asia/Bangkok' })
    log.info(`QC: job scheduled "${QC_JOB_CRON}"`)
}

module.exports = { start, runQcJob, evaluateSession, evaluateWithRetry }
