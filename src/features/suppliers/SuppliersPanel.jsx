import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import QueryError from '../../components/QueryError'
import { formatDocument } from '../customers/format'
import { useCreateSupplier, useSaveSupplier, useSupplier, useSuppliers } from './queries'
import '../customers/customers.css'

const fields = [
  ['name', 'Nome do fornecedor', { required: true, minLength: 2, maxLength: 120 }],
  ['document', 'CNPJ/CPF', { maxLength: 18, inputMode: 'numeric' }],
  ['stateRegistration', 'Inscrição estadual', { maxLength: 20 }],
  ['contact', 'Contato', { maxLength: 60 }],
  ['phone', 'Telefone', { maxLength: 20, inputMode: 'tel' }],
  ['fax', 'Fax', { maxLength: 20, inputMode: 'tel' }],
  ['email', 'E-mail', { type: 'email', maxLength: 254, autoCapitalize: 'none' }],
  ['zip', 'CEP', { maxLength: 9, inputMode: 'numeric' }],
  ['street', 'Endereço', { maxLength: 100 }],
  ['neighborhood', 'Bairro', { maxLength: 60 }],
  ['city', 'Cidade', { maxLength: 60 }],
  ['state', 'UF', { maxLength: 2, autoCapitalize: 'characters' }],
]
const emptySupplier = Object.fromEntries(fields.map(([name]) => [name, '']))
const toValues = (supplier) => Object.fromEntries(fields.map(([name]) => [name, supplier?.[name] ?? '']))
const toPayload = (values) => Object.fromEntries(fields.map(([name]) =>
  [name, typeof values[name] === 'string' && values[name].trim() ? values[name].trim() : null]))

function SupplierFields({ values, onChange, disabled }) {
  return <div className="customer-fields">
    {fields.map(([name, label, attributes]) => <label key={name}>{label}
      <input {...attributes} disabled={disabled} value={values[name] ?? ''}
        onChange={event => onChange(name, event.target.value)} /></label>)}
  </div>
}

function NewSupplier({ userId, storeId, onCreated }) {
  const creation = useCreateSupplier(userId, storeId)
  const [values, setValues] = useState(emptySupplier)
  const [error, setError] = useState('')
  const pending = creation.pendingOperation

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const supplier = await creation.submit(toPayload(values))
      setValues(emptySupplier)
      onCreated(supplier)
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="customer-form" aria-label="Cadastrar fornecedor" onSubmit={submit}>
    <p className="catalog-hint">O fornecedor é da empresa: todas as lojas dela enxergam este cadastro. Só CNPJ/CPF válidos são aceitos.</p>
    <fieldset disabled={creation.sending}>
      <SupplierFields values={pending ? toValues(pending) : values} disabled={Boolean(pending)}
        onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} />
      {pending && <p className="catalog-hint" role="status">Há um cadastro aguardando confirmação. Confirme o mesmo envio para evitar duplicação.</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="primary-button" type="submit">{creation.sending ? 'Cadastrando...'
        : pending ? 'Confirmar mesmo cadastro' : 'Cadastrar fornecedor'}</button>
    </fieldset>
  </form>
}

function SupplierEditor({ userId, storeId, supplier, canWrite, onSaved, onRefresh, refreshing }) {
  const mutation = useSaveSupplier(userId, storeId, supplier.id)
  const [values, setValues] = useState(() => toValues(supplier))
  const [active, setActive] = useState(supplier.active)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const disabled = mutation.isPending || refreshing || !canWrite

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const saved = await mutation.mutateAsync({ ...toPayload(values), active, version: supplier.version })
      setValues(toValues(saved))
      setActive(saved.active)
      onSaved('Fornecedor atualizado.')
    } catch (err) {
      setError(err.message)
      if (err.status === 0 || err.status === 408 || err.status === 409 || err.status >= 500) setBlocked(true)
    }
  }

  return <form className="customer-form" aria-label={`Editar ${supplier.name}`} onSubmit={submit}>
    <p className="catalog-hint">{canWrite ? `Versão ${supplier.version}. Conflito ou resposta incerta exige recarregar antes de salvar de novo; recarregar descarta campos não salvos.`
      : 'Somente proprietário e gerente editam fornecedores. Você pode consultar os dados.'}</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {canWrite && <button className="secondary-button" type="button" disabled={mutation.isPending || refreshing} onClick={onRefresh}>
      {refreshing ? 'Recarregando...' : 'Recarregar cadastro'}</button>}
    <fieldset disabled={disabled || blocked}>
      <SupplierFields values={values} onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} />
      <label className="team-checkbox"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />Fornecedor ativo</label>
      {canWrite && <button className="primary-button" type="submit">{mutation.isPending ? 'Salvando...' : 'Salvar fornecedor'}</button>}
    </fieldset>
  </form>
}

