'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Scale, Trash2, ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { useNegotiationSessions, useLogOutcome, useDeleteSession } from '../../hooks/use-negotiation'
import type { NegotiationSession, NegotiationOutcome, AiAnalysis } from '../../types'

const OUTCOME_STYLES: Record<NegotiationOutcome, { label: string; class: string }> = {
  won:      { label: 'Won',     class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  partial:  { label: 'Partial', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  lost:     { label: 'Lost',    class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  'no-deal':{ label: 'No Deal', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const TYPE_LABELS: Record<string, string> = {
  salary: 'Salary', freelance: 'Freelance', car: 'Car', lease: 'Lease', other: 'Other',
}

function SessionCard({ session }: { session: NegotiationSession }) {
  const { toast } = useToast()
  const logOutcome = useLogOutcome()
  const deleteSession = useDeleteSession()
  const [expanded, setExpanded] = useState(false)
  const [outcomeDialog, setOutcomeDialog] = useState(false)
  const [outcome, setOutcome] = useState<NegotiationOutcome>('won')
  const [outcomeValue, setOutcomeValue] = useState('')
  const [outcomeNotes, setOutcomeNotes] = useState('')

  const analysis = session.ai_analysis as AiAnalysis | null

  const handleLogOutcome = async () => {
    try {
      await logOutcome.mutateAsync({ id: session.id, outcome, outcome_value: outcomeValue || undefined, outcome_notes: outcomeNotes || undefined })
      setOutcomeDialog(false)
      toast({ title: 'Outcome logged!' })
    } catch {
      toast({ variant: 'destructive', title: 'Failed to log outcome' })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSession.mutateAsync(session.id)
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete session' })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{session.title}</h3>
              <Badge variant="outline" className="text-xs">{TYPE_LABELS[session.type]}</Badge>
              {session.outcome ? (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOME_STYLES[session.outcome].class}`}>
                  {OUTCOME_STYLES[session.outcome].label}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium">
                  In Prep
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(session.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              {session.outcome_value && <> · <strong>{session.outcome_value}</strong></>}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {!session.outcome && analysis && (
              <Button size="sm" variant="outline" onClick={() => setOutcomeDialog(true)}>
                <Trophy className="w-3.5 h-3.5 mr-1" /> Log Outcome
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setExpanded(v => !v)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleteSession.isPending}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Context */}
          <div className="text-sm space-y-1 border rounded-lg p-3 bg-muted/30">
            <div><span className="font-medium">Goal:</span> {session.context.what_you_want}</div>
            <div><span className="font-medium">BATNA:</span> {session.context.your_batna}</div>
            <div><span className="font-medium">Their position:</span> {session.context.their_likely_position}</div>
          </div>

          {/* AI Analysis */}
          {analysis ? (
            <div className="space-y-3">
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Anchor Point</p>
                <p className="font-semibold text-primary">{analysis.anchor_point}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Scripts</p>
                {analysis.counteroffers.map((co, i) => (
                  <div key={i} className="mb-2 border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">{co.scenario}</p>
                    <p className="text-sm italic">"{co.script}"</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No AI analysis generated yet.</p>
          )}

          {/* Outcome notes */}
          {session.outcome_notes && (
            <div className="text-sm border rounded-lg p-3 bg-muted/30">
              <span className="font-medium">Outcome notes:</span> {session.outcome_notes}
            </div>
          )}
        </CardContent>
      )}

      {/* Log Outcome Dialog */}
      <Dialog open={outcomeDialog} onOpenChange={setOutcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Outcome</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Result</Label>
              <Select value={outcome} onValueChange={v => setOutcome(v as NegotiationOutcome)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="won">Won — got what I wanted</SelectItem>
                  <SelectItem value="partial">Partial — got some of it</SelectItem>
                  <SelectItem value="lost">Lost — didn't get it</SelectItem>
                  <SelectItem value="no-deal">No Deal — walked away</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Actual value achieved <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={outcomeValue} onChange={e => setOutcomeValue(e.target.value)} placeholder="e.g. $122k salary" />
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} placeholder="What worked? What didn't?" rows={3} />
            </div>
            <Button className="w-full" onClick={handleLogOutcome} disabled={logOutcome.isPending}>
              {logOutcome.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Outcome
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function HistoryPage() {
  const { data: sessions = [], isLoading } = useNegotiationSessions()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('id')

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
          <h1 className="text-4xl font-medium">History</h1>
          <p className="text-muted-foreground mt-1">{sessions.length} negotiation{sessions.length !== 1 ? 's' : ''} prepped</p>
        </div>
        <Button asChild>
          <a href="/negotiation-prep-room/prep">New Prep</a>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No sessions yet</p>
          <p className="text-sm mt-1">Your negotiation history will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}
