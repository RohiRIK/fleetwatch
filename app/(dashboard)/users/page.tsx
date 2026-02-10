'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Users as UsersIcon, RefreshCw } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  azureId: string | null;
  image: string | null;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Filters {
  departments: string[];
  jobTitles: string[];
}

function UsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<Filters>({ departments: [], jobTitles: [] });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0,
  });
  
  // Get filter values from URL
  const search = searchParams.get('search') || '';
  const department = searchParams.get('department') || '';
  const jobTitle = searchParams.get('jobTitle') || '';
  const hasDevices = searchParams.get('hasDevices') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const page = parseInt(searchParams.get('page') || '1');
  
  // Fetch filters on mount
  useEffect(() => {
    fetchFilters();
  }, []);
  
  // Fetch users when URL params change
  useEffect(() => {
    fetchUsers();
  }, [search, department, jobTitle, hasDevices, sortBy, sortOrder, page]);
  
  const fetchFilters = async () => {
    try {
      const response = await fetch('/api/users/filters');
      const data = await response.json();
      setFilters(data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };
  
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (department) params.append('department', department);
      if (jobTitle) params.append('jobTitle', jobTitle);
      if (hasDevices) params.append('hasDevices', hasDevices);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      params.append('page', page.toString());
      params.append('pageSize', '20');
      
      const response = await fetch(`/api/users?${params.toString()}`);
      const data = await response.json();
      
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const updateSearchParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    // Reset to page 1 when filters change
    if (Object.keys(updates).some(key => key !== 'page' && key !== 'sortBy' && key !== 'sortOrder')) {
      params.set('page', '1');
    }
    
    router.push(`/users?${params.toString()}`);
  };
  
  const handleSort = (column: string) => {
    const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    updateSearchParams({ sortBy: column, sortOrder: newSortOrder });
  };
  
  const clearFilters = () => {
    router.push('/users');
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage users and view their device assignments
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.totalCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filters.departments.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Job Titles</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filters.jobTitles.length}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Find users by name, email, department, or job title
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => updateSearchParams({ search: e.target.value })}
                className="pl-8"
              />
            </div>
            
            {/* Department Filter */}
            <Select
              value={department}
              onValueChange={(value) => updateSearchParams({ department: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {filters.departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Job Title Filter */}
            <Select
              value={jobTitle}
              onValueChange={(value) => updateSearchParams({ jobTitle: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Job Title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Titles</SelectItem>
                {filters.jobTitles.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Has Devices Filter */}
            <Select
              value={hasDevices}
              onValueChange={(value) => updateSearchParams({ hasDevices: value === 'all' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Device Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="true">Has Devices</SelectItem>
                <SelectItem value="false">No Devices</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(search || department || jobTitle || hasDevices) && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Users ({pagination.totalCount})
          </CardTitle>
          <CardDescription>
            Page {pagination.page} of {pagination.totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your criteria
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                        Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('email')}>
                        Email {sortBy === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('department')}>
                        Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('jobTitle')}>
                        Job Title {sortBy === 'jobTitle' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort('deviceCount')}>
                        Devices {sortBy === 'deviceCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div className="font-medium">{user.name}</div>
                          {user.displayName && user.displayName !== user.name && (
                            <div className="text-sm text-muted-foreground">{user.displayName}</div>
                          )}
                        </td>
                        <td className="p-4 text-sm">{user.email}</td>
                        <td className="p-4 text-sm">
                          {user.department || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-4 text-sm">
                          {user.jobTitle || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-4">
                          <Badge variant={user.deviceCount > 0 ? 'default' : 'secondary'}>
                            {user.deviceCount} {user.deviceCount === 1 ? 'device' : 'devices'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Link href={`/users/${user.id}`}>
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {users.length} of {pagination.totalCount} users
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => updateSearchParams({ page: (page - 1).toString() })}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateSearchParams({ page: (page + 1).toString() })}
                    disabled={page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <UsersContent />
    </Suspense>
  );
}
