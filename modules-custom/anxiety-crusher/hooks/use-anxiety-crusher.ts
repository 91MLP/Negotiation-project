import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AnxietyTag,
  AnxietySession,
  CrushScript,
  AnxietyCrush,
  GenerateLanguage,
} from '@/modules/anxiety-crusher/types'

const TAGS_KEY = ['anxiety-crusher-tags']
const SESSIONS_KEY = ['anxiety-crusher-sessions']
const sessionDetailKey = (id: string) => ['anxiety-crusher-session', id]

// ─── Tags ──────────────────────────────────────────────────────────────────

export function useAnxietyTags() {
  return useQuery({
    queryKey: TAGS_KEY,
    queryFn: async (): Promise<AnxietyTag[]> => {
      const res = await fetch('/api/modules/anxiety-crusher/tags')
      if (!res.ok) throw new Error('Failed to fetch tags')
      const data = await res.json()
      return data.tags ?? []
    },
  })
}

export function useCreateAnxietyTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string): Promise<AnxietyTag> => {
      const res = await fetch('/api/modules/anxiety-crusher/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const details = (err.details as Array<{ message: string }> | undefined)?.map((d) => d.message).join(', ')
        throw new Error(details || err.error || 'Failed to create tag')
      }
      const data = await res.json()
      return data.tag
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: TAGS_KEY })
      const previous = queryClient.getQueryData<AnxietyTag[]>(TAGS_KEY)
      queryClient.setQueryData<AnxietyTag[]>(TAGS_KEY, (old = []) => [
        { id: 'temp-' + Date.now(), user_id: '', name, created_at: new Date().toISOString() },
        ...old,
      ])
      return { previous }
    },
    onError: (_err, _name, context) => {
      if (context?.previous) queryClient.setQueryData(TAGS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  })
}

export function useDeleteAnxietyTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/modules/anxiety-crusher/tags/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete tag')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TAGS_KEY })
      const previous = queryClient.getQueryData<AnxietyTag[]>(TAGS_KEY)
      queryClient.setQueryData<AnxietyTag[]>(TAGS_KEY, (old = []) => old.filter((t) => t.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(TAGS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY }),
  })
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export function useAnxietySessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async (): Promise<{ sessions: AnxietySession[]; total_sessions: number }> => {
      const res = await fetch('/api/modules/anxiety-crusher/sessions')
      if (!res.ok) throw new Error('Failed to fetch sessions')
      return res.json()
    },
  })
}

export function useAnxietySessionDetail(id: string | null) {
  return useQuery({
    queryKey: sessionDetailKey(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<AnxietySession> => {
      const res = await fetch(`/api/modules/anxiety-crusher/sessions/${encodeURIComponent(id!)}`)
      if (!res.ok) throw new Error('Failed to fetch session')
      const data = await res.json()
      return data.session
    },
  })
}

export function useCreateAnxietySession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tagNames, language }: { tagNames: string[]; language: GenerateLanguage }): Promise<AnxietySession> => {
      const res = await fetch('/api/modules/anxiety-crusher/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_names: tagNames, language }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate session')
      }
      const data = await res.json()
      return data.session
    },
    onSuccess: (session) => {
      // Seed the detail cache so the session view shows immediately without a refetch
      queryClient.setQueryData(sessionDetailKey(session.id), session)
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })
}

export function useDeleteAnxietySession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/modules/anxiety-crusher/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete session')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY })
      const previous = queryClient.getQueryData<{ sessions: AnxietySession[]; total_sessions: number }>(SESSIONS_KEY)
      queryClient.setQueryData<{ sessions: AnxietySession[]; total_sessions: number }>(SESSIONS_KEY, (old) => {
        if (!old) return old
        return {
          sessions: old.sessions.filter((s) => s.id !== id),
          total_sessions: old.total_sessions - 1,
        }
      })
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(SESSIONS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  })
}

// ─── Crushes ───────────────────────────────────────────────────────────────

export function useCrushComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      commentId,
      scriptName,
      sessionId,
    }: {
      commentId: string
      scriptName: CrushScript
      sessionId: string
    }): Promise<AnxietyCrush> => {
      const res = await fetch(`/api/modules/anxiety-crusher/comments/${encodeURIComponent(commentId)}/crush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_name: scriptName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to crush comment')
      }
      const data = await res.json()
      return data.crush
    },
    onSuccess: (_data, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionDetailKey(sessionId) })
    },
  })
}

// ─── Translation ────────────────────────────────────────────────────────────

export function useTranslateTexts() {
  return useMutation({
    mutationFn: async (texts: string[]): Promise<string[]> => {
      const res = await fetch('/api/modules/anxiety-crusher/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Translation failed')
      }
      const data = await res.json()
      return data.translations as string[]
    },
  })
}
