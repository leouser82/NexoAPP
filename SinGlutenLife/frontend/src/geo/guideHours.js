const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function plain(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Guides write hours free-form, with thin spaces and stray labels. */
export function hoursLines(hours) {
  const text = String(hours || '')
    .replace(/[\u2000-\u200f\u202f\u00a0]/g, ' ')
    .replace(/descripci[oó]n\s*:?\s*$/i, '')
  const parts = text.includes('\n') ? text.split('\n') : text.split(';')
  return parts
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .filter((line) => line && !/^descripci[oó]n/i.test(line))
}

/** Short label for a card: today's range, nothing when it cannot be told. */
export function todayLine(hours) {
  const today = plain(DAYS[new Date().getDay()])
  const line = hoursLines(hours).find((item) => plain(item).startsWith(today))
  if (!line) return ''
  const range = line.replace(/^[^\-:–]+[\-:–]\s*/, '').trim()
  if (!range || range.length > 34) return ''
  return /cerrado/i.test(range) ? 'Hoy cerrado' : `Hoy ${range}`
}
