import { createContext, useContext, useEffect } from 'react'

export const ModalGuardContext = createContext(() => {})

// Avisa a janela aberta que há alterações não salvas, para confirmar antes de fechar.
export function useUnsavedGuard(dirty) {
  const setDirty = useContext(ModalGuardContext)
  useEffect(() => {
    setDirty(dirty)
    return () => setDirty(false)
  }, [dirty, setDirty])
}
