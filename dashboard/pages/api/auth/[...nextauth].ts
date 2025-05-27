// dashboard/pages/api/auth/[...nextauth].ts - Fixed Database Access
import NextAuth, { NextAuthOptions, Account, Profile as NextAuthProfile, Session } from 'next-auth';
import { User as NextAuthUser } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters';
import DiscordProvider, { DiscordProfile as DiscordOAuthProfile } from 'next-auth/providers/discord';
import { discordService } from '@/lib/discordService';
import databaseEvents, { PrismaInstance as prisma } from '@/lib/database'; // Import prisma directly
import { DiscordProfile, GuildMemberWithRoles } from '@/types/index';
import { JWT } from 'next-auth/jwt';

const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;

if (!TARGET_GUILD_ID) {
  console.error("FATAL: TARGET_GUILD_ID environment variable is not set for NextAuth.");
}

interface SessionUser extends NextAuthUser, Partial<DiscordProfile> {
  id: string;
  hasRequiredAccess?: boolean;
  member?: GuildMemberWithRoles | null;
}

interface TokenUser extends JWT, Partial<DiscordProfile> {
  id?: string;
  accessToken?: string;
  hasRequiredAccess?: boolean;
  member?: GuildMemberWithRoles | null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      authorization: { params: { scope: 'identify email guilds guilds.members.read' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }: { user: NextAuthUser | AdapterUser; account: Account | null; profile?: NextAuthProfile | DiscordOAuthProfile }): Promise<boolean | string> {
      if (!account?.access_token || !TARGET_GUILD_ID) {
        console.warn("[NextAuth SignIn] Missing access_token or TARGET_GUILD_ID");
        return '/auth/error?error=Configuration';
      }

      const discordProfile = profile as DiscordOAuthProfile;

      try {
        // Ensure Discord service is initialized
        if (!discordService.isReady()) {
          console.log("[NextAuth SignIn] Initializing Discord service...");
          await discordService.initialize();
        }

        // Check guild membership
        const member = await discordService.getGuildMember(TARGET_GUILD_ID, discordProfile.id);

        if (!member) {
          console.log(`[NextAuth SignIn] User ${discordProfile.id} denied: Not a member of guild ${TARGET_GUILD_ID}`);
          return `/auth/error?error=GuildAccess&guildName=${TARGET_GUILD_ID}`;
        }

        // Check required role (if specified)
        const hasRequiredRole = REQUIRED_ROLE_ID ? member.roles.cache.has(REQUIRED_ROLE_ID) : true;

        if (!hasRequiredRole) {
          console.log(`[NextAuth SignIn] User ${discordProfile.id} denied: Lacks required role ${REQUIRED_ROLE_ID}`);
          return `/auth/error?error=RoleAccess&roleName=${REQUIRED_ROLE_ID}`;
        }

        // Create or update user in database using prisma directly
        try {
          await prisma.user.upsert({
            where: { id: discordProfile.id },
            update: {
              username: discordProfile.username,
              discriminator: discordProfile.discriminator,
              avatar: discordProfile.avatar,
              email: discordProfile.email,
              lastLogin: new Date(),
              updatedAt: new Date(),
            },
            create: {
              id: discordProfile.id,
              username: discordProfile.username,
              discriminator: discordProfile.discriminator,
              avatar: discordProfile.avatar,
              email: discordProfile.email,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastLogin: new Date(),
            }
          });

          console.log(`[NextAuth SignIn] User ${discordProfile.username} (${discordProfile.id}) authenticated successfully`);
        } catch (dbError) {
          console.error('[NextAuth SignIn] Database error during user upsert:', dbError);
          // Continue authentication even if DB update fails
        }

        // Sync guild information
        try {
          const guildInfo = await discordService.getGuildInfo(TARGET_GUILD_ID);
          if (guildInfo) {
            await databaseEvents.syncGuild(TARGET_GUILD_ID, guildInfo.name);
          }
        } catch (guildError) {
          console.error('[NextAuth SignIn] Error syncing guild:', guildError);
          // Continue authentication even if guild sync fails
        }
        
        // Set user properties for session
        (user as SessionUser).hasRequiredAccess = true;
        (user as SessionUser).member = {
          roles: member.roles.cache.map(role => role.id),
          nick: member.nickname,
          joined_at: member.joinedAt?.toISOString() ?? new Date().toISOString(),
        };

        return true;
      } catch (error) {
        console.error('[NextAuth SignIn] Error during sign-in check:', error);
        return '/auth/error?error=ApiError';
      }
    },

    async jwt({ token, user, account, profile }: { token: JWT; user?: NextAuthUser | AdapterUser; account?: Account | null; profile?: NextAuthProfile | DiscordOAuthProfile }): Promise<JWT> {
      const tokenUser = token as TokenUser;
      const nextAuthUser = user as SessionUser | undefined;

      // Store access token
      if (account?.access_token) {
        tokenUser.accessToken = account.access_token;
      }

      // Store Discord profile information
      if (profile) {
        const discordProfile = profile as DiscordOAuthProfile;
        tokenUser.id = discordProfile.id;
        tokenUser.name = discordProfile.username;
        tokenUser.email = discordProfile.email;
        tokenUser.image = discordProfile.image_url;
        tokenUser.username = discordProfile.username;
        tokenUser.discriminator = discordProfile.discriminator;
        tokenUser.avatar = discordProfile.avatar;
      }

      // Store user session data
      if (nextAuthUser) {
        tokenUser.id = nextAuthUser.id;
        tokenUser.hasRequiredAccess = nextAuthUser.hasRequiredAccess;
        tokenUser.member = nextAuthUser.member;
      }

      return tokenUser;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const sessionUser = session.user as SessionUser;
      const tokenData = token as TokenUser;

      if (sessionUser && tokenData) {
        sessionUser.id = tokenData.id || sessionUser.id;
        sessionUser.username = tokenData.username || sessionUser.username;
        sessionUser.discriminator = tokenData.discriminator || sessionUser.discriminator;
        sessionUser.avatar = tokenData.avatar || sessionUser.avatar;
        sessionUser.hasRequiredAccess = tokenData.hasRequiredAccess;
        sessionUser.member = tokenData.member;
      }

      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);