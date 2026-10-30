import { useState } from 'react'
import Icon from '../../components/Icon'
import QueryError from '../../components/QueryError'
import { useCreateGroup, useCreateSubgroup, useProductGroups, useSaveGroup, useSaveSubgroup } from './queries'
import '../customers/customers.css'
import './groups.css'

const groupFields = [
  ['name', 'Nome do grupo', 'text', { required: true, minLength: 2, maxLength: 60 }],
  ['ncm', 'NCM', 'text', { maxLength: 20 }],
  ['commission', 'Comissão (%)', 'number'],
  ['assemblyCommission', 'Comissão de montagem (%)', 'number'],
  ['assemblyDiscount', 'Desconto de montagem (%)', 'number'],
  ['markup', 'Markup (%)', 'number'],
  ['pautaDiscount', 'Desconto de pauta (%)', 'number'],
  ['flexibleDiscount', 'Desconto flexível (%)', 'number'],
]
const subgroupFields = [
  ['name', 'Nome do subgrupo', 'text', { required: true, minLength: 2, maxLength: 60 }],
  ['markup', 'Markup (%)', 'number'],
  ['margin', 'Margem (%)', 'number'],
  ['pautaDiscount', 'Desconto de pauta (%)', 'number'],
  ['flexibleDiscount', 'Desconto flexível (%)', 'number'],
]

const show = (value) => String(value ?? '').replace('.', ',')
const toValues = (definition, source) => Object.fromEntries(definition.map(([name, , type]) =>
  [name, type === 'number' ? show(source?.[name] ?? '') : source?.[name] ?? '']))

function toPayload(definition, values) {
  const payload = {}
  for (const [name, label, type] of definition) {
    const text = String(values[name] ?? '').trim()
    if (type === 'number') {
      if (!text) { payload[name] = null; continue }
      const number = Number(text.replace(',', '.'))
      if (!Number.isFinite(number)) throw new Error(`Valor inválido em ${label}.`)
      payload[name] = number
    } else payload[name] = text || null
  }
  return payload
}

function DataForm({ ariaLabel, title, definition, source, submitLabel, busy, pendingOperation, run, onDone, onCancel }) {
  const [values, setValues] = useState(() => toValues(definition, source))
  const [error, setError] = useState('')
  const shown = pendingOperation ? toValues(definition, pendingOperation) : values

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      onDone(await run(toPayload(definition, values)))
    } catch (err) {
      setError(err.message)
    }
  }

  return <form className="customer-form" aria-label={ariaLabel} onSubmit={submit}>
    <h3>{title}</h3>
    <fieldset disabled={busy}>
      <div className="customer-fields">{definition.map(([name, label, type, attributes]) => <label key={name}>{label}
        <input {...attributes} inputMode={type === 'number' ? 'decimal' : undefined} disabled={Boolean(pendingOperation)}
          value={shown[name] ?? ''} onChange={event => setValues(previous => ({ ...previous, [name]: event.target.value }))} /></label>)}</div>
      {pendingOperation && <p className="catalog-hint" role="status">Há um cadastro aguardando confirmação. Confirme o mesmo envio para evitar duplicação.</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="team-actions">
        <button className="primary-button" type="submit">{busy ? 'Salvando...' : pendingOperation ? 'Confirmar mesmo cadastro' : submitLabel}</button>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </fieldset>
  </form>
}

function NewGroupForm({ userId, storeId, ...rest }) {
  const creation = useCreateGroup(userId, storeId)
  return <DataForm {...rest} ariaLabel="Cadastrar grupo" title="Novo grupo" definition={groupFields} submitLabel="Cadastrar grupo"
    busy={creation.sending} pendingOperation={creation.pendingOperation} run={payload => creation.submit(payload)} />
}

function EditGroupForm({ userId, storeId, group, ...rest }) {
  const mutation = useSaveGroup(userId, storeId, group.id)
  return <DataForm {...rest} ariaLabel={`Editar grupo ${group.name}`} title={`Editar ${group.name}`} definition={groupFields}
    source={group} submitLabel="Salvar grupo" busy={mutation.isPending}
    run={payload => mutation.mutateAsync({ ...payload, version: group.version })} />
}

function NewSubgroupForm({ userId, storeId, group, ...rest }) {
  const creation = useCreateSubgroup(userId, storeId, group.id)
  return <DataForm {...rest} ariaLabel={`Cadastrar subgrupo em ${group.name}`} title={`Novo subgrupo em ${group.name}`}
    definition={subgroupFields} submitLabel="Cadastrar subgrupo" busy={creation.sending}
    pendingOperation={creation.pendingOperation} run={payload => creation.submit(payload)} />
}

