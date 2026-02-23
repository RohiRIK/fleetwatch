'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Cpu, 
  Battery, 
  Signal, 
  Users, 
  Smartphone, 
  Hash,
  CreditCard,
  Fingerprint,
  Globe
} from 'lucide-react';
import { DeviceHardwareInfo } from '@/lib/types/device-detail';

interface HardwareDeepDiveCardProps {
  data: DeviceHardwareInfo;
  className?: string;
}

export function HardwareDeepDiveCard({ data, className }: HardwareDeepDiveCardProps) {
  const hasAnyData = data.meid || data.iccid || data.udid || data.subscriberCarrier || 
                     data.batterySerialNumber || data.batteryChargeCycles || data.batteryLevelPercentage ||
                     data.productName || data.residentUsersCount || data.deviceFullQualifiedDomainName;
  
  if (!hasAnyData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Hardware Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No additional hardware information available</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          Hardware Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.meid && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">MEID</p>
            <p className="text-sm font-mono">{data.meid}</p>
          </div>
        )}
        {data.iccid && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">ICCID</p>
            <p className="text-sm font-mono">{data.iccid}</p>
          </div>
        )}
        {data.udid && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">UDID</p>
            <p className="text-sm font-mono">{data.udid}</p>
          </div>
        )}
        {data.subscriberCarrier && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Carrier</p>
            <p className="text-sm">{data.subscriberCarrier}</p>
          </div>
        )}
        {data.batterySerialNumber && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Battery Serial</p>
            <p className="text-sm font-mono">{data.batterySerialNumber}</p>
          </div>
        )}
        {data.batteryChargeCycles !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Charge Cycles</p>
            <p className="text-sm">{data.batteryChargeCycles}</p>
          </div>
        )}
        {data.batteryLevelPercentage !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Battery Level</p>
            <p className="text-sm">{data.batteryLevelPercentage}%</p>
          </div>
        )}
        {data.productName && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Product Name</p>
            <p className="text-sm">{data.productName}</p>
          </div>
        )}
        {data.residentUsersCount !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Resident Users</p>
            <p className="text-sm">{data.residentUsersCount}</p>
          </div>
        )}
        {data.deviceFullQualifiedDomainName && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Domain Name</p>
            <p className="text-sm">{data.deviceFullQualifiedDomainName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HardwareDeepDiveCard;
