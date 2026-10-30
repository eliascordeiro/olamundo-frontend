import { useRef, useState } from 'react'
import { useLogin, useLogout, useRegister, useSession } from './queries'
import StoreCatalog from './features/catalog/StoreCatalog'
import PlatformConsole from './features/platform/PlatformConsole'
import AcceptInvite from './features/platform/AcceptInvite'
import workspaceSections from './features/workspaceSections'
import Icon from './components/Icon'
import './App.css'
import './retail.css'

function Brand({ light = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><Icon name="store" size={25} /></span><span>nexo<span className="brand-dot">.</span><small>GESTÃO DO VAREJO</small></span></div>
}

function BusinessPanel() {
  return (
    <aside className="business-panel" aria-label="Apresentação Nexo">
      <Brand light />
      <div className="pitch">
        <span className="eyebrow"><span className="status-dot" /> NO RITMO DA SUA LOJA</span>
        <h1>Menos processos.<br />Mais tempo para<br /><span>atender bem.</span></h1>
        <p>Móveis, eletro e tudo o que sua loja oferece.<br />Uma operação organizada, do produto ao pedido.</p>
        <div className="workspace-preview" aria-label="Ilustração da rotina de uma loja">
          <div className="preview-top"><span className="preview-icon"><Icon name="store" size={17} /></span><span>Sua loja, em sintonia</span><span className="preview-live">VAREJO</span></div>
          <div className="preview-content"><div><span className="preview-label">Cada detalhe importa no atendimento.</span><strong>Encontre. Confira.<br /><span>Organize o pedido.</span></strong></div><Icon name="sofa" size={76} /></div>
          <div className="preview-bottom"><span><span className="tiny-check"><Icon name="check" size={12} /></span> Produtos · Estoque · Pedidos internos</span><span>Por loja</span></div>
        </div>
        <div className="panel-values"><span><Icon name="shield" size={17} /> Acesso protegido</span><span><Icon name="chart" size={17} /> Foco no que importa</span></div>
      </div>
      <div className="panel-footer"><span>Feito para quem vive o varejo.</span><span className="decorative-dots">● <span>● ●</span></span></div>
    </aside>
  )
}

function AuthForm() {
  const [year] = useState(() => new Date().getFullYear())
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const loginMutation = useLogin()
  const registerMutation = useRegister()
  const busy = loginMutation.isPending || registerMutation.isPending
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const heading = useRef(null)
  const isRegister = mode === 'register'

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError('')
    setNotice('')
    setShowPassword(false)
    setValues((previous) => ({ ...previous, password: '' }))
    heading.current?.focus()
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (isRegister && new TextEncoder().encode(values.password).length > 72) {
      setError('A senha deve ter no máximo 72 bytes. Reduza a quantidade de caracteres especiais.')
      return
    }
    try {
      if (isRegister) {
        await registerMutation.mutateAsync({
          name: values.name.trim(), email: values.email.trim(), password: values.password,
        })
        setMode('login')
        setValues((previous) => ({ ...previous, password: '' }))
        setShowPassword(false)
        setNotice('Conta criada! Entre com seu e-mail e senha para começar.')
        heading.current?.focus()
      } else {
        await loginMutation.mutateAsync({ email: values.email.trim(), password: values.password })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      loginMutation.reset()
      registerMutation.reset()
    }
  }

  function field(name) {
    return { value: values[name], onChange: (event) => setValues({ ...values, [name]: event.target.value }) }
  }

  return (
    <section className="auth-section">
      <div className="mobile-brand"><Brand /></div>
      <div className="auth-top">A rotina da loja começa aqui. <span><Icon name="shield" size={14} /> Ambiente seguro</span></div>
      <div className="auth-card">
        <div className="welcome-icon"><Icon name={isRegister ? 'user' : 'grid'} size={25} /></div>
        <span className="section-kicker">SEU PONTO DE ENCONTRO COM A LOJA</span>
        <h2 ref={heading} tabIndex={-1}>{isRegister ? 'Seu próximo passo no varejo.' : 'Bom ter você de volta.'}</h2>
        <p className="auth-description">{isRegister ? 'Crie sua conta para começar a organizar a operação das suas lojas.' : 'Entre para consultar produtos, conferir o estoque e acompanhar os pedidos da sua loja.'}</p>
        <form onSubmit={submit} className="auth-form" aria-label={isRegister ? 'Criar conta' : 'Entrar na conta'}>
          {isRegister && <div className="field-group"><label htmlFor="name">Seu nome</label><div className="input-wrap"><Icon name="user" /><input id="name" name="name" autoComplete="name" placeholder="Como podemos chamar você?" required minLength={2} maxLength={80} disabled={busy} {...field('name')} /></div></div>}
          <div className="field-group"><label htmlFor="email">E-mail</label><div className="input-wrap"><Icon name="mail" /><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@empresa.com.br" required maxLength={254} disabled={busy} {...field('email')} /></div></div>
          <div className="field-group"><label htmlFor="password">Senha</label><div className="input-wrap"><Icon name="lock" /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'Crie uma senha forte' : 'Digite sua senha'} required minLength={isRegister ? 12 : 1} maxLength={isRegister ? 72 : 128} disabled={busy} aria-describedby={isRegister ? 'password-hint' : undefined} {...field('password')} /><button className="eye-button" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={busy}><Icon name={showPassword ? 'hide' : 'eye'} size={19} /></button></div>{isRegister && <small id="password-hint" className="field-hint">Use uma senha exclusiva com 12 a 72 caracteres (até 72 bytes).</small>}</div>
          {!isRegister && <div className="session-note"><Icon name="lock" size={14} /> Sua sessão expira após 30 minutos de inatividade.</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> {isRegister ? 'Criando sua conta...' : 'Entrando...'}</> : <>{isRegister ? 'Criar minha conta' : 'Entrar no workspace'}<Icon name="arrow" size={19} /></>}</button>
        </form>
        <div className="auth-divider"><span>MAIS CLAREZA EM CADA ATENDIMENTO</span></div>
        <p className="switch-mode">{isRegister ? 'Já faz parte da Nexo?' : 'Ainda não tem uma conta?'} <button type="button" onClick={switchMode} disabled={busy}>{isRegister ? 'Entrar na conta' : 'Começar agora'} <span aria-hidden="true">↗</span></button></p>
        <div className="security-note"><Icon name="shield" size={17} /><span>Seus dados protegidos. Seu foco no futuro.</span></div>
      </div>
      <footer className="auth-footer"><span>© {year} Nexo Business</span><span>Sua loja. Seu próximo passo.</span></footer>
    </section>
  )
}

