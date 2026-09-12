import { useState } from 'react'
import { CONTACT, NEED_OPTIONS, SITE } from '../content'

const MAILBOX = SITE.email
const EMPTY_FORM = {
  name: '',
  email: '',
  need: NEED_OPTIONS[0],
  message: '',
}

async function sendBriefing(fields) {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(MAILBOX)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: fields.name,
      email: fields.email,
      need: fields.need,
      message: fields.message,
      _replyto: fields.email,
      _subject: `Briefing: ${fields.need} — ${fields.name}`,
      _template: 'table',
      _captcha: false,
    }),
  })

  const data = await response.json().catch(() => ({}))
  return { response, data }
}

export default function Contact() {
  const [form, setField] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  function onChange(event) {
    const { name, value } = event.target
    setField((current) => ({ ...current, [name]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setSending(true)
    setStatus(CONTACT.sending)

    try {
      const { response, data } = await sendBriefing(form)
      const message = String(data.message || '')
      const failed = String(data.success) === 'false'

      if (failed && /activate|confirm|email|web server/i.test(message)) {
        setStatus(CONTACT.activate)
        return
      }

      if (!response.ok || failed) {
        throw new Error(message || 'send-failed')
      }

      setField(EMPTY_FORM)
      setStatus(CONTACT.sent)
    } catch {
      setStatus(CONTACT.fail)
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contacto" className="contact">
      <div>
        <p className="kicker">{CONTACT.kicker}</p>
        <h2>{CONTACT.title}</h2>
        <p>{CONTACT.lead}</p>
        <p className="slots">
          {CONTACT.slotsBefore}
          <strong>{CONTACT.slotsStrong}</strong>
        </p>
      </div>
      <form onSubmit={onSubmit} autoComplete="on">
        <label>
          {CONTACT.name}
          <input
            name="name"
            required
            autoComplete="name"
            placeholder={CONTACT.namePlaceholder}
            value={form.name}
            onChange={onChange}
          />
        </label>
        <label>
          {CONTACT.email}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={CONTACT.emailPlaceholder}
            value={form.email}
            onChange={onChange}
          />
        </label>
        <label>
          {CONTACT.need}
          <select name="need" value={form.need} onChange={onChange}>
            {NEED_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          {CONTACT.message}
          <textarea
            name="message"
            rows="4"
            placeholder={CONTACT.messagePlaceholder}
            value={form.message}
            onChange={onChange}
          />
        </label>
        <button className="btn primary" type="submit" disabled={sending}>
          {sending ? CONTACT.sending : CONTACT.submit}
        </button>
        {status ? <p className="form-note">{status}</p> : null}
      </form>
    </section>
  )
}
