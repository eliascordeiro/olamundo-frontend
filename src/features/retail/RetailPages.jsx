import Icon from '../../components/Icon'

const operations = [
  { id: 'catalog', icon: 'products', title: 'Produtos e preços', description: 'Encontre o item do atendimento e confira seu preço de catálogo.', action: 'Abrir catálogo' },
  { id: 'inventory', icon: 'inventory', title: 'Estoque da loja', description: 'Consulte a disponibilidade e acompanhe entradas e saídas por produto.', action: 'Consultar estoque' },
  { id: 'orders', icon: 'orders', title: 'Pedidos internos', description: 'Organize itens, salve o pedido e confirme a baixa de estoque.', action: 'Acompanhar pedidos' },
]

const salesSteps = [
  { icon: 'user', title: 'Cliente e vendedor', description: 'Identificação do cliente, vendedor responsável e loja do atendimento.' },
  { icon: 'tag', title: 'Produtos e condições', description: 'Grupos, subgrupos, preços e descontos com autorização.' },
  { icon: 'orders', title: 'Pagamento e caixa', description: 'Composição de pagamentos, parcelas, entrada e confirmação no caixa.' },
  { icon: 'truck', title: 'Entrega e montagem', description: 'Endereço, datas, loja de saída e local de retirada por item.' },
]

export function RetailOverview({ store, draftCount, onSectionChange }) {
  return <section className="store-overview" aria-label={`Visão geral de ${store.name}`}>
    <div className="catalog-heading">
      <div><span className="section-eyebrow">ROTINA ORGANIZADA</span><h2>Visão geral</h2>
        <p>Seu ponto de partida para a operação de {store.name}.</p></div>
      <span className="feature-badge">Disponível agora</span>
    </div>
    <div className="retail-hero">
      <div><span className="section-eyebrow">DO PRODUTO AO ATENDIMENTO</span>
        <h3>A loja no centro.<br />O cliente no horizonte.</h3>
        <p>Comece pelo produto, confira o estoque e organize os itens em um pedido interno.</p>
        <button type="button" className="primary-button" onClick={() => onSectionChange('catalog')}>
          Consultar produtos <Icon name="arrow" size={17} />
        </button>
      </div>
      <div className="retail-hero-art" aria-hidden="true"><Icon name="sofa" size={108} /><span>MÓVEIS & ELETRO</span><div><Icon name="products" size={16} /> Cada item, no seu lugar.</div></div>
    </div>
    {draftCount > 0 && <div className="draft-reminder">
      <Icon name="orders" /><p><strong>Há {draftCount} {draftCount === 1 ? 'produto' : 'produtos'} no novo pedido.</strong>
        <span>Seleção em memória, ainda não salva no servidor.</span></p>
      <button type="button" className="inline-button" onClick={() => onSectionChange('orders')}>Continuar pedido <Icon name="arrow" size={16} /></button>
    </div>}
    <div className="overview-grid">
      {operations.map(item => <article className="overview-card" key={item.id}>
        <span className="operation-icon"><Icon name={item.icon} size={23} /></span>
        <h3>{item.title}</h3><p>{item.description}</p>
        <button type="button" className="inline-button" onClick={() => onSectionChange(item.id)}>{item.action} <Icon name="arrow" size={16} /></button>
      </article>)}
    </div>
    <div className="retail-next">
      <span className="operation-icon"><Icon name="store" size={23} /></span>
      <div><span className="section-eyebrow">PRÓXIMAS ETAPAS</span><h3>Uma venda completa precisa de mais.</h3>
        <p>Cliente, vendedor, comissões, caixa e entrega serão desenvolvidos em etapas. O pedido interno não substitui esse fluxo.</p></div>
      <button type="button" className="secondary-button" onClick={() => onSectionChange('sales')}>Conhecer o fluxo <Icon name="arrow" size={16} /></button>
    </div>
  </section>
}

export function SalesPreparation({ onSectionChange }) {
  return <section className="sales-preparation" aria-label="Preparação do módulo de vendas">
    <div className="catalog-heading"><div><span className="section-eyebrow">BALCÃO, CAIXA E PÓS-VENDA</span>
      <h2>Vendas de balcão</h2><p>O atendimento completo, orientado à rotina do varejo.</p></div>
      <span className="feature-badge feature-badge-planned">Em preparação</span>
    </div>
    <div className="sales-notice"><Icon name="store" size={28} /><div><h3>Este módulo ainda não registra vendas.</h3>
      <p>O fluxo foi levantado no Murimel e será implementado em partes. Nesta etapa não há cadastro de cliente ou vendedor,
        recebimento, cálculo de comissão ou agendamento de entrega.</p></div></div>
    <h3 className="retail-subtitle">O caminho de uma venda</h3>
    <ol className="sales-steps">{salesSteps.map((step, index) => <li key={step.title}>
      <span className="sales-step-number">0{index + 1}</span><Icon name={step.icon} size={24} />
      <h4>{step.title}</h4><p>{step.description}</p>
    </li>)}</ol>
    <div className="commission-preview">
      <span className="operation-icon"><Icon name="tag" size={24} /></span>
      <div><span className="section-eyebrow">COMISSÕES POR GRUPO DE PRODUTOS</span><h3>Cada vendedor, com sua regra.</h3>
        <p>O legado possui um percentual padrão no grupo e uma exceção por vendedor.
          A base de cálculo e as divergências entre relatórios precisam ser validadas antes da implementação.</p>
        <span className="catalog-hint">Sem percentuais ou valores simulados. Nenhuma comissão é calculada aqui.</span></div>
    </div>
    <div className="retail-available"><div><h3>O que você já pode fazer</h3>
      <p>Consultar produtos, verificar estoque e organizar pedidos internos. Confirmar um pedido baixa estoque; não recebe pagamentos nem gera comissão.</p></div>
      <div className="order-actions">
        <button type="button" className="primary-button" onClick={() => onSectionChange('catalog')}>Consultar produtos <Icon name="arrow" size={17} /></button>
        <button type="button" className="secondary-button" onClick={() => onSectionChange('orders')}>Abrir pedidos internos</button>
      </div>
    </div>
  </section>
}
