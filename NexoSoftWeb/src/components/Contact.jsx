import { useState } from 'react'
import { NEED_OPTIONS } from '../content'

const MAILBOX = 'leonexo@nexosoft.site'
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
    setStatus('Enviando…')

    try {
      const { response, data } = await sendBriefing(form)
      const message = String(data.message || '')
      const failed = String(data.success) === 'false'

      if (failed && /activate|confirm|email|web server/i.test(message)) {
        setStatus(
          'Te acaba de llegar un mail a leonexo@nexosoft.site para activar el formulario. Abrilo (también spam), confirmá el link y volvé a enviar el briefing.',
        )
        return
      }

      if (!response.ok || failed) {
        throw new Error(message || 'send-failed')
      }

      setField(EMPTY_FORM)
      setStatus('Listo. El briefing llegó a leonexo@nexosoft.site. Te escribo en 24–48h.')
    } catch {
      setStatus('No se pudo enviar desde el sitio. Escribime a leonexo@nexosoft.site')
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contacto" className="contact">
      <div>
        <p className="kicker">Empezá acá</p>
        <h2>Contame qué necesita tu negocio.</h2>
        <p>
          Te respondemos en 24 a 48 horas, en criollo. Si podemos ayudarte, te armamos el
          camino. Si no es para nosotros, te lo decimos.
        </p>
        <p className="slots">
          Hay lugar para <strong>2 proyectos este mes</strong>
        </p>
      </div>
      <form onSubmit={onSubmit} autoComplete="on">
        <label>
          Nombre
          <input
            name="name"
            required
            autoComplete="name"
            placeholder="Tu nombre"
            value={form.name}
            onChange={onChange}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="hola@marca.com"
            value={form.email}
            onChange={onChange}
          />
        </label>
        <label>
          Qué te gustaría tener
          <select name="need" value={form.need} onChange={onChange}>
            {NEED_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Contanos en una frase
          <textarea
            name="message"
            rows="4"
            placeholder="Ej: tengo un local y quiero que la gente me escriba por WhatsApp"
            value={form.message}
            onChange={onChange}
          />
        </label>
        <button className="btn primary" type="submit" disabled={sending}>
          {sending ? 'Enviando…' : 'Quiero que me escriban'}
        </button>
        {status ? <p className="form-note">{status}</p> : null}
      </form>
    </section>
  )
}
