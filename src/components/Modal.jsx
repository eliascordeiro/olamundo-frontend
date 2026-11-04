import { useCallback, useEffect, useRef, useState } from 'react'
import { ModalGuardContext } from './modalGuard'

// <dialog> nativo: foco preso, Esc fecha e o resto da página fica inerte.
export default function Modal({ title, onClose, children }) {
  const dialog = useRef(null)
  const dirty = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const setDirty = useCallback(value => { dirty.current = value }, [])

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  function requestClose() {
    if (dirty.current) setConfirming(true)
    else onClose()
  }

  return <dialog ref={dialog} className="modal" aria-label={title}
    onCancel={event => { event.preventDefault(); requestClose() }}
    onClick={event => { if (event.target === dialog.current) requestClose() }}>
    <div className="modal-card">
      <div className="modal-header"><h2>{title}</h2>
        <button type="button" className="secondary-button" onClick={requestClose}>Fechar</button></div>
      {confirming && <div className="modal-confirm" role="alertdialog" aria-label="Descartar alterações">
        <p>Há alterações não salvas. Deseja descartá-las?</p>
        <div className="modal-confirm-actions">
          <button type="button" className="secondary-button" autoFocus onClick={() => setConfirming(false)}>Continuar editando</button>
          <button type="button" className="primary-button" onClick={onClose}>Descartar e fechar</button>
        </div>
      </div>}
      <div className="modal-body">
        <ModalGuardContext.Provider value={setDirty}>
          {children}
        </ModalGuardContext.Provider>
      </div>
    </div>
  </dialog>
}
