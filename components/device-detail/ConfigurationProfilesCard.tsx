'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  MinusCircle,
  Loader2
} from 'lucide-react';

interface ConfigurationProfile {
  id?: string;
  displayName?: string;
  name?: string;
  profileName?: string;
  state?: string;
  settingCount?: number;
  errorCode?: number;
  lastReportedDateTime?: string;
}

interface ConfigurationProfilesCardProps {
  profiles: ConfigurationProfile[] | null;
  className?: string;
}

function getStateIcon(state: string | undefined) {
  switch (state?.toLowerCase()) {
    case 'compliant':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'remediated':
      return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    case 'noncompliant':
    case 'conflict':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'notapplicable':
    case 'unknown':
      return <MinusCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
  }
}

function getStateColor(state: string | undefined): string {
  switch (state?.toLowerCase()) {
    case 'compliant':
      return 'bg-green-100 text-green-800';
    case 'remediated':
      return 'bg-blue-100 text-blue-800';
    case 'noncompliant':
    case 'conflict':
      return 'bg-red-100 text-red-800';
    case 'error':
      return 'bg-orange-100 text-orange-800';
    case 'notapplicable':
    case 'unknown':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatState(state: string | undefined): string {
  if (!state) return 'Unknown';
  return state.charAt(0).toUpperCase() + state.slice(1).replace(/([A-Z])/g, ' $1').trim();
}

export function ConfigurationProfilesCard({ profiles, className }: ConfigurationProfilesCardProps) {
  const profileList = profiles && Array.isArray(profiles) ? profiles : [];
  
  if (profileList.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No configuration profiles assigned to this device</p>
        </CardContent>
      </Card>
    );
  }

  const compliantCount = profileList.filter(p => p.state?.toLowerCase() === 'compliant').length;
  const remediatedCount = profileList.filter(p => p.state?.toLowerCase() === 'remediated').length;
  const nonCompliantCount = profileList.filter(p => p.state?.toLowerCase() === 'noncompliant').length;
  const errorCount = profileList.filter(p => p.state?.toLowerCase() === 'error').length;
  const notApplicableCount = profileList.filter(p => p.state?.toLowerCase() === 'notapplicable').length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuration Profiles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex flex-wrap gap-2">
          {compliantCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
              {compliantCount} Compliant
            </span>
          )}
          {remediatedCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
              {remediatedCount} Remediated
            </span>
          )}
          {nonCompliantCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              {nonCompliantCount} Non-Compliant
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-800">
              {errorCount} Error
            </span>
          )}
          {notApplicableCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
              {notApplicableCount} Not Applicable
            </span>
          )}
        </div>

        {/* Profile List */}
        <div className="space-y-3">
          {profileList.map((profile, index) => (
            <div 
              key={profile.id || index} 
              className="p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  {profile.displayName || profile.profileName || profile.name || 'Unknown Profile'}
                </p>
                <span className={`text-xs px-2 py-1 rounded ${getStateColor(profile.state)}`}>
                  {getStateIcon(profile.state)}
                  <span className="ml-1">{formatState(profile.state)}</span>
                </span>
              </div>
              
              {profile.settingCount !== undefined && profile.settingCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {profile.settingCount} settings configured
                </p>
              )}
              
              {profile.errorCode && profile.errorCode !== 0 && (
                <p className="text-xs text-orange-600 mt-2">
                  Error code: {profile.errorCode}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
