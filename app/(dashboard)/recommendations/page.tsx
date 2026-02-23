'use client';

import { Suspense } from 'react';
import { RecommendationsList } from '@/components/recommendations/RecommendationsList';
import { RecommendationsWidget } from '@/components/recommendations/RecommendationsWidget';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function RecommendationsListSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function RecommendationsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fleet Health Recommendations</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered insights to improve your device fleet
          </p>
        </div>
      </div>

      <Suspense fallback={<RecommendationsListSkeleton />}>
        <RecommendationsWidget />
      </Suspense>

      <Suspense fallback={<RecommendationsListSkeleton />}>
        <RecommendationsList />
      </Suspense>
    </div>
  );
}
