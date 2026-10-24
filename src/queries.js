import {
  MutationCache,
  QueryCache,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getCurrentUser, getMessages, login, logout, register, sendMessage } from './api'

export const sessionKey = ['session']
export const messagesKey = (userId) => ['messages', userId]
const privateQueries = { predicate: (query) => query.queryKey[0] !== sessionKey[0] }

async function clearSession(client, filters) {
  const cancellation = client.cancelQueries(filters)
  client.setQueryData(sessionKey, null)
  await cancellation
  client.removeQueries(privateQueries)
}

export function createQueryClient() {
  const onError = (error) => {
    if (error.status === 401) return clearSession(client)
  }
  const client = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < 1 && (error.status === 0 || error.status >= 500),
      },
      mutations: { retry: false, gcTime: 0 },
    },
  })
  return client
}

export function useSession() {
  const client = useQueryClient()
  return useQuery({
    queryKey: sessionKey,
    queryFn: async ({ signal }) => {
      try {
        return await getCurrentUser({ signal })
      } catch (error) {
        if (error.status === 401) {
          // Keep this session query alive so its expected 401 can resolve as null.
          await clearSession(client, privateQueries)
          return null
        }
        throw error
      }
    },
  })
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: async (user) => {
      await clearSession(client)
      client.setQueryData(sessionKey, user)
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: ({ name, email, password }) => register(name, email, password),
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => clearSession(client),
  })
}

export function useMessages(userId) {
  const client = useQueryClient()
  return useQuery({
    queryKey: messagesKey(userId),
    queryFn: ({ signal }) => getMessages({ signal }),
    enabled: () => Boolean(userId) && client.getQueryData(sessionKey)?.id === userId,
  })
}

export function useSendMessage(userId) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: () => client.invalidateQueries({ queryKey: messagesKey(userId) }),
  })
}
