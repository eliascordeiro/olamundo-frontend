export default function QueryError({ query, label }) {
  return <div className="alert alert-error" role="alert">
    {label}: {query.error.message}{' '}
    <button type="button" className="inline-button" disabled={query.isFetching}
      onClick={() => query.refetch()}>Tentar novamente</button>
  </div>
}
