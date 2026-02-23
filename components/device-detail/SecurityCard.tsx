'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldQuestion,
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Bug,
  Lock
} from 'lucide-react';

interface SecurityBaseline {
  id?: string;
  displayName?: string;
  name?: string;
  state?: string;
  compliantSettingsCount?: number;
  nonCompliantSettingsCount?: number;
  errorCount?: number;
}

interface SecurityDetails {
  baselines?: SecurityBaseline[];
  healthAttestation?: any;
  windowsProtection?: any;
}

interface SecurityCardProps {
  data: SecurityDetails | null;
  isEncrypted?: boolean;
  jailBroken?: string | null;
  tpmPresent?: boolean | null;
  secureBootEnabled?: boolean | null;
  codeIntegrityEnabled?: boolean | null;
  className?: string;
}

function getBaselineStateColor(state: string | undefined): string {
  switch (state?.toLowerCase()) {
    case 'compliant':
      return 'bg-green-100 text-green-800';
    case 'noncompliant':
      return 'bg-red-100 text-red-800';
    case 'error':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function SecurityCard({ 
  data, 
  isEncrypted = false,
  jailBroken,
  tpmPresent,
  secureBootEnabled,
  codeIntegrityEnabled,
  className 
}: SecurityCardProps) {
  const baselines = data?.baselines || [];
  const hasSecurityData = baselines.length > 0 || data?.healthAttestation || data?.windowsProtection;
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Encryption Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Disk Encryption</span>
          </div>
          {isEncrypted ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-800">
              <ShieldCheck className="h-3 w-3" />
              Encrypted
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              <XCircle className="h-3 w-3" />
              Not Encrypted
            </span>
          )}
        </div>

        {/* TPM Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">TPM Present</span>
          </div>
          {tpmPresent === true ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3" />
              Yes
            </span>
          ) : tpmPresent === false ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              <XCircle className="h-3 w-3" />
              No
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
              <ShieldQuestion className="h-3 w-3" />
              Unknown
            </span>
          )}
        </div>

        {/* Secure Boot Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Secure Boot</span>
          </div>
          {secureBootEnabled === true ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3" />
              Enabled
            </span>
          ) : secureBootEnabled === false ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              <XCircle className="h-3 w-3" />
              Disabled
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
              <ShieldQuestion className="h-3 w-3" />
              Unknown
            </span>
          )}
        </div>

        {/* Code Integrity Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Code Integrity</span>
          </div>
          {codeIntegrityEnabled === true ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3" />
              Enabled
            </span>
          ) : codeIntegrityEnabled === false ? (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              <XCircle className="h-3 w-3" />
              Disabled
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
              <ShieldQuestion className="h-3 w-3" />
              Unknown
            </span>
          )}
        </div>

        {/* Jailbroken/Rooted Status */}
        {jailBroken && jailBroken !== 'Unknown' && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Device Security</span>
            </div>
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              <AlertTriangle className="h-3 w-3" />
              {jailBroken}
            </span>
          </div>
        )}

        {/* Security Baselines */}
        {baselines.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Security Baselines</p>
            <div className="space-y-2">
              {baselines.map((baseline, index) => (
                <div key={baseline.id || index} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {baseline.displayName || baseline.name || 'Security Baseline'}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded ${getBaselineStateColor(baseline.state)}`}>
                      {baseline.state || 'Unknown'}
                    </span>
                  </div>
                  {baseline.compliantSettingsCount !== undefined && (
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{baseline.compliantSettingsCount} compliant</span>
                      {baseline.nonCompliantSettingsCount !== undefined && baseline.nonCompliantSettingsCount > 0 && (
                        <span className="text-red-600">{baseline.nonCompliantSettingsCount} non-compliant</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSecurityData && !isEncrypted && !tpmPresent && !secureBootEnabled && (
          <p className="text-sm text-muted-foreground">No security information available</p>
        )}
      </CardContent>
    </Card>
  );
}
