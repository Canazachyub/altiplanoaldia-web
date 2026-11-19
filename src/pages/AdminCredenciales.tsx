// /admin → Credenciales (solo el administrador): emitir, renovar y revocar credenciales de prensa,
// e imprimirlas (frente y dorso a tamaño real, 54 × 85,6 mm) o bajarlas en SVG para retocarlas en Inkscape.
import { useCallback, useEffect, useState } from 'react'
import { armarCredencial, fechaCorta, prepararFoto, URL_VERIFICAR } from '../credencial'

type Llamar = <T>(accion: string, datos?: Record<string, unknown>) => Promise<T>
interface Cred {
  codigo: string
  nombre: string
  cargo: string
  dni: string
  emitida: string
  vence: string
  estado: 'vigente' | 'vencida' | 'revocada'
  motivo: string
  tiene_foto: boolean
}
interface Form {
  codigo: string
  nombre: string
  cargo: string
  dni: string
  vence: string
  revocada: boolean
  motivo: string
  foto?: { b64: string; tipo: string; vista: string }
}

const enUnAnio = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
const CARGOS = ['Reportero', 'Reportera', 'Corresponsal', 'Camarógrafo', 'Fotógrafo', 'Fotógrafa', 'Editor', 'Editora',
  'Conductor', 'Conductora', 'Community manager', 'Director', 'Directora']

