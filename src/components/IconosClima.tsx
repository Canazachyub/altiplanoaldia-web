// Íconos del tiempo dibujados a mano en SVG (planos, colores de la marca), en lugar de emojis.
// Códigos WMO de Open-Meteo: https://open-meteo.com/en/docs (weather_code).

type Tipo = 'sol' | 'solnube' | 'nube' | 'niebla' | 'llovizna' | 'lluvia' | 'nieve' | 'granizo' | 'tormenta'

export function tipoClima(codigo: number): Tipo {
  if (codigo === 0) return 'sol'
  if (codigo === 1 || codigo === 2) return 'solnube'
  if (codigo === 3) return 'nube'
  if (codigo === 45 || codigo === 48) return 'niebla'
  if (codigo >= 51 && codigo <= 57) return 'llovizna'
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return 'lluvia'
  if (codigo === 77) return 'granizo'
  if ((codigo >= 71 && codigo <= 75) || codigo === 85 || codigo === 86) return 'nieve'
  if (codigo >= 95) return 'tormenta'
  return 'nube'
}

const SOL = '#FFC400'
const NUBE = '#EEF2F8'
const NUBE_BORDE = '#7D8DA6'
const NUBE_OSC = '#C3CCDA'
const AGUA = '#2F80ED'

// Nube base (≈ x 6–44, y 12–36)
const D_NUBE = 'M13 36a7 7 0 0 1 0-14a10 10 0 0 1 19-3a8 8 0 0 1 3 17z'

function Rayos({ cx, cy, r1, r2 }: { cx: number; cy: number; r1: number; r2: number }) {
  return (
    <g stroke={SOL} strokeWidth="2.6" strokeLinecap="round">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4
        return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} />
      })}
    </g>
  )
}

function Nube({ y = 0, oscura = false }: { y?: number; oscura?: boolean }) {
  return <path d={D_NUBE} transform={`translate(0 ${y})`} fill={oscura ? NUBE_OSC : NUBE} stroke={NUBE_BORDE} strokeWidth="1.6" strokeLinejoin="round" />
}

export function IconoClima({ codigo, size = 48, titulo }: { codigo: number; size?: number; titulo?: string }) {
  const t = tipoClima(codigo)
  return (
    <svg className={`ico-clima ico-clima--${t}`} width={size} height={size} viewBox="0 0 48 48" role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {t === 'sol' && (
        <>
          <Rayos cx={24} cy={24} r1={13} r2={19} />
          <circle cx="24" cy="24" r="9" fill={SOL} />
        </>
      )}
      {t === 'solnube' && (
        <>
          <Rayos cx={18} cy={17} r1={9.5} r2={14} />
          <circle cx="18" cy="17" r="6.5" fill={SOL} />
          <Nube y={4} />
        </>
      )}
      {t === 'nube' && (
        <>
          <path d={D_NUBE} transform="translate(9 -5) scale(.72)" fill={NUBE_OSC} stroke={NUBE_BORDE} strokeWidth="2" strokeLinejoin="round" />
          <Nube y={3} />
        </>
      )}
      {t === 'niebla' && (
        <>
          <Nube y={-5} />
          <g stroke={NUBE_BORDE} strokeWidth="2.6" strokeLinecap="round">
            <line x1="9" y1="37" x2="39" y2="37" />
            <line x1="14" y1="43" x2="34" y2="43" />
          </g>
        </>
      )}
      {(t === 'llovizna' || t === 'lluvia') && (
        <>
          <Nube y={-5} oscura={t === 'lluvia'} />
          <g stroke={AGUA} strokeWidth="2.6" strokeLinecap="round">
            {t === 'lluvia' ? (
              <>
                <line x1="17" y1="36" x2="14.5" y2="43" />
                <line x1="24.5" y1="36" x2="22" y2="43" />
                <line x1="32" y1="36" x2="29.5" y2="43" />
              </>
            ) : (
              <>
                <line x1="17" y1="37" x2="16" y2="40" />
                <line x1="24.5" y1="39" x2="23.5" y2="42" />
                <line x1="32" y1="37" x2="31" y2="40" />
              </>
            )}
          </g>
        </>
      )}
      {t === 'nieve' && (
        <>
          <Nube y={-5} />
          <g fill="#9CC3F5" stroke={AGUA} strokeWidth="1.2">
            <circle cx="16" cy="38" r="2.4" />
            <circle cx="24.5" cy="42" r="2.4" />
            <circle cx="33" cy="38" r="2.4" />
          </g>
        </>
      )}
      {t === 'granizo' && (
        <>
          <Nube y={-5} oscura />
          <g fill="#fff" stroke={NUBE_BORDE} strokeWidth="1.4">
            <circle cx="16" cy="38.5" r="2.6" />
            <circle cx="24.5" cy="42.5" r="2.6" />
            <circle cx="33" cy="38.5" r="2.6" />
          </g>
        </>
      )}
      {t === 'tormenta' && (
        <>
          <Nube y={-6} oscura />
          <path d="M26 30l-6 9h5l-3 7 9-10h-5l3-6z" fill={SOL} stroke="#B98A00" strokeWidth="1" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/* Íconos de dato (monocromos, heredan el color del texto) */
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const IcoGota = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" /></svg>
)
export const IcoViento = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" /></svg>
)
export const IcoHumedad = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" /><path d="M9.5 15.5l5-5M9.6 11h.01M14.4 15.2h.01" /></svg>
)
export const IcoUV = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const IcoTermometro = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 10v6" /></svg>
)
export const IcoCopo = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M12 2v20M4 6.5l16 11M20 6.5l-16 11M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" /></svg>
)
export const IcoOk = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></svg>
)
