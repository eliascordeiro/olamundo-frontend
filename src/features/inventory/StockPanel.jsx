import { useId, useState } from 'react'
import { useStock, useStockHistory, useStockMovement } from './queries'
import QueryError from '../../components/QueryError'
import './inventory.css'

const empty = { type: 'IN', quantity: '', reason: '' }
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function MovementForm({ userId, storeId, productId }) {
  const id = useId()
  const { pendingOperation, sending, submit } = useStockMovement(userId, storeId, productId)
  const [draft, setDraft] = useState(empty)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const values = pendingOperation ?? draft

  function field(name) {
    return {
      value: values[name],
      onChange: (event) => setDraft((previous) => ({ ...previous, [name]: event.target.value })),
    }
  }

  async function send(event) {
    event.preventDefault()
    if (sending) return
    setError('')
    setNotice('')
    if (!pendingOperation && (!/^[1-9]\d{0,9}$/.test(draft.quantity) || Number(draft.quantity) > 2147483647
      || draft.reason.trim().length < 2)) {
      setError('Informe quantidade inteira de 1 a 2147483647 e motivo de 2 a 500 caracteres.')
      return
    }
    const submitted = { type: values.type, quantity: values.quantity, reason: values.reason.trim() }
    setDraft(submitted)
    try {
      const result = await submit(submitted)
      setDraft(empty)
      setNotice(`Movimentação confirmada. Saldo após a operação: ${result.balanceAfter} unidades.`)
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="stock-form" aria-label="Movimentar estoque" onSubmit={send}>
    <h4>Registrar movimentação</h4>
    <fieldset disabled={sending || Boolean(pendingOperation)}>
      <label>Tipo de movimentação<select {...field('type')}>
        <option value="IN">Entrada</option><option value="OUT">Saída</option>
      </select></label>
      <label>Quantidade (unidades)<input required inputMode="numeric" maxLength={10} {...field('quantity')} /></label>
      <div><label htmlFor={`${id}-reason`}>Motivo</label>
        <textarea id={`${id}-reason`} required minLength={2} maxLength={500} rows={2} {...field('reason')} /></div>
    </fieldset>
    {pendingOperation && <p className="catalog-hint">
      Operação aguardando confirmação. Se houve falha de conexão, repita este envio sem duplicar o estoque.
      Não recarregue a página; se já recarregou, confira o histórico antes de iniciar outra operação.
    </p>}
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    {notice && <div role="status" className="alert alert-success">{notice}</div>}
    <button type="submit" className="primary-button" disabled={sending}>
      {sending ? 'Confirmando...' : pendingOperation ? 'Confirmar mesmo envio' : 'Registrar movimentação'}
    </button>
  </form>
}

export default function StockPanel({ userId, store, product }) {
  const [page, setPage] = useState(0)
  const balance = useStock(userId, store.id, product.id)
  const history = useStockHistory(userId, store.id, product.id, page)
  const canWrite = store.role === 'OWNER' || store.role === 'MANAGER'

  return <section className="stock-panel" aria-label={`Estoque de ${product.name}`}>
    <h3>Estoque — {product.name}</h3>
    <p className="catalog-hint">Unidades inteiras, sem reservas. Pedidos confirmados também geram saídas. Saldo inicial zero.</p>
    {balance.isPending ? <p role="status">Carregando saldo...</p>
      : balance.isError ? <QueryError query={balance} label="Não foi possível consultar o saldo" />
        : <>
          <p className="stock-balance">Saldo atual: <strong>{balance.data.quantity} unidades</strong></p>
          {canWrite ? <MovementForm userId={userId} storeId={store.id} productId={product.id} />
            : <p className="catalog-hint">Seu acesso permite somente consultar estoque e histórico.</p>}
        </>}
    <h4>Histórico de movimentações</h4>
    {history.isPending ? <p role="status">Carregando histórico...</p>
      : history.isError ? <QueryError query={history} label="Não foi possível consultar o histórico" />
        : history.data.content.length === 0 ? <p>Nenhuma movimentação nesta página.</p>
          : <ol className="stock-history">{history.data.content.map((movement) =>
            <li key={movement.id}>
              <strong>{movement.type === 'IN' ? 'Entrada' : 'Saída'}: {movement.quantity} unidades</strong>
              <span>Saldo após: {movement.balanceAfter} · {date.format(new Date(movement.createdAt))}</span>
              <p>{movement.reason}</p>
              <small>Responsável (ID): {movement.userId} · Operação: {movement.id}</small>
            </li>)}</ol>}
    <nav className="catalog-pagination" aria-label="Páginas do histórico">
      <button type="button" className="secondary-button" disabled={page === 0 || history.isFetching}
        onClick={() => setPage((value) => value - 1)}>Histórico anterior</button>
      <span>Página {page + 1}</span>
      <button type="button" className="secondary-button"
        disabled={history.isError || !history.data?.hasNext || history.isFetching}
        onClick={() => setPage((value) => value + 1)}>Próximo histórico</button>
    </nav>
  </section>
}
