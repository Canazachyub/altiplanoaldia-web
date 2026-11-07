import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/tokens.css'
import './styles/app.css'
import './styles/mejoras.css'
import './styles/portada-lr.css'
import './styles/interiores-lr.css'
import './styles/tipografia-lr.css'
import './styles/imagenes-grandes.css'

// Lectura sin conexión (solo en producción, para no interferir con la recarga en caliente de Vite)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
