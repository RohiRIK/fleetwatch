'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  Lock,
  Cpu
} from 'lucide-react';
import { DeviceSecurityHardware } from '@/lib/types/device-detail';

interface SecurityHardwareCardProps {
  data: DeviceSecurityHardware;
  className?: string;
}

export function SecurityHardwareCard({ data, className }: SecurityHardwareCardProps) {
  const hasAnyData = data.tpmPresent !== null || data.secureBootEnabled !== null ||
                     data.codeIntegrityEnabled !== null || data.bootDebuggingEnabled !== null;
  
  if (!hasAnyData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Hardware
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No security hardware information available</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Hardware
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.tpmPresent !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">TPM Present</p>
            <p className="text-sm">{data.tpmPresent ? 'Yes' : 'No'}</p>
          </div>
        )}
        {data.secureBootEnabled !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Secure Boot</p>
            <p className="text-sm">{data.secureBootEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        )}
        {data.codeIntegrityEnabled !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Code Integrity</p>
            <p className="text-sm">{data.codeIntegrityEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        )}
        {data.bootDebuggingEnabled !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Boot Debugging</p>
            <p className={`text-sm ${data.bootDebuggingEnabled ? 'text-red-600' : ''}`}>
              {data.bootDebuggingEnabled ? 'Enabled (Security Risk)' : 'Disabled'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SecurityHardwareCard;
