'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Loader2, Scale, Sparkles, ArrowLeft } from 'lucide-react'
import { useCreateSession, useGenerateAnalysis } from '../../hooks/use-negotiation'
import type { NegotiationType, AiAnalysis } from '../../types'

const AGGRESSIVENESS_LABELS: Record<number, { label: string; description: string; color: string }> = {
  1: { label: 'Collaborative',  description: 'Warm, flexible, relationship-first',      color: 'text-blue-500' },
  2: { label: 'Friendly-firm',  description: 'Polite but confident',                    color: 'text-teal-500' },
  3: { label: 'Balanced',       description: 'Assertive, principled negotiation',       color: 'text-yellow-600' },
  4: { label: 'Assertive',      description: 'Push hard, concede slowly',               color: 'text-orange-500' },
  5: { label: 'Hardball',       description: 'Maximize every dollar, no softening',     color: 'text-red-500' },
}

const TYPE_OPTIONS: { value: NegotiationType; label: string; description: string }[] = [
  { value: 'salary',    label: 'Salary',         description: 'Job offer or raise negotiation' },
  { value: 'freelance', label: 'Freelance Rate',  description: 'Project rate or contract terms' },
  { value: 'car',       label: 'Car Purchase',    description: 'Vehicle price negotiation' },
  { value: 'lease',     label: 'Lease',           description: 'Apartment or commercial lease' },
  { value: 'other',     label: 'Other',           description: 'Any other negotiation' },
]

type Step = 'form' | 'generating' | 'result'

export default function NewPrepPage() {
  const router = useRouter()
  const { toast } = useToast()
  const createSession = useCreateSession()
  const generateAnalysis = useGenerateAnalysis()

  const [step, setStep] = useState<Step>('form')
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [type, setType] = useState<NegotiationType>('salary')
  const [whatYouWant, setWhatYouWant] = useState('')
  const [yourBatna, setYourBatna] = useState('')
  const [theirPosition, setTheirPosition] = useState('')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [aggressiveness, setAggressiveness] = useState(3)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !whatYouWant.trim() || !yourBatna.trim() || !theirPosition.trim()) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' })
      return
    }

    try {
      setStep('generating')
      const session = await createSession.mutateAsync({
        title: title.trim(),
        type,
        context: {
          what_you_want: whatYouWant.trim(),
          your_batna: yourBatna.trim(),
          their_likely_position: theirPosition.trim(),
          deadline: deadline.trim() || undefined,
          additional_notes: notes.trim() || undefined,
          aggressiveness,
        },
      })

      const updated = await generateAnalysis.mutateAsync(session.id)
      setSessionId(session.id)
      setAnalysis(updated.ai_analysis)
      setStep('result')
    } catch (err) {
      setStep('form')
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Analyzing your negotiation...</p>
        <p className="text-sm text-muted-foreground">Claude is building your prep kit</p>
      </div>
    )
  }

  if (step === 'result' && analysis) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/negotiation-prep-room')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-medium">{title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">Your AI-generated negotiation prep kit</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${AGGRESSIVENESS_LABELS[aggressiveness].color} border-current`}>
              {AGGRESSIVENESS_LABELS[aggressiveness].label}
            </span>
          </div>
        </div>

        {/* BATNA Assessment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4" /> BATNA Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{analysis.batna_assessment}</p>
          </CardContent>
        </Card>

        {/* Anchor Point */}
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-base">🎯 Your Opening Anchor</CardTitle>
            <CardDescription>{analysis.anchor_rationale}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">{analysis.anchor_point}</p>
          </CardContent>
        </Card>

        {/* Counteroffers + Scripts */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Likely Counteroffers & Scripts
          </h2>
          <div className="space-y-3">
            {analysis.counteroffers.map((co, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Scenario {i + 1}: {co.scenario}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <blockquote className="border-l-2 border-primary pl-4 text-sm italic">
                    "{co.script}"
                  </blockquote>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Closing Script */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">✅ Closing Script</CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="border-l-2 border-green-500 pl-4 text-sm italic">
              "{analysis.closing_script}"
            </blockquote>
          </CardContent>
        </Card>

        {/* Red Flags */}
        {analysis.red_flags.length > 0 && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-base text-red-700 dark:text-red-400">⚠️ Red Flags to Watch</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {analysis.red_flags.map((flag, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 pt-2">
          <Button asChild className="flex-1">
            <a href={`/negotiation-prep-room/history?id=${sessionId}`}>
              Log Outcome
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/negotiation-prep-room">Back to Dashboard</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-medium">New Prep</h1>
        <p className="text-muted-foreground mt-1">Fill in your context — AI does the rest.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Session title *</Label>
          <Input
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Senior Engineer offer at Acme Corp"
          />
        </div>

        <div className="space-y-2">
          <Label>Negotiation type *</Label>
          <Select value={type} onValueChange={v => setType(v as NegotiationType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  <div>
                    <div className="font-medium">{o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="want">What do you want to achieve? *</Label>
          <Textarea
            id="want"
            value={whatYouWant}
            onChange={e => setWhatYouWant(e.target.value)}
            placeholder="e.g. $130k base salary + $20k signing bonus"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="batna">Your BATNA (walk-away alternative) *</Label>
          <Textarea
            id="batna"
            value={yourBatna}
            onChange={e => setYourBatna(e.target.value)}
            placeholder="e.g. Current job paying $105k, competitor offer for $118k"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="their">Their likely opening position *</Label>
          <Textarea
            id="their"
            value={theirPosition}
            onChange={e => setTheirPosition(e.target.value)}
            placeholder="e.g. They'll probably offer $110-115k based on job posting"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline / time pressure <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            id="deadline"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            placeholder="e.g. They want an answer by Friday"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional context <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any other relevant details..."
            rows={3}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Negotiation style</Label>
            <span className={`text-sm font-semibold ${AGGRESSIVENESS_LABELS[aggressiveness].color}`}>
              {AGGRESSIVENESS_LABELS[aggressiveness].label}
            </span>
          </div>
          <Slider
            min={1}
            max={5}
            step={1}
            value={[aggressiveness]}
            onValueChange={([v]) => setAggressiveness(v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Collaborative</span>
            <span className={`${AGGRESSIVENESS_LABELS[aggressiveness].color}`}>
              {AGGRESSIVENESS_LABELS[aggressiveness].description}
            </span>
            <span>Hardball</span>
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={createSession.isPending || generateAnalysis.isPending}>
          <Sparkles className="w-4 h-4 mr-2" />
          Generate My Prep Kit
        </Button>
      </form>
    </div>
  )
}
