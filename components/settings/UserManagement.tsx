'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ExternalLink, Users } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  deviceCount: number;
}

/**
 * UserManagement Component
 * 
 * Displays FleetWatch users with their roles.
 * Links to the full users page for detailed management.
 */
export function UserManagement() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users?pageSize=10&sortBy=name&sortOrder=asc');
      
      // If API is not available, show empty state
      if (!response.ok) {
        console.warn('Users API not available');
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.warn('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return 'destructive';
      case 'ADMIN':
        return 'default';
      default:
        return 'secondary';
    }
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
      {/* Info Section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Showing {users.length} recent users. Visit the users page for full management capabilities.
          </p>
        </div>
        <Link href="/users">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Manage All Users
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Users Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Devices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{user.deviceCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Role Descriptions */}
      <div className="pt-4 border-t">
        <h3 className="text-sm font-semibold mb-2">Role Descriptions</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="mt-0.5">SUPERADMIN</Badge>
            <span>Full system access including settings, user management, and all operations</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="default" className="mt-0.5">ADMIN</Badge>
            <span>Access to devices, users, analytics, and compliance (no settings access)</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="mt-0.5">USER</Badge>
            <span>Read-only access to devices and basic information</span>
          </div>
        </div>
      </div>
    </div>
  );
}
