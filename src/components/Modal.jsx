import { useEffect, useRef } from 'react'

// <dialog> nativo: foco preso, Esc fecha e o resto da página fica inerte.
export default function Modal({ title, onClose, children }) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  return <dialog ref={dialog} className="modal" aria-label={title}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className="modal-card">
      <div className="modal-header"><h2>{title}</h2>
        <button type="button" className="secondary-button" onClick={onClose}>Fechar</button></div>
      <div className="modal-body">{children}</div>
    </div>
  </dialog>
}
