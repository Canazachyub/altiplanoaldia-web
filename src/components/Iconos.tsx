// Íconos de interfaz en SVG en línea (heredan color con currentColor).
type P = { size?: number; className?: string }

const base = (size = 20, className?: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true, focusable: false, className,
})

export const IcoMenu = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
)
export const IcoCerrar = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IcoBuscar = ({ size, className }: P) => (
  <svg {...base(size, className)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
)
export const IcoLuna = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)
export const IcoSol = ({ size, className }: P) => (
  <svg {...base(size, className)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const IcoFlecha = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M9 6l6 6-6 6" /></svg>
)
export const IcoReloj = ({ size, className }: P) => (
  <svg {...base(size, className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IcoEnlace = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
)
export const IcoMegafono = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
)
export const IcoCorreo = ({ size, className }: P) => (
  <svg {...base(size, className)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
)
export const IcoArriba = ({ size, className }: P) => (
  <svg {...base(size, className)}><path d="M6 15l6-6 6 6" /></svg>
)

const relleno = (size = 20, className?: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, focusable: false, className,
})

export const IcoFacebook = ({ size, className }: P) => (
  <svg {...relleno(size, className)}><path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" /></svg>
)
export const IcoTiktok = ({ size, className }: P) => (
  <svg {...relleno(size, className)}><path d="M16.6 3h-3.1v12.2a2.7 2.7 0 1 1-2.7-2.7c.3 0 .6 0 .8.1V9.4a5.9 5.9 0 1 0 5 5.8V9.1a7.6 7.6 0 0 0 4.4 1.4V7.4a4.5 4.5 0 0 1-4.4-4.4z" /></svg>
)
export const IcoWhatsapp = ({ size, className }: P) => (
  <svg {...relleno(size, className)}><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
)
export const IcoX = ({ size, className }: P) => (
  <svg {...relleno(size, className)}><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" /></svg>
)
