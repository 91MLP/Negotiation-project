'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, Eye, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

export default function AnxietyCrusherStatCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-anxiety-crusher-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/modules/anxiety-crusher/sessions')
      if (!res.ok) throw new Error('Failed to fetch sessions')
      return res.json()
    },
  })

  const totalSessions = data?.total_sessions ?? 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Anxiety Crushed</CardTitle>
        <Zap className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-2xl font-medium">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">sessions completed</p>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs"
          onClick={() => (window.location.href = '/anxiety-crusher')}
        >
          <Eye className="w-3 h-3 mr-1" />
          Open Crusher
        </Button>
      </CardContent>
    </Card>
  )
}
