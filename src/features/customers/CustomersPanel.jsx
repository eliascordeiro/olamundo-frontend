import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import QueryError from '../../components/QueryError'
import { useCreateCustomer, useCustomer, useCustomers, useSaveCustomer } from './queries'
import { formatDocument } from './format'
import DeliveryAddresses from './DeliveryAddresses'
import './customers.css'

const fields = [
  ['name', 'Nome do cliente', { required: true, minLength: 2, maxLength: 120 }],
  ['document', 'CPF/CNPJ', { maxLength: 18, inputMode: 'numeric' }],
  ['rg', 'RG', { maxLength: 20 }],
  ['stateRegistration', 'Inscrição estadual', { maxLength: 20 }],
  ['birthDate', 'Nascimento', { type: 'date' }],
  ['phone', 'Telefone', { maxLength: 20, inputMode: 'tel' }],
  ['mobile', 'Celular', { maxLength: 20, inputMode: 'tel' }],
  ['email', 'E-mail', { type: 'email', maxLength: 254, autoCapitalize: 'none' }],
  ['zip', 'CEP', { maxLength: 9, inputMode: 'numeric' }],
  ['street', 'Endereço', { maxLength: 100 }],
  ['number', 'Número', { maxLength: 20 }],
  ['complement', 'Complemento', { maxLength: 100 }],
  ['neighborhood', 'Bairro', { maxLength: 60 }],
  ['city', 'Cidade', { maxLength: 60 }],
  ['state', 'UF', { maxLength: 2, autoCapitalize: 'characters' }],
]
const emptyCustomer = Object.fromEntries(fields.map(([name]) => [name, '']))

const toValues = (customer) => Object.fromEntries(fields.map(([name]) => [name, customer?.[name] ?? '']))
const toPayload = (values) => Object.fromEntries(fields.map(([name]) =>
  [name, typeof values[name] === 'string' && values[name].trim() ? values[name].trim() : null]))

function CustomerFields({ values, onChange, disabled }) {
  return <div className="customer-fields">
    {fields.map(([name, label, attributes]) => <label key={name}>{label}
      <input {...attributes} disabled={disabled} value={values[name] ?? ''}
        onChange={event => onChange(name, event.target.value)} /></label>)}
  </div>
}

function NewCustomer({ userId, storeId, onCreated }) {
  const creation = useCreateCustomer(userId, storeId)
  const [values, setValues] = useState(emptyCustomer)
  const [error, setError] = useState('')
  const pending = creation.pendingOperation
  const shown = pending ? toValues(pending) : values

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const customer = await creation.submit(toPayload(values))
      setValues(emptyCustomer)
      onCreated(customer)
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="customer-form" aria-label="Cadastrar cliente" onSubmit={submit}>
    <p className="catalog-hint">O cliente é da empresa: todas as lojas dela enxergam este cadastro. Só CPF/CNPJ válidos são aceitos.</p>
    <fieldset disabled={creation.sending}>
      <CustomerFields values={shown} disabled={Boolean(pending)}
        onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} />
      {pending && <p className="catalog-hint" role="status">Há um cadastro aguardando confirmação. Confirme o mesmo envio para evitar duplicação.</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="primary-button" type="submit">{creation.sending ? 'Cadastrando...'
        : pending ? 'Confirmar mesmo cadastro' : 'Cadastrar cliente'}</button>
    </fieldset>
  </form>
}

function CustomerEditor({ userId, storeId, customer, onSaved, onRefresh, refreshing }) {
  const mutation = useSaveCustomer(userId, storeId, customer.id)
  const [values, setValues] = useState(() => toValues(customer))
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const disabled = mutation.isPending || refreshing

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const saved = await mutation.mutateAsync({ ...toPayload(values), version: customer.version })
      setValues(toValues(saved))
      onSaved('Cliente atualizado.')
    } catch (err) {
      setError(err.message)
      if (err.status === 0 || err.status === 408 || err.status === 409 || err.status >= 500) setBlocked(true)
    }
  }

  return <form className="customer-form" aria-label={`Editar ${customer.name}`} onSubmit={submit}>
    <p className="catalog-hint">Versão {customer.version}. Conflito ou resposta incerta exige recarregar antes de salvar de novo; recarregar descarta campos não salvos.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <button className="secondary-button" type="button" disabled={disabled} onClick={onRefresh}>
      {refreshing ? 'Recarregando...' : 'Recarregar cadastro'}</button>
    <fieldset disabled={disabled || blocked}>
      <CustomerFields values={values} onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} />
      <button className="primary-button" type="submit">{mutation.isPending ? 'Salvando...' : 'Salvar cliente'}</button>
    </fieldset>
  </form>
}

