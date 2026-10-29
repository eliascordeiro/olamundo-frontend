import { useState } from 'react'
import Icon from '../../components/Icon'
import { useAcceptOwnerInvite } from './queries'
import './platform.css'

export default function AcceptInvite({ token, onDone }) {
  const mutation = useAcceptOwnerInvite()
  const [values, setValues] = useState({ name: '', password: '' })
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (new TextEncoder().encode(values.password).length > 72) {
      setError('A senha deve ter no máximo 72 bytes. Reduza a quantidade de caracteres especiais.')
      return
    }
    try {
      setAccepted(await mutation.mutateAsync({ token, name: values.name.trim(), password: values.password }))
    } catch (err) {
      setError(err.message)
    }
  }

  const field = (name) => ({ value: values[name], onChange: (event) => setValues({ ...values, [name]: event.target.value }) })

  return <main className="invite-screen">
    {accepted ? <section className="platform-form" aria-label="Convite aceito">
      <h3>Acesso criado.</h3>
      <p className="catalog-hint">A conta de {accepted.email} está pronta. Entre com seu e-mail e a senha que acabou de definir.
        Se este e-mail já tinha conta, ela foi vinculada e a senha anterior continua valendo.</p>
      <button type="button" className="primary-button" onClick={onDone}>Ir para o login <Icon name="arrow" size={19} /></button>
    </section> : <form className="platform-form" aria-label="Aceitar convite" onSubmit={submit}>
      <h3>Bem-vindo à Nexo</h3>
      <p className="catalog-hint">Você foi convidado como proprietário. Defina seu nome e uma senha exclusiva para acessar.</p>
      <fieldset disabled={mutation.isPending}>
        <label>Seu nome<input required minLength={2} maxLength={80} autoComplete="name" {...field('name')} /></label>
        <label>Nova senha<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" {...field('password')} /></label>
        <small className="field-hint">Use uma senha exclusiva com 12 a 72 caracteres (até 72 bytes).</small>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="primary-button" type="submit">{mutation.isPending ? 'Criando acesso...' : 'Criar meu acesso'}</button>
        <button className="secondary-button" type="button" onClick={onDone}>Já tenho conta</button>
      </fieldset>
    </form>}
  </main>
}
