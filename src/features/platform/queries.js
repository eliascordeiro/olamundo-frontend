import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acceptOwnerInvite, acceptSellerInvite, createPlatformOwner, getPlatformOwners, invitePlatformOwner } from '../../api'
import { sessionKey } from '../../queries'
import useIdempotentOperation from '../../useIdempotentOperation'

const ownersKey = (userId) => ['platform-owners', userId]
const currentUser = (client, userId) => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId

export function usePlatformOwners(userId, page) {
  const client = useQueryClient()
  return useQuery({
    queryKey: [...ownersKey(userId), { page, size: 20 }],
    queryFn: ({ signal }) => getPlatformOwners({ page, signal }),
    enabled: () => currentUser(client, userId),
    staleTime: 0,
  })
}

export function useCreatePlatformOwner(userId) {
  const client = useQueryClient()
  return useIdempotentOperation({
    userId,
    operationKey: ['platform-owner-registration', userId],
    mutationKey: ['create-platform-owner', userId],
    mutationFn: owner => createPlatformOwner(owner),
    onSuccess: () => client.invalidateQueries({ queryKey: ownersKey(userId) }),
  })
}

export function useInvitePlatformOwner(userId) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, email }) => invitePlatformOwner(id, email),
    onSuccess: () => currentUser(client, userId) && client.invalidateQueries({ queryKey: ownersKey(userId) }),
  })
}

export function useAcceptOwnerInvite() {
  return useMutation({ mutationFn: acceptOwnerInvite })
}

export function useAcceptSellerInvite() {
  return useMutation({ mutationFn: acceptSellerInvite })
}
