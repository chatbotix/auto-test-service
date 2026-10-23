const cron = require('node-cron')
const log = require('../../utils/log')
const gemini = require('../../api/gemini_api')
const QcResult = require('../../models/qc_result_model')
const { sampleEndedSessions } = require('./session_repo')
const { buildTranscript, toGsUri } = require('./transcript')
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
        try {
            return { result: await gemini.evaluate(input), attempts: attempt }
        } catch (e) {
            lastError = e
            log.warn({ attempt, error: e.message }, 'QC: gemini evaluate failed')
            if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 2000 * attempt))
        }
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
        const transcript = buildTranscript(session)
        base.transcript = transcript
        const { result, attempts } = await evaluateWithRetry({
            transcript,
            audioUri: toGsUri(session.call_recording_url),
        })
        update = {
            ...base,
            status: 'DONE',
            ux_score: result.ux_score,
            primary_root_cause: result.call_metadata?.primary_root_cause,
            result,
            error: null,
            attempts,
        }
    } catch (e) {
        update = { ...base, status: 'FAILED', error: e.message, attempts: e.attempts || 1 }
    }
    await QcResult.findOneAndUpdate({ bot_session_id: session.bot_session_id }, update, { upsert: true })
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
        const done = await QcResult.find({ bot_session_id: { $in: ids }, status: 'DONE' }).distinct('bot_session_id')
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

module.exports = { start, runQcJob }
