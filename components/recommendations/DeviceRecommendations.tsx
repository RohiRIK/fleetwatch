'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, ExternalLink, X, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Recommendation {
  id: string;
  severity: string;
  category: string;
  status: string;
  title: string;
  description: string;
  recommendationType: string;
  ruleId: string;
  actionUrl: string;
  actionLabel: string;
  deviceName: string | null;
  deviceSerialNumber: string | null;
  userEmail: string | null;
  priorityScore: number | null;
  createdAt: string;
  extendedInfo?: {
    whatsWrong: string;
    whyItMatters: string;
    howToFix: string;
  };
}

interface DeviceRecommendationsProps {
  deviceId: string;
  deviceName: string;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'bg-red-500', label: 'Critical' },
  high: { icon: AlertCircle, color: 'bg-orange-500', label: 'High' },
  medium: { icon: Info, color: 'bg-yellow-500', label: 'Medium' },
  low: { icon: CheckCircle2, color: 'bg-blue-500', label: 'Low' },
};

const categoryColors: Record<string, string> = {
  security: 'bg-red-100 text-red-800',
  compliance: 'bg-orange-100 text-orange-800',
  performance: 'bg-yellow-100 text-yellow-800',
  maintenance: 'bg-blue-100 text-blue-800',
  license: 'bg-purple-100 text-purple-800',
};

export function DeviceRecommendations({ deviceId, deviceName }: DeviceRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('deviceId', deviceId);
      params.set('status', 'active');
      params.set('limit', '20');

      const response = await fetch(`/api/recommendations?${params}`);
      const data = await response.json();
      if (data.success) {
        setRecommendations(data.data.recommendations);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [deviceId]);

  const handleAction = async (id: string, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    try {
      await fetch(`/api/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchRecommendations();
    } catch (error) {
      console.error('Failed to update recommendation:', error);
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

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">No issues found!</p>
            <p className="text-sm text-muted-foreground">
              {deviceName} is in great shape with no recommendations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = recommendations.filter(r => r.severity === 'critical').length;
  const highCount = recommendations.filter(r => r.severity === 'high').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={criticalCount > 0 ? 'destructive' : highCount > 0 ? 'default' : 'secondary'}>
          {recommendations.length} issue{recommendations.length !== 1 ? 's' : ''}
        </Badge>
        {criticalCount > 0 && (
          <Badge variant="destructive">{criticalCount} critical</Badge>
        )}
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const severity = severityConfig[rec.severity as keyof typeof severityConfig] || severityConfig.low;
          const SeverityIcon = severity.icon;

          return (
            <div
              key={rec.id}
              className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className={`p-2 rounded-full ${severity.color}/10`}>
                <SeverityIcon className={`h-5 w-5 ${severity.color.replace('bg-', 'text-')}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[rec.category] || 'bg-gray-100'}`}>
                    {rec.category}
                  </span>
                  <Badge variant={rec.severity === 'critical' ? 'destructive' : rec.severity === 'high' ? 'default' : 'secondary'} className="text-xs">
                    {rec.severity}
                  </Badge>
                </div>
                
                <h4 className="font-medium text-sm">{rec.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{rec.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {rec.extendedInfo && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <HelpCircle className="h-5 w-5 text-blue-500" />
                          How to Fix: {rec.recommendationType}
                        </DialogTitle>
                        <DialogDescription asChild>
                          <div className="mt-4 space-y-4 text-sm">
                            <div>
                              <h4 className="font-semibold text-foreground">What's Wrong</h4>
                              <p className="text-muted-foreground mt-1">{rec.extendedInfo.whatsWrong}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">Why It Matters</h4>
                              <p className="text-muted-foreground mt-1">{rec.extendedInfo.whyItMatters}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">How to Fix</h4>
                              <pre className="mt-1 text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap">{rec.extendedInfo.howToFix}</pre>
                            </div>
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                    </DialogContent>
                  </Dialog>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction(rec.id, 'acknowledge')}
                  title="Mark as acknowledged"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction(rec.id, 'dismiss')}
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
