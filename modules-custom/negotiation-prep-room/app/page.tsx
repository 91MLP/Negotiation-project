'use client'

import { useState, useEffect } from 'react'
import { useModuleEnabled } from '@/lib/modules/module-hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Scale, Plus, TrendingUp, Trophy, Clock, ChevronRight } from 'lucide-react'
import { useNegotiationSessions } from '../hooks/use-negotiation'
import type { NegotiationSession, NegotiationOutcome } from '../types'

const OUTCOME_STYLES: Record<NegotiationOutcome, { label: string; class: string }> = {
  won:      { label: 'Won',     class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  partial:  { label: 'Partial', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  lost:     { label: 'Lost',    class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  'no-deal':{ label: 'No Deal', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const TYPE_LABELS: Record<string, string> = {
  salary: 'Salary', freelance: 'Freelance', car: 'Car', lease: 'Lease', other: 'Other',
}

export default function NegotiationDashboard() {
  const { enabled: quotesEnabled, loading: quotesLoading } = useModuleEnabled('quotes')
  const [randomQuote, setRandomQuote] = useState<{ quote: string } | null>(null)
  const { data: sessions = [], isLoading } = useNegotiationSessions()

  useEffect(() => {
    if (!quotesEnabled || quotesLoading) return
    let cancelled = false
    fetch('/api/modules/quotes/quotes')
      .then(r => r.ok ? r.json() : [])
      .then(q => { if (!cancelled && q.length > 0) setRandomQuote(q[Math.floor(Math.random() * q.length)]) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [quotesEnabled, quotesLoading])

  const completed = sessions.filter(s => s.status === 'completed')
  const won = completed.filter(s => s.outcome === 'won' || s.outcome === 'partial').length
  const winRate = completed.length > 0 ? Math.round((won / completed.length) * 100) : null
  const inPrep = sessions.filter(s => s.status === 'prep')
  const recent = sessions.slice(0, 5)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-medium">Negotiation</h1>
          {quotesEnabled && randomQuote && (
            <p className="text-sm text-[#aa2020] mt-1">{randomQuote.quote}</p>
          )}
        </div>
        <Button asChild>
          <a href="/negotiation-prep-room/prep">
            <Plus className="w-4 h-4 mr-2" />
            New Prep
          </a>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {winRate !== null ? `${winRate}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Win rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{sessions.length}</div>
                <div className="text-xs text-muted-foreground">Total prepped</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{inPrep.length}</div>
                <div className="text-xs text-muted-foreground">In progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Sessions</CardTitle>
          {sessions.length > 5 && (
            <Button variant="ghost" size="sm" asChild>
              <a href="/negotiation-prep-room/history">View all</a>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No negotiations yet</p>
              <p className="text-sm mt-1">Prep your first negotiation to see your stats here.</p>
              <Button className="mt-4" asChild>
                <a href="/negotiation-prep-room/prep">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Prep
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((s: NegotiationSession) => (
                <a
                  key={s.id}
                  href={`/negotiation-prep-room/history?id=${s.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{s.title}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {TYPE_LABELS[s.type] || s.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {s.outcome ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOME_STYLES[s.outcome].class}`}>
                        {OUTCOME_STYLES[s.outcome].label}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium">
                        In Prep
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
