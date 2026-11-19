// /verificar/<código>: lo abre el QR de la credencial de prensa. Dice si la credencial es auténtica y vigente,
// con la foto y el nombre del portador para compararlos con la persona que la muestra.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTitulo } from '../hooks/useTitulo'
import { CODIGO_CRED, fechaCorta, validar, type Validacion } from '../credencial'
import '../styles/verificar.css'

const TEXTO: Record<Validacion['estado'], { titulo: string; detalle: string }> = {
  vigente: { titulo: 'Credencial vigente', detalle: 'El portador es colaborador de prensa de Altiplano al Día.' },
  vencida: { titulo: 'Credencial vencida', detalle: 'Esta credencial ya no está vigente. El portador no puede presentarse a nombre del medio.' },
  revocada: { titulo: 'Credencial revocada', detalle: 'Altiplano al Día anuló esta credencial. El portador no nos representa.' },
  no_existe: { titulo: 'Credencial no registrada', detalle: 'Este código no corresponde a ninguna credencial de Altiplano al Día.' },
}

function useNoIndexar() {
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])
}

export default function Verificar() {
  useTitulo('Verificar credencial de prensa')
  useNoIndexar()
  const { codigo = '' } = useParams()
  const ir = useNavigate()
  const cod = codigo.trim().toUpperCase()
  const [res, setRes] = useState<Validacion | null>(null)
  const [error, setError] = useState('')
  const [escrito, setEscrito] = useState(cod)

  useEffect(() => {
    setRes(null)
    setError('')
    if (!cod) return
    if (!CODIGO_CRED.test(cod)) {
      setRes({ ok: true, valida: false, estado: 'no_existe', codigo: cod })
      return
    }
    let vivo = true
    validar(cod).then((r) => vivo && setRes(r)).catch((e: Error) => vivo && setError(e.message))
    return () => { vivo = false }
  }, [cod])

  return (
    <section className="ver">
      <header className="ver-cab">
        <p className="ver-ante">ALTIPLANO AL DÍA · PRENSA</p>
        <h1>Verificar credencial</h1>
        <p>Escanea el QR de la credencial o escribe su código (está en el frente, junto a la foto).</p>
      </header>
      <form
        className="ver-form"
        onSubmit={(e) => {
          e.preventDefault()
          const c = escrito.trim().toUpperCase().replace(/^AAD(?!-)/, 'AAD-')
          if (c) ir(`/verificar/${encodeURIComponent(c)}`)
        }}
      >
        <label htmlFor="ver-codigo">Código</label>
        <input id="ver-codigo" value={escrito} onChange={(e) => setEscrito(e.target.value)} placeholder="AAD-XXXXXX"
          autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <button type="submit">Verificar</button>
      </form>

      {cod && !res && !error && <p className="ver-cargando">Consultando…</p>}
      {error && <p className="ver-error" role="alert">{error}</p>}
      {res && (
        <article className={`ver-res ver-${res.estado}`} aria-live="polite">
          <div className="ver-sello">
            <span aria-hidden="true">{res.valida ? '✔' : '✖'}</span>
            <div>
              <h2>{TEXTO[res.estado].titulo}</h2>
              <p>{TEXTO[res.estado].detalle}</p>
            </div>
          </div>
          {res.nombre && (
            <div className="ver-ficha">
              {res.foto && <img src={res.foto} alt={`Foto de ${res.nombre}`} />}
              <dl>
                <dt>Nombre</dt><dd>{res.nombre}</dd>
                <dt>Cargo</dt><dd>{res.cargo}</dd>
                {res.dni && (<><dt>DNI</dt><dd>{res.dni}</dd></>)}
                <dt>Código</dt><dd>{res.codigo}</dd>
                <dt>Emitida</dt><dd>{fechaCorta(res.emitida)}</dd>
                <dt>Válida hasta</dt><dd>{fechaCorta(res.vence)}</dd>
                {res.motivo && (<><dt>Motivo</dt><dd>{res.motivo}</dd></>)}
              </dl>
            </div>
          )}
          <p className="ver-pie">
            Compara la foto y el nombre con la persona y su DNI. Si algo no coincide, o alguien usa el nombre del
            medio para pedir dinero, avísanos por WhatsApp al <a href="https://wa.me/51942149084">942 149 084</a>.
          </p>
        </article>
      )}
      <p className="ver-volver"><Link to="/">← Volver a Altiplano al Día</Link></p>
    </section>
  )
}
