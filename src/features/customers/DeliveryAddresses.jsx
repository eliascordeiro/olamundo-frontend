import { useState } from 'react'
import QueryError from '../../components/QueryError'
import {
  useCreateDeliveryAddress, useDeleteDeliveryAddress, useDeliveryAddresses, useSaveDeliveryAddress,
} from './queries'

const fields = [
  ['zip', 'CEP', { maxLength: 9, inputMode: 'numeric' }],
  ['street', 'Endereço', { required: true, minLength: 2, maxLength: 100 }],
  ['number', 'Número', { maxLength: 20 }],
  ['complement', 'Complemento', { maxLength: 100 }],
  ['neighborhood', 'Bairro', { maxLength: 60 }],
  ['city', 'Cidade', { maxLength: 60 }],
  ['state', 'UF', { maxLength: 2, autoCapitalize: 'characters' }],
]
const emptyAddress = Object.fromEntries(fields.map(([name]) => [name, '']))
const toValues = (address) => Object.fromEntries(fields.map(([name]) => [name, address?.[name] ?? '']))
const toPayload = (values) => Object.fromEntries(fields.map(([name]) =>
  [name, values[name].trim() ? values[name].trim() : null]))
const retryable = (err) => err.status === 0 || err.status === 408 || err.status === 409 || err.status >= 500

const summary = (address) => [
  [address.street, address.number].filter(Boolean).join(', '),
  address.complement, address.neighborhood,
  [address.city, address.state].filter(Boolean).join('/'),
  address.zip && address.zip.replace(/(\d{5})(\d{3})/, '$1-$2'),
].filter(Boolean).join(' · ')

function AddressFields({ values, onChange, disabled }) {
  return <div className="customer-fields">
    {fields.map(([name, label, attributes]) => <label key={name}>{label}
      <input {...attributes} disabled={disabled} value={values[name] ?? ''}
        onChange={event => onChange(name, event.target.value)} /></label>)}
  </div>
}

function NewAddress({ userId, storeId, customerId }) {
  const creation = useCreateDeliveryAddress(userId, storeId, customerId)
  const [values, setValues] = useState(emptyAddress)
  const [error, setError] = useState('')
  const pending = creation.pendingOperation
  const shown = pending ? toValues(pending) : values

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await creation.submit(toPayload(values))
      setValues(emptyAddress)
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="customer-form" aria-label="Cadastrar endereço de entrega" onSubmit={submit}>
    <h4>Novo endereço de entrega</h4>
    <fieldset disabled={creation.sending}>
      <AddressFields values={shown} disabled={Boolean(pending)}
        onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} />
      {pending && <p className="catalog-hint" role="status">Há um endereço aguardando confirmação. Confirme o mesmo envio para evitar duplicação.</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="primary-button" type="submit">{creation.sending ? 'Cadastrando...'
        : pending ? 'Confirmar mesmo endereço' : 'Cadastrar endereço'}</button>
    </fieldset>
  </form>
}

function AddressItem({ userId, storeId, customerId, address, onChanged }) {
  const save = useSaveDeliveryAddress(userId, storeId, customerId)
  const remove = useDeleteDeliveryAddress(userId, storeId, customerId)
  const [mode, setMode] = useState('view')
  const [values, setValues] = useState(() => toValues(address))
  const [error, setError] = useState('')
  const busy = save.isPending || remove.isPending

  async function run(action) {
    setError('')
    try {
      await action()
      setMode('view')
    } catch (err) {
      setError(err.message)
      if (retryable(err)) setMode('stale')
    }
  }

  if (mode === 'edit') {
    return <li><form className="customer-form" aria-label={`Editar endereço ${address.street}`}
      onSubmit={event => { event.preventDefault(); run(() => save.mutateAsync({ ...toPayload(values), id: address.id, version: address.version })) }}>
      <fieldset disabled={busy}>
        <AddressFields values={values} onChange={(name, value) => setValues(previous => ({ ...previous, [name]: value }))} />
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="primary-button" type="submit">{save.isPending ? 'Salvando...' : 'Salvar endereço'}</button>
        <button className="secondary-button" type="button" onClick={() => { setValues(toValues(address)); setError(''); setMode('view') }}>Cancelar</button>
      </fieldset>
    </form></li>
  }

  return <li>
    <div className="customer-person"><p>{summary(address)}</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}</div>
    {mode === 'stale'
      ? <button type="button" className="secondary-button" onClick={onChanged}>Recarregar endereços</button>
      : mode === 'confirm'
        ? <>
          <button type="button" className="secondary-button" disabled={busy}
            onClick={() => run(() => remove.mutateAsync({ id: address.id, version: address.version }))}>Confirmar remoção</button>
          <button type="button" className="secondary-button" onClick={() => setMode('view')}>Manter</button>
        </>
        : <>
          <button type="button" className="secondary-button" onClick={() => setMode('edit')}>Editar</button>
          <button type="button" className="secondary-button" onClick={() => setMode('confirm')}>Remover</button>
        </>}
  </li>
}

export default function DeliveryAddresses({ userId, storeId, customerId }) {
  const query = useDeliveryAddresses(userId, storeId, customerId)

  return <section className="delivery-addresses" aria-label="Endereços de entrega">
    <h3>Endereços de entrega</h3>
    <p className="catalog-hint">Além do endereço do cadastro. Qualquer membro da loja pode cadastrar, editar e remover.</p>
    {query.isPending ? <p role="status">Carregando endereços...</p>
      : query.isError ? <QueryError query={query} label="Não foi possível carregar os endereços de entrega" />
        : query.data.length === 0 ? <p className="empty-state">Nenhum endereço de entrega cadastrado.</p>
          : <ul className="customer-list" aria-label="Endereços de entrega cadastrados">{query.data.map(address =>
            <AddressItem key={`${address.id}:${address.version}`} userId={userId} storeId={storeId} customerId={customerId}
              address={address} onChanged={() => query.refetch()} />)}</ul>}
    <NewAddress userId={userId} storeId={storeId} customerId={customerId} />
  </section>
}
