'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface RecommendationsListProps {
  deviceId?: string;
}

export function RecommendationsList({ deviceId }: RecommendationsListProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [isPending, startTransition] = useTransition();

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', '0');
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (deviceId) params.set('deviceId', deviceId);

      const response = await fetch(`/api/recommendations?${params}`);
      const data = await response.json();
      if (data.success) {
        setRecommendations(data.data.recommendations);
        setTotal(data.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [severityFilter, categoryFilter, statusFilter, deviceId]);

  const handleFilterChange = (key: string, value: string) => {
    startTransition(() => {
      switch (key) {
        case 'severity':
          setSeverityFilter(value);
          break;
        case 'category':
          setCategoryFilter(value);
          break;
        case 'status':
          setStatusFilter(value);
          break;
      }
    });
  };

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

  const filteredRecommendations = useMemo(() => {
    return recommendations;
  }, [recommendations]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recommendations</span>
          <Badge variant="secondary">{total} total</Badge>
        </CardTitle>
        
        <div className="flex gap-2 mt-4">
          <Select value={severityFilter} onValueChange={(v) => handleFilterChange('severity', v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(v) => handleFilterChange('category', v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Category</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="license">License</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => handleFilterChange('status', v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredRecommendations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">No recommendations found</p>
            <p className="text-sm">Your fleet is in great shape!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecommendations.map((rec) => {
              const severity = severityConfig[rec.severity as keyof typeof severityConfig] || severityConfig.low;
              const SeverityIcon = severity.icon;

              return (
                <div
                  key={rec.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${severity.color}/10`}>
                    <SeverityIcon className={`h-5 w-5 ${severity.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[rec.category] || 'bg-gray-100'}`}>
                        {rec.category}
                      </span>
                      {rec.deviceName && (
                        <span className="text-sm font-medium">{rec.deviceName}</span>
                      )}
                    </div>
                    
                    <h4 className="font-medium text-sm">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{rec.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {rec.actionUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={rec.actionUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    
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
                    
                    {rec.status === 'active' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(rec.id, 'acknowledge')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(rec.id, 'dismiss')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
