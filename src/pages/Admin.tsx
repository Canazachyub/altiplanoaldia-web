// Panel de redacción (/admin): entrar con usuario y clave, corregir notas del día o de días anteriores,
// y (el admin) manejar los usuarios. Todo se guarda en Google Sheets (Apps Script). Las ediciones cambian
// SOLO la web; el sitio las toma en su próxima compilación (≈15 min, o al publicar el maquetador).
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SECCIONES } from '../config/sitio'
import { useTitulo } from '../hooks/useTitulo'
import '../styles/admin.css'

const API = (import.meta.env.VITE_SHEETS_API as string | undefined) ?? ''
// Mapa y visor de fotos de los avisos (se cargan solo al abrir la pestaña Avisos).
const MapaAviso = lazy(() => import('./Avisos').then((m) => ({ default: m.Mapa })))
const Ampliar = lazy(() => import('./Avisos').then((m) => ({ default: m.Ampliar })))
// Credenciales de prensa (solo admin): se carga al abrir la pestaña.
const Credenciales = lazy(() => import('./AdminCredenciales'))
const CLAVE_SESION = 'aad-admin'

interface Sesion { token: string; usuario: string; nombre: string; rol: 'admin' | 'editor' }
interface Texto { antetitulo: string; titular: string; bajada: string; cuerpo: string }
interface NotaPanel {
  id: number
  dia: string
  fecha: string
  seccion: string
  slug: string
  imagen: string
  lugar: string
  foto_drive: string
  propia?: boolean
  foto_propia?: string
  original: Texto
  edicion: (Texto & { seccion: string; oculta: boolean; usuario: string; fecha: string; foto: string }) | null
}
interface Usuario { usuario: string; nombre: string; rol: 'admin' | 'editor'; activo: boolean; ultimo_ingreso: string }

class ErrorApi extends Error {}

async function api<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new ErrorApi('Falta conectar el panel con Google Sheets (VITE_SHEETS_API).')
  let r: Response
  try {
    // Texto plano: así el navegador no hace la consulta previa (CORS) que Apps Script no responde.
    r = await fetch(API, { method: 'POST', body: JSON.stringify({ accion, ...datos }) })
  } catch {
    throw new ErrorApi('Sin conexión con Google Sheets. Revisa internet.')
  }
  const j = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida del servidor.' }))
  if (!j.ok) throw new ErrorApi(j.error || 'Error desconocido.')
  return j as T
}

const leerSesion = (): Sesion | null => {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null')
  } catch {
    return null
  }
}
const guardarSesion = (s: Sesion | null) => {
  try {
    if (s) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s))
    else sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    /* sin almacenamiento: la sesión dura lo que la pestaña */
  }
}

/** Google no debe indexar el panel. */
function useNoIndexar() {
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])
}

export default function Admin() {
  useTitulo('Panel de redacción')
  useNoIndexar()
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  const [vista, setVista] = useState<'notas' | 'avisos' | 'usuarios' | 'credenciales' | 'clave'>('notas')
  const salir = useCallback(() => {
    if (sesion) api('salir', { token: sesion.token }).catch(() => undefined)
    guardarSesion(null)
    setSesion(null)
    setVista('notas')
  }, [sesion])
  // Si la sesión venció en el servidor, se vuelve al ingreso.
  const llamar = useCallback(
    async <T,>(accion: string, datos: Record<string, unknown> = {}) => {
      try {
        return await api<T>(accion, { token: sesion?.token, ...datos })
      } catch (e) {
        if (e instanceof ErrorApi && /Sesión vencida|desactivado/.test(e.message)) {
          guardarSesion(null)
          setSesion(null)
        }
        throw e
      }
    },
    [sesion],
  )

  if (!sesion) {
    return (
      <Ingreso
        alEntrar={(s) => {
          guardarSesion(s)
          setSesion(s)
          setVista('notas')          // cada ingreso empieza en Notas (un editor no tiene «Usuarios»)
        }}
      />
    )
  }
  return (
    <div className="adm">
      <header className="adm-barra">
        <div>
          <h1>Panel de redacción</h1>
          <p>{sesion.nombre} · {sesion.rol === 'admin' ? 'Administrador' : 'Editor'}</p>
        </div>
        <nav aria-label="Panel">
          <button className={vista === 'notas' ? 'activo' : ''} onClick={() => setVista('notas')}>Notas</button>
          <button className={vista === 'avisos' ? 'activo' : ''} onClick={() => setVista('avisos')}>Avisos</button>
          {sesion.rol === 'admin' && (
            <button className={vista === 'usuarios' ? 'activo' : ''} onClick={() => setVista('usuarios')}>Usuarios</button>
          )}
          {sesion.rol === 'admin' && (
            <button className={vista === 'credenciales' ? 'activo' : ''} onClick={() => setVista('credenciales')}>Credenciales</button>
          )}
          <button className={vista === 'clave' ? 'activo' : ''} onClick={() => setVista('clave')}>Mi clave</button>
          <button onClick={salir}>Salir</button>
        </nav>
      </header>
      {(vista === 'notas' || ((vista === 'usuarios' || vista === 'credenciales') && sesion.rol !== 'admin')) && <Notas llamar={llamar} />}
      {vista === 'credenciales' && sesion.rol === 'admin' && (
        <Suspense fallback={<p className="adm-cargando">Cargando…</p>}><Credenciales llamar={llamar} /></Suspense>
      )}
      {vista === 'usuarios' && sesion.rol === 'admin' && <Usuarios llamar={llamar} yo={sesion.usuario} />}
      {vista === 'avisos' && <Avisos llamar={llamar} />}
      {vista === 'clave' && <MiClave llamar={llamar} />}
    </div>
  )
}

