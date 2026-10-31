import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer, createDeliveryAddress, deleteDeliveryAddress, getCustomer, getCustomers, getDeliveryAddresses,
  updateCustomer, updateDeliveryAddress,
} from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

const customersKey = (userId) => ['customers', userId]
const customerKey = (userId, storeId, id) => ['customer', userId, storeId, id]
const currentUser = (client, userId) => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId

export function useCustomers(userId, storeId, q, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...customersKey(userId), storeId, { q, page, size: 20 }],
    queryFn: ({ signal }) => getCustomers(storeId, { page, q, signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
    placeholderData: (previous) => previous,
  })
}

export function useCustomer(userId, storeId, id) {
  const client = useQueryClient()
  return useQuery({
    queryKey: customerKey(userId, storeId, id),
    queryFn: ({ signal }) => getCustomer(storeId, id, { signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useCreateCustomer(userId, storeId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['customer-registration', userId, storeId],
    mutationKey: ['create-customer', userId, storeId],
    mutationFn: customer => createCustomer(storeId, customer),
    onSuccess: () => client.invalidateQueries({ queryKey: customersKey(userId) }),
  })
}

export function useSaveCustomer(userId, storeId, id) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (customer) => updateCustomer(storeId, id, customer),
    onSuccess: async (customer) => {
      if (!currentUser(client, userId)) return
      await client.cancelQueries({ queryKey: customerKey(userId, storeId, id) })
      if (!currentUser(client, userId)) return
      client.setQueryData(customerKey(userId, storeId, id), customer)
      await client.invalidateQueries({ queryKey: customersKey(userId) })
    },
  })
}

const addressesKey = (userId, storeId, customerId) => ['delivery-addresses', userId, storeId, customerId]

export function useDeliveryAddresses(userId, storeId, customerId) {
  const client = useQueryClient()
  return useQuery({
    queryKey: addressesKey(userId, storeId, customerId),
    queryFn: ({ signal }) => getDeliveryAddresses(storeId, customerId, { signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export function useCreateDeliveryAddress(userId, storeId, customerId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['delivery-address-registration', userId, storeId, customerId],
    mutationKey: ['create-delivery-address', userId, storeId, customerId],
    mutationFn: address => createDeliveryAddress(storeId, customerId, address),
    onSuccess: () => client.invalidateQueries({ queryKey: addressesKey(userId, storeId, customerId) }),
  })
}

export function useSaveDeliveryAddress(userId, storeId, customerId) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...address }) => updateDeliveryAddress(storeId, customerId, id, address),
    onSuccess: () => client.invalidateQueries({ queryKey: addressesKey(userId, storeId, customerId) }),
  })
}

export function useDeleteDeliveryAddress(userId, storeId, customerId) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version }) => deleteDeliveryAddress(storeId, customerId, id, version),
    onSuccess: () => client.invalidateQueries({ queryKey: addressesKey(userId, storeId, customerId) }),
  })
}
