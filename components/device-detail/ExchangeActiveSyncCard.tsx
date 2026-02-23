'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import { DeviceExchangeActiveSync } from '@/lib/types/device-detail';
import { format } from 'date-fns';

interface ExchangeActiveSyncCardProps {
  data: DeviceExchangeActiveSync;
  className?: string;
}

export function ExchangeActiveSyncCard({ data, className }: ExchangeActiveSyncCardProps) {
  const hasAnyData = data.easActivated !== null || data.easDeviceId || data.exchangeLastSuccessfulSyncDateTime;
  
  if (!hasAnyData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Exchange ActiveSync
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No Exchange ActiveSync information available</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Exchange ActiveSync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.easActivated !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">EAS Status</p>
            <p className="text-sm">{data.easActivated ? 'Active' : 'Inactive'}</p>
          </div>
        )}
        {data.easDeviceId && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Device ID</p>
            <p className="text-sm font-mono">{data.easDeviceId}</p>
          </div>
        )}
        {data.exchangeLastSuccessfulSyncDateTime && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
            <p className="text-sm">{format(data.exchangeLastSuccessfulSyncDateTime, 'MMM d, yyyy h:mm a')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ExchangeActiveSyncCard;
