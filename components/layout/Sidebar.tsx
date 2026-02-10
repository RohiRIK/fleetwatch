'use client';

import Image from 'next/image';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  HardDrive,
  Shield,
  Users,
  Settings,
  BarChart3,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Devices', href: '/inventory', icon: HardDrive },
  { name: 'Compliance', href: '/compliance', icon: Shield },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Monitoring', href: '/admin/monitoring', icon: Activity, requiresSuperadmin: true },
];

export function Sidebar({ isSuperadmin = false }: { isSuperadmin?: boolean }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="shadow-lg"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border shadow-sm transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-sidebar-border px-6 bg-gradient-to-r from-primary/5 to-accent/5">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg group-hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.png"
                  alt="FleetWatch Logo"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent">FleetWatch</span>
                <p className="text-[10px] text-muted-foreground font-medium">v1.0</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-6">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5'
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <div className="w-1 h-4 bg-primary-foreground/50 rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* Admin Navigation */}
            {isSuperadmin && (
              <>
                <div className="my-4 border-t border-sidebar-border/50" />
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </div>
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5'
                      )}
                    >
                      <item.icon className={cn(
                        "h-5 w-5 flex-shrink-0",
                        isActive ? "text-primary-foreground" : "text-muted-foreground"
                      )} />
                      <span className="flex-1">{item.name}</span>
                      {isActive && (
                        <div className="w-1 h-4 bg-primary-foreground/50 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-4 bg-muted/30">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-sidebar-foreground">Device Inventory</p>
              <p className="text-[10px]">Microsoft Intune Integration</p>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-sidebar-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px]">System Active</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
