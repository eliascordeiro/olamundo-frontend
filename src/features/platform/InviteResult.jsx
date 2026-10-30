import { useState } from 'react'

// O token em claro só existe nesta resposta; o link nunca é persistido no navegador.
export default function InviteResult({ issued, param, onDismiss }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/?${param}=${encodeURIComponent(issued.token)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return <div className="platform-invite" role="status" aria-label="Convite emitido">
    <strong>Convite para {issued.name}</strong>
    <p className="catalog-hint">
      Este link é exibido uma única vez, vale até {new Date(issued.expiresAt).toLocaleString('pt-BR')} e
      só pode ser usado uma vez. Envie por um canal seguro; a pessoa definirá a própria senha.
    </p>
    <code>{link}</code>
    <div className="platform-actions">
      <button type="button" className="secondary-button" onClick={copy}>{copied ? 'Link copiado' : 'Copiar link'}</button>
      <button type="button" className="secondary-button" onClick={onDismiss}>Fechar convite</button>
    </div>
  </div>
}
