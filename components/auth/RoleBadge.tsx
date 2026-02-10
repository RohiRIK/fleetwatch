/**
 * User Role Badge Component
 * Displays and allows editing user roles (SUPERADMIN only)
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, ShieldCheck, Eye } from 'lucide-react';

type UserRole = 'VIEWER' | 'ADMIN' | 'SUPERADMIN';

interface RoleBadgeProps {
  userId: string;
  currentRole: UserRole;
  userEmail: string;
  editable?: boolean;
  onRoleChange?: (newRole: UserRole) => void;
}

const ROLE_CONFIG = {
  VIEWER: {
    label: 'Viewer',
    icon: Eye,
    variant: 'secondary' as const,
    description: 'Read-only access',
  },
  ADMIN: {
    label: 'Admin',
    icon: Shield,
    variant: 'default' as const,
    description: 'Full management access',
  },
  SUPERADMIN: {
    label: 'Superadmin',
    icon: ShieldCheck,
    variant: 'destructive' as const,
    description: 'System administrator',
  },
};

export function RoleBadge({
  userId,
  currentRole,
  userEmail,
  editable = false,
  onRoleChange,
}: RoleBadgeProps) {
  const [role, setRole] = useState<UserRole>(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);

  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === role) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      setRole(newRole);
      onRoleChange?.(newRole);

      // Simple alert for now - can be replaced with a toast system later
      alert(`Role updated: ${userEmail} is now a ${ROLE_CONFIG[newRole].label}`);
    } catch (error) {
      // Simple alert for errors - can be replaced with a toast system later
      alert(
        `Error: ${error instanceof Error ? error.message : 'Failed to update role'}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  if (!editable) {
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  return (
    <Select
      value={role}
      onValueChange={(value) => handleRoleChange(value as UserRole)}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-[150px] h-8">
        <SelectValue>
          <div className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ROLE_CONFIG).map(([roleKey, roleConfig]) => (
          <SelectItem key={roleKey} value={roleKey}>
            <div className="flex items-center gap-2">
              <roleConfig.icon className="h-4 w-4" />
              <div>
                <div className="font-medium">{roleConfig.label}</div>
                <div className="text-xs text-muted-foreground">
                  {roleConfig.description}
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
