import { useEffect, useRef, useState } from 'react'
import { getCurrentUser, getMessages, login, logout, register, sendMessage } from './api'
import './App.css'

function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    hide: <><path d="m3 3 18 18M10 5a11 11 0 0 1 12 7 18 18 0 0 1-3 4M6 6a18 18 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    chart: <><path d="M4 4v16h17M8 15l4-5 4 2 5-7" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    exit: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h13" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}

function Brand({ light = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><Icon name="chart" size={25} /></span><span>nexo<span className="brand-dot">.</span><small>BUSINESS WORKSPACE</small></span></div>
}

function BusinessPanel() {
  return (
    <aside className="business-panel" aria-label="Apresentação Nexo">
      <Brand light />
      <div className="pitch">
        <span className="eyebrow"><span className="status-dot" /> SEU PRÓXIMO CAPÍTULO COMEÇA AQUI</span>
        <h1>Grandes negócios.<br />Novas conexões.<br /><span>Um só lugar.</span></h1>
        <p>Mais clareza para suas decisões.<br />Mais espaço para o seu negócio crescer.</p>
        <div className="workspace-preview" aria-label="Ilustração de um espaço de trabalho">
          <div className="preview-top"><span className="preview-icon"><Icon name="grid" size={17} /></span><span>Visão do negócio</span><span className="preview-live">WORKSPACE</span></div>
          <div className="preview-content"><div><span className="preview-label">Conecte ideias. Crie oportunidades.</span><strong>Seu próximo nível <span>↗</span></strong></div><div className="mini-chart" aria-hidden="true">{[28, 44, 37, 61, 52, 76, 94].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
          <div className="preview-bottom"><span><span className="tiny-check"><Icon name="check" size={12} /></span> Pessoas, estratégia e resultados</span><span>Em sintonia</span></div>
        </div>
        <div className="panel-values"><span><Icon name="shield" size={17} /> Acesso protegido</span><span><Icon name="chart" size={17} /> Foco no que importa</span></div>
      </div>
      <div className="panel-footer"><span>Feito para quem faz acontecer.</span><span className="decorative-dots">● <span>● ●</span></span></div>
    </aside>
  )
}

function AuthForm({ onAuthenticated }) {
  const [year] = useState(() => new Date().getFullYear())
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
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
    setBusy(true)
    try {
      if (isRegister) {
        await register(values.name.trim(), values.email.trim(), values.password)
        setMode('login')
        setValues((previous) => ({ ...previous, password: '' }))
        setShowPassword(false)
        setNotice('Conta criada! Entre com seu e-mail e senha para começar.')
        heading.current?.focus()
      } else {
        onAuthenticated(await login(values.email.trim(), values.password))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function field(name) {
    return { value: values[name], onChange: (event) => setValues({ ...values, [name]: event.target.value }) }
  }

  return (
    <section className="auth-section">
      <div className="mobile-brand"><Brand /></div>
      <div className="auth-top">Seu negócio, mais conectado. <span><Icon name="shield" size={14} /> Ambiente seguro</span></div>
      <div className="auth-card">
        <div className="welcome-icon"><Icon name={isRegister ? 'user' : 'grid'} size={25} /></div>
        <span className="section-kicker">SEU ESPAÇO DE POSSIBILIDADES</span>
        <h2 ref={heading} tabIndex={-1}>{isRegister ? 'Comece uma nova conexão.' : 'Bom ter você de volta.'}</h2>
        <p className="auth-description">{isRegister ? 'Crie sua conta e dê o próximo passo com a Nexo.' : 'Acesse sua conta e continue construindo o que vem a seguir.'}</p>
        <form onSubmit={submit} className="auth-form" aria-label={isRegister ? 'Criar conta' : 'Entrar na conta'}>
          {isRegister && <div className="field-group"><label htmlFor="name">Seu nome</label><div className="input-wrap"><Icon name="user" /><input id="name" name="name" autoComplete="name" placeholder="Como podemos chamar você?" required minLength={2} maxLength={80} disabled={busy} {...field('name')} /></div></div>}
          <div className="field-group"><label htmlFor="email">E-mail</label><div className="input-wrap"><Icon name="mail" /><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@empresa.com.br" required maxLength={254} disabled={busy} {...field('email')} /></div></div>
          <div className="field-group"><label htmlFor="password">Senha</label><div className="input-wrap"><Icon name="lock" /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'Crie uma senha forte' : 'Digite sua senha'} required minLength={isRegister ? 12 : 1} maxLength={isRegister ? 72 : 128} disabled={busy} aria-describedby={isRegister ? 'password-hint' : undefined} {...field('password')} /><button className="eye-button" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={busy}><Icon name={showPassword ? 'hide' : 'eye'} size={19} /></button></div>{isRegister && <small id="password-hint" className="field-hint">Use uma senha exclusiva com 12 a 72 caracteres (até 72 bytes).</small>}</div>
          {!isRegister && <div className="session-note"><Icon name="lock" size={14} /> Sua sessão expira após 30 minutos de inatividade.</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> {isRegister ? 'Criando sua conta...' : 'Entrando...'}</> : <>{isRegister ? 'Criar minha conta' : 'Entrar no workspace'}<Icon name="arrow" size={19} /></>}</button>
        </form>
        <div className="auth-divider"><span>CONEXÕES QUE MOVEM NEGÓCIOS</span></div>
        <p className="switch-mode">{isRegister ? 'Já faz parte da Nexo?' : 'Ainda não tem uma conta?'} <button type="button" onClick={switchMode} disabled={busy}>{isRegister ? 'Entrar na conta' : 'Começar agora'} <span aria-hidden="true">↗</span></button></p>
        <div className="security-note"><Icon name="shield" size={17} /><span>Seus dados protegidos. Seu foco no futuro.</span></div>
      </div>
      <footer className="auth-footer"><span>© {year} Nexo Business</span><span>Conecte. Simplifique. Evolua.</span></footer>
    </section>
  )
}

function Workspace({ user, onSignedOut }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleError(err) {
    if (err.status === 401) onSignedOut()
    else setError(err.message)
  }

  async function loadMessages() {
    setLoading(true)
    setError('')
    try {
      setMessages(await getMessages())
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getMessages().then((data) => {
      if (active) setMessages(data)
    }).catch((err) => {
      if (!active) return
      if (err.status === 401) onSignedOut()
      else setError(err.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [onSignedOut])

  async function submitMessage(event) {
    event.preventDefault()
    if (!text.trim()) {
      setError('Escreva uma mensagem antes de enviar.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await sendMessage(text.trim())
      setText('')
      await loadMessages()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await logout()
      onSignedOut()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  return <main className="workspace">
    <header className="workspace-header"><Brand /><div className="account-menu"><span>{user.name}</span><button type="button" className="secondary-button" onClick={signOut} disabled={busy}><Icon name="exit" size={17} /> Sair</button></div></header>
    <section className="workspace-body"><span className="section-kicker">SEU WORKSPACE</span><h1>Olá, {user.name.split(' ')[0]}<span className="brand-dot">.</span></h1><p>Boas conexões começam com uma conversa.</p>
      <div className="workspace-banner"><span className="welcome-icon"><Icon name="shield" size={24} /></span><div><h2>Você está no seu espaço de negócios.</h2><p>Acesso autenticado. Ideias prontas para ganhar vida.</p></div><span className="connected-badge"><span className="status-dot" /> Conectado</span></div>
      <section className="messages-card"><div className="messages-heading"><div><h2>Mural de conexões</h2><p>Compartilhe uma ideia com o workspace.</p></div><Icon name="mail" size={24} /></div>
        <form className="message-form" onSubmit={submitMessage}><label htmlFor="message">Sua mensagem</label><textarea id="message" value={text} onChange={(event) => setText(event.target.value)} placeholder="O que vamos construir hoje?" required maxLength={2000} disabled={busy} /><button className="primary-button" disabled={busy || !text.trim()}>{busy ? 'Aguarde...' : 'Publicar mensagem'}<Icon name="arrow" size={18} /></button></form>
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="inline-button" onClick={loadMessages} disabled={busy || loading}>Tentar novamente</button></div>}
        <div aria-live="polite">{loading ? <p className="empty-state">Carregando mensagens...</p> : messages.length === 0 ? <p className="empty-state">O próximo assunto pode começar com você. Publique a primeira mensagem.</p> : <ul className="message-list">{messages.map((message) => <li key={message.id}><p>{message.texto}</p>{message.criadaEm && <time dateTime={message.criadaEm}>{new Date(message.criadaEm).toLocaleString('pt-BR')}</time>}</li>)}</ul>}</div>
      </section>
    </section>
  </main>
}

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  async function restoreSession() {
    setChecking(true)
    setError('')
    try {
      setUser(await getCurrentUser())
    } catch (err) {
      if (err.status !== 401) setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    let active = true
    getCurrentUser().then((account) => {
      if (active) setUser(account)
    }).catch((err) => {
      if (active && err.status !== 401) setError(err.message)
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => { active = false }
  }, [])

  if (checking || error) return <main className="startup-screen"><Brand />{checking ? <p role="status"><span className="spinner" /> Preparando seu workspace...</p> : <><div className="alert alert-error" role="alert">{error}</div><button className="primary-button" onClick={restoreSession}>Tentar novamente <Icon name="arrow" /></button></>}</main>
  if (user) return <Workspace user={user} onSignedOut={() => setUser(null)} />
  return <main className="login-layout"><BusinessPanel /><AuthForm onAuthenticated={setUser} /></main>
}

export default App
