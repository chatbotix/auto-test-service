const QcSession = require('../../models/qc_session_model')
const log = require('../../utils/log')
const { toSignedUrl } = require('../gcs/gcs_signed_url')
const { buildConversationTurns } = require('./conversation_turns')

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

// เรียงบทสนทนาตาม turn เดียวกับแท็บ STT; ข้อมูลเก่าที่ไม่มี bot_session ใช้ conversations ชั้นนอกตามเดิม
const toUiConversations = ({ bot_conversations: botConversations, ...doc }) =>
    botConversations.length
        ? { ...doc, conversations: buildConversationTurns(botConversations, doc.conversations) }
        : doc

const MISS_CATEGORIES = ['MISSING_CAPTURE', 'CRITICAL_MISHEARING']
const reportRows = { $ifNull: ['$qc_result.stt_discrepancy_report', []] }
const missRows = { $filter: { input: reportRows, as: 'r', cond: { $in: ['$$r.error_category', MISS_CATEGORIES] } } }
const hasMiss = { $gt: [{ $size: missRows }, 0] }

// สายที่ทีม QC ควรเปิดดู (ต้องตรงกับ needsReview ฝั่ง UI): ตรวจไม่สำเร็จ, คะแนน <= 2, หรือบอทได้ยินผิด
const needsReview = {
    $or: [{ $eq: ['$status', 'FAILED'] }, { $lte: [{ $ifNull: ['$qc_result.ux_score', 5] }, 2] }, hasMiss],
}

// ตัวกรองตามปัญหา: NEEDS_REVIEW หรือรหัส primary_root_cause
const problemMatch = (problem) => {
    if (!problem) return {}
    if (problem === 'NEEDS_REVIEW') return { $expr: needsReview }
    return { 'qc_result.call_metadata.primary_root_cause': problem }
}

const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } })

// สรุปทั้งช่วงเวลา (ไม่ขึ้นกับหน้า และไม่ขึ้นกับตัวกรองปัญหา) ให้ทีม QC เห็นภาพรวมและเลือกดูทีละเรื่อง
const summaryFacets = {
    overview: [
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                failed: countIf({ $eq: ['$status', 'FAILED'] }),
                avgScore: { $avg: '$qc_result.ux_score' },
                needsReview: countIf(needsReview),
                misheardCalls: countIf(hasMiss),
                misheardTimes: { $sum: { $size: missRows } },
                negativeEnd: countIf({ $eq: ['$qc_result.sentiment_analytics.final_sentiment', 'NEGATIVE'] }),
                good: countIf({ $gte: ['$qc_result.ux_score', 4] }),
                fair: countIf({ $eq: ['$qc_result.ux_score', 3] }),
                poor: countIf({ $and: [{ $ne: ['$qc_result.ux_score', null] }, { $lte: ['$qc_result.ux_score', 2] }] }),
            },
        },
    ],
    byProblem: [
        { $match: { status: 'DONE' } },
        { $group: { _id: '$qc_result.call_metadata.primary_root_cause', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
    ],
}

const toSummary = ({ overview, byProblem }) => {
    const o = overview[0] || {}
    return {
        total: o.total || 0,
        failed: o.failed || 0,
        avgScore: o.avgScore == null ? null : Math.round(o.avgScore * 10) / 10,
        needsReview: o.needsReview || 0,
        misheardCalls: o.misheardCalls || 0,
        misheardTimes: o.misheardTimes || 0,
        negativeEnd: o.negativeEnd || 0,
        scoreBands: { good: o.good || 0, fair: o.fair || 0, poor: o.poor || 0 },
        byProblem: byProblem.filter((p) => p._id).map((p) => ({ code: p._id, count: p.count })),
    }
}

// join ข้อมูลสายจาก sessions และเลือกฟิลด์ที่หน้า UI ใช้ (ใช้ทั้ง list และเปิดสายเดียว)
const uiDocStages = [
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
                                    listened_at: '$$c.listened_at',
                                },
                            },
                        },
                        // ลำดับ turn แบบเดียวกับ transcript (มี turn NO-INPUT) ดึงเฉพาะฟิลด์ที่ใช้
                        bot_conversations: {
                            $map: {
                                input: { $ifNull: ['$bot_session.conversations', []] },
                                as: 'c',
                                in: {
                                    conversation_id: '$$c.conversation_id',
                                    sender: '$$c.sender',
                                    payload: {
                                        utterance: '$$c.payload.utterance',
                                        action: '$$c.payload.action',
                                        flowDecisionAt: '$$c.payload.flowDecisionAt',
                                        audios: {
                                            $map: {
                                                input: { $ifNull: ['$$c.payload.audios', []] },
                                                as: 'a',
                                                in: { type: '$$a.type', text: '$$a.text' },
                                            },
                                        },
                                    },
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
            qc_result: 1,
            audio_check: 1,
            conversations: { $ifNull: ['$session.conversations', []] },
            bot_conversations: { $ifNull: ['$session.bot_conversations', []] },
            job_run_at: 1,
        },
    },
]

// ดึง qc_session ตามช่วงเวลาโทร แบบแบ่งหน้า แล้ว join conversations จาก sessions ด้วย session_id
const listQcSessions = async ({ start, end, page = 1, limit = 20, status, problem } = {}) => {
    const match = { call_created_at: { $gte: start, $lte: end } }
    if (status) match.status = status
    const filtered = problemMatch(problem)

    const [result] = await QcSession.aggregate([
        { $match: match },
        {
            $facet: {
                ...summaryFacets,
                total: [{ $match: filtered }, { $count: 'count' }],
                docs: [
                    { $match: filtered },
                    { $sort: { call_created_at: -1, _id: -1 } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    ...uiDocStages,
                ],
            },
        },
    ])
    const docs = result.docs
    const total = result.total[0]?.count || 0

    return {
        summary: toSummary(result),
        docs: await Promise.all(docs.map(toUiConversations).map(withPlayUrls)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    }
}

// เปิดสายเดียวด้วย bot_session_id (ลิงก์ที่ทีม QC แชร์ให้ทีมพัฒนา) รูปแบบเดียวกับแถวใน list
const getQcSessionDetail = async (botSessionId) => {
    const [doc] = await QcSession.aggregate([{ $match: { bot_session_id: botSessionId } }, ...uiDocStages])
    return doc ? withPlayUrls(toUiConversations(doc)) : null
}

module.exports = { listQcSessions, getQcSessionDetail }
