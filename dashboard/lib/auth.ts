// dashboard/lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';

// Define your target guild ID again or import from a shared config
const TARGET_GUILD_ID = '554266392262737930';

// Update AuthenticatedRequest to match the session.user structure
export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    guilds?: Array<{ // This structure should match the UserGuild interface from [...nextauth].ts
      id: string;
      name: string;
      icon: string | null;
      owner: boolean;
      permissions: string;
      features: string[];
    }>;
    hasRequiredPermission?: boolean; // Key flag
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
    
    // Check 1: User must be in the target guild (session.user.guilds should ideally only contain the target guild if signIn was successful and session callback filters it)
    // Or, more robustly, ensure the guilds array contains the target guild.
    const inTargetGuild = session.user.guilds?.some(g => g.id === TARGET_GUILD_ID);
    if (!inTargetGuild) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `You do not have access to the required Discord server (${TARGET_GUILD_ID}).`
      });
    }
    
    // Check 2: User must have the required permission (flag set by [...nextauth].ts)
    if (session.user.hasRequiredPermission !== true) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have the required permissions to access this resource.' 
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


export async function validateSession(req: NextApiRequest, res: NextApiResponse): Promise<AuthenticatedRequest['user'] | null> {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user) {
    return null;
  }

  const inTargetGuild = session.user.guilds?.some(g => g.id === TARGET_GUILD_ID);
  if (!inTargetGuild || session.user.hasRequiredPermission !== true) {
    return null; // Not authorized
  }

  return session.user;
}