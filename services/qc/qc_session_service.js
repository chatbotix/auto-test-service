const QcSession = require('../../models/qc_session_model')
const log = require('../../utils/log')
const { toSignedUrl } = require('../gcs/gcs_signed_url')

// เซ็นลิงก์เสียงทั้งสายและเสียงลูกค้าแต่ละประโยค ถ้าเซ็นไม่ได้ให้หน้า list ยังใช้ได้
const withPlayUrls = async (doc) => {
    try {
        const [callUrl, conversations] = await Promise.all([
            toSignedUrl(doc.call_recording_url),
            Promise.all(
                doc.conversations.map(async (c) => ({
                    ...c,
                    audios: await Promise.all((c.audios || []).map(toSignedUrl)),
                })),
            ),
        ])
        return { ...doc, call_recording_play_url: callUrl, conversations }
    } catch (e) {
        log.warn({ bot_session_id: doc.bot_session_id, error: e.message }, 'QC: sign audio url failed')
        return { ...doc, call_recording_play_url: null }
    }
}

// ดึง qc_session ตามช่วงเวลาโทร แบบแบ่งหน้า แล้ว join conversations จาก sessions ด้วย session_id
const listQcSessions = async ({ start, end, page = 1, limit = 20, status } = {}) => {
    const match = { call_created_at: { $gte: start, $lte: end } }
    if (status) match.status = status

    const [{ docs, total }] = await QcSession.aggregate([
        { $match: match },
        {
            $facet: {
                total: [{ $count: 'count' }],
                docs: [
                    { $sort: { call_created_at: -1, _id: -1 } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'sessions',
                            localField: 'session_id',
                            foreignField: '_id',
                            pipeline: [
                                {
                                    $project: {
                                        _id: 0,
                                        direction: 1,
                                        duration: 1,
                                        conversations: {
                                            $map: {
                                                input: { $ifNull: ['$conversations', []] },
                                                as: 'c',
                                                in: {
                                                    conversation_id: '$$c.conversation_id',
                                                    sender: '$$c.sender',
                                                    utterance: '$$c.message.utterance',
                                                    audios: '$$c.message.audios',
                                                    created_at: '$$c.created_at',
                                                },
                                            },
                                        },
                                    },
                                },
                            ],
                            as: 'session',
                        },
                    },
                    { $set: { session: { $first: '$session' } } },
                    {
                        $project: {
                            _id: 0,
                            bot_session_id: 1,
                            session_id: 1,
                            call_created_at: 1,
                            call_recording_url: 1,
                            direction: '$session.direction',
                            duration: '$session.duration',
                            status: 1,
                            model: 1,
                            error: 1,
                            qc_result: 1,
                            conversations: { $ifNull: ['$session.conversations', []] },
                            job_run_at: 1,
                        },
                    },
                ],
            },
        },
        { $project: { docs: 1, total: { $ifNull: [{ $first: '$total.count' }, 0] } } },
    ])

    return {
        docs: await Promise.all(docs.map(withPlayUrls)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    }
}

module.exports = { listQcSessions }
