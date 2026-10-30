import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProductGroup, createProductSubgroup, getProductGroups, updateProductGroup, updateProductSubgroup } from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

const groupsKey = (userId) => ['product-groups', userId]
const currentUser = (client, userId) => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId

export function useProductGroups(userId, storeId) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...groupsKey(userId), storeId],
    queryFn: ({ signal }) => getProductGroups(storeId, { signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
  })
}

export function useCreateGroup(userId, storeId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['group-registration', userId, storeId],
    mutationKey: ['create-group', userId, storeId],
    mutationFn: group => createProductGroup(storeId, group),
    onSuccess: () => client.invalidateQueries({ queryKey: groupsKey(userId) }),
  })
}

export function useSaveGroup(userId, storeId, id) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (group) => updateProductGroup(storeId, id, group),
    onSuccess: () => currentUser(client, userId) && client.invalidateQueries({ queryKey: groupsKey(userId) }),
  })
}

export function useCreateSubgroup(userId, storeId, groupId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['subgroup-registration', userId, storeId, groupId],
    mutationKey: ['create-subgroup', userId, storeId, groupId],
    mutationFn: subgroup => createProductSubgroup(storeId, groupId, subgroup),
    onSuccess: () => client.invalidateQueries({ queryKey: groupsKey(userId) }),
  })
}

export function useSaveSubgroup(userId, storeId, groupId, id) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (subgroup) => updateProductSubgroup(storeId, groupId, id, subgroup),
    onSuccess: () => currentUser(client, userId) && client.invalidateQueries({ queryKey: groupsKey(userId) }),
  })
}
