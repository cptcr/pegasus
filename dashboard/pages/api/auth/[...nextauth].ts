// dashboard/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions, Session } from 'next-auth';
import { JWT } from "next-auth/jwt";
import DiscordProvider from 'next-auth/providers/discord';

// Use environment variables instead of hardcoded values
const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID!;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;

// Extended types for Discord
interface DiscordProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  email?: string;
  verified?: boolean;
}

interface ExtendedToken extends JWT {
  accessToken?: string;
  id?: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
}

// Extend Session and JWT interfaces
declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string;
      username?: string;
      discriminator?: string;
      avatar?: string;
      guilds?: any[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds',
        },
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, account, profile }): Promise<ExtendedToken> {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.id = (profile as DiscordProfile).id;
        token.username = (profile as DiscordProfile).username;
        token.discriminator = (profile as DiscordProfile).discriminator;
        token.avatar = (profile as DiscordProfile).avatar;
      }
      return token;
    },
    
    async session({ session, token }): Promise<Session> {
      if (token.accessToken) {
        // Fetch user's guilds from Discord API
        try {
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          });

          const guilds = guildsResponse.ok ? await guildsResponse.json() : [];

          session.user = {
            ...session.user,
            id: token.id,
            username: token.username,
            discriminator: token.discriminator,
            avatar: token.avatar,
            guilds: guilds.filter((guild: any) => guild.id === ALLOWED_GUILD_ID),
          };
        } catch (error) {
          console.error('Failed to fetch user guilds:', error);
          session.user = {
            ...session.user,
            id: token.id,
            username: token.username,
            discriminator: token.discriminator,
            avatar: token.avatar,
            guilds: [],
          };
        }
      }

      return session;
    },

    async signIn({ user, account, profile }) {
      // Only allow the specific admin user
      if ((profile as DiscordProfile).id !== ADMIN_USER_ID) {
        console.log(`Access denied for user ${(profile as DiscordProfile).id} (${(profile as DiscordProfile).username})`);
        return false;
      }

      // Additional check: verify user has access to the target guild
      try {
        if (account?.access_token) {
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          });

          if (guildsResponse.ok) {
            const guilds = await guildsResponse.json();
            const hasAccess = guilds.some((guild: any) => guild.id === ALLOWED_GUILD_ID);
            
            if (!hasAccess) {
              console.log(`User ${(profile as DiscordProfile).username} does not have access to required guild`);
              return false;
            }
          }
        }
      } catch (error) {
        console.error('Error checking guild access:', error);
        return false;
      }

      return true;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);