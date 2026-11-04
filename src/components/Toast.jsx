import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContext'

const DURATION = 6000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const container = useRef(null)
  const next = useRef(0)

  const dismiss = useCallback((id) => setToasts(current => current.filter(toast => toast.id !== id)), [])
  const notify = useCallback((message) => {
    const id = next.current++
    setToasts(current => [...current, { id, message }])
    setTimeout(() => dismiss(id), DURATION)
  }, [dismiss])

  // Popover vai para a camada superior, então o aviso aparece também acima de janelas abertas.
  useEffect(() => {
    const element = container.current
    if (!element?.showPopover) return
    if (toasts.length === 0) {
      if (element.matches(':popover-open')) element.hidePopover()
      return
    }
    if (element.matches(':popover-open')) element.hidePopover()
    element.showPopover()
  }, [toasts])

  const value = useMemo(() => notify, [notify])

  return <ToastContext.Provider value={value}>
    {children}
    <div ref={container} popover="manual" className="toast-region" aria-live="polite">
      {toasts.map(toast => <div key={toast.id} className="toast" role="status">
        <span>{toast.message}</span>
        <button type="button" className="toast-close" aria-label="Dispensar aviso" onClick={() => dismiss(toast.id)}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>
}
