<<<<<<< HEAD
// dashboard/pages/api/auth/[...nextauth].ts - Fixed NextAuth Configuration
import NextAuth, { NextAuthOptions, User as NextAuthUser, Account, Profile as NextAuthProfile } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters';
import DiscordProvider, { DiscordProfile as DiscordOAuthProfile } from 'next-auth/providers/discord';
import { discordService } from '../../../lib/discordService';
import db from '../../../lib/database';
import { DiscordProfile, GuildMemberWithRoles } from '../../../types';
=======
// dashboard/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions, User as NextAuthUser, Account, Profile as NextAuthProfile } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters'; // Import AdapterUser
import DiscordProvider, { DiscordProfile as DiscordOAuthProfile } from 'next-auth/providers/discord'; // DiscordProfile from provider
import discordService from '@/lib/discordService';
import db from '@/lib/database'; // Assuming db is your Prisma client instance
import { DiscordProfile, GuildMemberWithRoles } from '@/types/index'; // Your extended DiscordProfile
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
import { JWT } from 'next-auth/jwt';

const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;

if (!TARGET_GUILD_ID) {
  console.error("FATAL: TARGET_GUILD_ID environment variable is not set for NextAuth.");
<<<<<<< HEAD
}

=======
  // Depending on your setup, you might want to throw an error or handle this differently
  // For now, we'll log and proceed, but auth will likely fail for guild checks.
}

// Define the shape of the user object you want in the session
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
interface SessionUser extends NextAuthUser, Partial<DiscordProfile> {
  id: string;
  hasRequiredAccess?: boolean;
  member?: GuildMemberWithRoles | null;
<<<<<<< HEAD
}

interface TokenUser extends JWT, Partial<DiscordProfile> {
  id?: string;
=======
  // Add any other custom fields you expect on session.user
}

// Define the shape of the token object
interface TokenUser extends JWT, Partial<DiscordProfile> {
  id?: string; // id should be on JWT if you're using it to populate session
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
  accessToken?: string;
  hasRequiredAccess?: boolean;
  member?: GuildMemberWithRoles | null;
}
<<<<<<< HEAD
=======

