import { SignInButton } from '@/components/auth/SignInButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-sky-500 to-cyan-500 bg-clip-text text-transparent">
            FleetWatch
          </CardTitle>
          <CardDescription>
            Enterprise device fleet management powered by Microsoft Intune
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignInButton provider="azure-ad" className="w-full">
            <svg
              className="mr-2 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 23 23"
              fill="currentColor"
            >
              <path d="M11.03.284l-.292-.003a10.9 10.9 0 0 0-9.935 8.99 10.9 10.9 0 0 0 8.99 12.617c.83.17 1.675.257 2.522.257A10.9 10.9 0 0 0 19.9 17.7l.284-.332-.844-2.94a7.97 7.97 0 0 1-7.006 4.065 7.97 7.97 0 0 1-7.97-7.97 7.97 7.97 0 0 1 7.17-7.94l.8-.08v3.015l6.035-4.56-6.035-4.645V.285z" />
            </svg>
            Sign in with Microsoft
          </SignInButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Link href="/admin-login" className="w-full block">
            <Button variant="outline" className="w-full">
              Emergency Admin Login
            </Button>
          </Link>

          <p className="px-8 text-center text-xs text-muted-foreground">
            Emergency admin login should only be used when Azure AD is unavailable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
