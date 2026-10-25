import { useState } from 'react'
import { useCreateProduct, useProducts, useStore, useStores } from './queries'
import StockPanel from '../inventory/StockPanel'
import QueryError from '../../components/QueryError'
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

  return <form className="product-form" onSubmit={submit} aria-label="Cadastrar produto">
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

function ProductCatalog({ userId, store }) {
  const [page, setPage] = useState(0)
  const [stockProduct, setStockProduct] = useState(null)
  const products = useProducts(userId, store.id, page)
  const canCreate = store.role === 'OWNER' || store.role === 'MANAGER'

  return <section className="product-catalog" aria-label={`Catálogo de ${store.name}`}>
    <div className="catalog-heading">
      <div><h2>Catálogo — {store.name}</h2><p>Produtos e preços desta loja, em reais.</p></div>
      <span className="store-role">{roleNames[store.role] ?? store.role}</span>
    </div>
    {canCreate
      ? <ProductForm userId={userId} storeId={store.id} />
      : <p className="catalog-hint">Seu acesso permite consultar produtos. O cadastro é feito por proprietários e gerentes.</p>}
    {products.isPending ? <p role="status">Carregando produtos...</p>
      : products.isError ? <QueryError query={products} label="Não foi possível carregar o catálogo" />
        : products.data.content.length === 0
          ? <p className="empty-state">Nenhum produto nesta página.</p>
          : <ul className="product-list">{products.data.content.map((product) =>
            <li key={product.id}>
              <div><h3>{product.name}</h3><span className="catalog-hint">SKU: {product.sku}</span>
                {product.description && <p>{product.description}</p>}</div>
              <div className="product-actions"><strong>{money.format(product.price)}</strong>
                <button type="button" className="secondary-button" aria-label={`Ver estoque de ${product.name}`}
                  onClick={() => setStockProduct(product)}>Estoque</button></div>
            </li>)}</ul>}
    {stockProduct && <StockPanel key={stockProduct.id} userId={userId} store={store} product={stockProduct} />}
    <nav className="catalog-pagination" aria-label="Páginas do catálogo">
      <button type="button" className="secondary-button" disabled={page === 0 || products.isFetching}
        onClick={() => setPage((current) => current - 1)}>Página anterior</button>
      <span>Página {page + 1}</span>
      <button type="button" className="secondary-button"
        disabled={products.isError || !products.data?.hasNext || products.isFetching}
        onClick={() => setPage((current) => current + 1)}>Próxima página</button>
    </nav>
  </section>
}

function SelectedStore({ userId, storeId }) {
  const store = useStore(userId, storeId)
  if (store.isPending) return <p role="status">Verificando acesso à loja...</p>
  if (store.isError) return <QueryError query={store} label="Não foi possível acessar a loja" />
  return <ProductCatalog userId={userId} store={store.data} />
}

export default function StoreCatalog({ userId }) {
  const stores = useStores(userId)
  const [selectedId, setSelectedId] = useState('')
  const availableStores = stores.data?.pages.flatMap((page) => page.content) ?? []

  return <section className="store-catalog" aria-label="Lojas e catálogo">
    <div className="catalog-heading"><div><h2>Suas lojas</h2><p>Selecione uma loja para consultar seu catálogo.</p></div></div>
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
    {selectedId && <SelectedStore key={selectedId} userId={userId} storeId={selectedId} />}
  </section>
}
