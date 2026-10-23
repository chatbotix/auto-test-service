const mongoose = require('mongoose')

const qcResultSchema = new mongoose.Schema(
    {
        bot_session_id: { type: String, required: true, unique: true },
        session_id: { type: mongoose.Schema.Types.ObjectId, index: true },
        call_recording_url: String,
        transcript: String,
        status: { type: String, enum: ['DONE', 'FAILED'], index: true },
        ux_score: Number,
        primary_root_cause: String,
        result: mongoose.Schema.Types.Mixed,
        model: String,
        error: String,
        attempts: Number,
        call_created_at: Date,
        job_run_at: Date,
    },
    { collection: 'qc_results', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

module.exports = mongoose.model('QcResult', qcResultSchema)
