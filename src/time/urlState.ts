const RIYADH_OFFSET_MS = 3 * 3_600_000

export function parseTimeParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('t')
  if (!raw) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw)
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31 || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null
  const ms = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`)
  if (Number.isNaN(ms)) return null
  // Reject overflowed dates such as 2027-02-31.
  return formatLocal(ms).startsWith(`${y}-${mo}-${d}`) ? ms : null
}

function formatLocal(ms: number): string {
  return new Date(ms + RIYADH_OFFSET_MS).toISOString().slice(0, 19)
}

/** Riyadh local time, minute precision (seconds only when non-zero). */
export function formatTimeParam(ms: number): string {
  const full = formatLocal(ms)
  return full.endsWith(':00') ? full.slice(0, 16) : full
}
