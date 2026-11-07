import { useEffect } from 'react'

export function useTitulo(titulo?: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} | Altiplano al Día` : 'Altiplano al Día · Noticias de Puno y la región'
  }, [titulo])
}
