'use client'

import { useState, useEffect } from 'react'
import { useModuleEnabled } from '@/lib/modules/module-hooks'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Zap, Plus, X, Loader2, History, ArrowLeft, Trash2, ChevronDown, Sparkles, Languages } from 'lucide-react'
import {
  useAnxietyTags,
  useCreateAnxietyTag,
  useDeleteAnxietyTag,
  useAnxietySessions,
  useAnxietySessionDetail,
  useCreateAnxietySession,
  useDeleteAnxietySession,
  useCrushComment,
  useTranslateTexts,
} from '../hooks/use-anxiety-crusher'
import { PRESET_TAGS, CRUSH_SCRIPTS } from '../types'
import type { AnxietySession, AnxietyComment, CrushScript, GenerateLanguage, CommentTranslation } from '../types'

type View = 'main' | 'session' | 'history'

export default function AnxietyCrusherPage() {
  const { toast } = useToast()

  const { enabled: quotesEnabled, loading: quotesLoading } = useModuleEnabled('quotes')
  const [randomQuote, setRandomQuote] = useState<{ quote: string; author?: string } | null>(null)

  const [view, setView] = useState<View>('main')
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [addTagError, setAddTagError] = useState('')
  const [generateLanguage, setGenerateLanguage] = useState<GenerateLanguage>('en')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [crushingCommentId, setCrushingCommentId] = useState<string | null>(null)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  // translationCache: commentId -> { original, crushed }
  const [translationCache, setTranslationCache] = useState<Record<string, CommentTranslation>>({})
  // which comment cards are showing translated view
  const [showingTranslation, setShowingTranslation] = useState<Set<string>>(new Set())
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  const { data: customTags = [] } = useAnxietyTags()
  const { data: sessionsData } = useAnxietySessions()
  const { data: sessionDetail, isLoading: detailLoading } = useAnxietySessionDetail(selectedSessionId)

  const createTag = useCreateAnxietyTag()
  const deleteTag = useDeleteAnxietyTag()
  const createSession = useCreateAnxietySession()
  const deleteSession = useDeleteAnxietySession()
  const crushComment = useCrushComment()
  const translateTexts = useTranslateTexts()

  useEffect(() => {
    if (!quotesEnabled || quotesLoading) return
    let cancelled = false
    fetch('/api/modules/quotes/quotes')
      .then((res) => (res.ok ? res.json() : []))
      .then((quotes: Array<{ quote: string; author?: string }>) => {
        if (!cancelled && quotes.length > 0) {
          setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)])
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [quotesEnabled, quotesLoading])

  const allAvailableTags = [
    ...PRESET_TAGS,
    ...customTags.map((t) => t.name).filter((n) => !PRESET_TAGS.includes(n)),
  ]

  function toggleTag(name: string) {
    setSelectedTagNames((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    )
  }

  function handleAddCustomTag() {
    const trimmed = newTagInput.trim()
    if (!trimmed) {
      setAddTagError('Tag name is required')
      return
    }
    if (trimmed.length > 100) {
      setAddTagError('Tag name must be 100 characters or less')
      return
    }
    if (allAvailableTags.map((t) => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setAddTagError('That tag already exists')
      return
    }
    setAddTagError('')
    createTag.mutate(trimmed, {
      onSuccess: (tag) => {
        setNewTagInput('')
        setSelectedTagNames((prev) => [...prev, tag.name])
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to add tag', description: err.message })
      },
    })
  }

  function handleGenerate() {
    if (selectedTagNames.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least one anxiety tag' })
      return
    }
    createSession.mutate({ tagNames: selectedTagNames, language: generateLanguage }, {
      onSuccess: (session) => {
        setSelectedSessionId(session.id)
        setView('session')
        setSelectedTagNames([])
        setTranslationCache({})
        setShowingTranslation(new Set())
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Generation failed', description: err.message })
      },
    })
  }

  function handleTranslate(comment: AnxietyComment) {
    const id = comment.id
    const latestCrush = comment.crushes?.[comment.crushes.length - 1]
    const cached = translationCache[id]
    // Cache is complete if it covers the original AND the crushed version (if one exists)
    const cacheComplete = cached && (!latestCrush || cached.crushed)
    if (cacheComplete) {
      setShowingTranslation((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
      return
    }
    // Build list of texts to translate: original + crushed (if exists)
    const texts = latestCrush
      ? [comment.content, latestCrush.crushed_content]
      : [comment.content]

    setTranslatingId(id)
    translateTexts.mutate(texts, {
      onSuccess: (translations) => {
        setTranslationCache((prev) => ({
          ...prev,
          [id]: {
            original: translations[0],
            crushed: translations[1],
          },
        }))
        setShowingTranslation((prev) => new Set(prev).add(id))
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Translation failed', description: err.message })
      },
      onSettled: () => setTranslatingId(null),
    })
  }

  function handleCrush(commentId: string, sessionId: string, scriptName: CrushScript) {
    setCrushingCommentId(commentId)
    // Clear stale translation cache for this comment so next translate includes the new crush
    setTranslationCache((prev) => {
      if (!prev[commentId]) return prev
      const next = { ...prev }
      delete next[commentId]
      return next
    })
    setShowingTranslation((prev) => {
      const next = new Set(prev)
      next.delete(commentId)
      return next
    })
    crushComment.mutate(
      { commentId, scriptName, sessionId },
      {
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Crushing failed', description: err.message })
        },
        onSettled: () => setCrushingCommentId(null),
      }
    )
  }

  function openHistorySession(id: string) {
    setSelectedSessionId(id)
    setView('session')
  }

  function handleDeleteSession(id: string) {
    deleteSession.mutate(id, {
      onSuccess: () => {
        setDeleteSessionId(null)
        if (view === 'session') {
          setView('history')
          setSelectedSessionId(null)
        }
      },
      onError: () => {
        toast({ variant: 'destructive', title: 'Failed to delete session' })
      },
    })
  }

  const displaySession = sessionDetail ?? null
  const sessions = sessionsData?.sessions ?? []

  // ─── Session view ─────────────────────────────────────────────────────────
  if (view === 'session') {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setView('main')
              setSelectedSessionId(null)
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-medium">Session Results</h1>
            {displaySession && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(displaySession.tag_names ?? []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
          {displaySession && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => setDeleteSessionId(displaySession.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {displaySession?.comments?.length === 0 && (
          <p className="text-muted-foreground text-sm">No comments in this session.</p>
        )}

        <div className="space-y-4">
          {(displaySession?.comments ?? []).map((comment: AnxietyComment) => {
            const latestCrush = comment.crushes?.[comment.crushes.length - 1]
            const isCrushing = crushingCommentId === comment.id
            const isTranslating = translatingId === comment.id
            const isShowingTranslation = showingTranslation.has(comment.id)
            const cached = translationCache[comment.id]

            const displayOriginal = isShowingTranslation && cached?.original
              ? cached.original
              : comment.content
            const displayCrushed = latestCrush
              ? (isShowingTranslation && cached?.crushed ? cached.crushed : latestCrush.crushed_content)
              : null

            return (
              <Card key={comment.id} className="border-border">
                <CardContent className="pt-4 space-y-3">
                  {latestCrush ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Original Toxic Comment</p>
                        <p className="text-sm text-muted-foreground line-through opacity-70">{displayOriginal}</p>
                      </div>
                      <div className="space-y-1 bg-primary/5 rounded-lg p-3">
                        <p className="text-xs font-medium text-primary uppercase tracking-wide">
                          {CRUSH_SCRIPTS.find((s) => s.id === latestCrush.script_name)?.emoji}{' '}
                          {CRUSH_SCRIPTS.find((s) => s.id === latestCrush.script_name)?.label}
                        </p>
                        <p className="text-sm">{displayCrushed}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{displayOriginal}</p>
                  )}

                  {isShowingTranslation && (
                    <p className="text-xs text-blue-500">
                      🌐 {latestCrush ? '翻译版本 / Translated version' : '翻译 / Translation'}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    {latestCrush ? (
                      <p className="text-xs text-muted-foreground">Crushed! Try another script:</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Crush this comment:</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isTranslating}
                        className={`gap-1 text-xs ${isShowingTranslation ? 'text-blue-500' : ''}`}
                        onClick={() => handleTranslate(comment)}
                      >
                        {isTranslating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        {isShowingTranslation ? '原文' : '翻译'}
                      </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isCrushing}
                          className="gap-1"
                        >
                          {isCrushing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Crushing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 text-yellow-500" />
                              Crush It
                              <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {CRUSH_SCRIPTS.map((script) => (
                          <DropdownMenuItem
                            key={script.id}
                            onClick={() => displaySession && handleCrush(comment.id, displaySession.id, script.id)}
                          >
                            <span className="mr-2">{script.emoji}</span>
                            <div>
                              <p className="font-medium text-sm">{script.label}</p>
                              <p className="text-xs text-muted-foreground">{script.description}</p>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Dialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Session</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete this session and all its comments and crushing history. Are you sure?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteSessionId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteSession.isPending}
                onClick={() => deleteSessionId && handleDeleteSession(deleteSessionId)}
              >
                {deleteSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─── History view ─────────────────────────────────────────────────────────
  if (view === 'history') {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('main')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-medium">Session History</h1>
            <p className="text-sm text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No sessions yet. Generate your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: AnxietySession) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openHistorySession(session.id)}
              >
                <CardContent className="pt-4 flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1">
                      {(session.tag_names ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Zap className="w-4 h-4 text-yellow-500 shrink-0 mt-1" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Main view ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-medium">Anxiety Crusher</h1>
          {quotesEnabled && randomQuote && (
            <p className="text-sm text-[#aa2020] mt-1">{randomQuote.quote}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => setView('history')}>
          <History className="w-4 h-4 mr-2" />
          History
          {sessions.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">{sessions.length}</Badge>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What's stressing you out?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {allAvailableTags.map((tag) => {
              const isSelected = selectedTagNames.includes(tag)
              const isCustom = !PRESET_TAGS.includes(tag)
              const customTagObj = customTags.find((t) => t.name === tag)

              return (
                <div key={tag} className="relative group">
                  <Badge
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer select-none pr-2 hover:opacity-80 transition-opacity text-sm py-1 px-3"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                  {isCustom && customTagObj && (
                    <button
                      className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteTag.mutate(customTagObj.id)
                        setSelectedTagNames((prev) => prev.filter((t) => t !== tag))
                      }}
                      title="Remove custom tag"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Add your own tag..."
                value={newTagInput}
                maxLength={100}
                onChange={(e) => {
                  setNewTagInput(e.target.value)
                  if (addTagError) setAddTagError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                className={addTagError ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {addTagError && <p className="text-xs text-red-500">{addTagError}</p>}
            </div>
            <Button
              variant="outline"
              onClick={handleAddCustomTag}
              disabled={createTag.isPending}
            >
              {createTag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {selectedTagNames.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-xs text-muted-foreground self-center">Selected:</span>
              {selectedTagNames.map((tag) => (
                <Badge key={tag} className="text-xs gap-1 cursor-pointer" onClick={() => toggleTag(tag)}>
                  {tag}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Generate in:</span>
          <Button
            variant={generateLanguage === 'en' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setGenerateLanguage('en')}
          >
            🇺🇸 English
          </Button>
          <Button
            variant={generateLanguage === 'zh' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setGenerateLanguage('zh')}
          >
            🇨🇳 中文
          </Button>
        </div>
        <Button
          size="lg"
          className="w-full gap-2 text-base"
          onClick={handleGenerate}
          disabled={createSession.isPending || selectedTagNames.length === 0}
        >
          {createSession.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {generateLanguage === 'zh' ? '生成毒评中...' : 'Generating toxic comments...'}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {generateLanguage === 'zh' ? '生成并粉碎 🔥' : 'Generate & Crush'}
            </>
          )}
        </Button>
        {selectedTagNames.length === 0 && (
          <p className="text-xs text-muted-foreground">Select at least one tag to generate</p>
        )}
      </div>

      <Card className="bg-muted/40">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {CRUSH_SCRIPTS.map((script) => (
              <div key={script.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{script.emoji}</span>
                <span>{script.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">6 crushing scripts powered by Claude AI</p>
        </CardContent>
      </Card>
    </div>
  )
}
