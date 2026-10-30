export const themes = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'contrast', label: 'Alto contraste' },
]

const storageKey = 'nexo.theme'
const themeColors = { light: '#103e34', dark: '#0b1411', contrast: '#000000' }

// Preferência de interface (não é dado de negócio); falhas de armazenamento são ignoradas.
export function readTheme() {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (themes.some(theme => theme.id === saved)) return saved
  } catch {
    // Sem armazenamento, segue a preferência do sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

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
