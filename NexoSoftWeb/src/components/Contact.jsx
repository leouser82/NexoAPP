import { useState } from 'react'
import { NEED_OPTIONS } from '../content'

const EMPTY_FORM = {
  name: '',
  email: '',
  need: NEED_OPTIONS[0],
  message: '',
  company: '',
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
    if (form.company) {
      setStatus('Listo. Te escribo en 24–48h.')
      return
    }

    setSending(true)
    setStatus('Enviando…')

    try {
      const response = await fetch('/send-briefing.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          need: form.need,
          message: form.message,
          company: form.company,
        }),
      })

      if (!response.ok) {
        throw new Error('send-failed')
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
        <p className="kicker">Siguiente paso</p>
        <h2>Contame qué estás construyendo.</h2>
        <p>
          Respondé en 24–48h. Si hay fit, armamos un alcance claro. Si no hay fit, te lo digo —
          no vendo por vender.
        </p>
        <p className="slots">
          Disponibilidad: <strong>2 cupos este mes</strong>
        </p>
      </div>
      <form onSubmit={onSubmit}>
        <label className="hp" aria-hidden="true">
          Empresa
          <input
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={form.company}
            onChange={onChange}
          />
        </label>
        <label>
          Nombre
          <input
            name="name"
            required
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
            placeholder="hola@marca.com"
            value={form.email}
            onChange={onChange}
          />
        </label>
        <label>
          Qué necesitás
          <select name="need" value={form.need} onChange={onChange}>
            {NEED_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          El proyecto en una frase
          <textarea
            name="message"
            rows="4"
            placeholder="Ej: landing para mi estudio de arquitectura"
            value={form.message}
            onChange={onChange}
          />
        </label>
        <button className="btn primary" type="submit" disabled={sending}>
          {sending ? 'Enviando…' : 'Enviar briefing'}
        </button>
        {status ? <p className="form-note">{status}</p> : null}
      </form>
    </section>
  )
}
