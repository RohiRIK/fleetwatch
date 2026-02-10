import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { isSuperadmin } from '@/lib/auth/rbac';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isSuperadmin();
  
  return (
    <div className="flex min-h-screen">
      <Sidebar isSuperadmin={isAdmin} />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
