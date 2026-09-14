import { useEffect, useState } from 'react'
import { SITE } from '../content'
import { useCopy } from '../i18n/LanguageContext.jsx'

const MAILBOX = SITE.email

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

function fill(template, email) {
  return String(template || '').replaceAll('{email}', email)
}

export default function Contact() {
  const { copy, lang } = useCopy()
  const contact = copy.contact
  const needOptions = copy.needOptions
  const [form, setField] = useState({ name: '', email: '', need: needOptions[0], message: '' })
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setField((current) => ({ ...current, need: needOptions[0] }))
  }, [lang, needOptions])

  function onChange(event) {
    const { name, value } = event.target
    setField((current) => ({ ...current, [name]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setSending(true)
    setStatus(contact.sending)

    try {
      const { response, data } = await sendBriefing(form)
      const message = String(data.message || '')
      const failed = String(data.success) === 'false'

      if (failed && /activate|confirm|email|web server/i.test(message)) {
        setStatus(fill(contact.activate, MAILBOX))
        return
      }

      if (!response.ok || failed) {
        throw new Error(message || 'send-failed')
      }

      setField({ name: '', email: '', need: needOptions[0], message: '' })
      setStatus(fill(contact.sent, MAILBOX))
    } catch {
      setStatus(fill(contact.fail, MAILBOX))
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contacto" className="contact">
      <div>
        <p className="kicker">{contact.kicker}</p>
        <h2>{contact.title}</h2>
        <p>{contact.lead}</p>
        <p className="slots">
          {contact.slotsBefore}
          <strong>{contact.slotsStrong}</strong>
        </p>
      </div>
      <form onSubmit={onSubmit} autoComplete="on">
        <label>
          {contact.name}
          <input
            name="name"
            required
            autoComplete="name"
            placeholder={contact.namePlaceholder}
            value={form.name}
            onChange={onChange}
          />
        </label>
        <label>
          {contact.email}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={contact.emailPlaceholder}
            value={form.email}
            onChange={onChange}
          />
        </label>
        <label>
          {contact.need}
          <select name="need" value={form.need} onChange={onChange}>
            {needOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          {contact.message}
          <textarea
            name="message"
            rows="4"
            placeholder={contact.messagePlaceholder}
            value={form.message}
            onChange={onChange}
          />
        </label>
        <button className="btn primary" type="submit" disabled={sending}>
          {sending ? contact.sending : contact.submit}
        </button>
        {status ? <p className="form-note">{status}</p> : null}
      </form>
    </section>
  )
}
