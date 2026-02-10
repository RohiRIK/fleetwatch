'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Cloud, 
  Mail, 
  Webhook, 
  RefreshCw,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';

type NotificationType = 'email' | 'webhook';
type SyncMode = 'full' | 'incremental' | 'deep';

interface TestResult {
  type: 'success' | 'error';
  message: string;
}

interface SyncResult {
  success: boolean;
  mode: SyncMode;
  devicesProcessed: number;
  devicesCreated: number;
  devicesUpdated: number;
  devicesFailed: number;
  durationMs: number;
}

/**
 * HealthMonitoring Component
 * 
 * Provides health check tools and manual operation triggers:
 * - Test Azure connection
 * - Test email notifications
 * - Test webhook notifications
 * - Manually trigger device sync
 */
export function HealthMonitoring() {
  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<TestResult | null>(null);

  // Notification test state
  const [testingNotification, setTestingNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType>('email');
  const [notificationResult, setNotificationResult] = useState<TestResult | null>(null);

  // Sync trigger state
  const [triggeringSync, setTriggeringSync] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>('full');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Test Azure Connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const response = await fetch('/api/settings/test-connection', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionResult({ type: 'success', message: data.message });
      } else {
        setConnectionResult({ 
          type: 'error', 
          message: data.error || 'Connection test failed' 
        });
      }
    } catch (error) {
      setConnectionResult({ 
        type: 'error', 
        message: 'Network error - could not reach server' 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Test Notification
  const handleTestNotification = async () => {
    setTestingNotification(true);
    setNotificationResult(null);

    try {
      const response = await fetch('/api/settings/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: notificationType }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setNotificationResult({ type: 'success', message: data.message });
      } else {
        setNotificationResult({ 
          type: 'error', 
          message: data.error || 'Notification test failed' 
        });
      }
    } catch (error) {
      setNotificationResult({ 
        type: 'error', 
        message: 'Network error - could not reach server' 
      });
    } finally {
      setTestingNotification(false);
    }
  };

  // Trigger Manual Sync
  const handleTriggerSync = async () => {
    setTriggeringSync(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const response = await fetch('/api/settings/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: syncMode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncResult(data.result);
      } else {
        setSyncError(data.error || 'Sync failed');
      }
    } catch (error) {
      setSyncError('Network error - could not reach server');
    } finally {
      setTriggeringSync(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Azure Connection Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Azure Connection Test
          </CardTitle>
          <CardDescription>
            Test connectivity to Microsoft Graph API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="w-full sm:w-auto"
          >
            {testingConnection ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>

          {connectionResult && (
            <div
              className={`flex items-start gap-2 p-4 rounded-md ${
                connectionResult.type === 'success'
                  ? 'bg-green-50 text-green-900 border border-green-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}
            >
              {connectionResult.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {connectionResult.type === 'success' ? 'Connection Successful' : 'Connection Failed'}
                </p>
                <p className="text-sm mt-1">{connectionResult.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notification Test
          </CardTitle>
          <CardDescription>
            Send a test notification to verify configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select 
              value={notificationType} 
              onValueChange={(value: NotificationType) => setNotificationType(value)}
            >
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                </SelectItem>
                <SelectItem value="webhook">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    Webhook
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleTestNotification}
            disabled={testingNotification}
            className="w-full sm:w-auto"
          >
            {testingNotification ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>

          {notificationResult && (
            <div
              className={`flex items-start gap-2 p-4 rounded-md ${
                notificationResult.type === 'success'
                  ? 'bg-green-50 text-green-900 border border-green-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}
            >
              {notificationResult.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {notificationResult.type === 'success' ? 'Test Sent' : 'Test Failed'}
                </p>
                <p className="text-sm mt-1">{notificationResult.message}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Sync Trigger Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Manual Device Sync
          </CardTitle>
          <CardDescription>
            Manually trigger a device synchronization from Microsoft Intune
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Warning</p>
              <p className="mt-1">Manual sync may take several minutes depending on device count and sync mode.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sync Mode</Label>
            <Select 
              value={syncMode} 
              onValueChange={(value: SyncMode) => setSyncMode(value)}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Sync (All Devices)</SelectItem>
                <SelectItem value="incremental">Incremental Sync (Changes Only)</SelectItem>
                <SelectItem value="deep">Deep Sync (Full Enrichment)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleTriggerSync}
            disabled={triggeringSync}
            variant="default"
            className="w-full sm:w-auto"
          >
            {triggeringSync ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Trigger Sync Now
              </>
            )}
          </Button>

          {syncError && (
            <div className="flex items-start gap-2 p-4 rounded-md bg-red-50 text-red-900 border border-red-200">
              <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Sync Failed</p>
                <p className="text-sm mt-1">{syncError}</p>
              </div>
            </div>
          )}

          {syncResult && (
            <div className="flex items-start gap-2 p-4 rounded-md bg-green-50 text-green-900 border border-green-200">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Sync Completed Successfully</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Processed</p>
                    <p className="text-lg font-semibold">{syncResult.devicesProcessed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="text-lg font-semibold text-green-600">{syncResult.devicesCreated}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="text-lg font-semibold text-blue-600">{syncResult.devicesUpdated}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Failed</p>
                    <p className="text-lg font-semibold text-red-600">{syncResult.devicesFailed}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="secondary">{syncResult.mode.toUpperCase()} MODE</Badge>
                    <span>Duration: {(syncResult.durationMs / 1000).toFixed(2)}s</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
