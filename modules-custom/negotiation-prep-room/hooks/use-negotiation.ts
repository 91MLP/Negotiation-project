import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  NegotiationSession,
  CreateSessionRequest,
  LogOutcomeRequest,
} from '../types'

const SESSIONS_KEY = ['negotiation-sessions']
const sessionKey = (id: string) => ['negotiation-session', id]

export function useNegotiationSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async (): Promise<NegotiationSession[]> => {
      const res = await fetch('/api/modules/negotiation-prep-room/sessions')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch sessions')
      }
      const data = await res.json()
      return data.sessions || []
    },
  })
}

export function useNegotiationSession(id: string) {
  return useQuery({
    queryKey: sessionKey(id),
    queryFn: async (): Promise<NegotiationSession> => {
      const res = await fetch(`/api/modules/negotiation-prep-room/sessions/${id}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch session')
      }
      const data = await res.json()
      return data.session
    },
    enabled: !!id,
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateSessionRequest): Promise<NegotiationSession> => {
      const res = await fetch('/api/modules/negotiation-prep-room/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create session')
      }
      return (await res.json()).session
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useGenerateAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<NegotiationSession> => {
      const res = await fetch(`/api/modules/negotiation-prep-room/sessions/${id}/generate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'AI generation failed')
      }
      return (await res.json()).session
    },
    onSuccess: (session) => {
      queryClient.setQueryData(sessionKey(session.id), session)
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useLogOutcome() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: LogOutcomeRequest & { id: string }): Promise<NegotiationSession> => {
      const res = await fetch(`/api/modules/negotiation-prep-room/sessions/${id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to log outcome')
      }
      return (await res.json()).session
    },
    onSuccess: (session) => {
      queryClient.setQueryData(sessionKey(session.id), session)
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/modules/negotiation-prep-room/sessions/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete session')
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY })
      const previous = queryClient.getQueryData<NegotiationSession[]>(SESSIONS_KEY)
      queryClient.setQueryData<NegotiationSession[]>(SESSIONS_KEY, (old = []) =>
        old.filter(s => s.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(SESSIONS_KEY, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}