function SelectedSupplier({ userId, store, canWrite, id }) {
  const query = useSupplier(userId, store.id, id)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')

  async function refresh() {
    setNotice('')
    const result = await query.refetch()
    if (!result.isError) setRevision(previous => previous + 1)
  }

  return <section aria-label="Gerenciar fornecedor">
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {query.isPending ? <p role="status">Carregando fornecedor...</p>
      : query.isError ? <QueryError query={query} label="Não foi possível consultar o fornecedor" />
        : <SupplierEditor key={`${id}:${revision}`} userId={userId} storeId={store.id} supplier={query.data}
          canWrite={canWrite} onSaved={setNotice} onRefresh={refresh} refreshing={query.isFetching} />}
  </section>
}

export default function SuppliersPanel({ userId, store }) {
  const canWrite = store.role === 'OWNER' || store.role === 'MANAGER'
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const suppliers = useSuppliers(userId, store.id, query, page)

  useEffect(() => {
    const next = search.trim()
    if (next === query) return undefined
    const timer = setTimeout(() => { setQuery(next); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search, query])

  return <section className="customers-workspace" aria-label={`Fornecedores de ${store.name}`}>
    <div className="catalog-heading"><div><span className="section-eyebrow">DE QUEM A EMPRESA COMPRA</span><h2>Fornecedores</h2>
      <p>Cadastro único da empresa, compartilhado por todas as lojas dela. Todos consultam; proprietário e gerente cadastram e editam.</p></div>
      <span className="team-icon"><Icon name="truck" size={28} /></span></div>
    {canWrite && <button type="button" className="primary-button" onClick={() => { setNotice(''); setCreating(true) }}>+ Novo fornecedor</button>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <label className="customer-search">Buscar fornecedor
      <input type="search" maxLength={100} value={search} placeholder="Nome, CNPJ/CPF ou telefone"
        onChange={event => setSearch(event.target.value)} /></label>
    {suppliers.isPending ? <p role="status">Carregando fornecedores...</p>
      : suppliers.isError && !suppliers.data ? <QueryError query={suppliers} label="Não foi possível carregar os fornecedores" />
        : <>
          {suppliers.isError && <QueryError query={suppliers} label="Não foi possível atualizar os fornecedores" />}
          {suppliers.data.content.length === 0
            ? <p className="empty-state">{query ? 'Nenhum fornecedor encontrado para esta busca.' : 'Nenhum fornecedor nesta página.'}</p>
            : <ul className="customer-list" aria-label="Fornecedores">{suppliers.data.content.map(supplier =>
              <li key={supplier.id} className={selectedId === supplier.id ? 'customer-selected' : undefined}>
                <div className="customer-person"><h3>{supplier.name}</h3>
                  <p>{[formatDocument(supplier.document), supplier.phone, supplier.city, supplier.active ? null : 'Inativo'].filter(Boolean).join(' · ') || 'Sem documento ou contato'}</p></div>
                <button type="button" className="secondary-button" aria-label={`Abrir ${supplier.name}`}
                  aria-pressed={selectedId === supplier.id} onClick={() => setSelectedId(supplier.id)}>Abrir</button>
              </li>)}</ul>}
          <nav className="catalog-pagination" aria-label="Páginas de fornecedores">
            <button type="button" className="secondary-button" disabled={page === 0 || suppliers.isFetching}
              onClick={() => { setSelectedId(''); setPage(page - 1) }}>Página anterior</button>
            <span>Página {page + 1}</span>
            <button type="button" className="secondary-button" disabled={!suppliers.data.hasNext || suppliers.isFetching}
              onClick={() => { setSelectedId(''); setPage(page + 1) }}>Próxima página</button>
          </nav>
        </>}
    {selectedId && <Modal title="Fornecedor" onClose={() => setSelectedId('')}>
      <SelectedSupplier key={selectedId} userId={userId} store={store} canWrite={canWrite} id={selectedId} /></Modal>}
    {creating && <Modal title="Novo fornecedor" onClose={() => setCreating(false)}>
      <NewSupplier userId={userId} storeId={store.id} onCreated={(supplier) => {
        setNotice(`Fornecedor ${supplier.name} cadastrado.`)
        setCreating(false)
        setSelectedId(supplier.id)
      }} /></Modal>}
  </section>
}