const descargar = (nombre: string, svg: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Abre una ventana con frente y dorso a tamaño real y lanza la impresión. */
function imprimir(frente: string, dorso: string, titulo: string) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) throw new Error('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.')
  const lado = (svg: string) => svg.replace(/<\?xml[^>]*>/, '').replace(/width="54mm" height="85.6mm"/, 'width="54mm" height="85.6mm" class="tarjeta"')
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
@font-face{font-family:'Alfa Slab One';src:url('${location.origin}/fonts/AlfaSlabOne-Regular.ttf')}
@font-face{font-family:'Fira Sans Condensed';font-weight:500;src:url('${location.origin}/fonts/FiraSansCondensed-Medium.ttf')}
@font-face{font-family:'Fira Sans Condensed';font-weight:600;src:url('${location.origin}/fonts/FiraSansCondensed-SemiBold.ttf')}
@font-face{font-family:'Fira Sans Condensed';font-weight:700;src:url('${location.origin}/fonts/FiraSansCondensed-Bold.ttf')}
@font-face{font-family:'Fira Sans Condensed';font-weight:800;src:url('${location.origin}/fonts/FiraSansCondensed-ExtraBold.ttf')}
@page{size:A4;margin:12mm}
body{margin:0;font-family:sans-serif}
.hoja{display:flex;gap:8mm;flex-wrap:wrap}
.tarjeta{outline:0.2mm dashed #999;display:block}
p{font-size:11px;color:#555}
@media print{p{display:none}}
</style></head><body>
<p>Imprime a escala 100 % (sin «ajustar a la página»). Recorta por la línea punteada y plastifica frente con dorso.</p>
<div class="hoja">${lado(frente)}${lado(dorso)}</div>
<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))</script>
</body></html>`)
  w.document.close()
}

export default function Credenciales({ llamar }: { llamar: Llamar }) {
  const [lista, setLista] = useState<Cred[] | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [vista, setVista] = useState<{ cred: Cred; frente: string; dorso: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(() => {
    llamar<{ credenciales: Cred[] }>('credenciales').then((r) => setLista(r.credenciales)).catch((e) => setError(e.message))
  }, [llamar])
  useEffect(cargar, [cargar])

  const abrirVista = async (c: Cred) => {
    setError('')
    setOcupado(true)
    try {
      const r = await llamar<{ foto: string }>('credenciales', { codigo: c.codigo })
      const s = await armarCredencial({ ...c, foto: r.foto })
      setVista({ cred: c, ...s })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const guardar = async () => {
    if (!form) return
    setError('')
    setOcupado(true)
    try {
      const r = await llamar<{ codigo: string }>('guardar_credencial', {
        datos: {
          codigo: form.codigo || undefined, nombre: form.nombre, cargo: form.cargo, dni: form.dni, vence: form.vence,
          estado: form.revocada ? 'revocada' : 'activa', motivo: form.motivo,
          foto_b64: form.foto?.b64, foto_tipo: form.foto?.tipo,
        },
      })
      setAviso(form.codigo ? `Credencial ${r.codigo} actualizada.` : `Credencial ${r.codigo} emitida. Ya puedes imprimirla.`)
      setForm(null)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (vista) {
    const nombreArchivo = `credencial-${vista.cred.codigo}`
    return (
      <section className="adm-seccion">
        {error && <p className="adm-error" role="alert">{error}</p>}
        <div className="adm-acciones">
          <button className="adm-principal" onClick={() => {
            try { imprimir(vista.frente, vista.dorso, nombreArchivo) } catch (e) { setError((e as Error).message) }
          }}>Imprimir (tamaño real)</button>
          <button onClick={() => descargar(`${nombreArchivo}-frente.svg`, vista.frente)}>Bajar frente (SVG · Inkscape)</button>
          <button onClick={() => descargar(`${nombreArchivo}-dorso.svg`, vista.dorso)}>Bajar dorso (SVG · Inkscape)</button>
          <button onClick={() => setVista(null)}>Volver</button>
        </div>
        <p className="adm-nota">
          QR: <a href={URL_VERIFICAR + vista.cred.codigo} target="_blank" rel="noreferrer">{URL_VERIFICAR + vista.cred.codigo}</a>
        </p>
        <div className="adm-cred-vista">
          <div dangerouslySetInnerHTML={{ __html: vista.frente }} />
          <div dangerouslySetInnerHTML={{ __html: vista.dorso }} />
        </div>
      </section>
    )
  }

  return (
    <section className="adm-seccion">
      {error && <p className="adm-error" role="alert">{error}</p>}
      {aviso && !form && <p className="adm-nota" role="status">{aviso}</p>}
      {form ? (
        <div className="adm-editor">
          <h2>{form.codigo ? `Credencial ${form.codigo}` : 'Nueva credencial de prensa'}</h2>
          <label>Nombre completo<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={80} /></label>
          <label>
            Cargo
            <input list="adm-cargos" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} maxLength={60} />
            <datalist id="adm-cargos">{CARGOS.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label>DNI (8 dígitos, se imprime; en la web solo se ven los 4 últimos)
            <input inputMode="numeric" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
          </label>
          <label>Válida hasta<input type="date" value={form.vence} onChange={(e) => setForm({ ...form, vence: e.target.value })} /></label>
          <label>
            Foto (retrato, fondo claro; se recorta al formato de la credencial)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try { setForm({ ...form, foto: await prepararFoto(f) }) } catch (x) { setError((x as Error).message) }
            }} />
          </label>
          {form.foto && <img className="adm-cred-foto" src={form.foto.vista} alt="Vista previa de la foto" />}
          {form.codigo && (
            <label className="adm-check">
              <input type="checkbox" checked={form.revocada} onChange={(e) => setForm({ ...form, revocada: e.target.checked })} />
              Revocar (la validación dirá que ya no representa al medio)
            </label>
          )}
          {form.revocada && <label>Motivo<input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} maxLength={200} /></label>}
          <div className="adm-acciones">
            <button className="adm-principal" disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
            <button onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="adm-acciones">
            <button className="adm-principal" onClick={() => { setAviso(''); setForm({ codigo: '', nombre: '', cargo: '', dni: '', vence: enUnAnio(), revocada: false, motivo: '' }) }}>
              + Nueva credencial
            </button>
          </div>
          {!lista ? (
            <p className="adm-cargando">Cargando credenciales…</p>
          ) : !lista.length ? (
            <p className="adm-nota">Aún no hay credenciales. Emite la primera con «Nueva credencial».</p>
          ) : (
            <table className="adm-tabla">
              <thead><tr><th>Código</th><th>Nombre</th><th>Cargo</th><th>Vence</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.codigo}>
                    <td>{c.codigo}</td>
                    <td>{c.nombre}</td>
                    <td>{c.cargo}</td>
                    <td>{fechaCorta(c.vence)}</td>
                    <td className={`adm-cred-${c.estado}`}>{c.estado === 'vigente' ? 'Vigente' : c.estado === 'vencida' ? 'Vencida' : 'Revocada'}</td>
                    <td className="adm-cred-botones">
                      <button disabled={ocupado} onClick={() => abrirVista(c)}>Ver e imprimir</button>
                      <button onClick={() => { setAviso(''); setForm({ codigo: c.codigo, nombre: c.nombre, cargo: c.cargo, dni: c.dni, vence: c.vence, revocada: c.estado === 'revocada', motivo: c.motivo }) }}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
