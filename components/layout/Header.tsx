import { UserMenu } from '@/components/auth/UserMenu';
import { auth } from '@/lib/auth/config';

export async function Header() {
  const session = await auth();
  
  if (!session?.user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b bg-background/95 px-6 backdrop-blur">
      <div className="flex items-center gap-4">
        <UserMenu user={session.user} />
      </div>
    </header>
  );
}
