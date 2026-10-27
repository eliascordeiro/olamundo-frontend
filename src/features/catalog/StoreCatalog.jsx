import { useState } from 'react'
import { useCreateProduct, useProducts, useStore, useStores } from './queries'
import StockPanel from '../inventory/StockPanel'
import QueryError from '../../components/QueryError'
import OrdersPanel from '../orders/OrdersPanel'
import { useCreateOrder, useOrderDraft } from '../orders/queries'
import Icon from '../../components/Icon'
import { RetailOverview, SalesPreparation } from '../retail/RetailPages'
import './catalog.css'

const roleNames = { OWNER: 'Proprietário', MANAGER: 'Gerente', STAFF: 'Colaborador' }
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyProduct = { name: '', sku: '', description: '', price: '' }

function ProductForm({ userId, storeId }) {
  const mutation = useCreateProduct(userId, storeId)
  const [values, setValues] = useState(emptyProduct)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function field(name) {
    return {
      value: values[name],
      onChange: (event) => setValues((previous) => ({ ...previous, [name]: event.target.value })),
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    const price = values.price.trim().replace(',', '.')
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(price)) {
      setError('Informe um preço de 0 a 9.999.999.999,99, sem separador de milhar e com até duas casas decimais.')
      return
    }
    try {
      await mutation.mutateAsync({
        name: values.name.trim(),
        sku: values.sku.trim().toUpperCase(),
        description: values.description.trim(),
        // Preserve decimal text; monetary calculations belong to the backend.
        price,
      })
      setValues(emptyProduct)
      setNotice('Produto cadastrado com sucesso.')
    } catch (err) {
      setError(err.message)
    }
  }

  return <form id="product-create" className="product-form" onSubmit={submit} aria-label="Cadastrar produto">
    <h3>Novo produto</h3>
    <fieldset disabled={mutation.isPending}>
      <div className="product-fields">
        <label>Nome do produto<input required minLength={2} maxLength={120} {...field('name')} /></label>
        <label>SKU<input required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,63}"
          title="Letras, números, ponto, hífen ou sublinhado, começando por letra ou número."
          autoCapitalize="characters" {...field('sku')} /></label>
        <label>Preço (R$)<input required inputMode="decimal" maxLength={13} placeholder="Ex.: 19,90"
          aria-describedby="price-help" {...field('price')} /></label>
      </div>
      <p id="price-help" className="catalog-hint">Valores em reais, com até duas casas decimais. Estoque é movimentado separadamente; sem cobrança.</p>
      <label>Descrição<textarea maxLength={2000} rows={3} {...field('description')} /></label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <button className="primary-button" type="submit">
        {mutation.isPending ? 'Cadastrando produto...' : 'Cadastrar produto'}
      </button>
    </fieldset>
  </form>
}

