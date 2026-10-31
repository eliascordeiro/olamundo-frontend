import { useId, useState } from 'react'
import Modal from '../../components/Modal'
import QueryError from '../../components/QueryError'
import { useCancelOrder, useConfirmOrder, useOrder, useOrders } from './queries'
import './orders.css'

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const statusName = status => ({ DRAFT: 'Rascunho', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado' })[status] ?? status

// Order monetary fields are decimal strings; keep all digits, including totals beyond Number's precision.
function money(value) {
  const [whole, cents] = value.split('.')
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`
}

function OrderDetail({ userId, store, orderId }) {
  const order = useOrder(userId, store.id, orderId)
  const confirmation = useConfirmOrder(userId, store.id, orderId)
  const cancellation = useCancelOrder(userId, store.id, orderId)
  const [armed, setArmed] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const reasonId = useId()
  const [error, setError] = useState('')
  const canWrite = store.role === 'OWNER' || store.role === 'MANAGER'
  if (order.isPending) return <p role="status">Carregando pedido...</p>
  if (order.isError) return <QueryError query={order} label="Não foi possível consultar o pedido" />
  const { summary, items } = order.data

  async function confirm() {
    if (confirmation.sending || cancellation.pendingOperation) return
    setError('')
    try {
      await confirmation.mutateAsync()
      setArmed(false)
    } catch (err) { setError(err.message) }
  }

  async function cancel(event) {
    event.preventDefault()
    if (cancellation.sending) return
    setError('')
    const normalizedReason = (cancellation.pendingOperation?.reason ?? reason).trim()
    if (normalizedReason.length < 2 || normalizedReason.length > 500) {
      setError('Informe motivo de cancelamento de 2 a 500 caracteres.')
      return
    }
    try {
      await cancellation.submit({ reason: normalizedReason })
      setCancelling(false)
      setArmed(false)
      setReason('')
    } catch (err) { setError(err.message) }
  }

  return <section className="order-detail" aria-label={`Detalhes do pedido ${summary.id}`}>
    <h4>Pedido {summary.id}</h4>
    <button type="button" className="inline-button" disabled={order.isFetching || confirmation.sending}
      onClick={() => { setError(''); order.refresh() }}>Atualizar pedido</button>
    <p>Situação: <strong>{statusName(summary.status)}</strong></p>
    <p>Criado em {date.format(new Date(summary.createdAt))} · Responsável (ID): {summary.createdBy}</p>
    <ul>{items.map(item => <li key={item.productId}>
      <strong>{item.productName}</strong> · SKU: {item.sku} · {item.quantity} unidades
      <span>Preço unitário: {money(item.unitPrice)} · Subtotal: {money(item.lineTotal)}</span>
    </li>)}</ul>
    <p className="order-total">Total do pedido: <strong>{money(summary.total)}</strong></p>
    {summary.status === 'CONFIRMED' && <p role="status">
      Estoque baixado. Confirmado em {date.format(new Date(summary.confirmedAt))} por {summary.confirmedBy}.
    </p>}
    {summary.status === 'CANCELLED' && <div role="status">
      <p>Cancelado em {date.format(new Date(summary.cancelledAt))} por {summary.cancelledBy}.</p>
      <p>Motivo: {summary.cancellationReason}</p>
      {summary.confirmedAt ? <p>Estoque devolvido integralmente. Confirmação anterior em
        {' '}{date.format(new Date(summary.confirmedAt))} por {summary.confirmedBy}.</p>
        : <p>Rascunho cancelado sem movimentar estoque.</p>}
      <p>Cancelamento definitivo, sem reabertura. Não representa reembolso financeiro.</p>
    </div>}
    {canWrite && summary.status === 'DRAFT' && !cancelling && !cancellation.pendingOperation && <>
      <p className="catalog-hint">Confirmar baixa o estoque de todos os itens. Não é pagamento.
        Um cancelamento posterior devolve integralmente essas unidades.</p>
      {!armed ? <button type="button" className="primary-button" onClick={() => setArmed(true)}>Confirmar pedido</button>
        : <div className="order-actions">
          <button type="button" className="primary-button" disabled={confirmation.sending} onClick={confirm}>
            {confirmation.sending ? 'Confirmando pedido...' : 'Confirmar e baixar estoque'}
          </button>
          <button type="button" className="secondary-button" disabled={confirmation.sending}
            onClick={() => setArmed(false)}>Voltar sem confirmar</button>
        </div>}
    </>}
    {canWrite && summary.status !== 'CANCELLED' && <>
      {!cancelling && !cancellation.pendingOperation
        ? <button type="button" className="secondary-button" disabled={confirmation.sending}
          onClick={() => { setCancelling(true); setArmed(false); setError('') }}>Cancelar pedido</button>
        : <form onSubmit={cancel} className="order-cancellation" aria-label="Cancelar pedido">
          <p>{summary.status === 'CONFIRMED'
            ? 'Cancelar devolverá integralmente todos os itens ao estoque.'
            : 'Cancelar este rascunho não altera o estoque.'} Esta ação é definitiva e não faz reembolso financeiro.</p>
          <label htmlFor={reasonId}>Motivo do cancelamento</label>
          <textarea id={reasonId} required minLength={2} maxLength={500} value={cancellation.pendingOperation?.reason ?? reason}
            disabled={cancellation.sending || Boolean(cancellation.pendingOperation)}
            onChange={event => setReason(event.target.value)} />
          {cancellation.pendingOperation && <p className="catalog-hint">Cancelamento aguardando confirmação.
            Repita o mesmo envio; o motivo está preservado. Não haverá devolução duplicada.
            Após recarregar, consulte a situação do pedido antes de tentar novamente.</p>}
          <div className="order-actions">
            <button type="submit" className="primary-button" disabled={cancellation.sending}>
              {cancellation.sending ? 'Cancelando pedido...' : cancellation.pendingOperation
                ? 'Repetir mesmo cancelamento' : 'Confirmar cancelamento definitivo'}
            </button>
            {!cancellation.pendingOperation && <button type="button" className="secondary-button"
              disabled={cancellation.sending} onClick={() => { setCancelling(false); setError('') }}>Manter pedido</button>}
          </div>
        </form>}
    </>}
    {error && <div role="alert" className="alert alert-error">{error}
      {' '}Use Atualizar pedido para consultar a situação. Repetir a mesma operação não movimenta o estoque duas vezes.</div>}
  </section>
}

export default function OrdersPanel({ userId, store, draft, creation, selectedId, onSelectOrder }) {
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const orders = useOrders(userId, store.id, page)
  const canWrite = store.role === 'OWNER' || store.role === 'MANAGER'
  const locked = creation.sending || Boolean(creation.pendingOperation)

  async function save(event) {
    event.preventDefault()
    if (creation.sending) return
    setError('')
    if (!creation.pendingOperation && (draft.items.length === 0 || draft.items.length > 50
      || draft.items.some(item => !/^[1-9]\d{0,9}$/.test(item.quantity) || Number(item.quantity) > 2147483647))) {
      setError('Selecione de 1 a 50 produtos e quantidades inteiras de 1 a 2147483647.')
      return
    }
    try {
      const order = await creation.submit({ items: draft.items.map(item => ({ productId: item.productId, quantity: item.quantity })) })
      onSelectOrder(order.summary.id)
    } catch (err) { setError(err.message) }
  }

  return <section className="orders-panel" aria-label={`Pedidos de ${store.name}`}>
    <h3>Pedidos internos — {store.name}</h3>
    <p className="catalog-hint">Sem pagamento, frete ou cliente. O rascunho guarda os preços atuais do catálogo,
      mas não reserva estoque. Confira os valores antes de confirmar.</p>
    {canWrite ? <form onSubmit={save} aria-label="Criar pedido">
      <h4>Novo pedido</h4>
      <fieldset disabled={locked}>
        {draft.items.length === 0 ? <p>Adicione produtos pelo catálogo para montar o pedido.</p>
          : draft.items.map(item => <div key={item.productId} className="order-draft-item">
            <span>{item.name} · SKU: {item.sku}</span>
            <label>Quantidade de {item.name}<input required inputMode="numeric" maxLength={10} value={item.quantity}
              onChange={event => draft.setItems(previous => previous.map(line => line.productId === item.productId
                ? { ...line, quantity: event.target.value } : line))} /></label>
            <button type="button" className="secondary-button"
              onClick={() => draft.setItems(previous => previous.filter(line => line.productId !== item.productId))}
              aria-label={`Remover ${item.name} do pedido`}>Remover</button>
          </div>)}
      </fieldset>
      {creation.pendingOperation && <p className="catalog-hint">
        Criação aguardando confirmação. Repita o mesmo envio sem criar outro pedido.
        {' '}Identificador: {creation.pendingOperation.requestId}.
        Não recarregue; se já recarregou após uma falha, confira a lista de pedidos antes de criar outro.
      </p>}
      <button type="submit" className="primary-button" disabled={creation.sending || (!draft.items.length && !creation.pendingOperation)}>
        {creation.sending ? 'Salvando pedido...' : creation.pendingOperation ? 'Confirmar mesmo rascunho' : 'Salvar rascunho do pedido'}
      </button>
      {error && <div role="alert" className="alert alert-error">{error}</div>}
    </form> : <p className="catalog-hint">Seu acesso permite somente consultar pedidos.</p>}
    <div className="order-actions"><h4>Pedidos da loja</h4>
      <button type="button" className="inline-button" disabled={orders.isFetching}
        onClick={() => orders.refetch()}>Atualizar pedidos</button></div>
    {orders.isPending ? <p role="status">Carregando pedidos...</p>
      : orders.isError ? <QueryError query={orders} label="Não foi possível listar os pedidos" />
        : orders.data.content.length === 0 ? <p>Nenhum pedido nesta página.</p>
          : <ul className="orders-list">{orders.data.content.map(order => <li key={order.id}>
            <span>{statusName(order.status)} · {money(order.total)} · {date.format(new Date(order.createdAt))}</span>
            <button type="button" className="secondary-button" onClick={() => onSelectOrder(order.id)}
              aria-label={`Ver pedido ${order.id}`}>Ver pedido {order.id}</button>
          </li>)}</ul>}
    <nav className="catalog-pagination" aria-label="Páginas dos pedidos">
      <button type="button" className="secondary-button" disabled={page === 0 || orders.isFetching}
        onClick={() => setPage(value => value - 1)}>Pedidos anteriores</button>
      <span>Página {page + 1}</span>
      <button type="button" className="secondary-button"
        disabled={orders.isError || !orders.data?.hasNext || orders.isFetching}
        onClick={() => setPage(value => value + 1)}>Próximos pedidos</button>
    </nav>
    {selectedId && <Modal title="Pedido" onClose={() => onSelectOrder('')}>
      <OrderDetail key={selectedId} userId={userId} store={store} orderId={selectedId} /></Modal>}
  </section>
}
