// Google Analytics 4 y Google AdSense. Se activan solo si la compilación trae sus identificadores
// (variables del repositorio GA_ID y ADSENSE_CLIENT → VITE_GA_ID y VITE_ADSENSE_CLIENT); sin ellos no se
// carga nada de Google. El panel /admin nunca lleva publicidad ni se mide.
const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() ?? ''
const ADSENSE = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() ?? ''

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

let iniciado = false

function script(src: string, extra: Record<string, string> = {}) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  Object.entries(extra).forEach(([k, v]) => s.setAttribute(k, v))
  document.head.appendChild(s)
}

function iniciar(ruta: string) {
  if (iniciado || ruta.startsWith('/admin')) return
  iniciado = true
  if (/^G-[A-Z0-9]+$/.test(GA_ID)) {
    script(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    window.gtag('js', new Date())
    // Las visitas se envían a mano en cada cambio de página (la web es de una sola página).
    window.gtag('config', GA_ID, { send_page_view: false })
  }
  if (/^ca-pub-\d+$/.test(ADSENSE)) {
    script(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`, { crossorigin: 'anonymous' })
  }
}

/** Llamar en cada cambio de ruta. */
export function registrarVisita(ruta: string) {
  iniciar(ruta)
  if (!window.gtag || !GA_ID || ruta.startsWith('/admin')) return
  window.gtag('event', 'page_view', { page_path: ruta, page_location: window.location.href, page_title: document.title })
}
