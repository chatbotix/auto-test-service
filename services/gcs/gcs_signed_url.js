const path = require('path')
const { Storage } = require('@google-cloud/storage')
const { SERVICE_ACCOUNT_FILE = 'service-account.json', GCS_SIGNED_URL_TTL_MINUTES = '60' } = process.env

let storage = null
const getStorage = () => {
    if (!storage) storage = new Storage({ keyFilename: path.join(__dirname, '../..', 'key', SERVICE_ACCOUNT_FILE) })
    return storage
}

const GCS_URL = /^https?:\/\/storage\.(?:cloud\.)?googleapis\.com\/([^/]+)\/([^?]+)/

// bucket เป็น private: แปลงลิงก์ GCS เป็น signed URL (v4) ให้ browser เล่นเสียงได้ชั่วคราว
// ลิงก์ที่ไม่ใช่ GCS คืนค่าเดิม
const toSignedUrl = async (url) => {
    const match = (url || '').match(GCS_URL)
    if (!match) return url
    const [, bucket, objectPath] = match
    const [signed] = await getStorage()
        .bucket(bucket)
        .file(decodeURIComponent(objectPath))
        .getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + Number(GCS_SIGNED_URL_TTL_MINUTES) * 60 * 1000,
        })
    return signed
}

module.exports = { toSignedUrl }
