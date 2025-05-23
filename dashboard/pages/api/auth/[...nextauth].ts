// dashboard/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions, Session } from 'next-auth';
import { JWT } from "next-auth/jwt";
import DiscordProvider from 'next-auth/providers/discord';

// Define your target guild and required permission
const TARGET_GUILD_ID = '554266392262737930'; // As per your requirement

// Explicitly define permission bits for clarity
const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 1 << 0,
  KICK_MEMBERS: 1 << 1,
  BAN_MEMBERS: 1 << 2,
  ADMINISTRATOR: 1 << 3,
  MANAGE_CHANNELS: 1 << 4,
  MANAGE_GUILD: 1 << 5,
  ADD_REACTIONS: 1 << 6,
  VIEW_AUDIT_LOG: 1 << 7,
  PRIORITY_SPEAKER: 1 << 8,
  STREAM: 1 << 9,
  VIEW_CHANNEL: 1 << 10,
  SEND_MESSAGES: 1 << 11,
  SEND_TTS_MESSAGES: 1 << 12,
  MANAGE_MESSAGES: 1 << 13,
  EMBED_LINKS: 1 << 14,
  ATTACH_FILES: 1 << 15,
  READ_MESSAGE_HISTORY: 1 << 16,
  MENTION_EVERYONE: 1 << 17,
  USE_EXTERNAL_EMOJIS: 1 << 18,
  VIEW_GUILD_INSIGHTS: 1 << 19,
  CONNECT: 1 << 20,
  SPEAK: 1 << 21,
  MUTE_MEMBERS: 1 << 22,
  DEAFEN_MEMBERS: 1 << 23,
  MOVE_MEMBERS: 1 << 24,
  USE_VAD: 1 << 25,
  CHANGE_NICKNAME: 1 << 26,
  MANAGE_NICKNAMES: 1 << 27,
  MANAGE_ROLES: 1 << 28,
  MANAGE_WEBHOOKS: 1 << 29,
  MANAGE_GUILD_EXPRESSIONS: 1 << 30, // MANAGE_EMOJIS_AND_STICKERS previously
  USE_APPLICATION_COMMANDS: 1 << 31,
  REQUEST_TO_SPEAK: 1 << 32,
  MANAGE_EVENTS: 1 << 33,
  MANAGE_THREADS: 1 << 34,
  CREATE_PUBLIC_THREADS: 1 << 35,
  CREATE_PRIVATE_THREADS: 1 << 36,
  USE_EXTERNAL_STICKERS: 1 << 37,
  SEND_MESSAGES_IN_THREADS: 1 << 38,
  USE_EMBEDDED_ACTIVITIES: 1 << 39, // START_EMBEDDED_ACTIVITIES previously
  MODERATE_MEMBERS: 1 << 40, // Timeout members
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1 << 41,
  USE_SOUNDBOARD: 1 << 42,
  CREATE_GUILD_EXPRESSIONS: 1 << 43,
  CREATE_EVENTS: 1 << 44,
  USE_EXTERNAL_SOUNDS: 1 << 45,
  SEND_VOICE_MESSAGES: 1 << 46,
};

// Set REQUIRED_PERMISSION_BIT to KICK_MEMBERS for "Manage Members"
const REQUIRED_PERMISSION_NAME = "KICK_MEMBERS";
const REQUIRED_PERMISSION_BIT = PERMISSIONS.KICK_MEMBERS; // This is (1 << 1) = 2

interface DiscordProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  email?: string;
  verified?: boolean;
}

interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string; // Permissions bitmask as a string
  features: string[];
}

interface ExtendedToken extends JWT {
  accessToken?: string;
  id?: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
}

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
      guilds?: UserGuild[];
      hasRequiredPermission?: boolean;
    };
    accessToken?: string;
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
          scope: 'identify guilds', // Sufficient for this check.ts]
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
      if (token.id) session.user.id = token.id;
      if (token.username) session.user.username = token.username;
      if (token.discriminator) session.user.discriminator = token.discriminator;
      if (token.avatar) session.user.avatar = token.avatar;
      if (token.accessToken) session.accessToken = token.accessToken;

      session.user.hasRequiredPermission = false; 

      if (token.accessToken && session.user.id) {
        try {
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          });
          
          if (guildsResponse.ok) {
            const allUserGuilds: UserGuild[] = await guildsResponse.json();
            const targetGuild = allUserGuilds.find(g => g.id === TARGET_GUILD_ID);

            if (targetGuild) {
              session.user.guilds = [targetGuild];
              const permissionsValue = BigInt(targetGuild.permissions);
              if ((permissionsValue & BigInt(REQUIRED_PERMISSION_BIT)) !== 0n) {
                session.user.hasRequiredPermission = true;
              }
            } else {
              session.user.guilds = [];
            }
          } else {
            console.error(`Session callback: Failed to fetch guilds. Status: ${guildsResponse.status}`);
            session.user.guilds = [];
          }
        } catch (error) {
          console.error('Session callback - Error fetching user guilds:', error);
          session.user.guilds = [];
          session.user.hasRequiredPermission = false;
        }
      }
      return session;
    },

    async signIn({ account, profile }) {
      if (!account?.access_token || !profile) {
        console.log("SignIn: Missing account or profile information.");
        return false;
      }

      const discordProfile = profile as DiscordProfile;
      const accessToken = account.access_token;

      console.log(`SignIn: Attempting login for user ${discordProfile.username} (${discordProfile.id}). Checking for guild ${TARGET_GUILD_ID} and permission bit ${REQUIRED_PERMISSION_BIT} (${REQUIRED_PERMISSION_NAME}).`);

      try {
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!guildsResponse.ok) {
          console.log(`SignIn: Failed to fetch guilds for user ${discordProfile.username}. Status: ${guildsResponse.status}`);
          try {
            const errorText = await guildsResponse.text();
            console.log(`SignIn: Guild fetch error details: ${errorText}`);
          } catch {
            console.log(`SignIn: Guild fetch error details: Could not parse error response.`);
          }
          return false;
        }
        
        const guilds: UserGuild[] = await guildsResponse.json();
        const targetUserGuild = guilds.find(guild => guild.id === TARGET_GUILD_ID);

        if (!targetUserGuild) {
          console.log(`SignIn: User ${discordProfile.username} (${discordProfile.id}) NOT in target guild ${TARGET_GUILD_ID}. Access DENIED.`);
          return false;
        }

        console.log(`SignIn: User ${discordProfile.username} IS in target guild ${TARGET_GUILD_ID}. User's permissions string in this guild: "${targetUserGuild.permissions}".`);
        
        const userPermissionsInGuild = BigInt(targetUserGuild.permissions);
        
        if ((userPermissionsInGuild & BigInt(REQUIRED_PERMISSION_BIT)) !== 0n) {
          console.log(`SignIn: Access GRANTED for user ${discordProfile.username}. Has required permission ${REQUIRED_PERMISSION_NAME} (bit ${REQUIRED_PERMISSION_BIT}). User permissions value: ${userPermissionsInGuild}.`);
          return true;
        } else {
          console.log(`SignIn: Access DENIED for user ${discordProfile.username}. LACKS required permission ${REQUIRED_PERMISSION_NAME} (bit ${REQUIRED_PERMISSION_BIT}). User permissions value: ${userPermissionsInGuild}.`);
          return false;
        }

      } catch (error) {
        console.error('SignIn callback critical error:', error);
        return false;
      }
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error', //.ts]
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);