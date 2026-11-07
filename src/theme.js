export const themes = [
  { id: 'dark', label: 'Escuro' },
  { id: 'contrast', label: 'Alto contraste' },
]

const storageKey = 'nexo.theme'
const themeColors = { dark: '#0b1411', contrast: '#000000' }

// Preferência de interface (não é dado de negócio); falhas de armazenamento são ignoradas.
export function readTheme() {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (themes.some(theme => theme.id === saved)) return saved
  } catch {
    // Sem armazenamento (ou com o antigo tema claro), usa o padrão.
  }
  return window.matchMedia?.('(prefers-contrast: more)').matches ? 'contrast' : 'dark'
}

export const otherTheme = id => (id === 'dark' ? 'contrast' : 'dark')

export function applyTheme(id) {
  document.documentElement.dataset.theme = id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[id])
}

export function saveTheme(id) {
  applyTheme(id)
  try {
    window.localStorage.setItem(storageKey, id)
  } catch {
    // A escolha vale só nesta sessão.
  }
}
