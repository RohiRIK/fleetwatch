'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, RefreshCw } from 'lucide-react';

interface RecommendationStats {
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  total: number;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100', label: 'Critical' },
  high: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-100', label: 'High' },
  medium: { icon: Info, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Medium' },
  low: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Low' },
};

export function RecommendationsWidget() {
  const [stats, setStats] = useState<RecommendationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recommendations?stats=true');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch recommendation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          options: {},
        }),
      });
      await fetchStats();
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const total = stats?.total || 0;
  const critical = stats?.bySeverity?.critical || 0;
  const high = stats?.bySeverity?.high || 0;
  const medium = stats?.bySeverity?.medium || 0;
  const low = stats?.bySeverity?.low || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Fleet Health Recommendations</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className="text-3xl font-bold">{total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>

          {(Object.entries(severityConfig) as [keyof typeof severityConfig, typeof severityConfig[keyof typeof severityConfig]][]).map(([severity, config]) => {
            const count = stats?.bySeverity?.[severity] || 0;
            return (
              <div
                key={severity}
                className={`text-center p-4 rounded-lg ${config.bg}`}
              >
                <div className={`text-3xl font-bold ${config.color}`}>{count}</div>
                <div className="text-sm text-muted-foreground">{config.label}</div>
              </div>
            );
          })}
        </div>

        {total > 0 && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {Object.entries(stats?.byCategory || {}).map(([category, count]) => (
              <Badge key={category} variant="outline">
                {category}: {count}
              </Badge>
            ))}
          </div>
        )}

        {total === 0 && (
          <div className="mt-4 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No recommendations. Your fleet is healthy!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
