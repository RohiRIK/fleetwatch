'use client';

import { useState, useEffect, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mail, Briefcase, Building2, Calendar, Laptop, RefreshCw } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  azureId: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Device {
  id: string;
  azureId: string;
  deviceName: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  complianceState: string | null;
  isEncrypted: boolean;
  managementState: string | null;
  enrolledAt: string | null;
  lastSyncAt: string | null;
  chassisType: string | null;
}

interface UserDetailsResponse {
  user: User;
  devices: Device[];
  deviceCount: number;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const userId = unwrappedParams.id;
  const router = useRouter();
  
  const [data, setData] = useState<UserDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchUserDetails();
  }, [userId]);
  
  const fetchUserDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/users/${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load user details');
        }
        return;
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getComplianceBadge = (state: string | null) => {
    if (!state) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (state.toLowerCase()) {
      case 'compliant':
        return <Badge className="bg-green-500">Compliant</Badge>;
      case 'noncompliant':
        return <Badge variant="destructive">Non-Compliant</Badge>;
      case 'ingraceperiod':
        return <Badge className="bg-yellow-500">Grace Period</Badge>;
      case 'configmanager':
        return <Badge variant="secondary">Config Manager</Badge>;
      default:
        return <Badge variant="secondary">{state}</Badge>;
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">{error || 'User not found'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { user, devices, deviceCount } = data;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
            {user.displayName && user.displayName !== user.name && (
              <p className="text-muted-foreground">{user.displayName}</p>
            )}
          </div>
        </div>
        
        <Button variant="outline" onClick={fetchUserDetails}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      {/* User Info Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Email */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium break-all">{user.email}</div>
          </CardContent>
        </Card>
        
        {/* Department */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Department</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {user.department || <span className="text-muted-foreground">Not specified</span>}
            </div>
          </CardContent>
        </Card>
        
        {/* Job Title */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Job Title</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {user.jobTitle || <span className="text-muted-foreground">Not specified</span>}
            </div>
          </CardContent>
        </Card>
        
        {/* Total Devices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Laptop className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deviceCount}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* User Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Azure ID</div>
              <div className="text-sm font-mono mt-1">
                {user.azureId || <span className="text-muted-foreground">Not synced</span>}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-muted-foreground">Account Created</div>
              <div className="text-sm mt-1">{formatDate(user.createdAt)}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
              <div className="text-sm mt-1">{formatDate(user.updatedAt)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Devices List */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Devices ({deviceCount})</CardTitle>
          <CardDescription>
            Devices currently assigned to this user
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No devices assigned to this user
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <Card key={device.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{device.deviceName}</h3>
                          {getComplianceBadge(device.complianceState)}
                          {device.isEncrypted && (
                            <Badge variant="outline" className="bg-blue-500/10">
                              Encrypted
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Manufacturer: </span>
                            <span className="font-medium">{device.manufacturer || '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Model: </span>
                            <span className="font-medium">{device.model || '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">OS: </span>
                            <span className="font-medium">
                              {device.operatingSystem} {device.osVersion}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Type: </span>
                            <span className="font-medium">{device.chassisType || '—'}</span>
                          </div>
                        </div>
                        
                        {device.serialNumber && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Serial: </span>
                            <span className="font-mono">{device.serialNumber}</span>
                          </div>
                        )}
                        
                        <div className="text-sm text-muted-foreground">
                          Last synced: {formatDate(device.lastSyncAt)}
                        </div>
                      </div>
                      
                      <Link href={`/devices/${device.id}`}>
                        <Button variant="ghost" size="sm">
                          View Device
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
