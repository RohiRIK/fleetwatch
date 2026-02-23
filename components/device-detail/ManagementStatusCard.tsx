'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Settings, 
  Shield, 
  Clock, 
  Users,
  ExternalLink
} from 'lucide-react';
import { DeviceManagementInfo } from '@/lib/types/device-detail';
import { format } from 'date-fns';

interface ManagementStatusCardProps {
  data: DeviceManagementInfo;
  className?: string;
}

export function ManagementStatusCard({ data, className }: ManagementStatusCardProps) {
  const hasAnyData = data.managementAgent || data.managementCertificateExpirationDate ||
                     data.managementFeatures || data.remoteAssistanceSessionUrl ||
                     data.enrollmentProfileName || data.requireUserEnrollmentApproval !== null;
  
  if (!hasAnyData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No management information available</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.managementAgent && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Management Agent</p>
            <p className="text-sm">{data.managementAgent}</p>
          </div>
        )}
        {data.enrollmentProfileName && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Enrollment Profile</p>
            <p className="text-sm">{data.enrollmentProfileName}</p>
          </div>
        )}
        {data.managementCertificateExpirationDate && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Certificate Expires</p>
            <p className="text-sm">{format(data.managementCertificateExpirationDate, 'MMM d, yyyy')}</p>
          </div>
        )}
        {data.managementFeatures && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Features</p>
            <p className="text-sm">{data.managementFeatures}</p>
          </div>
        )}
        {data.requireUserEnrollmentApproval !== null && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Requires Approval</p>
            <p className="text-sm">{data.requireUserEnrollmentApproval ? 'Yes' : 'No'}</p>
          </div>
        )}
        {data.remoteAssistanceSessionUrl && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Remote Assistance</p>
            <a 
              href={data.remoteAssistanceSessionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Session Link
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {data.remoteAssistanceSessionErrorDetails && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Session Error</p>
            <p className="text-sm text-red-600">{data.remoteAssistanceSessionErrorDetails}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ManagementStatusCard;
