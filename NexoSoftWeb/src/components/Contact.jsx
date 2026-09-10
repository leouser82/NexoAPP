import { useState } from 'react'
import { NEED_OPTIONS } from '../content'

export default function Contact() {
  const [form, setField] = useState({
    name: '',
    email: '',
    need: NEED_OPTIONS[0],
    message: '',
  })
  const [status, setStatus] = useState('')

  function onChange(event) {
    const { name, value } = event.target
    setField((current) => ({ ...current, [name]: value }))
  }

  function onSubmit(event) {
    event.preventDefault()
    const subject = encodeURIComponent(`Briefing: ${form.need} — ${form.name}`)
    const body = encodeURIComponent(
      `Nombre: ${form.name}\nEmail: ${form.email}\nServicio: ${form.need}\n\n${form.message}`,
    )
    window.location.href = `mailto:hola@nexostudio.dev?subject=${subject}&body=${body}`
    setStatus('Listo. Se abre tu mail con el briefing. Si no se abre, escribime directo.')
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
        <button className="btn primary" type="submit">
          Enviar briefing
        </button>
        {status ? <p className="form-note">{status}</p> : null}
      </form>
    </section>
  )
}
