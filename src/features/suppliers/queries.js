import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSupplier, getSupplier, getSuppliers, updateSupplier } from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

const suppliersKey = (userId) => ['suppliers', userId]
const supplierKey = (userId, storeId, id) => ['supplier', userId, storeId, id]
const currentUser = (client, userId) => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId

export function useSuppliers(userId, storeId, q, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...suppliersKey(userId), storeId, { q, page, size: 20 }],
    queryFn: ({ signal }) => getSuppliers(storeId, { page, q, signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
    placeholderData: (previous) => previous,
  })
}

export function useSupplier(userId, storeId, id) {
  const client = useQueryClient()
  return useQuery({
    queryKey: supplierKey(userId, storeId, id),
    queryFn: ({ signal }) => getSupplier(storeId, id, { signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useCreateSupplier(userId, storeId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['supplier-registration', userId, storeId],
    mutationKey: ['create-supplier', userId, storeId],
    mutationFn: supplier => createSupplier(storeId, supplier),
    onSuccess: () => client.invalidateQueries({ queryKey: suppliersKey(userId) }),
  })
}

export function useSaveSupplier(userId, storeId, id) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (supplier) => updateSupplier(storeId, id, supplier),
    onSuccess: async (supplier) => {
      if (!currentUser(client, userId)) return
      await client.cancelQueries({ queryKey: supplierKey(userId, storeId, id) })
      if (!currentUser(client, userId)) return
      client.setQueryData(supplierKey(userId, storeId, id), supplier)
      await client.invalidateQueries({ queryKey: suppliersKey(userId) })
    },
  })
}
