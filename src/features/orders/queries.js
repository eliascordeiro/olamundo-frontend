import { skipToken, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelOrder, confirmOrder, createOrder, getOrder, getOrders } from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

const ordersKey = (userId, storeId) => ['orders', userId, storeId]
const detailKey = (userId, storeId, orderId) => ['order', userId, storeId, orderId]
const draftKey = (userId, storeId) => ['order-draft', userId, storeId]

const currentUser = (client, userId) => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId

export function useOrderDraft(userId, storeId) {
  const client = useQueryClient()
  const key = draftKey(userId, storeId)
  const draft = useQuery({ queryKey: key, queryFn: skipToken, initialData: [], enabled: false, gcTime: Infinity })
  return { items: draft.data, setItems: (value) => client.setQueryData(key, value) }
}

export function useCreateOrder(userId, storeId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['order-operation', userId, storeId],
    mutationKey: ['create-order', userId, storeId],
    mutationFn: (payload) => createOrder(storeId, payload),
    onSuccess: async (order) => {
      client.setQueryData(draftKey(userId, storeId), [])
      client.setQueryData(detailKey(userId, storeId, order.summary.id), order)
      await client.invalidateQueries({ queryKey: ordersKey(userId, storeId) })
    },
  })
}

export function useOrders(userId, storeId, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...ordersKey(userId, storeId), { page, size: 20 }],
    queryFn: ({ signal }) => getOrders(storeId, { page, signal }),
    enabled: () => currentUser(client, userId),
  })
}

export function useOrder(userId, storeId, orderId) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: detailKey(userId, storeId, orderId),
    queryFn: ({ signal }) => getOrder(storeId, orderId, { signal }),
    enabled: () => Boolean(orderId) && currentUser(client, userId),
    staleTime: 0,
  })
  return {
    ...query,
    refresh: async () => {
      const result = await query.refetch()
      if (result.isSuccess && currentUser(client, userId)) {
        await invalidateOrderRelated(client, userId, storeId, result.data)
      }
      return result
    },
  }
}

function invalidateOrderRelated(client, userId, storeId, order) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ordersKey(userId, storeId) }),
    ...order.items.map(item => client.invalidateQueries({ queryKey: ['stock', userId, storeId, item.productId] })),
  ])
}

async function updateOrder(client, userId, storeId, orderId, order) {
  if (!currentUser(client, userId)) return
  await client.cancelQueries({ queryKey: detailKey(userId, storeId, orderId), exact: true })
  if (!currentUser(client, userId)) return
  client.setQueryData(detailKey(userId, storeId, orderId), order)
  await invalidateOrderRelated(client, userId, storeId, order)
}

export function useConfirmOrder(userId, storeId, orderId) {
  const client = useQueryClient()
  const mutationKey = ['order-transition', userId, storeId, orderId]
  const sending = useIsMutating({ mutationKey }) > 0
  const mutation = useMutation({
    mutationKey,
    mutationFn: () => confirmOrder(storeId, orderId),
    onSuccess: (order) => updateOrder(client, userId, storeId, orderId, order),
  })
  return { ...mutation, sending }
}

export function useCancelOrder(userId, storeId, orderId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['order-cancellation', userId, storeId, orderId],
    mutationKey: ['order-transition', userId, storeId, orderId],
    mutationFn: ({ reason }) => cancelOrder(storeId, orderId, { reason }),
    onSuccess: (order) => updateOrder(client, userId, storeId, orderId, order),
  })
}
