import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

function App() {
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function carregarMensagens() {
    setLoading(true)
    setErro(null)
    try {
      const resposta = await fetch(`${API_BASE_URL}/api/mensagens`)
      if (!resposta.ok) throw new Error(`Erro ${resposta.status}`)
      const dados = await resposta.json()
      setMensagens(dados)
    } catch (err) {
      setErro(`Não foi possível carregar as mensagens: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarMensagens()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!texto.trim()) return

    setEnviando(true)
    setErro(null)
    try {
      const resposta = await fetch(`${API_BASE_URL}/api/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      if (!resposta.ok) throw new Error(`Erro ${resposta.status}`)
      setTexto('')
      await carregarMensagens()
    } catch (err) {
      setErro(`Não foi possível enviar a mensagem: ${err.message}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="container">
      <h1>Olá Mundo 👋</h1>
      <p className="subtitle">Frontend React + Vite consumindo a API Spring Boot</p>

      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite uma mensagem..."
          disabled={enviando}
        />
        <button type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>

      {erro && <p className="erro">{erro}</p>}

      <h2>Mensagens</h2>
      {loading ? (
        <p>Carregando...</p>
      ) : (
        <ul className="lista">
          {mensagens.length === 0 && <li>Nenhuma mensagem ainda.</li>}
          {mensagens.map((m) => (
            <li key={m.id}>
              <span className="texto">{m.texto}</span>
              {m.criadaEm && (
                <span className="data">
                  {new Date(m.criadaEm).toLocaleString('pt-BR')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
