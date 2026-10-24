const squash = (text = '') => String(text).replace(/\s+/g, '')

// ตรวจว่า Gemini ประเมิน turn ลูกค้าตรงกับรายการที่โค้ดนับให้ (จำนวน ลำดับ ข้อความ)
// กันกรณีเอาบรรทัด Bot มานับเป็น turn ลูกค้า; คืนข้อความปัญหา หรือ null ถ้าถูกต้อง
const findTurnMismatch = (result = {}, customerTurns = []) => {
    const rows = result.stt_discrepancy_report || []
    const total = result.stt_accuracy_metrics?.total_turns
    if (rows.length !== customerTurns.length || total !== customerTurns.length) {
        return `expected ${customerTurns.length} customer turns, got report=${rows.length} total_turns=${total}`
    }
    for (let i = 0; i < customerTurns.length; i++) {
        const expected = customerTurns[i]
        const row = rows[i]
        if (row.turn_id !== expected.turn_id || squash(row.system_transcript) !== squash(expected.text)) {
            return `turn ${expected.turn_id} mismatch: got "${row.system_transcript}"`
        }
    }
    return null
}

module.exports = { findTurnMismatch }
