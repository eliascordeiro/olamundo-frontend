import { useState } from 'react'
import Icon from '../../components/Icon'
import QueryError from '../../components/QueryError'
import { useCreateSalesperson, useGrantSellerAccess, useSalespeople, useSalesperson, useSaveSalesperson } from './queries'
import { useStores } from '../catalog/queries'
import InviteResult from '../platform/InviteResult'
import './team.css'

function NewSalesperson({ userId, storeId }) {
  const creation = useCreateSalesperson(userId, storeId)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await creation.submit({ name: name.trim() })
      setName('')
      setNotice('Vendedor cadastrado. Nenhuma conta ou permissão foi criada.')
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="team-form" aria-label="Cadastrar vendedor" onSubmit={submit}>
    <h3>Novo vendedor</h3>
    <p className="catalog-hint">O cadastro comercial pode existir sem login, preservando a identidade do vendedor para as próximas etapas.</p>
    <fieldset disabled={creation.sending}>
      <label>Nome do novo vendedor<input required minLength={2} maxLength={120}
        value={creation.pendingOperation?.name ?? name} disabled={Boolean(creation.pendingOperation)}
        onChange={event => setName(event.target.value)} /></label>
      {creation.pendingOperation && <p className="catalog-hint" role="status">Há um cadastro aguardando confirmação. Confirme o mesmo envio para evitar duplicação.</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <button className="primary-button" type="submit">{creation.sending ? 'Cadastrando...'
        : creation.pendingOperation ? 'Confirmar mesmo cadastro' : 'Cadastrar vendedor'}</button>
    </fieldset>
  </form>
}

const roleOptions = [['STAFF', 'Colaborador'], ['MANAGER', 'Gerente']]

function AccessForm({ userId, store, seller, disabled, onError, onGranted, onUnlink }) {
  const access = useGrantSellerAccess(userId, store.id, seller.id)
  const stores = useStores(userId)
  const [email, setEmail] = useState('')
  const [grants, setGrants] = useState({ [store.id]: 'STAFF' })
  const [issued, setIssued] = useState(null)
  const ownedStores = (stores.data?.pages.flatMap(page => page.content) ?? []).filter(item => item.role === 'OWNER')

  function toggle(id, checked) {
    setGrants(previous => {
      const next = { ...previous }
      if (checked) next[id] = 'STAFF'
      else delete next[id]
      return next
    })
  }

  async function submit(event) {
    event.preventDefault()
    onError('')
    setIssued(null)
    try {
      const result = await access.mutateAsync({
        email: email.trim(), version: seller.version,
        stores: Object.entries(grants).map(([storeId, role]) => ({ storeId, role })),
      })
      setEmail('')
      if (result.inviteToken) {
        setIssued({ name: email.trim(), token: result.inviteToken, expiresAt: result.expiresAt })
        onGranted('Esta pessoa ainda não tem conta. Envie o convite abaixo para ela definir a senha e acessar as lojas escolhidas.')
      } else {
        onGranted('Conta vinculada e acesso concedido nas lojas escolhidas. Quem já era membro manteve o perfil atual.')
      }
    } catch (err) {
      onError(err)
    }
  }

  return <form className="team-form" aria-label="Vincular conta do vendedor" onSubmit={submit}>
    <h3>Conta de acesso</h3>
    <p className="team-account">{seller.userId ? `Conta vinculada: ${seller.accountEmail ?? seller.userId}` : 'Sem conta vinculada'}</p>
    <p className="catalog-hint">Informe o e-mail e escolha as lojas em que a pessoa poderá entrar. Sem conta, geramos um convite para ela criar a senha.</p>
    <fieldset disabled={disabled || access.isPending}>
      <label>E-mail da conta<input required type="email" maxLength={254}
        value={email} onChange={event => setEmail(event.target.value)} autoCapitalize="none" /></label>
      <fieldset className="team-stores"><legend>Lojas com acesso</legend>
        {stores.isPending && <p role="status" className="catalog-hint">Carregando lojas...</p>}
        {stores.isError && <p className="catalog-hint">Não foi possível carregar suas outras lojas; o acesso será concedido só nesta loja.</p>}
        {ownedStores.map(item => <div className="team-store-row" key={item.id}>
          <label className="team-checkbox"><input type="checkbox" checked={item.id in grants}
            disabled={item.id === store.id} onChange={event => toggle(item.id, event.target.checked)} />
            {item.name}{item.id === store.id ? ' (esta loja)' : ''}</label>
          {item.id in grants && <select aria-label={`Perfil em ${item.name}`} value={grants[item.id]}
            onChange={event => setGrants(previous => ({ ...previous, [item.id]: event.target.value }))}>
            {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
        </div>)}
        {stores.hasNextPage && <button type="button" className="inline-button" disabled={stores.isFetchingNextPage}
          onClick={() => stores.fetchNextPage()}>Carregar mais lojas</button>}
      </fieldset>
      <p className="catalog-hint">Quem já participa de uma loja mantém o perfil atual. Cada loja ganha um cadastro de vendedor ligado à conta.</p>
      <div className="team-actions">
        <button type="submit" className="primary-button">{access.isPending ? 'Concedendo...'
          : seller.userId ? 'Atualizar acesso' : 'Vincular conta'}</button>
        {seller.userId && <button className="secondary-button" type="button" onClick={onUnlink}>Desvincular conta</button>}
      </div>
    </fieldset>
    {issued && <InviteResult issued={issued} param="acesso" onDismiss={() => setIssued(null)} />}
  </form>
}

function SalespersonEditor({ userId, store, seller, onSaved, onRefresh, refreshing }) {
  const storeId = store.id
  const mutation = useSaveSalesperson(userId, storeId, seller.id)
  const [name, setName] = useState(seller.name)
  const [active, setActive] = useState(seller.active)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const disabled = mutation.isPending || refreshing

  function fail(err) {
    if (!err) return setError('')
    setError(err.message)
    if (err.status === 0 || err.status === 408 || err.status === 409 || err.status >= 500) setBlocked(true)
  }

  async function save(account, payload) {
    setError('')
    try {
      const saved = await mutation.mutateAsync({ account, payload: { ...payload, version: seller.version } })
      if (!account) {
        setName(saved.name)
        setActive(saved.active)
      }
      onSaved(account ? 'Vínculo comercial removido. As permissões da conta não foram alteradas.'
        : 'Cadastro comercial atualizado. O acesso da conta não foi alterado.')
    } catch (err) {
      fail(err)
    }
  }

  return <div className="team-editor" aria-label={`Cadastro comercial de ${seller.name}`}>
    <p className="catalog-hint">Versão {seller.version}. Inativar não bloqueia o login nem revoga permissões. Não há exclusão de vendedores nesta etapa.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {blocked && <p className="catalog-hint">Confira a situação gravada antes de tentar outra alteração.</p>}
    <p className="catalog-hint">Recarregar descarta as alterações ainda não salvas neste cadastro.</p>
    <button className="secondary-button" type="button" disabled={disabled}
      onClick={onRefresh}>{refreshing ? 'Recarregando...' : 'Recarregar cadastro'}</button>
    <div className="team-editor-grid">
      <form className="team-form" aria-label="Editar vendedor" onSubmit={event => {
        event.preventDefault()
        save(false, { name: name.trim(), active })
      }}>
        <h3>Cadastro comercial</h3>
        <fieldset disabled={disabled || blocked}>
          <label>Nome do vendedor<input required minLength={2} maxLength={120}
            value={name} onChange={event => setName(event.target.value)} /></label>
          <label className="team-checkbox"><input type="checkbox" checked={active}
            onChange={event => setActive(event.target.checked)} />Vendedor ativo</label>
          <button type="submit" className="primary-button">Salvar cadastro comercial</button>
        </fieldset>
      </form>
      <AccessForm userId={userId} store={store} seller={seller} disabled={disabled || blocked}
        onError={fail} onGranted={onSaved} onUnlink={() => save(true, { email: '' })} />
    </div>
  </div>
}

function SelectedSalesperson({ userId, store, id, onClose }) {
  const storeId = store.id
  const query = useSalesperson(userId, storeId, id)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')

  async function refresh() {
    setNotice('')
    const result = await query.refetch()
    if (!result.isError) setRevision(previous => previous + 1)
  }

  return <section className="team-detail" aria-label="Gerenciar vendedor">
    <div className="catalog-heading"><h3>Gerenciar vendedor</h3>
      <button type="button" className="secondary-button" onClick={onClose}>Fechar cadastro</button></div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {query.isPending ? <p role="status">Carregando cadastro...</p>
      : query.isError ? <QueryError query={query} label="Não foi possível consultar o vendedor" />
        : <SalespersonEditor key={`${id}:${revision}`} userId={userId} store={store}
          seller={query.data} onSaved={setNotice} onRefresh={refresh} refreshing={query.isFetching} />}
  </section>
}

function OwnerTeam({ userId, store }) {
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const query = useSalespeople(userId, store.id, page)

  function changePage(next) {
    setSelectedId('')
    setPage(next)
  }

  return <>
    <div className="team-section-heading"><h3>Vendedores da loja</h3>
      <button type="button" className="secondary-button" disabled={query.isFetching}
        onClick={() => query.refetch()}>Atualizar vendedores</button></div>
    {query.isPending ? <p role="status">Carregando vendedores...</p>
      : query.isError ? <QueryError query={query} label="Não foi possível carregar os vendedores" />
        : <>
          {query.data.content.length === 0 ? <p className="empty-state">Nenhum vendedor nesta página.</p>
            : <ul className="team-list" aria-label={`Vendedores de ${store.name}`}>{query.data.content.map(seller =>
              <li key={seller.id}>
                <span className="team-avatar"><Icon name="user" size={22} /></span>
                <div className="team-person"><h3>{seller.name}</h3>
                  <p>{seller.userId ? 'Com conta de acesso vinculada' : 'Cadastro comercial sem login'}</p></div>
                <span className={`team-status${seller.active ? '' : ' team-status-inactive'}`}>{seller.active ? 'Ativo' : 'Inativo'}</span>
                <button type="button" className="secondary-button" aria-label={`Gerenciar ${seller.name}`}
                  aria-pressed={selectedId === seller.id} onClick={() => setSelectedId(seller.id)}>Gerenciar</button>
              </li>)}</ul>}
          <nav className="catalog-pagination" aria-label="Páginas de vendedores">
            <button type="button" className="secondary-button" aria-label="Página anterior de vendedores"
              disabled={page === 0 || query.isFetching} onClick={() => changePage(page - 1)}>Página anterior</button>
            <span>Página {page + 1}</span>
            <button type="button" className="secondary-button" aria-label="Próxima página de vendedores"
              disabled={!query.data.hasNext || query.isFetching} onClick={() => changePage(page + 1)}>Próxima página</button>
          </nav>
        </>}
    {selectedId && <SelectedSalesperson key={selectedId} userId={userId} store={store}
      id={selectedId} onClose={() => setSelectedId('')} />}
    <NewSalesperson userId={userId} storeId={store.id} />
  </>
}

export default function TeamPanel({ userId, store }) {
  return <section className="team-workspace" aria-label={`Equipe de ${store.name}`}>
    <div className="catalog-heading">
      <div><span className="section-eyebrow">PESSOAS QUE FAZEM A LOJA</span><h2>Equipe e vendedores</h2>
        <p>Identidade comercial por loja, separada do login e das permissões.</p></div>
      <span className="team-icon"><Icon name="user" size={28} /></span>
    </div>
    <div className="team-policy"><Icon name="shield" size={22} />
      <p>O proprietário gerencia o cadastro comercial. Contas e permissões continuam independentes.
        Vendas e comissões ainda não utilizam este cadastro; nenhum dado legado foi importado.</p></div>
    {store.role === 'OWNER' ? <OwnerTeam userId={userId} store={store} />
      : <p className="empty-state">Somente o proprietário pode gerenciar a equipe desta loja.</p>}
  </section>
}
