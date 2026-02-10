'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SignInButtonProps {
  provider: 'azure-ad' | 'credentials';
  children: React.ReactNode;
  className?: string;
}

export function SignInButton({ provider, children, className }: SignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Sign in error:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      className={className}
      variant={provider === 'azure-ad' ? 'default' : 'outline'}
      size="lg"
    >
      {isLoading ? 'Signing in...' : children}
    </Button>
  );
}
