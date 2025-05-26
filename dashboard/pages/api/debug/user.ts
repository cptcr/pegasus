// dashboard/pages/api/debug/user.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { DiscordProfile, GuildMemberWithRoles } from '@/types/index'; // Using defined types

// Define a more specific type for the session user for this debug endpoint
interface DebugSessionUser extends Partial<DiscordProfile> { // Use DiscordProfile for user shape
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string;
  discriminator?: string;
  guilds?: Array<{ // Example structure for guilds, align with what DiscordProvider returns
    id: string;
    name: string;
    icon: string | null;
    permissions?: string; // permissions might be a string bitfield
  }>;
  targetGuild?: { id: string; name: string; icon: string | null; } | null;
  hasRequiredAccess?: boolean;
  member?: GuildMemberWithRoles | null;
}

interface DebugInfo {
  hasSession: boolean;
  user: DebugSessionUser | null;
  expectedUserId: string;
  expectedGuildId: string | undefined; // TARGET_GUILD_ID can be undefined if not set
  timestamp: string;
  // Add any other debug fields you might need
  rawSession?: unknown; // Optionally include raw session for deeper debugging
}


export default async function handler(req: NextApiRequest, res: NextApiResponse<DebugInfo | { error: string; details?: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const sessionUser = session?.user as DebugSessionUser | undefined; // Cast to our debug user type

    const debugInfo: DebugInfo = {
      hasSession: !!session,
      user: sessionUser ? {
        id: sessionUser.id,
        username: sessionUser.username,
        discriminator: sessionUser.discriminator,
        email: sessionUser.email,
        name: sessionUser.name, // From NextAuthUser
        image: sessionUser.image, // From NextAuthUser, usually avatar
        avatar: sessionUser.avatar, // Explicitly from DiscordProfile part
        guilds: sessionUser.guilds?.map(guild => ({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          permissions: guild.permissions // Make sure this field is populated if needed
        })) || [],
        targetGuild: sessionUser.targetGuild || null,
        hasRequiredAccess: sessionUser.hasRequiredAccess,
        member: sessionUser.member
      } : null,
      expectedUserId: process.env.ADMIN_USER_ID || 'Not Set', // Assuming ADMIN_USER_ID is an expected ID
      expectedGuildId: process.env.TARGET_GUILD_ID, // This can be undefined
      timestamp: new Date().toISOString(),
      // rawSession: process.env.NODE_ENV === 'development' ? session : undefined, // Only in dev
    };

    res.status(200).json(debugInfo);
  } catch (error: unknown) { // Catch unknown
    res.status(500).json({
      error: 'Failed to get session info',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}