const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../..')

// ค่าตั้งของงานตรวจอัตโนมัติที่แสดงในหน้า "ตั้งค่าระบบ" ของ UI (อ่านอย่างเดียว)
// default ต้องตรงกับที่โค้ดแต่ละส่วนใช้จริง
// ห้ามใส่ค่าที่เกี่ยวกับสิทธิ์/บัญชี (token, รหัส DB, service account, GCP project) และไม่บอกที่มาของค่า
// ส่งออกด้วย id กลาง ไม่ส่งชื่อตัวแปร env: [ชื่อ env, id ที่ส่งให้ UI, default]
const GROUPS = [
    {
        id: 'job',
        items: [
            ['QC_JOB_ENABLED', 'jobEnabled', 'false'],
            ['QC_JOB_CRON', 'schedule', '0 * * * *'],
            ['QC_LOOKBACK_HOURS', 'lookbackHours', '1'],
            ['QC_SAMPLE_PERCENT', 'samplePercent', '10'],
            ['QC_MIN_DURATION_SECONDS', 'minDurationSeconds', '0'],
            ['QC_CONCURRENCY', 'concurrency', '3'],
            ['QC_MAX_RETRY', 'maxRetry', '2'],
            ['QC_PROMPT_FILE', 'promptFile', 'prompts/qc_judge.txt'],
            ['QC_SCHEMA_FILE', 'schemaFile', 'prompts/qc_result.schema.json'],
        ],
    },
    {
        id: 'gemini',
        items: [
            ['GCP_LOCATION', 'region', 'global'],
            ['GEMINI_MODEL', 'model', 'gemini-2.5-flash'],
            ['GEMINI_TEMPERATURE', 'temperature', '0'],
        ],
    },
]

const read = (key, fallback) => {
    const value = String(process.env[key] ?? '').trim()
    return value === '' ? fallback : value
}

const fileExists = (relative) => {
    try {
        return fs.statSync(path.resolve(ROOT, relative)).isFile()
    } catch {
        return false
    }
}

const FILE_IDS = new Set(['promptFile', 'schemaFile'])

const getQcConfig = () => ({
    groups: GROUPS.map((group) => ({
        id: group.id,
        items: group.items.map(([envKey, id, fallback]) => {
            const value = read(envKey, fallback)
            // ไฟล์ prompt/schema: บอกแค่ว่ามีอยู่จริงไหม ไม่ส่งเนื้อหาไฟล์
            return FILE_IDS.has(id) ? { id, value, exists: fileExists(value) } : { id, value }
        }),
    })),
})

module.exports = { getQcConfig }
