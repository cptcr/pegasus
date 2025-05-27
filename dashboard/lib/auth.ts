// dashboard/lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, User as NextAuthUser } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { DiscordProfile, GuildMemberWithRoles } from '@/types/index';

// These should be environment variables
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;
// Removed unused REQUIRED_ROLE_ID

// Define the shape of the user object within the session
interface SessionUser extends NextAuthUser, Partial<DiscordProfile> {
  id: string;
  username?: string;
  discriminator?: string;
  avatar?: string | null;
  guilds?: Array<{
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    features: string[];
  }>;
  hasRequiredAccess?: boolean;
  member?: GuildMemberWithRoles | null;
}

export interface AuthenticatedRequest extends NextApiRequest {
  user?: SessionUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void | NextApiResponse<unknown>>
): Promise<void | NextApiResponse<unknown>> {
  if (!TARGET_GUILD_ID) {
    console.error("FATAL: TARGET_GUILD_ID environment variable is not set in requireAuth.");
    return res.status(500).json({
        error: 'Configuration Error',
        message: 'Server is not configured correctly. TARGET_GUILD_ID is missing.'
    });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource.'
      });
    }

    const userSession = session.user as SessionUser;

    if (userSession.hasRequiredAccess !== true) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Ensure you are a member of the correct guild and have the required role.`
      });
    }

    req.user = userSession;
    return await handler(req, res);
  } catch (error: unknown) {
    console.error('Auth middleware error:', error);
    const message = error instanceof Error ? error.message : 'Authentication check failed.';
    return res.status(500).json({
      error: 'Internal Server Error',
      message: message
    });
  }
}

export async function validateSession(req: NextApiRequest, res: NextApiResponse): Promise<SessionUser | null> {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return null;
  }
  const userSession = session.user as SessionUser;

  if (userSession.hasRequiredAccess !== true) {
    return null;
  }

  return userSession;
}

export interface GuildMemberWithRoles {
  roles: string[];
  nick?: string | null;
  avatar?: string | null;
  joined_at: string;
}