>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
<<<<<<< HEAD
      authorization: { params: { scope: 'identify email guilds guilds.members.read' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }): Promise<boolean | string> {
      if (!account?.access_token || !TARGET_GUILD_ID) {
        console.warn("[NextAuth SignIn] Missing access_token or TARGET_GUILD_ID");
        return '/auth/error?error=Configuration';
      }

      const discordProfile = profile as DiscordOAuthProfile;

      try {
        // Initialize Discord service with bot token
        if (!discordService.isReady()) {
          await discordService.initialize();
        }

=======
      authorization: { params: { scope: 'identify email guilds guilds.members.read' } }, // Added guilds.members.read
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET, // Ensure this is set
  callbacks: {
    async signIn({ user, account, profile }: { user: NextAuthUser | AdapterUser; account: Account | null; profile?: NextAuthProfile | DiscordOAuthProfile }): Promise<boolean | string> {
      if (!account?.access_token || !TARGET_GUILD_ID) {
        console.warn("[NextAuth SignIn] Missing access_token or TARGET_GUILD_ID");
        return '/auth/error?error=Configuration'; // Redirect to error page
      }

      const discordProfile = profile as DiscordOAuthProfile; // Cast to DiscordProfile provided by the DiscordProvider

      try {
        // Initialize discordService with user's access token for specific guild member checks
        // This is temporary for this callback. The bot itself uses its own token.
        // await discordService.initialize(account.access_token); // Pass token if needed for user-context operations
        // For checking roles, it's better to use the BOT's token if the dashboard doesn't require user-specific API calls to Discord beyond profile/guild list.
        // Assuming discordService is initialized elsewhere with the bot token for privileged operations.
        // If not, and you NEED to use user's token, initialize it here.
        // However, for role checks, it's common to use the bot's elevated permissions.

        // Ensure discordService (using bot token) is initialized
        if (!discordService.isReady()) {
            await discordService.initialize(); // Initialize with bot token
        }


>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        const member = await discordService.getGuildMember(TARGET_GUILD_ID, discordProfile.id);

        if (!member) {
          console.log(`[NextAuth SignIn] User ${discordProfile.id} denied: Not a member of guild ${TARGET_GUILD_ID}`);
<<<<<<< HEAD
          return `/auth/error?error=GuildAccess&guildName=${TARGET_GUILD_ID}`;
=======
          return `/auth/error?error=GuildAccess&guildName=${TARGET_GUILD_ID}`; // Provide more context to error page
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        }

        const hasRequiredRole = REQUIRED_ROLE_ID ? member.roles.cache.has(REQUIRED_ROLE_ID) : true;

        if (!hasRequiredRole) {
          console.log(`[NextAuth SignIn] User ${discordProfile.id} denied: Lacks required role ${REQUIRED_ROLE_ID}`);
          return `/auth/error?error=RoleAccess&roleName=${REQUIRED_ROLE_ID}`;
        }

<<<<<<< HEAD
        // Store/update user in database
        await db.prisma.user.upsert({
          where: { id: discordProfile.id },
          update: {
            username: discordProfile.username,
            discriminator: discordProfile.discriminator,
            avatar: discordProfile.avatar,
            email: discordProfile.email,
            lastLogin: new Date(),
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

        // Sync guild info
=======
        // Store/update user and their guild-specific info in your database
        await db.user.upsert({
            where: { id: discordProfile.id },
            update: {
                username: discordProfile.username,
                discriminator: discordProfile.discriminator,
                avatar: discordProfile.avatar,
                email: discordProfile.email, // Make sure email scope is requested if needed
                lastLogin: new Date(),
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

        // Sync guild info on successful sign-in (if bot is in the guild)
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        const guildInfo = await discordService.getGuildInfo(TARGET_GUILD_ID);
        if (guildInfo) {
          await db.syncGuild(TARGET_GUILD_ID, guildInfo.name);
        }
<<<<<<< HEAD

        // Add custom properties to user object
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

    async jwt({ token, user, account, profile }): Promise<JWT> {
      const tokenUser = token as TokenUser;
      const nextAuthUser = user as SessionUser | undefined;

      if (account) {
        tokenUser.accessToken = account.access_token;
      }

      if (profile) {
        const discordProfile = profile as DiscordOAuthProfile;
        tokenUser.id = discordProfile.id;
        tokenUser.name = discordProfile.username;
        tokenUser.email = discordProfile.email;
        tokenUser.image = discordProfile.image_url;
=======
        
        // Add custom property to user object to be available in JWT and session
        (user as SessionUser).hasRequiredAccess = true;
        (user as SessionUser).member = { // Store relevant member info
            roles: member.roles.cache.map(role => role.id),
            nick: member.nickname,
            joined_at: member.joinedAt?.toISOString() ?? new Date().toISOString(),
        };


        return true; // Allow sign in
      } catch (error) {
        console.error('[NextAuth SignIn] Error during sign-in check:', error);
        return '/auth/error?error=ApiError'; // Generic API error
      }
    },

    async jwt({ token, user, account, profile }: { token: JWT; user?: NextAuthUser | AdapterUser; account?: Account | null; profile?: NextAuthProfile | DiscordOAuthProfile }): Promise<JWT> {
      const tokenUser = token as TokenUser; // Cast token
      const nextAuthUser = user as SessionUser | undefined; // Cast user

      if (account) { // On successful sign-in
        tokenUser.accessToken = account.access_token;
      }
      if (profile) { // The profile from Discord OAuth
        const discordProfile = profile as DiscordOAuthProfile;
        tokenUser.id = discordProfile.id;
        tokenUser.name = discordProfile.username; // Or often `discordProfile.global_name || discordProfile.username`
        tokenUser.email = discordProfile.email;
        tokenUser.image = discordProfile.image_url; // Usually a direct URL
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        tokenUser.username = discordProfile.username;
        tokenUser.discriminator = discordProfile.discriminator;
        tokenUser.avatar = discordProfile.avatar;
      }
<<<<<<< HEAD

      if (nextAuthUser) {
=======
       if (nextAuthUser) { // If user object is passed (e.g., on sign-in)
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        tokenUser.id = nextAuthUser.id;
        tokenUser.hasRequiredAccess = nextAuthUser.hasRequiredAccess;
        tokenUser.member = nextAuthUser.member;
      }
<<<<<<< HEAD

      return tokenUser;
    },

    async session({ session, token }): Promise<any> {
      const sessionUser = session.user as SessionUser;
      const tokenData = token as TokenUser;

      if (sessionUser) {
        sessionUser.id = tokenData.id || sessionUser.id;
=======
      return tokenUser;
    },

    async session({ session, token }: { session: any; token: JWT }): Promise<any> { // Use `any` for session for now, or define a strict Session type
      const sessionUser = session.user as SessionUser; // Cast session.user
      const tokenData = token as TokenUser; // Cast token

      if (sessionUser) {
        sessionUser.id = tokenData.id || sessionUser.id; // Ensure ID is set
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
        sessionUser.username = tokenData.username || sessionUser.username;
        sessionUser.discriminator = tokenData.discriminator || sessionUser.discriminator;
        sessionUser.avatar = tokenData.avatar || sessionUser.avatar;
        sessionUser.hasRequiredAccess = tokenData.hasRequiredAccess;
        sessionUser.member = tokenData.member;
<<<<<<< HEAD
      }

=======
        // Do NOT expose accessToken to the client-side session object for security reasons
      }
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
<<<<<<< HEAD
    error: '/auth/error',
  },
=======
    error: '/auth/error', // Custom error page
  },
  // Add debug option for development
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);