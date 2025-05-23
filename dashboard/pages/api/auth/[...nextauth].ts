// dashboard/pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions, Session } from 'next-auth';
import { JWT } from "next-auth/jwt";
import DiscordProvider from 'next-auth/providers/discord';

// Your specific requirements
const TARGET_GUILD_ID = '554266392262737930';
const REQUIRED_ROLE_ID = '797927858420187186';

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
  permissions: string;
  features: string[];
}

interface GuildMember {
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
  };
  roles: string[];
  nick?: string;
  joined_at: string;
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
      hasRequiredAccess?: boolean;
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
          scope: 'identify guilds guilds.members.read',
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

      session.user.hasRequiredAccess = false; 

      if (token.accessToken && session.user.id) {
        try {
          // First, check if user is in the guild
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          });
          
          if (guildsResponse.ok) {
            const allUserGuilds: UserGuild[] = await guildsResponse.json();
            const targetGuild = allUserGuilds.find(g => g.id === TARGET_GUILD_ID);

            if (targetGuild) {
              session.user.guilds = [targetGuild];

              // Now check if user has the required role in that guild
              try {
                const memberResponse = await fetch(
                  `https://discord.com/api/users/@me/guilds/${TARGET_GUILD_ID}/member`,
                  {
                    headers: { Authorization: `Bearer ${token.accessToken}` },
                  }
                );

                if (memberResponse.ok) {
                  const memberData: GuildMember = await memberResponse.json();
                  
                  // Check if user has the required role
                  if (memberData.roles.includes(REQUIRED_ROLE_ID)) {
                    session.user.hasRequiredAccess = true;
                    console.log(`✅ Access granted for user ${session.user.username} - has required role`);
                  } else {
                    console.log(`❌ Access denied for user ${session.user.username} - missing required role ${REQUIRED_ROLE_ID}`);
                    console.log(`User roles:`, memberData.roles);
                  }
                } else {
                  console.log(`❌ Failed to fetch member data for user ${session.user.username} in guild ${TARGET_GUILD_ID}`);
                }
              } catch (memberError) {
                console.error('Error fetching guild member data:', memberError);
              }
            } else {
              console.log(`❌ User ${session.user.username} not in target guild ${TARGET_GUILD_ID}`);
              session.user.guilds = [];
            }
          } else {
            console.error(`Session callback: Failed to fetch guilds. Status: ${guildsResponse.status}`);
            session.user.guilds = [];
          }
        } catch (error) {
          console.error('Session callback - Error fetching user data:', error);
          session.user.guilds = [];
          session.user.hasRequiredAccess = false;
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

      console.log(`SignIn: Attempting login for user ${discordProfile.username} (${discordProfile.id})`);
      console.log(`Required: Guild ${TARGET_GUILD_ID} and Role ${REQUIRED_ROLE_ID}`);

      try {
        // Check if user is in the target guild
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!guildsResponse.ok) {
          console.log(`SignIn: Failed to fetch guilds. Status: ${guildsResponse.status}`);
          return false;
        }
        
        const guilds: UserGuild[] = await guildsResponse.json();
        const targetUserGuild = guilds.find(guild => guild.id === TARGET_GUILD_ID);

        if (!targetUserGuild) {
          console.log(`SignIn: User ${discordProfile.username} NOT in target guild ${TARGET_GUILD_ID}`);
          return false;
        }

        console.log(`SignIn: User ${discordProfile.username} IS in target guild ${TARGET_GUILD_ID}`);
        
        // Check if user has required role in the guild
        try {
          const memberResponse = await fetch(
            `https://discord.com/api/users/@me/guilds/${TARGET_GUILD_ID}/member`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!memberResponse.ok) {
            console.log(`SignIn: Failed to fetch member data. Status: ${memberResponse.status}`);
            return false;
          }

          const memberData: GuildMember = await memberResponse.json();
          
          if (memberData.roles.includes(REQUIRED_ROLE_ID)) {
            console.log(`✅ SignIn: Access GRANTED for user ${discordProfile.username} - has required role ${REQUIRED_ROLE_ID}`);
            return true;
          } else {
            console.log(`❌ SignIn: Access DENIED for user ${discordProfile.username} - missing required role ${REQUIRED_ROLE_ID}`);
            console.log(`User roles in guild:`, memberData.roles);
            return false;
          }

        } catch (memberError) {
          console.error('SignIn: Error fetching member data:', memberError);
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
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);