type Llamar = <T>(accion: string, datos?: Record<string, unknown>) => Promise<T>

function Ingreso({ alEntrar }: { alEntrar: (s: Sesion) => void }) {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  return (
    <div className="adm adm--ingreso">
      <form
        className="adm-caja"
        onSubmit={async (e) => {
          e.preventDefault()
          setEnviando(true)
          setError('')
          try {
            const r = await api<Sesion>('login', { usuario, clave })
            alEntrar({ token: r.token, usuario: r.usuario, nombre: r.nombre, rol: r.rol })
          } catch (x) {
            setError((x as Error).message)
          } finally {
            setEnviando(false)
          }
        }}
      >
        <h1>Panel de redacción</h1>
        <label>
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Clave
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-principal" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="adm-nota">¿Olvidaste tu clave? Pídesela al administrador.</p>
      </form>
    </div>
  )
}

const nombreDia = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function Notas({ llamar }: { llamar: Llamar }) {
  const [dias, setDias] = useState<string[] | null>(null)
  const [dia, setDia] = useState('')
  const [notas, setNotas] = useState<NotaPanel[] | null>(null)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<NotaPanel | null>(null)
  const [filtro, setFiltro] = useState('')
  const [seccion, setSeccion] = useState('')
  const [sinFoto, setSinFoto] = useState(false)
  const [nueva, setNueva] = useState(false)

  useEffect(() => {
    llamar<{ dias: string[] }>('dias')
      .then((r) => {
        setDias(r.dias)
        setDia((d) => d || r.dias[0] || '')
      })
      .catch((e) => setError(e.message))
  }, [llamar])

  const cargar = useCallback(() => {
    if (!dia) return
    setNotas(null)
    llamar<{ notas: NotaPanel[] }>('notas', { dia })
      .then((r) => setNotas(r.notas.sort((a, b) => b.fecha.localeCompare(a.fecha))))
      .catch((e) => setError(e.message))
  }, [dia, llamar])
  useEffect(cargar, [cargar])

  if (nueva) {
    return (
      <NuevaNota
        dia={dia}
        llamar={llamar}
        alCerrar={(creada) => {
          setNueva(false)
          window.scrollTo(0, 0)
          if (creada) {
            llamar<{ dias: string[] }>('dias').then((r) => setDias(r.dias)).catch(() => undefined)
            cargar()
          }
        }}
      />
    )
  }
  if (abierta) {
    return (
      <Editor
        nota={abierta}
        llamar={llamar}
        alCerrar={(cambio) => {
          setAbierta(null)
          window.scrollTo(0, 0)
          if (cambio) cargar()
        }}
      />
    )
  }
  const q = filtro.trim().toLowerCase()
  const secDe = (n: NotaPanel) => n.edicion?.seccion || n.seccion
  const tieneFoto = (n: NotaPanel) => n.edicion?.foto === 'ninguna' ? false : !!(n.edicion?.foto || n.imagen || n.foto_propia)
  const todas = notas ?? []
  const visibles = todas.filter((n) =>
    (!q || (n.edicion?.titular || n.original.titular).toLowerCase().includes(q)) &&
    (!seccion || secDe(n) === seccion) &&
    (!sinFoto || !tieneFoto(n)))
  const cuentaSec = (c: string) => todas.filter((n) => secDe(n) === c).length
  const nSinFoto = todas.filter((n) => !tieneFoto(n)).length
  return (
    <section className="adm-seccion">
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-filtros">
        <label>
          Día
          <select value={dia} onChange={(e) => setDia(e.target.value)} disabled={!dias}>
            {(dias ?? []).map((d) => <option key={d} value={d}>{nombreDia(d).replace(/^./, (c) => c.toUpperCase())}</option>)}
          </select>
        </label>
        <label>
          Buscar
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Titular…" />
        </label>
      </div>
      <div className="adm-filtros adm-filtros--tres">
        <label>
          Sección
          <select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            <option value="">Todas ({todas.length})</option>
            {SECCIONES.map((s) => <option key={s.clave} value={s.clave}>{s.nombre} ({cuentaSec(s.clave)})</option>)}
          </select>
        </label>
        <label className="adm-check adm-check--filtro">
          <input type="checkbox" checked={sinFoto} onChange={(e) => setSinFoto(e.target.checked)} />
          Solo sin foto ({nSinFoto})
        </label>
        <button className="adm-principal" onClick={() => { setNueva(true); window.scrollTo(0, 0) }}>+ Nueva nota</button>
      </div>
      <p className="adm-nota">
        Los cambios se ven en la web en unos 15 minutos. El boletín PDF no cambia (lo arma el maquetador).
      </p>
      {!notas ? (
        <p className="adm-cargando">Cargando notas…</p>
      ) : !visibles.length ? (
        <p className="adm-cargando">No hay notas{q || seccion || sinFoto ? ' con estos filtros' : ' en este día'}.</p>
      ) : (
        <ul className="adm-lista">
          {visibles.map((n) => {
            const e = n.edicion
            const sec = SECCIONES.find((s) => s.clave === (e?.seccion || n.seccion))
            return (
              <li key={n.id}>
                <button className="adm-fila" onClick={() => { setAbierta(n); window.scrollTo(0, 0) }}>
                  {n.imagen ? <img src={`/${n.imagen}`} alt="" loading="lazy" /> : <span className="adm-sinfoto" aria-hidden="true" />}
                  <span>
                    <span className="adm-meta">
                      {sec?.nombre ?? n.seccion} · {n.fecha.slice(11, 16) || n.fecha.slice(0, 10)}
                      {n.propia && <span className="adm-etq adm-etq--propia">Nota propia</span>}
                      {!tieneFoto(n) && <span className="adm-etq adm-etq--oculta">Sin foto</span>}
                      {e && !e.oculta && <span className="adm-etq adm-etq--editada">Editada por {e.usuario}</span>}
                      {e?.oculta && <span className="adm-etq adm-etq--oculta">Oculta</span>}
                      {e?.foto && e.foto !== 'ninguna' && <span className="adm-etq adm-etq--editada">Foto nueva</span>}
                    </span>
                    <strong>{e?.titular || n.original.titular}</strong>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Achica la foto en el navegador (lado mayor 1600 px, JPEG) antes de subirla a Drive. */
async function prepararFoto(archivo: File): Promise<{ b64: string; vista: string }> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'))
      i.src = url
    })
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const vista = c.toDataURL('image/jpeg', 0.88)
    return { b64: vista.split(',')[1], vista }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function Foto({ nota, foto, alCambiar, llamar }: { nota: NotaPanel; foto: string; alCambiar: (f: string) => void; llamar: Llamar }) {
  const [vista, setVista] = useState('')
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const actual = foto === 'ninguna' ? '' : vista || (!foto && nota.imagen ? `/${nota.imagen}` : '')
  return (
    <fieldset className="adm-foto">
      <legend>Foto</legend>
      {actual ? (
        <img src={actual} alt="Foto de la nota" />
      ) : (
        <p className="adm-nota">{foto === 'ninguna' ? 'La nota irá sin foto.' : foto ? 'Foto nueva guardada en Drive.' : 'Esta nota no tiene foto.'}</p>
      )}
      <p className="adm-nota">Solo fotos: sin titulares, logos, marcas de agua ni capturas. Se guarda en Drive.</p>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-acciones">
        <label className="adm-boton-archivo">
          {estado || 'Cambiar foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!!estado}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setError('')
              setEstado('Subiendo a Drive…')
              try {
                const p = await prepararFoto(f)
                const r = await llamar<{ foto: string }>('subir_foto_edicion', { id: nota.id, tipo: 'image/jpeg', b64: p.b64 })
                setVista(p.vista)
                alCambiar(r.foto)
              } catch (x) {
                setError((x as Error).message)
              } finally {
                setEstado('')
              }
            }}
          />
        </label>
        {foto !== 'ninguna' && (foto || nota.imagen) && (
          <button type="button" onClick={() => { setVista(''); alCambiar('ninguna') }}>Quitar foto</button>
        )}
        {foto && <button type="button" onClick={() => { setVista(''); alCambiar('') }}>Usar la foto original</button>}
        {nota.foto_drive && <a href={nota.foto_drive} target="_blank" rel="noopener">Original en Drive ↗</a>}
      </div>
    </fieldset>
  )
}

function Editor({ nota, llamar, alCerrar }: { nota: NotaPanel; llamar: Llamar; alCerrar: (cambio: boolean) => void }) {
  const base = nota.edicion ?? { ...nota.original, seccion: '', oculta: false, foto: '' }
  const [t, setT] = useState({
    antetitulo: base.antetitulo || nota.original.antetitulo,
    titular: base.titular || nota.original.titular,
    bajada: base.bajada || nota.original.bajada,
    cuerpo: base.cuerpo || nota.original.cuerpo,
    seccion: base.seccion || nota.seccion,
    oculta: !!base.oculta,
    foto: base.foto || '',
  })
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const campo = (k: keyof typeof t) => (e: { target: { value: string } }) => setT({ ...t, [k]: e.target.value })
  const guardar = async () => {
    setEstado('Guardando…')
    setError('')
    try {
      await llamar('editar', { id: nota.id, dia: nota.dia, cambios: { ...t, seccion: t.seccion === nota.seccion ? '' : t.seccion } })
      alCerrar(true)
    } catch (e) {
      setError((e as Error).message)
      setEstado('')
    }
  }
  const restaurar = async () => {
    if (!window.confirm('¿Volver a la versión original del maquetador? Se pierden los cambios de esta nota.')) return
    setEstado('Restaurando…')
    try {
      await llamar('restaurar', { id: nota.id })
      alCerrar(true)
    } catch (e) {
      setError((e as Error).message)
      setEstado('')
    }
  }
  return (
    <section className="adm-seccion adm-editor">
      <div className="adm-editor__cab">
        <button onClick={() => alCerrar(false)}>← Volver a la lista</button>
        {nota.slug && <Link to={`/nota/${nota.slug}`} target="_blank" rel="noopener">Ver en la web ↗</Link>}
      </div>
      {nota.edicion && (
        <p className="adm-nota">Última edición: {nota.edicion.usuario}, {nota.edicion.fecha.replace('T', ' ').slice(0, 16)}.</p>
      )}
      <Foto nota={nota} foto={t.foto} llamar={llamar} alCambiar={(foto) => setT({ ...t, foto })} />
      <label>Antetítulo<input value={t.antetitulo} onChange={campo('antetitulo')} maxLength={200} /></label>
      <label>Titular<textarea value={t.titular} onChange={campo('titular')} rows={2} maxLength={300} required /></label>
      <label>Bajada<textarea value={t.bajada} onChange={campo('bajada')} rows={3} maxLength={600} /></label>
      <label>
        Sección
        <select value={t.seccion} onChange={campo('seccion')}>
          {SECCIONES.map((s) => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}
        </select>
      </label>
      <label>
        Texto <small>(deja una línea en blanco entre párrafos)</small>
        <textarea value={t.cuerpo} onChange={campo('cuerpo')} rows={16} />
      </label>
      <label className="adm-check">
        <input type="checkbox" checked={t.oculta} onChange={(e) => setT({ ...t, oculta: e.target.checked })} />
        Ocultar esta nota de la web
      </label>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-acciones">
        <button className="adm-principal" onClick={guardar} disabled={!!estado || !t.titular.trim()}>{estado || 'Guardar cambios'}</button>
        {nota.edicion && <button onClick={restaurar} disabled={!!estado}>Restaurar original</button>}
      </div>
    </section>
  )
}

const AMBITOS_NOTA = [
  { clave: 'DISTRITAL', nombre: 'Distrital' },
  { clave: 'LOCAL', nombre: 'Local' },
  { clave: 'REGIONAL', nombre: 'Regional' },
  { clave: 'NACIONAL', nombre: 'Nacional' },
  { clave: 'INTERNACIONAL', nombre: 'Internacional' },
]

/** Nota propia escrita en el panel. Sale en la web en ~15 min (no entra al boletín PDF). */
function NuevaNota({ dia, llamar, alCerrar }: { dia: string; llamar: Llamar; alCerrar: (creada: boolean) => void }) {
  const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)
  const [t, setT] = useState({ antetitulo: '', titular: '', bajada: '', cuerpo: '', seccion: SECCIONES[0]?.clave ?? '', ambito: 'REGIONAL', lugar: 'Puno', dia: dia || hoy })
  const [foto, setFoto] = useState<{ b64: string; vista: string } | null>(null)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const [hecha, setHecha] = useState<{ slug: string } | null>(null)
  const campo = (k: keyof typeof t) => (e: { target: { value: string } }) => setT({ ...t, [k]: e.target.value })

  const guardar = async () => {
    setError('')
    if (t.titular.trim().length < 10) return setError('El titular es muy corto.')
    if (t.cuerpo.trim().length < 80) return setError('El texto es muy corto (mínimo 80 letras).')
    setEstado(foto ? 'Subiendo foto y guardando…' : 'Guardando…')
    try {
      const r = await llamar<{ id: number; slug: string }>('crear_nota', {
        nota: { ...t, foto: foto ? { b64: foto.b64, tipo: 'image/jpeg' } : null },
      })
      setHecha({ slug: r.slug })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEstado('')
    }
  }

  if (hecha) {
    return (
      <section className="adm-seccion adm-editor">
        <p className="adm-ok" role="status">
          Nota guardada. Sale en la web en unos 15 minutos, en la sección elegida y en la portada si es reciente.
          Su foto quedó en Drive, en Notas/{t.dia.slice(0, 7)}.
        </p>
        <p className="adm-nota">Dirección: <code>altiplanoaldia.pe/nota/{hecha.slug}</code> (funciona cuando la web se actualice).</p>
        <div className="adm-acciones">
          <button className="adm-principal" onClick={() => alCerrar(true)}>Volver a la lista</button>
        </div>
      </section>
    )
  }

  return (
    <section className="adm-seccion adm-editor">
      <div className="adm-editor__cab">
        <button onClick={() => alCerrar(false)}>← Volver a la lista</button>
      </div>
      <h2>Nueva nota</h2>
      <p className="adm-nota">
        Se publica solo en la web (no en el boletín PDF). Después puedes corregirla u ocultarla como cualquier otra nota.
        Recuerda: datos verificados y con fuente; nombres de menores y víctimas, nunca.
      </p>
      <fieldset className="adm-foto">
        <legend>Foto</legend>
        {foto ? <img src={foto.vista} alt="Foto de la nota" /> : <p className="adm-nota">Sin foto todavía. Solo fotos: sin titulares, logos, marcas de agua ni capturas.</p>}
        <div className="adm-acciones">
          <label className="adm-boton-archivo">
            {foto ? 'Cambiar foto' : 'Elegir foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try { setFoto(await prepararFoto(f)) } catch (x) { setError((x as Error).message) }
            }} />
          </label>
          {foto && <button type="button" onClick={() => setFoto(null)}>Quitar foto</button>}
        </div>
      </fieldset>
      <div className="adm-fila-2">
        <label>Sección
          <select value={t.seccion} onChange={campo('seccion')}>{SECCIONES.map((s) => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}</select>
        </label>
        <label>Ámbito
          <select value={t.ambito} onChange={campo('ambito')}>{AMBITOS_NOTA.map((a) => <option key={a.clave} value={a.clave}>{a.nombre}</option>)}</select>
        </label>
        <label>Lugar<input value={t.lugar} onChange={campo('lugar')} maxLength={80} placeholder="Puno, Juliaca, Ilave…" /></label>
        <label>Día<input type="date" value={t.dia} onChange={campo('dia')} max={hoy} /></label>
      </div>
      <label>Antetítulo<input value={t.antetitulo} onChange={campo('antetitulo')} maxLength={200} /></label>
      <label>Titular<textarea value={t.titular} onChange={campo('titular')} rows={2} maxLength={300} required /></label>
      <label>Bajada<textarea value={t.bajada} onChange={campo('bajada')} rows={3} maxLength={600} /></label>
      <label>
        Texto <small>(deja una línea en blanco entre párrafos)</small>
        <textarea value={t.cuerpo} onChange={campo('cuerpo')} rows={16} />
      </label>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-acciones">
        <button className="adm-principal" onClick={guardar} disabled={!!estado}>{estado || 'Publicar nota'}</button>
        <button onClick={() => alCerrar(false)} disabled={!!estado}>Cancelar</button>
      </div>
    </section>
  )
}


function Usuarios({ llamar, yo }: { llamar: Llamar; yo: string }) {
  const [lista, setLista] = useState<Usuario[] | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<(Usuario & { clave: string; nuevo: boolean }) | null>(null)
  const cargar = useCallback(() => {
    llamar<{ usuarios: Usuario[] }>('usuarios').then((r) => setLista(r.usuarios)).catch((e) => setError(e.message))
  }, [llamar])
  useEffect(cargar, [cargar])
  const guardar = async () => {
    if (!form) return
    setError('')
    try {
      await llamar('guardar_usuario', { datos: { usuario: form.usuario, nombre: form.nombre, rol: form.rol, activo: form.activo, clave: form.clave || undefined } })
      setForm(null)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <section className="adm-seccion">
      {error && <p className="adm-error" role="alert">{error}</p>}
      {form ? (
        <div className="adm-editor">
          <h2>{form.nuevo ? 'Nuevo usuario' : `Editar ${form.usuario}`}</h2>
          <label>Usuario<input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} disabled={!form.nuevo} autoComplete="off" /></label>
          <label>Nombre<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
          <label>
            Rol
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Usuario['rol'] })} disabled={form.usuario === yo}>
              <option value="editor">Editor (corrige notas)</option>
              <option value="admin">Administrador (también maneja usuarios)</option>
            </select>
          </label>
          <label>
            {form.nuevo ? 'Clave (mínimo 8 caracteres)' : 'Nueva clave (vacío = no cambia)'}
            <input type="password" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} autoComplete="new-password" />
          </label>
          <label className="adm-check">
            <input type="checkbox" checked={form.activo} disabled={form.usuario === yo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Activo (puede entrar)
          </label>
          <div className="adm-acciones">
            <button className="adm-principal" onClick={guardar}>Guardar</button>
            <button onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="adm-acciones">
            <button className="adm-principal" onClick={() => setForm({ usuario: '', nombre: '', rol: 'editor', activo: true, ultimo_ingreso: '', clave: '', nuevo: true })}>
              + Nuevo usuario
            </button>
          </div>
          {!lista ? (
            <p className="adm-cargando">Cargando usuarios…</p>
          ) : (
            <table className="adm-tabla">
              <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th /></tr></thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.usuario}>
                    <td>{u.usuario}</td>
                    <td>{u.nombre}</td>
                    <td>{u.rol === 'admin' ? 'Admin' : 'Editor'}</td>
                    <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>{u.ultimo_ingreso ? u.ultimo_ingreso.replace('T', ' ').slice(0, 16) : '—'}</td>
                    <td><button onClick={() => setForm({ ...u, clave: '', nuevo: false })}>Editar</button></td>
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

function MiClave({ llamar }: { llamar: Llamar }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [msj, setMsj] = useState('')
  const [error, setError] = useState('')
  return (
    <section className="adm-seccion">
      <form
        className="adm-editor"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setMsj('')
          if (nueva !== repetir) return setError('Las claves nuevas no coinciden.')
          try {
            await llamar('cambiar_clave', { actual, nueva })
            setMsj('Clave cambiada.')
            setActual('')
            setNueva('')
            setRepetir('')
          } catch (x) {
            setError((x as Error).message)
          }
        }}
      >
        <h2>Cambiar mi clave</h2>
        <label>Clave actual<input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required /></label>
        <label>Nueva clave (mínimo 8)<input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label>Repite la nueva clave<input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required /></label>
        {error && <p className="adm-error" role="alert">{error}</p>}
        {msj && <p className="adm-ok" role="status">{msj}</p>}
        <div className="adm-acciones"><button className="adm-principal">Cambiar clave</button></div>
      </form>
    </section>
  )
}

// ------------------------------------------------------------------ avisos del público
// Alerta Mascota y Anuncios gratis: la gente los manda desde la web y quedan «pendientes» hasta aprobarlos aquí.
interface AvisoPanel {
  id: string; creado: string; estado: string; tipo: string; descripcion: string; zona: string; provincia: string; etapa: string; depurado: string
  lat: number | null; lng: number | null; contacto: string; autor: string; foto: string; enlace: string
  especie?: string; nombre?: string; fecha_hecho?: string; titulo?: string; precio?: string
  moderador: string; moderado: string; nota_editor: string; novedades?: { texto: string; fecha: string; foto: string }[]; desenlace?: string
}
const SECCIONES_AVISO = [
  { clave: 'mascotas', nombre: 'Alerta Mascota', ruta: '/alerta-mascota' },
  { clave: 'anuncios', nombre: 'Anuncios gratis', ruta: '/anuncios' },
  { clave: 'denuncias', nombre: 'Denuncias ciudadanas', ruta: '/denuncia' },
] as const
const ESTADOS_AVISO = [
  { clave: 'pendiente', nombre: 'Por revisar' },
  { clave: 'aprobado', nombre: 'Publicados' },
  { clave: 'resuelto', nombre: 'Resueltos' },
  { clave: 'rechazado', nombre: 'Rechazados' },
  { clave: 'todos', nombre: 'Todos' },
]

function FotoAviso({ seccion, foto, llamar }: { seccion: string; foto: string; llamar: Llamar }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!foto) return
    let vivo = true
    llamar<{ tipo: string; b64: string }>('foto_aviso', { seccion, foto })
      .then((r) => { if (vivo) setSrc(`data:${r.tipo};base64,${r.b64}`) })
      .catch(() => undefined)
    return () => { vivo = false }
  }, [seccion, foto, llamar])
  const [grande, setGrande] = useState(false)
  if (!foto) return <div className="adm-sinfoto adm-aviso__foto" />
  if (!src) return <div className="adm-sinfoto adm-aviso__foto" />
  return (
    <>
      <button type="button" className="adm-aviso__verfoto" onClick={() => setGrande(true)} title="Ver en grande"><img className="adm-aviso__foto" src={src} alt="" /></button>
      {grande && <Suspense fallback={null}><Ampliar src={src} alt="Foto del aviso" alCerrar={() => setGrande(false)} /></Suspense>}
    </>
  )
}

/** Mapa para poner o corregir el punto de un aviso (referencial: barrio, calle o lugar conocido). */
function UbicarAviso({ seccion, a, llamar, alGuardar }: { seccion: string; a: AvisoPanel; llamar: Llamar; alGuardar: () => void }) {
  const [punto, setPunto] = useState<[number, number] | null>(a.lat != null && a.lng != null ? [a.lat, a.lng] : null)
  const [estado, setEstado] = useState('')
  const guardar = async () => {
    if (!punto) return
    setEstado('Guardando…')
    try {
      await llamar('ubicar_aviso', { seccion, id: a.id, lat: punto[0], lng: punto[1] })
      alGuardar()
    } catch (e) {
      setEstado((e as Error).message)
    }
  }
  return (
    <div className="adm-ubicar">
      <p className="adm-nota">Toca el mapa para marcar la ubicación referencial ({a.zona}).</p>
      <Suspense fallback={<p className="adm-nota">Cargando mapa…</p>}>
        <MapaAviso elegido={punto} alElegir={setPunto} alto={260} />
      </Suspense>
      <div className="adm-acciones">
        <button className="adm-principal" onClick={guardar} disabled={!punto || estado === 'Guardando…'}>Guardar ubicación</button>
        {estado && estado !== 'Guardando…' && <span className="adm-error">{estado}</span>}
      </div>
    </div>
  )
}

function Avisos({ llamar }: { llamar: Llamar }) {
  const [seccion, setSeccion] = useState<'mascotas' | 'anuncios' | 'denuncias'>('mascotas')
  const [estado, setEstado] = useState('pendiente')
  const [avisos, setAvisos] = useState<AvisoPanel[] | null>(null)
  const [pendientes, setPendientes] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [ubicando, setUbicando] = useState('')

  const cargar = useCallback(() => {
    setAvisos(null)
    setError('')
    llamar<{ avisos: AvisoPanel[]; pendientes: Record<string, number> }>('avisos_admin', { seccion, estado })
      .then((r) => { setAvisos(r.avisos); setPendientes(r.pendientes) })
      .catch((e) => setError(e.message))
  }, [seccion, estado, llamar])
  useEffect(cargar, [cargar])

  const moderar = async (a: AvisoPanel, nuevo: string) => {
    if (nuevo === 'rechazado' && !window.confirm('¿Rechazar este aviso? No se publicará.')) return
    setOcupado(a.id)
    setOk('')
    try {
      await llamar('moderar_aviso', { seccion, id: a.id, estado: nuevo })
      setOk(seccion === 'denuncias' ? 'Denuncia actualizada (las denuncias nunca se publican tal cual).' : nuevo === 'aprobado' ? 'Aviso publicado: ya se ve en la web.' : nuevo === 'resuelto' ? 'Marcado como resuelto.' : 'Aviso actualizado.')
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado('')
    }
  }
  const ruta = SECCIONES_AVISO.find((s) => s.clave === seccion)?.ruta ?? '/'

  return (
    <section className="adm-seccion">
      <div className="adm-acciones">
        {SECCIONES_AVISO.map((s) => (
          <button key={s.clave} className={seccion === s.clave ? 'activo adm-principal' : ''} onClick={() => setSeccion(s.clave)}>
            {s.nombre}{pendientes[s.clave] ? ` (${pendientes[s.clave]} por revisar)` : ''}
          </button>
        ))}
        <Link to={ruta} target="_blank">Ver la página ↗</Link>
      </div>
      <label>
        Mostrar
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS_AVISO.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
        </select>
      </label>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {ok && <p className="adm-ok" role="status">{ok}</p>}
      {!avisos && !error && <p className="adm-nota">Cargando…</p>}
      {avisos && avisos.length === 0 && <p className="adm-nota">No hay avisos en esta lista.</p>}
      <ul className="adm-lista">
        {(avisos ?? []).map((a) => (
          <li key={a.id} className="adm-aviso">
            <FotoAviso seccion={seccion} foto={a.foto} llamar={llamar} />
            <div>
              <div className="adm-meta">
                <span className="adm-etq adm-etq--editada">{a.tipo}</span>
                <span className={`adm-etq${a.estado === 'rechazado' ? ' adm-etq--oculta' : ''}`}>{a.estado}{a.etapa === 'archivo' ? ' · archivo' : ''}</span>
                {a.depurado && <span className="adm-etq">datos borrados</span>}
                <span>{a.id}</span>
                <span>{new Date(a.creado).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                {a.moderador && <span>· {a.moderador}</span>}
              </div>
              <strong>{a.titulo || a.nombre || (a.especie ? `(${a.especie} sin nombre)` : 'Sin título')}{a.precio ? ` · ${a.precio}` : ''}</strong>
              <p className="adm-aviso__texto">{a.descripcion}</p>
              {(a.novedades || []).map((n, i) => (
                <p key={i} className="adm-meta"><b>Novedad ({n.fecha.slice(0, 10)}):</b>&nbsp;{n.texto}{n.foto ? ' · con foto' : ''}</p>
              ))}
              {a.desenlace && <p className="adm-meta"><b>Cómo terminó:</b>&nbsp;{a.desenlace}</p>}
              <p className="adm-meta">
                📍 {a.zona}{a.provincia ? ` · ${a.provincia}` : ''}{a.lat == null ? ' · sin ubicación en el mapa' : ''}
                {a.lat != null && a.lng != null && (
                  <> · <a href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`} target="_blank" rel="noopener noreferrer">ver en el mapa</a></>
                )}
                {' '}· 📱 {a.contacto ? <a href={`https://wa.me/${a.contacto}`} target="_blank" rel="noopener noreferrer">{a.contacto.replace(/^51/, '')}</a> : 'anónima'}
                {a.autor && ` (${a.autor})`}
                {a.enlace && <> · <a href={a.enlace} target="_blank" rel="noopener noreferrer nofollow">publicación de Facebook ↗</a></>}
              </p>
              <div className="adm-acciones">
                {a.estado !== 'aprobado' && <button className="adm-principal" disabled={ocupado === a.id} onClick={() => moderar(a, 'aprobado')}>{seccion === 'denuncias' ? 'En verificación' : 'Aprobar y publicar'}</button>}
                {a.estado === 'aprobado' && <button disabled={ocupado === a.id} onClick={() => moderar(a, 'resuelto')}>Marcar resuelto</button>}
                {a.estado !== 'rechazado' && <button disabled={ocupado === a.id} onClick={() => moderar(a, 'rechazado')}>Rechazar</button>}
                {a.estado !== 'pendiente' && <button disabled={ocupado === a.id} onClick={() => moderar(a, 'pendiente')}>Volver a pendiente</button>}
                <button onClick={() => setUbicando(ubicando === a.id ? '' : a.id)}>{a.lat != null ? 'Cambiar ubicación' : 'Ubicar en el mapa'}</button>
              </div>
              {ubicando === a.id && (
                <UbicarAviso seccion={seccion} a={a} llamar={llamar} alGuardar={() => { setUbicando(''); setOk('Ubicación guardada.'); cargar() }} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
