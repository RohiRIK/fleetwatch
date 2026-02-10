'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, CheckCircle2, XCircle, Plus, X } from 'lucide-react';

interface NotificationSetting {
  id: string;
  key: string;
  value: boolean | string | string[] | number;
  description: string;
}

/**
 * NotificationSettings Component
 * 
 * Manages notification settings:
 * - Email notifications (enable/disable, recipients)
 * - Webhook notifications (URL)
 * - Alertthresholds (compliance %, sync errors)
 */
export function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Email settings
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');

  // Webhook settings
  const [webhookUrl, setWebhookUrl] = useState('');

  // Threshold settings
  const [complianceThreshold, setComplianceThreshold] = useState(80);
  const [syncErrorsThreshold, setSyncErrorsThreshold] = useState(5);

  // Original values
  const [originalValues, setOriginalValues] = useState({
    emailEnabled: false,
    emailRecipients: [] as string[],
    webhookUrl: '',
    complianceThreshold: 80,
    syncErrorsThreshold: 5,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings?category=notifications');
      
      // If API is not available, use defaults
      if (!response.ok) {
        console.warn('Settings API not available, using defaults');
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      const settings = data.settings || [];

      const enabled = settings.find((s: NotificationSetting) => s.key === 'notifications.email.enabled')?.value ?? false;
      const recipients = settings.find((s: NotificationSetting) => s.key === 'notifications.email.recipients')?.value ?? [];
      const webhook = settings.find((s: NotificationSetting) => s.key === 'notifications.webhook.url')?.value ?? '';
      const compThreshold = settings.find((s: NotificationSetting) => s.key === 'notifications.thresholds.compliance')?.value ?? 80;
      const errThreshold = settings.find((s: NotificationSetting) => s.key === 'notifications.thresholds.syncErrors')?.value ?? 5;

      setEmailEnabled(Boolean(enabled));
      setEmailRecipients(Array.isArray(recipients) ? recipients : []);
      setWebhookUrl(String(webhook));
      setComplianceThreshold(Number(compThreshold));
      setSyncErrorsThreshold(Number(errThreshold));

      setOriginalValues({
        emailEnabled: Boolean(enabled),
        emailRecipients: Array.isArray(recipients) ? recipients : [],
        webhookUrl: String(webhook),
        complianceThreshold: Number(compThreshold),
        syncErrorsThreshold: Number(errThreshold),
      });
    } catch (error) {
      console.warn('Error fetching notification settings, using defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = () => {
    const email = newRecipient.trim();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Invalid email address format' });
      return;
    }

    if (emailRecipients.includes(email)) {
      setMessage({ type: 'error', text: 'Email already added' });
      return;
    }

    setEmailRecipients([...emailRecipients, email]);
    setNewRecipient('');
    setMessage(null);
  };

  const handleRemoveRecipient = (email: string) => {
    setEmailRecipients(emailRecipients.filter((e) => e !== email));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updates = [
        { key: 'notifications.email.enabled', value: emailEnabled },
        { key: 'notifications.email.recipients', value: emailRecipients },
        { key: 'notifications.webhook.url', value: webhookUrl },
        { key: 'notifications.thresholds.compliance', value: complianceThreshold },
        { key: 'notifications.thresholds.syncErrors', value: syncErrorsThreshold },
      ];

      const results = await Promise.all(
        updates.map(({ key, value }) =>
          fetch(`/api/settings/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          })
        )
      );

      const allSucceeded = results.every((r) => r.ok);
      if (!allSucceeded) {
        const errors = await Promise.all(
          results.filter((r) => !r.ok).map((r) => r.json())
        );
        throw new Error(errors[0]?.error || 'Failed to update settings');
      }

      setMessage({ type: 'success', text: 'Notification settings saved successfully' });
      setOriginalValues({
        emailEnabled,
        emailRecipients: [...emailRecipients],
        webhookUrl,
        complianceThreshold,
        syncErrorsThreshold,
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const keys = [
        'notifications.email.enabled',
        'notifications.email.recipients',
        'notifications.webhook.url',
        'notifications.thresholds.compliance',
        'notifications.thresholds.syncErrors',
      ];

      const results = await Promise.all(
        keys.map((key) => fetch(`/api/settings/${key}/reset`, { method: 'POST' }))
      );

      const allSucceeded = results.every((r) => r.ok);
      if (!allSucceeded) throw new Error('Failed to reset settings');

      setMessage({ type: 'success', text: 'Settings reset to defaults' });
      await fetchSettings();
    } catch (error) {
      console.error('Error resetting notification settings:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = 
    emailEnabled !== originalValues.emailEnabled ||
    JSON.stringify(emailRecipients) !== JSON.stringify(originalValues.emailRecipients) ||
    webhookUrl !== originalValues.webhookUrl ||
    complianceThreshold !== originalValues.complianceThreshold ||
    syncErrorsThreshold !== originalValues.syncErrorsThreshold;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Status Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Email Notifications Section */}
      <div className="space-y-4 pb-6 border-b">
        <h3 className="text-lg font-semibold">Email Notifications</h3>
        
        {/* Email Enabled Toggle */}
        <div className="space-y-2">
          <Label htmlFor="email-enabled">Email Alerts</Label>
          <div className="flex items-center gap-4">
            <Select
              value={emailEnabled ? 'enabled' : 'disabled'}
              onValueChange={(value) => setEmailEnabled(value === 'enabled')}
            >
              <SelectTrigger id="email-enabled" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant={emailEnabled ? 'default' : 'secondary'}>
              {emailEnabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Send email alerts for compliance issues and sync failures
          </p>
        </div>

        {/* Email Recipients */}
        <div className="space-y-2">
          <Label htmlFor="email-recipients">Recipients</Label>
          <div className="flex gap-2">
            <Input
              id="email-recipients"
              type="email"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRecipient()}
              placeholder="admin@example.com"
              className="max-w-md"
            />
            <Button onClick={handleAddRecipient} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Add email addresses to receive notifications
          </p>
          
          {/* Recipient List */}
          {emailRecipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {emailRecipients.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <button
                    onClick={() => handleRemoveRecipient(email)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Webhook Notifications Section */}
      <div className="space-y-4 pb-6 border-b">
        <h3 className="text-lg font-semibold">Webhook Notifications</h3>
        
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/alerts"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            POST requests will be sent to this URL for alerts. Leave empty to disable webhooks.
          </p>
        </div>
      </div>

      {/* Alert Thresholds Section */}
      <div className="space-y-4 pb-6 border-b">
        <h3 className="text-lg font-semibold">Alert Thresholds</h3>
        
        {/* Compliance Threshold */}
        <div className="space-y-2">
          <Label htmlFor="compliance-threshold">Compliance Threshold (%)</Label>
          <Input
            id="compliance-threshold"
            type="number"
            min="0"
            max="100"
            value={complianceThreshold}
            onChange={(e) => setComplianceThreshold(Number(e.target.value))}
            className="w-[150px]"
          />
          <p className="text-sm text-muted-foreground">
            Alert when compliance rate falls below this percentage
          </p>
        </div>

        {/* Sync Errors Threshold */}
        <div className="space-y-2">
          <Label htmlFor="sync-errors-threshold">Sync Errors Threshold</Label>
          <Input
            id="sync-errors-threshold"
            type="number"
            min="0"
            value={syncErrorsThreshold}
            onChange={(e) => setSyncErrorsThreshold(Number(e.target.value))}
            className="w-[150px]"
          />
          <p className="text-sm text-muted-foreground">
            Alert when sync error count exceeds this number
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="min-w-[120px]"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button onClick={handleReset} variant="outline" disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        {hasChanges && (
          <span className="text-sm text-muted-foreground">
            You have unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
