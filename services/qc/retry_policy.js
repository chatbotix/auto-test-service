// กติกา retry ตอนเรียก Gemini: retry เฉพาะ error ที่ลองใหม่แล้วมีโอกาสผ่าน และรอนานขึ้นทุกครั้ง

const BASE_DELAY_MS = 2000
// ชน quota (429) ต้องรอนานกว่า error ทั่วไป ไม่อย่างนั้นจะชนซ้ำทันที
const QUOTA_BASE_DELAY_MS = 5000
const MAX_DELAY_MS = 60000

// 408 timeout, 429 quota, 5xx ฝั่ง server: ลองใหม่ได้
// 4xx อื่น (request ผิด, ไม่มีสิทธิ์, หาไฟล์เสียงไม่เจอ): ลองใหม่ก็ผิดเหมือนเดิม
// ไม่มี status (network หลุด, timeout ฝั่งเรา, response ว่าง, JSON เสีย): ลองใหม่ได้
const isRetryable = (error) => {
    const status = Number(error?.status)
    if (!status) return true
    return status === 408 || status === 429 || status >= 500
}

// exponential backoff + jitter: ครั้งที่ 1 รอ ~base, ครั้งที่ 2 ~2×base, ... ไม่เกิน MAX_DELAY_MS
// สุ่มครึ่งหลังของช่วง เพื่อให้หลายสายที่พังพร้อมกันไม่ยิงกลับไปพร้อมกันอีก
const backoffDelayMs = (attempt, error, random = Math.random) => {
    const base = Number(error?.status) === 429 ? QUOTA_BASE_DELAY_MS : BASE_DELAY_MS
    const ceiling = Math.min(MAX_DELAY_MS, base * 2 ** (attempt - 1))
    return Math.round(ceiling / 2 + (random() * ceiling) / 2)
}

module.exports = { isRetryable, backoffDelayMs, MAX_DELAY_MS }
