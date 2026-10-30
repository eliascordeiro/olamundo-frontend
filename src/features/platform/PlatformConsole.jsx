import { useState } from 'react'
import Icon from '../../components/Icon'
import QueryError from '../../components/QueryError'
import { useLogout } from '../../queries'
import { useCreatePlatformOwner, useInvitePlatformOwner, usePlatformOwners } from './queries'
import InviteResult from './InviteResult'
import './platform.css'

const statusLabels = { PENDING: 'Aguardando convite', INVITED: 'Convite emitido', ACTIVE: 'Ativo' }

function NewOwner({ userId, onResult }) {
  const creation = useCreatePlatformOwner(userId)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const pending = creation.pendingOperation

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const result = await creation.submit({ name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) })
      setName('')
      setEmail('')
      onResult(result)
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="platform-form" aria-label="Cadastrar proprietário" onSubmit={submit}>
    <h3>Novo proprietário</h3>
    <p className="catalog-hint">Cria o cadastro do proprietário. Com e-mail, emite o convite; sem e-mail, o convite pode ser emitido depois.</p>
    <fieldset disabled={creation.sending}>
      <label>Nome do novo proprietário<input required minLength={2} maxLength={120}
        value={pending?.name ?? name} disabled={Boolean(pending)} onChange={event => setName(event.target.value)} /></label>
      <label>E-mail do proprietário (opcional)<input type="email" maxLength={254} autoCapitalize="none"
        value={pending ? pending.email ?? '' : email} disabled={Boolean(pending)}
        onChange={event => setEmail(event.target.value)} /></label>
      {pending && <p className="catalog-hint" role="status">Há um cadastro aguardando confirmação. Confirme o mesmo envio para evitar duplicação.</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="primary-button" type="submit">{creation.sending ? 'Cadastrando...'
        : pending ? 'Confirmar mesmo cadastro' : 'Cadastrar proprietário'}</button>
    </fieldset>
  </form>
}

function InviteForm({ userId, owner, onResult, onClose }) {
  const mutation = useInvitePlatformOwner(userId)
  const [email, setEmail] = useState(owner.email ?? '')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const result = await mutation.mutateAsync({ id: owner.id, email: email.trim() })
      onResult(result)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="platform-form" aria-label={`Emitir convite para ${owner.name}`} onSubmit={submit}>
    <h3>Convite de {owner.name}</h3>
    <p className="catalog-hint">Um novo convite invalida os anteriores. Se o e-mail já tiver conta, ela é vinculada sem convite.</p>
    <fieldset disabled={mutation.isPending}>
      <label>E-mail do proprietário<input required type="email" maxLength={254} autoCapitalize="none"
        value={email} onChange={event => setEmail(event.target.value)} /></label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="platform-actions">
        <button className="primary-button" type="submit">{mutation.isPending ? 'Emitindo...' : 'Emitir convite'}</button>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
      </div>
    </fieldset>
  </form>
}

export default function PlatformConsole({ user }) {
  const logout = useLogout()
  const [page, setPage] = useState(0)
  const [inviting, setInviting] = useState('')
  const [issued, setIssued] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const query = usePlatformOwners(user.id, page)

  function showResult(result) {
    setNotice('')
    if (result.inviteToken) {
      setIssued({ name: result.owner.name, token: result.inviteToken, expiresAt: result.expiresAt })
    } else if (result.owner.status === 'ACTIVE') {
      setIssued(null)
      setNotice(`${result.owner.name} foi ativado com a conta existente do e-mail informado.`)
    } else {
      setIssued(null)
      setNotice(`${result.owner.name} foi cadastrado. Emita o convite quando tiver o e-mail do proprietário.`)
    }
  }

  async function signOut() {
    setError('')
    try {
      await logout.mutateAsync()
    } catch (err) {
      setError(err.message)
    }
  }

  return <div className="platform-console">
    <header className="platform-header">
      <span className="workspace-location"><Icon name="shield" size={18} /> <strong>Administração da plataforma</strong></span>
      <div className="account-menu"><span>{user.name}</span>
        <button type="button" className="secondary-button" onClick={signOut} disabled={logout.isPending}><Icon name="exit" size={17} /> Sair</button></div>
    </header>
    <main className="platform-body" id="platform-content" tabIndex={-1}>
      <div className="catalog-heading"><div><span className="section-eyebrow">SOMENTE ADMINISTRADOR DA PLATAFORMA</span>
        <h1>Proprietários</h1>
        <p>Cada proprietário administra suas próprias lojas e equipes. Este console não acessa dados de lojas.</p></div></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {issued && <InviteResult issued={issued} param="convite" onDismiss={() => setIssued(null)} />}
      {query.isPending ? <p role="status">Carregando proprietários...</p>
        : query.isError ? <QueryError query={query} label="Não foi possível carregar os proprietários" />
          : <>
            {query.data.content.length === 0 ? <p className="empty-state">Nenhum proprietário nesta página.</p>
              : <ul className="platform-list" aria-label="Proprietários da plataforma">{query.data.content.map(owner =>
                <li key={owner.id}>
                  <div className="platform-person"><h3>{owner.name}</h3>
                    <p>{owner.email ?? 'Sem e-mail cadastrado'}</p></div>
                  <span className={`platform-badge${owner.status === 'PENDING' ? ' platform-badge-pending' : owner.status === 'INVITED' ? ' platform-badge-invited' : ''}`}>{statusLabels[owner.status]}</span>
                  {owner.status !== 'ACTIVE' && <button type="button" className="secondary-button"
                    aria-label={`Convidar ${owner.name}`} onClick={() => setInviting(owner.id)}>Emitir convite</button>}
                </li>)}</ul>}
            <nav className="catalog-pagination" aria-label="Páginas de proprietários">
              <button type="button" className="secondary-button" disabled={page === 0 || query.isFetching}
                onClick={() => { setInviting(''); setPage(page - 1) }}>Página anterior</button>
              <span>Página {page + 1}</span>
              <button type="button" className="secondary-button" disabled={!query.data.hasNext || query.isFetching}
                onClick={() => { setInviting(''); setPage(page + 1) }}>Próxima página</button>
            </nav>
            {inviting && query.data.content.some(owner => owner.id === inviting) &&
              <InviteForm key={inviting} userId={user.id} owner={query.data.content.find(owner => owner.id === inviting)}
                onResult={showResult} onClose={() => setInviting('')} />}
          </>}
      <NewOwner userId={user.id} onResult={showResult} />
    </main>
  </div>
}
