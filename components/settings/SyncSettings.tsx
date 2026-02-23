'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { CronBuilder } from './CronBuilder';

type SyncMode = 'full' | 'incremental' | 'deep';

interface SyncSetting {
  id: string;
  key: string;
  value: boolean | string | SyncMode;
  description: string;
}

/**
 * SyncSettings Component
 * 
 * Manages device synchronization settings:
 * - Sync schedule (cron expression)
 * - Sync mode (full/incremental/deep)
 * - Enable/disable sync
 */
export function SyncSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Setting values
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncSchedule, setSyncSchedule] = useState('0 */6 * * *'); // Default: Every 6 hours
  const [syncMode, setSyncMode] = useState<SyncMode>('full');

  // Original values for reset detection
  const [originalValues, setOriginalValues] = useState({
    syncEnabled: true,
    syncSchedule: '0 */6 * * *',
    syncMode: 'full' as SyncMode,
  });

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings?category=sync');
      
      // If API is not available (401, 500, etc), use defaults
      if (!response.ok) {
        console.warn('Settings API not available, using defaults');
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      const settings = data.settings || [];

      // Extract values
      const enabled = settings.find((s: SyncSetting) => s.key === 'sync.enabled')?.value ?? true;
      const schedule = settings.find((s: SyncSetting) => s.key === 'sync.schedule')?.value ?? '0 */6 * * *';
      const mode = settings.find((s: SyncSetting) => s.key === 'sync.mode')?.value ?? 'full';

      setSyncEnabled(Boolean(enabled));
      setSyncSchedule(String(schedule));
      setSyncMode(mode as SyncMode);

      setOriginalValues({
        syncEnabled: Boolean(enabled),
        syncSchedule: String(schedule),
        syncMode: mode as SyncMode,
      });
    } catch (error) {
      console.warn('Error fetching sync settings, using defaults:', error);
      // Use defaults instead of showing error
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Update all three settings
      const updates = [
        { key: 'sync.enabled', value: syncEnabled },
        { key: 'sync.schedule', value: syncSchedule },
        { key: 'sync.mode', value: syncMode },
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

      // Check if all succeeded
      const allSucceeded = results.every((r) => r.ok);
      if (!allSucceeded) {
        const errors = await Promise.all(
          results.filter((r) => !r.ok).map((r) => r.json())
        );
        throw new Error(errors[0]?.error || 'Failed to update settings');
      }

      setMessage({ type: 'success', text: 'Sync settings saved successfully' });
      setOriginalValues({ syncEnabled, syncSchedule, syncMode });
    } catch (error) {
      console.error('Error saving sync settings:', error);
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
      const keys = ['sync.enabled', 'sync.schedule', 'sync.mode'];
      const results = await Promise.all(
        keys.map((key) =>
          fetch(`/api/settings/${key}/reset`, { method: 'POST' })
        )
      );

      const allSucceeded = results.every((r) => r.ok);
      if (!allSucceeded) throw new Error('Failed to reset settings');

      setMessage({ type: 'success', text: 'Settings reset to defaults' });
      await fetchSettings(); // Reload from server
    } catch (error) {
      console.error('Error resetting sync settings:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = 
    syncEnabled !== originalValues.syncEnabled ||
    syncSchedule !== originalValues.syncSchedule ||
    syncMode !== originalValues.syncMode;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Sync Enabled Toggle */}
      <div className="space-y-2">
        <Label htmlFor="sync-enabled">Automatic Sync</Label>
        <div className="flex items-center gap-4">
          <Select
            value={syncEnabled ? 'enabled' : 'disabled'}
            onValueChange={(value) => setSyncEnabled(value === 'enabled')}
          >
            <SelectTrigger id="sync-enabled" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant={syncEnabled ? 'default' : 'secondary'}>
            {syncEnabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Enable or disable automatic device synchronization from Microsoft Intune
        </p>
      </div>

      {/* Sync Schedule */}
      <div className="space-y-2">
        <Label>Sync Schedule</Label>
        <CronBuilder value={syncSchedule} onChange={setSyncSchedule} />
      </div>

      {/* Sync Mode */}
      <div className="space-y-2">
        <Label htmlFor="sync-mode">Sync Mode</Label>
        <Select value={syncMode} onValueChange={(value: SyncMode) => setSyncMode(value)}>
          <SelectTrigger id="sync-mode" className="w-[300px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Sync (All Devices)</SelectItem>
            <SelectItem value="incremental">Incremental Sync (Changes Only)</SelectItem>
            <SelectItem value="deep">Deep Sync (Full Enrichment)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {syncMode === 'full' && 'Sync all devices from Intune'}
          {syncMode === 'incremental' && 'Sync only devices that changed since last sync (faster)'}
          {syncMode === 'deep' && 'Sync with full enrichment including compliance, apps, and security data'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t">
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
        <Button
          onClick={handleReset}
          variant="outline"
          disabled={saving}
        >
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