function WorkspaceMenu({ section, onSectionChange }) {
  return <nav className="workspace-menu" aria-label="Navegação principal">
    <span className="workspace-menu-label">DIA A DIA DA LOJA</span>
    {workspaceSections.map((item) =>
      <button key={item.id} type="button" className="workspace-nav-button"
        aria-label={item.id === 'orders' ? 'Pedidos da loja' : item.label} title={item.label}
        aria-current={section === item.id ? 'page' : undefined}
        onClick={() => onSectionChange(item.id)}>
        <Icon name={item.icon} size={19} />
        <span>{item.label}</span>
        {item.preparing && <small className="nav-preparing">Em preparação</small>}
      </button>)}
    <div className="workspace-menu-note">
      <Icon name="shield" size={16} />
      <span>Uma operação por vez.<br />Acesso por loja e perfil.</span>
    </div>
  </nav>
}

const sidebarKey = 'nexo.sidebar-collapsed'

// Preferência de interface (não é dado de negócio); falhas de armazenamento são ignoradas.
function readSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarKey) === '1'
  } catch {
    return false
  }
}

function saveSidebarPreference(collapsed) {
  try {
    window.localStorage.setItem(sidebarKey, collapsed ? '1' : '0')
  } catch {
    // Sem armazenamento disponível, a preferência vale só nesta sessão.
  }
}

