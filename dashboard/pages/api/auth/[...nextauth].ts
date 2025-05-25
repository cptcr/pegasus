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
  hasRequiredAccess?: boolean;
  lastValidated?: number;
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
    hasRequiredAccess?: boolean;
    lastValidated?: number;
  }
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return false;
  }
  
  if (userLimit.count >= 3) { // Max 3 requests per minute
    return true;
  }
  
  userLimit.count++;
  return false;
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '1');
        console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries - 1) break;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  throw lastError!;
}

async function validateUserAccess(accessToken: string, userId: string): Promise<boolean> {
  try {
    // Check rate limiting
    if (isRateLimited(userId)) {
      console.log(`Rate limited for user ${userId}, using cached result`);
      return false;
    }

    // First, check if user is in the target guild
    const guildsResponse = await fetchWithRetry('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!guildsResponse.ok) {
      console.log(`Failed to fetch guilds for user ${userId}. Status: ${guildsResponse.status}`);
      return false;
    }
    
    const guilds: UserGuild[] = await guildsResponse.json();
    const targetGuild = guilds.find(guild => guild.id === TARGET_GUILD_ID);

    if (!targetGuild) {
      console.log(`User ${userId} NOT in target guild ${TARGET_GUILD_ID}`);
      return false;
    }

    console.log(`User ${userId} IS in target guild ${TARGET_GUILD_ID}`);
    
    // Check if user has required role in the guild
    try {
      const memberResponse = await fetchWithRetry(
        `https://discord.com/api/users/@me/guilds/${TARGET_GUILD_ID}/member`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!memberResponse.ok) {
        console.log(`Failed to fetch member data for user ${userId}. Status: ${memberResponse.status}`);
        
        // If we can't verify the role but they're in the guild, we'll deny access for security
        return false;
      }

      const memberData: GuildMember = await memberResponse.json();
      
      const hasRole = memberData.roles.includes(REQUIRED_ROLE_ID);
      console.log(`User ${userId} role check: ${hasRole ? 'HAS' : 'MISSING'} required role ${REQUIRED_ROLE_ID}`);
      
      return hasRole;

    } catch (memberError) {
      console.error(`Error fetching member data for user ${userId}:`, memberError);
      return false;
    }

  } catch (error) {
    console.error(`Error validating access for user ${userId}:`, error);
    return false;
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
        token.hasRequiredAccess = false;
        token.lastValidated = 0;
      }

      // Only re-validate if it's been more than 5 minutes since last validation
      const now = Date.now();
      const shouldValidate = !token.lastValidated || (now - token.lastValidated) > 300000; // 5 minutes

      if (token.accessToken && token.id && shouldValidate) {
        try {
          const hasAccess = await validateUserAccess(token.accessToken, token.id);
          token.hasRequiredAccess = hasAccess;
          token.lastValidated = now;
          
          if (hasAccess) {
            console.log(`✅ Access validated for user ${token.username}`);
          } else {
            console.log(`❌ Access denied for user ${token.username}`);
          }
        } catch (error) {
          console.error('Error during token validation:', error);
          // Keep existing access status on error to avoid disrupting existing sessions
        }
      }

      return token;
    },
    
    async session({ session, token }): Promise<Session> {
      if (token.id) session.user.id = token.id;
      if (token.username) session.user.username = token.username;
      if (token.discriminator) session.user.discriminator = token.discriminator;
      if (token.avatar) session.user.avatar = token.avatar;
      if (token.accessToken) session.accessToken = token.accessToken;

      // Use cached validation result
      session.user.hasRequiredAccess = token.hasRequiredAccess || false;

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
        const hasAccess = await validateUserAccess(accessToken, discordProfile.id);
        
        if (hasAccess) {
          console.log(`✅ SignIn: Access GRANTED for user ${discordProfile.username}`);
          return true;
        } else {
          console.log(`❌ SignIn: Access DENIED for user ${discordProfile.username}`);
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

  // Add custom error handling
  events: {
    async signIn(message) {
      console.log('SignIn event:', message.user.email || message.user.name);
    },
    async session(message) {
      // Only log if there's an issue
      if (!message.session.user?.hasRequiredAccess) {
        console.log('Session event: User without required access');
      }
    },
    async signOut(message) {
      console.log('SignOut event:', message.token?.email || 'Unknown user');
    },
  },
};

export default NextAuth(authOptions);