function ProductCatalog({ userId, store, section, onSectionChange }) {
  const [page, setPage] = useState(0)
  const [stockProduct, setStockProduct] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [orderError, setOrderError] = useState('')
  const [search, setSearch] = useState('')
  const draft = useOrderDraft(userId, store.id)
  const creation = useCreateOrder(userId, store.id)
  const products = useProducts(userId, store.id, page)
  const canCreate = store.role === 'OWNER' || store.role === 'MANAGER'

  function showStock(product) {
    setStockProduct(product)
    onSectionChange('inventory')
  }

  function addToOrder(product) {
    setOrderError('')
    if (draft.items.some(item => item.productId === product.id)) {
      onSectionChange('orders')
      return
    }
    if (draft.items.length >= 50) {
      setOrderError('O pedido aceita no máximo 50 produtos distintos.')
      return
    }
    draft.setItems(previous => [...previous, { productId: product.id, name: product.name, sku: product.sku, quantity: '1' }])
    onSectionChange('orders')
  }

  function pagination(label) {
    return <nav className="catalog-pagination" aria-label={`Páginas de ${label}`}>
      <button type="button" className="secondary-button" disabled={page === 0 || products.isFetching}
        onClick={() => { setSearch(''); setPage((current) => current - 1) }}>Página anterior</button>
      <span>Página {page + 1}</span>
      <button type="button" className="secondary-button"
        disabled={products.isError || !products.data?.hasNext || products.isFetching}
        onClick={() => { setSearch(''); setPage((current) => current + 1) }}>Próxima página</button>
    </nav>
  }

  function productList(label, action) {
    if (products.isPending) return <p role="status">Carregando produtos...</p>
    if (products.isError) return <QueryError query={products} label="Não foi possível carregar os produtos" />
    if (products.data.content.length === 0) return <p className="empty-state">Nenhum produto nesta página.</p>
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    const term = normalize(search.trim())
    const visibleProducts = products.data.content.filter(product => normalize(`${product.name} ${product.sku}`).includes(term))
    return <>
      <div className="product-toolbar"><label className="product-search">
        Buscar nesta página<input type="search" value={search} maxLength={120} placeholder="Nome do produto ou SKU"
          onChange={event => setSearch(event.target.value)} />
      </label><p className="catalog-hint">Busca somente nos {products.data.content.length} produtos desta página. Use a paginação para consultar os demais.</p></div>
      {visibleProducts.length === 0 && <p className="empty-state" role="status">Nenhum produto encontrado nesta página. Ajuste a busca ou consulte outra página.</p>}
      <ul className="product-list" aria-label={label}>{visibleProducts.map((product) =>
      <li key={product.id}>
        <span className="product-tile-icon" aria-hidden="true"><Icon name="products" size={24} /></span>
        <div className="product-info"><h3>{product.name}</h3><span className="catalog-hint">SKU: {product.sku}</span>
          {product.description && <p>{product.description}</p>}</div>
        {action(product)}
      </li>)}</ul>
    </>
  }

  if (section === 'overview') return <RetailOverview store={store} draftCount={canCreate ? draft.items.length : 0} onSectionChange={onSectionChange} />
  if (section === 'sales') return <SalesPreparation onSectionChange={onSectionChange} />

  if (section === 'catalog') return <section className="product-catalog" aria-label={`Catálogo de ${store.name}`}>
    <div className="catalog-heading">
      <div><span className="section-eyebrow">PRODUTOS E PREÇOS</span><h2>Catálogo</h2>
        <p>Confira o produto do atendimento e organize seu pedido.</p></div>
      {canCreate && <a className="secondary-button" href="#product-create">Novo produto <Icon name="arrow" size={16} /></a>}
    </div>
    {!canCreate && <p className="catalog-hint">Seu acesso permite consultar produtos. O cadastro é feito por proprietários e gerentes.</p>}
    {productList(`Produtos do catálogo de ${store.name}`, (product) =>
      <div className="product-actions"><strong>{money.format(product.price)}</strong>
        <button type="button" className="secondary-button" aria-label={`Ver estoque de ${product.name}`}
          onClick={() => showStock(product)}>Estoque</button>
        {canCreate && <button type="button" className="secondary-button"
          aria-label={`Adicionar ${product.name} ao pedido`}
          disabled={creation.sending || Boolean(creation.pendingOperation)}
          onClick={() => addToOrder(product)}>Adicionar ao pedido</button>}</div>)}
    {orderError && <div className="alert alert-error" role="alert">{orderError}</div>}
    {products.data && pagination('catálogo')}
    {canCreate && <ProductForm userId={userId} storeId={store.id} />}
  </section>

  if (section === 'inventory') return <section className="inventory-workspace" aria-label={`Estoque de ${store.name}`}>
    <div className="catalog-heading">
      <div><span className="section-eyebrow">SALDOS E MOVIMENTAÇÕES</span><h2>Estoque</h2>
        <p>Escolha um produto para consultar o saldo e o histórico.</p></div>
      <span className="store-role">{roleNames[store.role] ?? store.role}</span>
    </div>
    {productList(`Produtos para consultar estoque em ${store.name}`, (product) =>
      <div className="product-actions">
        <button type="button" className="secondary-button" aria-label={`Ver estoque de ${product.name}`}
          aria-pressed={stockProduct?.id === product.id} onClick={() => setStockProduct(product)}>
          {stockProduct?.id === product.id ? 'Selecionado' : 'Consultar estoque'}
        </button>
      </div>)}
    {stockProduct && <StockPanel key={stockProduct.id} userId={userId} store={store} product={stockProduct} />}
    {products.data && pagination('produtos')}
  </section>

  return <section className="orders-workspace" aria-label={`Pedidos de ${store.name}`}>
    <div className="catalog-heading">
      <div><span className="section-eyebrow">OPERAÇÕES INTERNAS</span><h2>Pedidos</h2>
        <p>Pedidos internos não representam pagamentos ou reservas de estoque.</p></div>
      <span className="store-role">{roleNames[store.role] ?? store.role}</span>
    </div>
    <button type="button" className="secondary-button" onClick={() => onSectionChange('catalog')}>
      Adicionar produtos pelo catálogo
    </button>
    <OrdersPanel userId={userId} store={store} draft={draft} creation={creation}
      selectedId={selectedOrderId} onSelectOrder={setSelectedOrderId} />
  </section>
}

