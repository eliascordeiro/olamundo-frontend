import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSalesperson, getSalespeople, getSalesperson, linkSalesperson, updateSalesperson } from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

const teamKey = (userId, storeId) => ['salespeople', userId, storeId]
const personKey = (userId, storeId, id) => ['salesperson', userId, storeId, id]
const currentUser = (client, userId) => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId

export function useSalespeople(userId, storeId, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...teamKey(userId, storeId), { page, size: 20 }],
    queryFn: ({ signal }) => getSalespeople(storeId, { page, signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
  })
}

export function useSalesperson(userId, storeId, id) {
  const client = useQueryClient()
  return useQuery({
    queryKey: personKey(userId, storeId, id),
    queryFn: ({ signal }) => getSalesperson(storeId, id, { signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useCreateSalesperson(userId, storeId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['salesperson-registration', userId, storeId],
    mutationKey: ['create-salesperson', userId, storeId],
    mutationFn: registration => createSalesperson(storeId, registration),
    onSuccess: () => client.invalidateQueries({ queryKey: teamKey(userId, storeId) }),
  })
}

export function useSaveSalesperson(userId, storeId, id) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ account, payload }) => account
      ? linkSalesperson(storeId, id, payload) : updateSalesperson(storeId, id, payload),
    onSuccess: async (seller) => {
      if (!currentUser(client, userId)) return
      await client.cancelQueries({ queryKey: personKey(userId, storeId, id) })
      if (!currentUser(client, userId)) return
      client.setQueryData(personKey(userId, storeId, id), seller)
      await client.invalidateQueries({ queryKey: teamKey(userId, storeId) })
    },
  })
}
