'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, EyeOff, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AzureSetting {
  id: string;
  key: string;
  value: string;
  description: string;
}

/**
 * AzureSettings Component
 * 
 * Displays Azure AD and Microsoft Graph API configuration (read-only).
 * These values come from environment variables and cannot be edited from the UI.
 */
export function AzureSettings() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [showIds, setShowIds] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings?category=azure');
      
      // If API is not available, show placeholder
      if (!response.ok) {
        console.warn('Settings API not available');
        setTenantId('Not configured (Database not available)');
        setClientId('Not configured (Database not available)');
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      const settings = data.settings || [];

      const tenant = settings.find((s: AzureSetting) => s.key === 'azure.tenantId')?.value ?? 'Not configured';
      const client = settings.find((s: AzureSetting) => s.key === 'azure.clientId')?.value ?? 'Not configured';

      setTenantId(tenant);
      setClientId(client);
    } catch (error) {
      console.warn('Error fetching Azure settings:', error);
      setTenantId('Not configured (Database not available)');
      setClientId('Not configured (Database not available)');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const maskValue = (value: string) => {
    if (showIds) return value;
    if (value.length <= 8) return '••••••••';
    return value.substring(0, 8) + '••••••••••••••••••••••••••••';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Azure credentials are configured via environment variables and cannot be edited from this interface.
          Contact your system administrator to modify these settings.
        </p>
      </div>

      {/* Show/Hide Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIds(!showIds)}
        >
          {showIds ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide Values
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Show Values
            </>
          )}
        </Button>
      </div>

      {/* Azure Tenant ID */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Azure Tenant ID</Label>
          <Badge variant="secondary">Read-Only</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm">
            {maskValue(tenantId)}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleCopy(tenantId, 'tenant')}
            disabled={tenantId === 'Not configured'}
          >
            {copiedField === 'tenant' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          The Azure AD tenant ID for Microsoft Graph API authentication
        </p>
      </div>

      {/* Azure Client ID */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Azure Client ID (Application ID)</Label>
          <Badge variant="secondary">Read-Only</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm">
            {maskValue(clientId)}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleCopy(clientId, 'client')}
            disabled={clientId === 'Not configured'}
          >
            {copiedField === 'client' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          The Azure AD application (client) ID registered for FleetWatch
        </p>
      </div>

      {/* API Permissions Info */}
      <div className="pt-4 border-t">
        <h3 className="text-sm font-semibold mb-2">Required API Permissions</h3>
        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
          <li>• DeviceManagementManagedDevices.Read.All</li>
          <li>• User.Read.All</li>
          <li>• Directory.Read.All</li>
          <li>• DeviceManagementApps.Read.All</li>
          <li>• DeviceManagementConfiguration.Read.All</li>
        </ul>
      </div>
    </div>
  );
}
