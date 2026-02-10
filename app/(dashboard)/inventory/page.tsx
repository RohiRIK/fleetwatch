'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Filter,
  RefreshCw,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  HardDrive,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
} from 'lucide-react';

interface Device {
  id: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  isCompliant: boolean;
  isEncrypted: boolean;
  userPrincipalName: string;
  userDisplayName: string;
  chassisType: string;
  lastSyncAt: string;
  ipAddressV4: string;
}

interface FilterOptions {
  operatingSystems: string[];
  manufacturers: string[];
  chassisTypes: string[];
  complianceOptions: { label: string; value: string }[];
  encryptionOptions: { label: string; value: string }[];
}

function DeviceInventoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [devices, setDevices] = useState<Device[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state from URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [os, setOs] = useState(searchParams.get('os') || '');
  const [manufacturer, setManufacturer] = useState(searchParams.get('manufacturer') || '');
  const [isCompliant, setIsCompliant] = useState(searchParams.get('isCompliant') || '');
  const [isEncrypted, setIsEncrypted] = useState(searchParams.get('isEncrypted') || '');
  const [chassisType, setChassisType] = useState(searchParams.get('chassisType') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'lastSyncAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );

  // Build query string
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (os) params.set('os', os);
    if (manufacturer) params.set('manufacturer', manufacturer);
    if (isCompliant) params.set('isCompliant', isCompliant);
    if (isEncrypted) params.set('isEncrypted', isEncrypted);
    if (chassisType) params.set('chassisType', chassisType);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    return params.toString();
  }, [search, os, manufacturer, isCompliant, isEncrypted, chassisType, sortBy, sortOrder, page, pageSize]);

  // Load devices
  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const queryString = buildQueryString();
      const response = await fetch(`/api/devices?${queryString}`);
      const data = await response.json();

      if (data.success) {
        setDevices(data.devices);
        setTotalCount(data.pagination.totalCount);
        setTotalPages(data.pagination.totalPages);
        
        // Update URL
        router.push(`?${queryString}`, { scroll: false });
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString, router]);

  // Load filter options
  const loadFilterOptions = async () => {
    try {
      const response = await fetch('/api/devices/filters');
      const data = await response.json();
      if (data.success) {
        setFilterOptions(data.filters);
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  // Trigger sync
  const triggerSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/cron/sync-devices?mode=deep&syncUsers=true', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        await loadDevices();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(devices.map(d => d.id)));
    } else {
      setSelectedDevices(new Set());
    }
  };

  // Handle select one
  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedDevices);
    if (checked) {
      newSelected.add(deviceId);
    } else {
      newSelected.delete(deviceId);
    }
    setSelectedDevices(newSelected);
  };

  // Export to CSV
  const exportToCsv = () => {
    const headers = ['Device Name', 'Manufacturer', 'Model', 'OS', 'OS Version', 'Compliant', 'Encrypted', 'User', 'Last Sync'];
    const rows = devices.map(d => [
      d.deviceName,
      d.manufacturer,
      d.model,
      d.operatingSystem,
      d.osVersion,
      d.isCompliant ? 'Yes' : 'No',
      d.isEncrypted ? 'Yes' : 'No',
      d.userDisplayName || d.userPrincipalName,
      d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : 'Never',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset filters
  const resetFilters = () => {
    setSearch('');
    setOs('');
    setManufacturer('');
    setIsCompliant('');
    setIsEncrypted('');
    setChassisType('');
    setPage(1);
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const allSelected = devices.length > 0 && selectedDevices.size === devices.length;
  const someSelected = selectedDevices.size > 0 && selectedDevices.size < devices.length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Device Inventory</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your organization's devices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDevices} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
          <Button onClick={triggerSync} disabled={syncing}>
            {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Search and filter devices by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices, users, serial numbers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    loadDevices();
                  }
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={() => { setPage(1); loadDevices(); }}>
              Search
            </Button>
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Operating System */}
            <Select value={os} onValueChange={(value) => { setOs(value === 'all' ? '' : value); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Operating System" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operating Systems</SelectItem>
                {filterOptions?.operatingSystems.map((osOption) => (
                  <SelectItem key={osOption} value={osOption}>
                    {osOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Manufacturer */}
            <Select value={manufacturer} onValueChange={(value) => { setManufacturer(value === 'all' ? '' : value); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manufacturers</SelectItem>
                {filterOptions?.manufacturers.map((mfg) => (
                  <SelectItem key={mfg} value={mfg}>
                    {mfg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Compliance */}
            <Select value={isCompliant} onValueChange={(value) => { setIsCompliant(value === 'all' ? '' : value); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Compliance Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {filterOptions?.complianceOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Encryption */}
            <Select value={isEncrypted} onValueChange={(value) => { setIsEncrypted(value === 'all' ? '' : value); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Encryption Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {filterOptions?.encryptionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedDevices.size > 0 && (
        <Card className="bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {selectedDevices.size} device{selectedDevices.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Selected
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedDevices(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {devices.length > 0 ? ((page - 1) * pageSize) + 1 : 0} to {Math.min(page * pageSize, totalCount)} of {totalCount} devices
        </p>
        <Button variant="outline" size="sm" onClick={exportToCsv} disabled={devices.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
      </div>

      {/* Device Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('deviceName')}>
                <div className="flex items-center gap-1">
                  Device Name
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('manufacturer')}>
                <div className="flex items-center gap-1">
                  Manufacturer
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('operatingSystem')}>
                <div className="flex items-center gap-1">
                  OS
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('lastSyncAt')}>
                <div className="flex items-center gap-1">
                  Last Sync
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No devices found. Try adjusting your filters.
                </TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDevices.has(device.id)}
                      onCheckedChange={(checked: boolean) => handleSelectDevice(device.id, checked)}
                      aria-label={`Select ${device.deviceName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      {device.deviceName}
                    </div>
                  </TableCell>
                  <TableCell>{device.manufacturer}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{device.model}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{device.operatingSystem}</div>
                      <div className="text-muted-foreground text-xs">{device.osVersion}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={device.isCompliant ? 'default' : 'destructive'} className="w-fit">
                        {device.isCompliant ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {device.isCompliant ? 'Compliant' : 'Non-Compliant'}
                      </Badge>
                      {device.isEncrypted && (
                        <Badge variant="secondary" className="w-fit">
                          <Shield className="h-3 w-3 mr-1" />
                          Encrypted
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm max-w-[150px]">
                      <div className="truncate">{device.userDisplayName || device.userPrincipalName || 'Unassigned'}</div>
                      {device.userPrincipalName && (
                        <div className="text-muted-foreground text-xs truncate">{device.userPrincipalName}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => router.push(`/devices/${device.id}`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>Sync Device</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Copy Device ID</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage(page - 1); }}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage(page + 1); }}
              disabled={page === totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeviceInventoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <DeviceInventoryContent />
    </Suspense>
  );
}
