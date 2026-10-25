import { skipToken, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getStock, getStockHistory, moveStock } from '../../api'
import { sessionKey } from '../../queries'

const stockKey = (userId, storeId, productId) => ['stock', userId, storeId, productId]
const operationKey = (userId, storeId, productId) => ['stock-operation', userId, storeId, productId]

function currentUser(client, userId) {
  return Boolean(userId) && client.getQueryData(sessionKey)?.id === userId
}

export function useStock(userId, storeId, productId) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...stockKey(userId, storeId, productId), 'balance'],
    queryFn: ({ signal }) => getStock(storeId, productId, { signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
  })
}

export function useStockHistory(userId, storeId, productId, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...stockKey(userId, storeId, productId), 'history', { page, size: 20 }],
    queryFn: ({ signal }) => getStockHistory(storeId, productId, { page, signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
  })
}

export function useStockMovement(userId, storeId, productId) {
  const client = useQueryClient()
  const key = operationKey(userId, storeId, productId)
  const operation = useQuery({
    queryKey: key,
    queryFn: skipToken,
    initialData: null,
    enabled: false,
    gcTime: Infinity,
  })
  const mutationKey = ['move-stock', userId, storeId, productId]
  const sending = useIsMutating({ mutationKey }) > 0
  const mutation = useMutation({
    mutationKey,
    mutationFn: (movement) => moveStock(storeId, productId, movement),
    onSuccess: async (_result, payload) => {
      if (!currentUser(client, userId)) return
      if (client.getQueryData(key)?.requestId === payload.requestId) client.setQueryData(key, null)
      await client.invalidateQueries({ queryKey: stockKey(userId, storeId, productId) })
    },
    onError: (error, payload) => {
      if (currentUser(client, userId) && client.getQueryData(key)?.requestId === payload.requestId
        && error.status >= 400 && error.status < 500 && error.status !== 408) {
        client.setQueryData(key, null)
      }
    },
  })

  return {
    pendingOperation: operation.data,
    sending,
    submit: (draft) => {
      const pending = client.getQueryData(key)
      const payload = pending ?? { ...draft, requestId: crypto.randomUUID() }
      // Keep uncertain requests across panel/store switches; logout clears all private queries.
      client.setQueryData(key, payload)
      return mutation.mutateAsync(payload)
    },
  }
}