function Workspace({ user }) {
  const logoutMutation = useLogout()
  const [error, setError] = useState('')
  const [section, setSection] = useState('catalog')
  const busy = logoutMutation.isPending
  const [collapsed, setCollapsed] = useState(readSidebarPreference)

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    saveSidebarPreference(next)
  }

  function changeSection(nextSection) {
    setSection(nextSection)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  async function signOut() {
    setError('')
    try {
      await logoutMutation.mutateAsync()
    } catch (err) {
      setError(err.message)
    }
  }

  return <div className={`workspace${collapsed ? ' workspace-collapsed' : ''}`}>
    <a className="skip-link" href="#workspace-content">Ir para o conteúdo</a>
    <aside className="workspace-sidebar">
      <button type="button" className="sidebar-toggle" aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        onClick={toggleSidebar}><Icon name="menu" size={18} /></button>
      <Brand light />
      <WorkspaceMenu section={section} onSectionChange={changeSection} />
      <div className="sidebar-edition"><Icon name="sofa" size={28} /><p>Varejo, de perto.<span>Móveis · Eletro · Vendas em geral</span></p></div>
    </aside>
    <div className="workspace-content">
      <header className="workspace-header">
        <div className="workspace-location"><Icon name="store" size={18} /><span>Operação de loja <span aria-hidden="true">/</span> <strong>{workspaceSections.find(item => item.id === section).label}</strong></span></div>
        <div className="account-menu"><span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span><span>{user.name}</span><button type="button" className="secondary-button" onClick={signOut} disabled={busy}><Icon name="exit" size={17} /> Sair</button></div>
      </header>
      <main className="workspace-body" id="workspace-content" tabIndex={-1}>
        <div className="workspace-intro"><div><span className="section-kicker">CADA ATENDIMENTO COMEÇA COM ORGANIZAÇÃO</span><h1>Olá, {user.name.split(' ')[0]}<span className="brand-dot">.</span></h1><p>Produtos, estoque e pedidos. No contexto certo, para atender melhor.</p></div><span className="retail-signature"><Icon name="sofa" size={22} /> Sua loja, mais próxima.</span></div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <StoreCatalog userId={user.id} section={section} onSectionChange={changeSection} canCreateStore={user.platformOwner === true} />
      </main>
    </div>
  </div>
}

function readInvite() {
  const params = new URLSearchParams(window.location.search)
  const kinds = { convite: 'owner', acesso: 'seller' }
  const param = Object.keys(kinds).find(name => params.get(name) !== null)
  if (!param) return null
  const invite = { token: params.get(param), kind: kinds[param] }
  // Remove o token da barra de endereço para não vazar em histórico ou referrer.
  Object.keys(kinds).forEach(name => params.delete(name))
  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  return invite
}

const initialInvite = readInvite()

function App() {
  const session = useSession()
  const user = session.data
  const checking = session.isPending || (session.isError && session.isFetching)
  const [invite, setInvite] = useState(initialInvite)

  if (checking || session.isError) return <main className="startup-screen"><Brand />{checking ? <p role="status"><span className="spinner" /> Preparando seu workspace...</p> : <><div className="alert alert-error" role="alert">{session.error.message}</div><button className="primary-button" onClick={() => session.refetch()}>Tentar novamente <Icon name="arrow" /></button></>}</main>
  if (user?.platformAdmin) return <PlatformConsole key={user.id} user={user} />
  if (user) return <Workspace key={user.id} user={user} />
  if (invite) return <AcceptInvite token={invite.token} kind={invite.kind} onDone={() => setInvite(null)} />
  return <main className="login-layout"><BusinessPanel /><AuthForm /></main>
}

export default App
