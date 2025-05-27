// dashboard/types/next-auth.d.ts - NextAuth Module Augmentation
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string;
      discriminator?: string;
      avatar?: string | null;
      hasRequiredAccess?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string;
    discriminator?: string;
    avatar?: string | null;
    hasRequiredAccess?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string | null;
    hasRequiredAccess?: boolean;
    accessToken?: string;
  }
}