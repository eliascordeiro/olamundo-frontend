import { skipToken, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sessionKey } from './queries'

export default function useIdempotentOperation({ userId, operationKey, mutationKey, mutationFn, onSuccess }) {
  const client = useQueryClient()
  const currentUser = () => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId
  const operation = useQuery({
    queryKey: operationKey, queryFn: skipToken, initialData: null, enabled: false, gcTime: Infinity,
  })
  const sending = useIsMutating({ mutationKey }) > 0
  const mutation = useMutation({
    mutationKey,
    mutationFn,
    onSuccess: async (result, payload) => {
      if (!currentUser()) return
      if (client.getQueryData(operationKey)?.requestId === payload.requestId) client.setQueryData(operationKey, null)
      await onSuccess(result)
    },
    onError: (error, payload) => {
      if (currentUser() && client.getQueryData(operationKey)?.requestId === payload.requestId
        && error.status >= 400 && error.status < 500 && error.status !== 408) {
        client.setQueryData(operationKey, null)
      }
    },
  })
  return {
    pendingOperation: operation.data,
    sending,
    submit: (draft) => {
      const payload = client.getQueryData(operationKey) ?? { ...draft, requestId: crypto.randomUUID() }
      // Preserve uncertain requests across panel switches; logout clears private query state.
      client.setQueryData(operationKey, payload)
      return mutation.mutateAsync(payload)
    },
  }
}