function EditSubgroupForm({ userId, storeId, group, subgroup, ...rest }) {
  const mutation = useSaveSubgroup(userId, storeId, group.id, subgroup.id)
  return <DataForm {...rest} ariaLabel={`Editar subgrupo ${subgroup.name}`} title={`Editar ${subgroup.name}`}
    definition={subgroupFields} source={subgroup} submitLabel="Salvar subgrupo" busy={mutation.isPending}
    run={payload => mutation.mutateAsync({ ...payload, version: subgroup.version })} />
}

const percent = (value) => `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

export default function GroupsPanel({ userId, store }) {
  const canWrite = store.role === 'OWNER' || store.role === 'MANAGER'
  const groups = useProductGroups(userId, store.id)
  const [form, setForm] = useState(null)
  const [notice, setNotice] = useState('')
  const finish = (message) => () => { setNotice(message); setForm(null) }
  const common = { userId, storeId: store.id, onCancel: () => setForm(null) }

  return <section className="customers-workspace" aria-label={`Grupos de produtos de ${store.name}`}>
    <div className="catalog-heading"><div><span className="section-eyebrow">COMO OS PRODUTOS SÃO ORGANIZADOS</span><h2>Grupos de produtos</h2>
      <p>Grupos e subgrupos da empresa, compartilhados por todas as lojas dela. Todos consultam; proprietário e gerente cadastram e editam.
        Comissões e descontos ficam guardados para as vendas, que ainda não os utilizam.</p></div>
      <span className="team-icon"><Icon name="tag" size={28} /></span></div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {groups.isPending ? <p role="status">Carregando grupos...</p>
      : groups.isError ? <QueryError query={groups} label="Não foi possível carregar os grupos" />
        : groups.data.length === 0 ? <p className="empty-state">Nenhum grupo cadastrado.</p>
          : <ul className="group-list" aria-label="Grupos">{groups.data.map(group => <li key={group.id}>
            <div className="group-head">
              <div className="customer-person"><h3>{group.name}</h3>
                <p>{[group.ncm && `NCM ${group.ncm}`, `Comissão ${percent(group.commission)}`, `Markup ${percent(group.markup)}`].filter(Boolean).join(' · ')}</p></div>
              {canWrite && <div className="team-actions">
                <button type="button" className="secondary-button" aria-label={`Editar grupo ${group.name}`}
                  onClick={() => setForm({ kind: 'editGroup', group })}>Editar</button>
                <button type="button" className="secondary-button" aria-label={`Novo subgrupo em ${group.name}`}
                  onClick={() => setForm({ kind: 'newSubgroup', group })}>Novo subgrupo</button>
              </div>}
            </div>
            {group.subgroups.length > 0 && <ul className="subgroup-list" aria-label={`Subgrupos de ${group.name}`}>
              {group.subgroups.map(subgroup => <li key={subgroup.id}>
                <div className="customer-person"><h4>{subgroup.name}</h4>
                  <p>{`Markup ${percent(subgroup.markup)} · Margem ${percent(subgroup.margin)}`}</p></div>
                {canWrite && <button type="button" className="secondary-button" aria-label={`Editar subgrupo ${subgroup.name}`}
                  onClick={() => setForm({ kind: 'editSubgroup', group, subgroup })}>Editar</button>}
              </li>)}</ul>}
          </li>)}</ul>}
    {canWrite && !form && <button type="button" className="primary-button" onClick={() => setForm({ kind: 'newGroup' })}>Novo grupo</button>}
    {form?.kind === 'newGroup' && <NewGroupForm {...common} onDone={finish('Grupo cadastrado.')} />}
    {form?.kind === 'editGroup' && <EditGroupForm key={form.group.id + form.group.version} {...common} group={form.group} onDone={finish('Grupo atualizado.')} />}
    {form?.kind === 'newSubgroup' && <NewSubgroupForm {...common} group={form.group} onDone={finish('Subgrupo cadastrado.')} />}
    {form?.kind === 'editSubgroup' && <EditSubgroupForm key={form.subgroup.id + form.subgroup.version} {...common}
      group={form.group} subgroup={form.subgroup} onDone={finish('Subgrupo atualizado.')} />}
  </section>
}
