const mongoose = require('mongoose')

const qcSessionSchema = new mongoose.Schema(
    {
        bot_session_id: { type: String, required: true, unique: true },
        session_id: { type: mongoose.Schema.Types.ObjectId, index: true },
        call_recording_url: String,
        transcript: String,
        status: { type: String, enum: ['DONE', 'FAILED'], index: true },
        qc_result: mongoose.Schema.Types.Mixed,
        model: String,
        error: String,
        attempts: Number,
        call_created_at: Date,
        job_run_at: Date,
    },
    { collection: 'qc_session', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

module.exports = mongoose.model('QcSession', qcSessionSchema)
