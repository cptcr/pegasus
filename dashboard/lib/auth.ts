// dashboard/lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';

// Use environment variables instead of hardcoded values
const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID!;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    guilds?: Array<{
      id: string;
      name: string;
      permissions: string;
    }>;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'You must be logged in to access this resource.' 
      });
    }

    // Check if user is the specific admin user
    if (session.user.id !== ADMIN_USER_ID) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to access this resource.' 
      });
    }

    // Check if user has access to the target guild
    const userGuilds = session.user.guilds || [];
    const hasGuildAccess = userGuilds.some(guild => guild.id === ALLOWED_GUILD_ID);

    if (!hasGuildAccess) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have access to the required Discord server.' 
      });
    }

    // Attach user to request
    req.user = session.user;

    // Call the handler
    return await handler(req, res);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Authentication check failed.' 
    });
  }
}

export function checkGuildAccess(guildId: string, userGuilds: any[] = []): boolean {
  if (guildId !== ALLOWED_GUILD_ID) {
    return false;
  }
  return userGuilds.some(guild => guild.id === ALLOWED_GUILD_ID);
}

export async function validateSession(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user) {
    return null;
  }

  // Only allow access to specific user
  if (session.user.id !== ADMIN_USER_ID) {
    return null;
  }

  return session.user;
}