function SelectedStore({ userId, storeId, section, onSectionChange }) {
  const store = useStore(userId, storeId)
  if (store.isPending) return <p role="status">Verificando acesso à loja...</p>
  if (store.isError) return <QueryError query={store} label="Não foi possível acessar a loja" />
  return <ProductCatalog userId={userId} store={store.data} section={section} onSectionChange={onSectionChange} />
}

export default function StoreCatalog({ userId, section, onSectionChange }) {
  const stores = useStores(userId)
  const [selectedId, setSelectedId] = useState('')
  const availableStores = stores.data?.pages.flatMap((page) => page.content) ?? []

  return <section className="store-catalog" aria-label="Lojas e operações">
    <div className="store-context">
      <span className="store-context-icon"><Icon name="store" size={25} /></span>
      <div className="store-context-main"><span className="section-eyebrow">VOCÊ ESTÁ TRABALHANDO EM</span>
    {stores.isPending ? <p role="status">Carregando lojas...</p>
      : stores.isError && !stores.data ? <QueryError query={stores} label="Não foi possível carregar as lojas" />
        : <>
          {availableStores.length === 0
            ? <p className="empty-state">Você ainda não participa de uma loja. Solicite um vínculo ao proprietário ou crie uma loja pela API.</p>
            : <label className="store-select">Loja ativa
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                <option value="">Selecione uma loja</option>
                {availableStores.map((store) =>
                  <option key={store.id} value={store.id}>{store.name} — {roleNames[store.role] ?? store.role}</option>)}
              </select>
            </label>}
          {stores.isError && <QueryError query={stores} label="Não foi possível atualizar as lojas" />}
          <div className="store-actions">
            <button type="button" className="inline-button" disabled={stores.isFetching}
              onClick={() => stores.refetch()}>Atualizar lojas</button>
            {stores.hasNextPage && <button type="button" className="secondary-button"
              disabled={stores.isFetching} onClick={() => stores.fetchNextPage()}>
              {stores.isFetchingNextPage ? 'Carregando...' : 'Carregar mais lojas'}
            </button>}
          </div>
        </>}
      </div>
      <p className="store-context-note"><Icon name="shield" size={17} /> Produtos, estoque e pedidos<br />isolados por loja e perfil.</p>
    </div>
    {!selectedId && !stores.isPending && !stores.isError && availableStores.length > 0 && <div className="store-start">
      <span className="welcome-icon"><Icon name="store" size={30} /></span>
      <h2>Qual loja vamos organizar hoje?</h2><p>Selecione uma loja acima para acessar suas operações.<br />Você verá somente os dados e ações permitidos para seu perfil.</p>
    </div>}
    {selectedId && <SelectedStore key={selectedId} userId={userId} storeId={selectedId}
      section={section} onSectionChange={onSectionChange} />}
  </section>
}
