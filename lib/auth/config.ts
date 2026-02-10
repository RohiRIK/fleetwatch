import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db/drizzle';
import { users, activityLogs } from '@/lib/db/schema';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // No adapter - we'll manually persist users in callbacks
  // This allows both Azure AD (OAuth) and Credentials providers to work together
  
  providers: [
    // PRIMARY: Azure AD OAuth (for regular users)
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
    
    // FALLBACK: Credentials (emergency admin only)
    CredentialsProvider({
      id: 'credentials',
      name: 'Emergency Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Check hardcoded emergency admin from .env
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (
          credentials.email === adminEmail &&
          adminPasswordHash &&
          (await compare(credentials.password as string, adminPasswordHash))
        ) {
          // Find or create admin user
          let adminUser = await db.query.users.findFirst({
            where: eq(users.email, adminEmail),
          });

          if (!adminUser) {
            // Create admin user on first login
            const [newUser] = await db.insert(users).values({
              email: adminEmail,
              name: 'Emergency Admin',
              displayName: 'Emergency Admin',
              passwordHash: adminPasswordHash,
            }).returning();
            
            adminUser = newUser;
          }

          return {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
          };
        }

        return null;
      },
    }),
  ],

  session: {
    strategy: 'jwt', // Use JWT for credentials provider compatibility
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async session({ session, token, user }) {
      // Attach user ID from token (JWT) or user object (database)
      if (session.user) {
        session.user.id = (token?.id || user?.id) as string;
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      try {
        // Handle different provider types
        if (account?.provider === 'credentials') {
          // Credentials login - user was already created in authorize()
          const dbUser = await db.query.users.findFirst({
            where: eq(users.email, user.email as string),
          });
          
          if (dbUser) {
            // Update token with database user ID
            user.id = dbUser.id;
            
            await db.insert(activityLogs).values({
              userId: dbUser.id,
              action: 'LOGIN',
              entityType: 'USER',
              entityId: dbUser.id,
              metadata: {
                provider: 'credentials',
                timestamp: new Date().toISOString(),
              },
            });
          }
        } else if (account?.provider === 'azure-ad') {
          // Azure AD OAuth - manually persist user
          let dbUser = await db.query.users.findFirst({
            where: eq(users.email, user.email as string),
          });
          
          if (!dbUser) {
            // Create new user from Azure AD profile
            const [newUser] = await db.insert(users).values({
              email: user.email as string,
              name: user.name as string,
              displayName: (profile as any)?.displayName || user.name as string,
              azureId: account.providerAccountId,
              emailVerified: null,
              image: user.image,
            }).returning();
            
            dbUser = newUser;
            user.id = newUser.id;
          } else {
            // Update existing user
            await db.update(users)
              .set({
                name: user.name as string,
                displayName: (profile as any)?.displayName || user.name as string,
                azureId: account.providerAccountId,
                image: user.image,
                updatedAt: new Date(),
              })
              .where(eq(users.id, dbUser.id));
            
            user.id = dbUser.id;
          }
          
          // Log activity
          await db.insert(activityLogs).values({
            userId: dbUser.id,
            action: 'LOGIN',
            entityType: 'USER',
            entityId: dbUser.id,
            metadata: {
              provider: 'azure-ad',
              timestamp: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        console.error('[Auth] Failed to persist user or log activity:', error);
        // Don't block login if activity logging fails
      }

      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Called when token is created
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  debug: process.env.NODE_ENV === 'development',
});
