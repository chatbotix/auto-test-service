const mongoose = require('mongoose')
const { QC_LOOKBACK_MINUTES = '60', QC_SAMPLE_PERCENT = '10' } = process.env

// สุ่ม session ที่จบแล้วย้อนหลัง N นาที ตาม % ที่กำหนด (count 1 ครั้ง + $sample ใน aggregate)
const sampleEndedSessions = async ({
    lookbackMinutes = Number(QC_LOOKBACK_MINUTES),
    samplePercent = Number(QC_SAMPLE_PERCENT),
    now = new Date(),
} = {}) => {
    const sessions = mongoose.connection.db.collection('sessions')
    const match = {
        created_at: { $gte: new Date(now.getTime() - lookbackMinutes * 60 * 1000) },
        is_end_session: true,
        call_recording_url: { $nin: [null, ''] },
    }

    const total = await sessions.countDocuments(match)
    const size = Math.ceil((total * samplePercent) / 100)
    if (size === 0) return { total, docs: [] }

    const docs = await sessions
        .aggregate(
            [
                { $match: match },
                { $sample: { size } },
                {
                    $project: {
                        bot_session_id: 1,
                        call_recording_url: 1,
                        'bot_session.conversations': 1,
                        'payload.ani': 1,
                        created_at: 1,
                        duration: 1,
                    },
                },
            ],
            { allowDiskUse: true },
        )
        .toArray()

    return { total, docs }
}

module.exports = { sampleEndedSessions }
