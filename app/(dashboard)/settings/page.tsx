'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, RefreshCw, Bell, Cloud, Users, Activity } from 'lucide-react';

// Import setting components (we'll create these next)
import { SyncSettings } from '@/components/settings/SyncSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AzureSettings } from '@/components/settings/AzureSettings';
import { UserManagement } from '@/components/settings/UserManagement';
import { HealthMonitoring } from '@/components/settings/HealthMonitoring';

/**
 * Settings Page
 * 
 * Admin configuration UI for FleetWatch
 * SUPERADMIN only - access control handled by middleware
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('sync');

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure device sync, notifications, and system settings
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sync</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="azure" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            <span className="hidden sm:inline">Azure</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
        </TabsList>

        {/* Sync Settings Tab */}
        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Device Sync Configuration</CardTitle>
              <CardDescription>
                Configure how and when device data is synchronized from Microsoft Intune
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SyncSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure email and webhook notifications for compliance alerts and sync events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Azure Settings Tab */}
        <TabsContent value="azure">
          <Card>
            <CardHeader>
              <CardTitle>Azure Configuration</CardTitle>
              <CardDescription>
                View Azure AD and Microsoft Graph API connection details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AzureSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user roles and permissions for FleetWatch
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Monitoring Tab */}
        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>Health Monitoring</CardTitle>
              <CardDescription>
                Test connections, view sync status, and manually trigger operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HealthMonitoring />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
