import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getStock, getStockHistory, moveStock } from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

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
  return useIdempotentOperation({
    userId,
    operationKey: operationKey(userId, storeId, productId),
    mutationKey: ['move-stock', userId, storeId, productId],
    mutationFn: (movement) => moveStock(storeId, productId, movement),
    onSuccess: () => client.invalidateQueries({ queryKey: stockKey(userId, storeId, productId) }),
  })
}
