'use client'

import { useNegotiationSessions } from '../hooks/use-negotiation'
import { Scale, TrendingUp } from 'lucide-react'

export default function NegotiationStatCard() {
  const { data: sessions = [], isLoading } = useNegotiationSessions()

  const completed = sessions.filter(s => s.status === 'completed')
  const won = completed.filter(s => s.outcome === 'won' || s.outcome === 'partial').length
  const winRate = completed.length > 0 ? Math.round((won / completed.length) * 100) : null
  const total = sessions.length

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg border bg-card animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-8 w-16 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Scale className="w-4 h-4" />
        <span>Negotiation</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-semibold">
            {winRate !== null ? `${winRate}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Win rate</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-medium">{total}</div>
          <div className="text-xs text-muted-foreground">Total prepped</div>
        </div>
      </div>
      {completed.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          <span>{won} win{won !== 1 ? 's' : ''} from {completed.length} completed</span>
        </div>
      )}
    </div>
  )
}
