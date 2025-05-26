// dashboard/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { REST } from '@discordjs/rest';
import { Routes, APIUserGuild } from 'discord-api-types/v10';
import discordService from '@/lib/discordService';
import db from '@/lib/database';

// These should be configured in your .env file
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;

if (!TARGET_GUILD_ID) {
  console.error("FATAL: TARGET_GUILD_ID environment variable is not set.");
  process.exit(1);
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      authorization: { params: { scope: 'identify email guilds' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (!account?.access_token || !TARGET_GUILD_ID) {
        return false;
      }

      try {
        await discordService.initialize(account.access_token);
        const member = await discordService.getGuildMember(TARGET_GUILD_ID, user.id);

        if (!member) {
          console.log(`User ${user.id} denied access: Not a member of guild ${TARGET_GUILD_ID}`);
          return '/auth/error?error=GuildAccess';
        }

        // If REQUIRED_ROLE_ID is set, check for the role. Otherwise, allow any member.
        if (REQUIRED_ROLE_ID && !member.roles.includes(REQUIRED_ROLE_ID)) {
          console.log(`User ${user.id} denied access: Lacks required role ${REQUIRED_ROLE_ID}`);
          return '/auth/error?error=RoleAccess';
        }
        
        // Sync guild info on successful sign-in
        const guildInfo = await discordService.getGuildInfo(TARGET_GUILD_ID);
        if (guildInfo) {
          await db.syncGuild(TARGET_GUILD_ID, guildInfo.name);
        }
        
        return true;
      } catch (error) {
        console.error('Error during sign-in check:', error);
        return '/auth/error?error=ApiError';
      }
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        // profile is a DiscordProfile
        token.id = profile.id;
        token.image = profile.image_url;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as NextAuthUser & { id: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  }
};

export default NextAuth(authOptions);