function SelectedCustomer({ userId, storeId, id }) {
  const query = useCustomer(userId, storeId, id)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')

  async function refresh() {
    setNotice('')
    const result = await query.refetch()
    if (!result.isError) setRevision(previous => previous + 1)
  }

  return <section aria-label="Gerenciar cliente">
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {query.isPending ? <p role="status">Carregando cliente...</p>
      : query.isError ? <QueryError query={query} label="Não foi possível consultar o cliente" />
        : <CustomerEditor key={`${id}:${revision}`} userId={userId} storeId={storeId} customer={query.data}
          onSaved={setNotice} onRefresh={refresh} refreshing={query.isFetching} />}
    {query.data && <DeliveryAddresses userId={userId} storeId={storeId} customerId={id} />}
  </section>
}

export default function CustomersPanel({ userId, store }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const customers = useCustomers(userId, store.id, query, page)

  useEffect(() => {
    const next = search.trim()
    if (next === query) return undefined
    const timer = setTimeout(() => { setQuery(next); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search, query])

  return <section className="customers-workspace" aria-label={`Clientes de ${store.name}`}>
    <div className="catalog-heading"><div><span className="section-eyebrow">QUEM COMPRA DA EMPRESA</span><h2>Clientes</h2>
      <p>Cadastro único da empresa, compartilhado por todas as lojas dela. Qualquer membro da loja pode consultar, cadastrar e editar.</p></div>
      <span className="team-icon"><Icon name="user" size={28} /></span></div>
    <button type="button" className="primary-button" onClick={() => { setNotice(''); setCreating(true) }}>+ Novo cliente</button>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <label className="customer-search">Buscar cliente
      <input type="search" maxLength={100} value={search} placeholder="Nome, CPF/CNPJ ou telefone"
        onChange={event => setSearch(event.target.value)} /></label>
    {customers.isPending ? <p role="status">Carregando clientes...</p>
      : customers.isError && !customers.data ? <QueryError query={customers} label="Não foi possível carregar os clientes" />
        : <>
          {customers.isError && <QueryError query={customers} label="Não foi possível atualizar os clientes" />}
          {customers.data.content.length === 0
            ? <p className="empty-state">{query ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente nesta página.'}</p>
            : <ul className="customer-list" aria-label="Clientes">{customers.data.content.map(customer =>
              <li key={customer.id} className={selectedId === customer.id ? 'customer-selected' : undefined}>
                <div className="customer-person"><h3>{customer.name}</h3>
                  <p>{[formatDocument(customer.document), customer.mobile || customer.phone, customer.city].filter(Boolean).join(' · ') || 'Sem documento ou contato'}</p></div>
                <button type="button" className="secondary-button" aria-label={`Abrir ${customer.name}`}
                  aria-pressed={selectedId === customer.id} onClick={() => setSelectedId(customer.id)}>Abrir</button>
              </li>)}</ul>}
          <nav className="catalog-pagination" aria-label="Páginas de clientes">
            <button type="button" className="secondary-button" disabled={page === 0 || customers.isFetching}
              onClick={() => { setSelectedId(''); setPage(page - 1) }}>Página anterior</button>
            <span>Página {page + 1}</span>
            <button type="button" className="secondary-button" disabled={!customers.data.hasNext || customers.isFetching}
              onClick={() => { setSelectedId(''); setPage(page + 1) }}>Próxima página</button>
          </nav>
        </>}
    {selectedId && <Modal title="Cliente" onClose={() => setSelectedId('')}>
      <SelectedCustomer key={selectedId} userId={userId} storeId={store.id} id={selectedId} /></Modal>}
    {creating && <Modal title="Novo cliente" onClose={() => setCreating(false)}>
      <NewCustomer userId={userId} storeId={store.id} onCreated={(customer) => {
        setNotice(`Cliente ${customer.name} cadastrado.`)
        setCreating(false)
        setSelectedId(customer.id)
      }} /></Modal>}
  </section>
}
