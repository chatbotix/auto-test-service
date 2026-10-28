const { expect } = require('chai')
const { isRetryable, backoffDelayMs, MAX_DELAY_MS } = require('../services/qc/retry_policy')
const gemini = require('../api/gemini_api')
const { evaluateWithRetry } = require('../services/qc/qc_job')

const apiError = (status) => Object.assign(new Error(`status ${status}`), { status })

describe('qc retry policy', () => {
    it('retries quota, timeout and server errors', () => {
        for (const status of [408, 429, 500, 503]) expect(isRetryable(apiError(status)), status).to.equal(true)
    })

    it('retries errors without a status (network, our timeout, empty response)', () => {
        expect(isRetryable(new Error('This operation was aborted'))).to.equal(true)
        expect(isRetryable(new Error('gemini_api: empty response (finishReason=MAX_TOKENS)'))).to.equal(true)
    })

    it('does not retry other client errors', () => {
        for (const status of [400, 401, 403, 404]) expect(isRetryable(apiError(status)), status).to.equal(false)
    })

    it('doubles the wait each attempt and waits longer for quota errors', () => {
        const max = () => 1
        expect(backoffDelayMs(1, new Error('x'), max)).to.equal(2000)
        expect(backoffDelayMs(2, new Error('x'), max)).to.equal(4000)
        expect(backoffDelayMs(1, apiError(429), max)).to.equal(5000)
        expect(backoffDelayMs(2, apiError(429), max)).to.equal(10000)
    })

    it('adds jitter within the upper half and caps the wait', () => {
        expect(backoffDelayMs(1, apiError(429), () => 0)).to.equal(2500)
        expect(backoffDelayMs(20, apiError(429), () => 1)).to.equal(MAX_DELAY_MS)
    })
})

describe('qc evaluateWithRetry', () => {
    const original = gemini.evaluate
    afterEach(() => {
        gemini.evaluate = original
    })

    it('fails fast on a non-retryable error without waiting', async () => {
        let calls = 0
        gemini.evaluate = async () => {
            calls++
            throw apiError(403)
        }
        const error = await evaluateWithRetry({ customerTurns: [] }).catch((e) => e)
        expect(error.status).to.equal(403)
        expect(error.attempts).to.equal(1)
        expect(calls).to.equal(1)
    })
})
