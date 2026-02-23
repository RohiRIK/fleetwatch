'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface SettingsBackup {
  version: string;
  exportedAt: string;
  settings: Record<string, string | boolean | number>;
}

interface SettingsBackupRestoreProps {
  onBackupCreated?: () => void;
}

export function SettingsBackupRestore({ onBackupCreated }: SettingsBackupRestoreProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      const settings = data.settings || [];

      const backup: SettingsBackup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        settings: settings.reduce((acc: Record<string, string | boolean | number>, s: { key: string; value: string | boolean | number }) => {
          acc[s.key] = s.value;
          return acc;
        }, {}),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleetwatch-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Exported ${Object.keys(backup.settings).length} settings` });
      onBackupCreated?.();
    } catch (error) {
      console.error('Export failed:', error);
      setMessage({ type: 'error', text: 'Failed to export settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);

    try {
      const text = await file.text();
      const backup: SettingsBackup = JSON.parse(text);

      if (!backup.settings || typeof backup.settings !== 'object') {
        throw new Error('Invalid backup file format');
      }

      const settingsArray = Object.entries(backup.settings).map(([key, value]) => ({
        key,
        value,
      }));

      const results = await Promise.all(
        settingsArray.map(({ key, value }) =>
          fetch(`/api/settings/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          })
        )
      );

      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.length - succeeded;

      if (failed > 0) {
        setMessage({
          type: 'error',
          text: `Imported ${succeeded}/${results.length} settings. ${failed} failed.`,
        });
      } else {
        setMessage({
          type: 'success',
          text: `Successfully imported ${succeeded} settings`,
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to import settings',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Backup & Restore
        </CardTitle>
        <CardDescription>
          Export your settings to a JSON file or restore from a previous backup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={handleExport} disabled={loading} className="min-w-[150px]">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Settings
              </>
            )}
          </Button>

          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="settings-import"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="min-w-[150px]"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Settings
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Warning: Import will overwrite current settings</p>
            <p className="mt-1">
              Importing a backup file will replace all current settings with the values from the file.
              It is recommended to export your current settings before importing.
            </p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Export format:</strong></p>
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
{`{
  "version": "1.0",
  "exportedAt": "2026-02-23T12:00:00Z",
  "settings": {
    "sync.enabled": true,
    "sync.schedule": "0 */6 * * *",
    ...
  }
}`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
