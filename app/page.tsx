import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function Home() {
  const session = await getSession();
  
  // Redirect to dashboard if authenticated, otherwise to login
  if (session?.user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}

