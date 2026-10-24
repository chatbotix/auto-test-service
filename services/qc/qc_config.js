const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../..')

// ค่าตั้งของงานตรวจอัตโนมัติที่แสดงในหน้า "ระบบ" ของ UI (อ่านอย่างเดียว)
// default ต้องตรงกับที่โค้ดแต่ละส่วนใช้จริง; ห้ามใส่ค่าลับ (token, รหัส DB, เนื้อหา SA key)
const GROUPS = [
    {
        id: 'job',
        items: [
            ['QC_JOB_ENABLED', 'false'],
            ['QC_JOB_CRON', '0 * * * *'],
            ['QC_LOOKBACK_HOURS', '1'],
            ['QC_SAMPLE_PERCENT', '10'],
            ['QC_MIN_DURATION_SECONDS', '0'],
            ['QC_CONCURRENCY', '3'],
            ['QC_MAX_RETRY', '2'],
            ['QC_PROMPT_FILE', 'prompts/qc_judge.txt'],
            ['QC_SCHEMA_FILE', 'prompts/qc_result.schema.json'],
        ],
    },
    {
        id: 'gemini',
        items: [
            ['SERVICE_ACCOUNT_FILE', 'service-account.json'],
            ['GCP_PROJECT_ID', ''],
            ['GCP_LOCATION', 'global'],
            ['GEMINI_MODEL', 'gemini-2.5-flash'],
            ['GEMINI_TEMPERATURE', '0'],
        ],
    },
]

const read = (key, fallback) => {
    const raw = process.env[key]
    const value = raw == null ? '' : String(raw).trim()
    return value === '' ? { value: fallback, source: 'default' } : { value, source: 'env' }
}

const fileExists = (relative) => {
    try {
        return fs.statSync(path.resolve(ROOT, relative)).isFile()
    } catch {
        return false
    }
}

// project ไม่ได้ตั้งใน env: ใช้ project_id จากไฟล์ SA (เหมือน api/gemini_api.js)
const saProjectId = (saFile) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(ROOT, 'key', saFile), 'utf8')).project_id || null
    } catch {
        return null
    }
}

const getQcConfig = () => {
    const groups = GROUPS.map((group) => ({
        id: group.id,
        items: group.items.map(([key, fallback]) => ({ key, ...read(key, fallback) })),
    }))
    const byKey = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.key, i])))

    // ตรวจไฟล์ที่อ้างถึงว่ามีอยู่จริง (ไม่ส่งเนื้อหาไฟล์ออกไป)
    byKey.QC_PROMPT_FILE.exists = fileExists(byKey.QC_PROMPT_FILE.value)
    byKey.QC_SCHEMA_FILE.exists = fileExists(byKey.QC_SCHEMA_FILE.value)
    byKey.SERVICE_ACCOUNT_FILE.exists = fileExists(path.join('key', byKey.SERVICE_ACCOUNT_FILE.value))
    if (byKey.GCP_PROJECT_ID.source === 'default') {
        const fromSa = saProjectId(byKey.SERVICE_ACCOUNT_FILE.value)
        byKey.GCP_PROJECT_ID.value = fromSa || ''
        byKey.GCP_PROJECT_ID.source = fromSa ? 'service-account' : 'missing'
    }
    return { groups }
}

module.exports = { getQcConfig }
