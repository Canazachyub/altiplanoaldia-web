// Configuración central del sitio: canales oficiales, secciones y ámbitos.

export const SITIO = {
  nombre: 'Altiplano al Día',
  lema: 'Noticias de Puno y la región',
  ciudad: 'Puno',
  facebook: 'https://www.facebook.com/profile.php?id=100077594686001',
  tiktok: 'https://www.tiktok.com/@altiplano_al_dia',
  tiktokUsuario: '@altiplano_al_dia',
  whatsappDenuncias: '51982591289',
  whatsappVisible: '+51 982 591 289',
  firma: 'Redacción Altiplano al Día',
  // Coordenadas de Puno para el clima en la barra superior (Open-Meteo, sin API key)
  lat: -15.8402,
  lon: -70.0219,
}

export function enlaceWhatsApp(texto: string) {
  return `https://wa.me/${SITIO.whatsappDenuncias}?text=${encodeURIComponent(texto)}`
}

export interface Seccion {
  clave: string
  nombre: string
  tema: string // valor del campo `tema` en noticias.json
  color: string
  icono: string // archivo en /icons
}

export const SECCIONES: Seccion[] = [
  { clave: 'politica', nombre: 'Política', tema: 'Política', color: '#043F9B', icono: 'tema_politica' },
  { clave: 'seguridad', nombre: 'Seguridad', tema: 'Seguridad/Policiales', color: '#C62828', icono: 'tema_seguridad' },
  { clave: 'sociedad', nombre: 'Sociedad', tema: 'Sociedad', color: '#D84315', icono: 'tema_sociedad' },
  { clave: 'economia', nombre: 'Economía', tema: 'Economía', color: '#2E7D32', icono: 'tema_economia' },
  { clave: 'educacion', nombre: 'Educación', tema: 'Educación', color: '#6A1B9A', icono: 'tema_educacion' },
  { clave: 'salud', nombre: 'Salud', tema: 'Salud', color: '#00838F', icono: 'tema_salud' },
  { clave: 'cultura', nombre: 'Cultura', tema: 'Cultura', color: '#AD1457', icono: 'tema_cultura' },
  { clave: 'deportes', nombre: 'Deportes', tema: 'Deportes', color: '#1565C0', icono: 'tema_deportes' },
  { clave: 'ambiente', nombre: 'Medio ambiente', tema: 'Medio ambiente', color: '#2E7D32', icono: 'tema_medio-ambiente' },
  { clave: 'otros', nombre: 'Otros', tema: 'Otros', color: '#37474F', icono: 'tema_otros' },
]

export interface Ambito {
  clave: string
  nombre: string
  valor: string
  icono: string
}

export const AMBITOS: Ambito[] = [
  { clave: 'distrital', nombre: 'Distrital', valor: 'DISTRITAL', icono: 'ambito_distrital' },
  { clave: 'local', nombre: 'Local', valor: 'LOCAL', icono: 'ambito_local' },
  { clave: 'regional', nombre: 'Regional', valor: 'REGIONAL', icono: 'ambito_regional' },
  { clave: 'nacional', nombre: 'Nacional', valor: 'NACIONAL', icono: 'ambito_nacional' },
  { clave: 'internacional', nombre: 'Internacional', valor: 'INTERNACIONAL', icono: 'ambito_internacional' },
]

export const seccionPorClave = (clave?: string) => SECCIONES.find((s) => s.clave === clave)
export const seccionPorTema = (tema: string) => SECCIONES.find((s) => s.tema === tema) ?? SECCIONES[SECCIONES.length - 1]
export const ambitoPorClave = (clave?: string) => AMBITOS.find((a) => a.clave === clave)
export const ambitoPorValor = (valor: string) => AMBITOS.find((a) => a.valor === valor)
export const temaColor = (tema: string) => seccionPorTema(tema).color

/** Ruta pública respetando el `base` de Vite. */
export const pub = (ruta: string) => `${import.meta.env.BASE_URL}${ruta.replace(/^\//, '')}`
