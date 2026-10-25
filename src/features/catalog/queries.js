import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProduct, getProducts, getStore, getStores } from '../../api'
import { sessionKey } from '../../queries'

const storesKey = (userId) => ['stores', userId]
const storeKey = (userId, storeId) => ['store', userId, storeId]
const productsKey = (userId, storeId) => ['products', userId, storeId]

function isCurrentUser(client, userId) {
  return Boolean(userId) && client.getQueryData(sessionKey)?.id === userId
}

export function useStores(userId) {
  const client = useQueryClient()
  return useInfiniteQuery({
    queryKey: storesKey(userId),
    queryFn: ({ pageParam, signal }) => getStores({ page: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.page + 1 : undefined,
    enabled: () => isCurrentUser(client, userId),
  })
}

export function useStore(userId, storeId) {
  const client = useQueryClient()
  return useQuery({
    queryKey: storeKey(userId, storeId),
    queryFn: ({ signal }) => getStore(storeId, { signal }),
    enabled: () => Boolean(storeId) && isCurrentUser(client, userId),
    staleTime: 0,
  })
}

export function useProducts(userId, storeId, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...productsKey(userId, storeId), { page, size: 20 }],
    queryFn: ({ signal }) => getProducts(storeId, { page, signal }),
    enabled: () => Boolean(storeId) && isCurrentUser(client, userId),
  })
}

export function useCreateProduct(userId, storeId) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (product) => createProduct(storeId, product),
    onSuccess: () => client.invalidateQueries({ queryKey: productsKey(userId, storeId) }),
  })
}
