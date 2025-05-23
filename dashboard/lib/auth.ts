// dashboard/lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';

const TARGET_GUILD_ID = '554266392262737930';
const REQUIRED_ROLE_ID = '797927858420187186';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    guilds?: Array<{
      id: string;
      name: string;
      icon: string | null;
      owner: boolean;
      permissions: string;
      features: string[];
    }>;
    hasRequiredAccess?: boolean;
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
    
    // Check if user has required access (guild membership + role)
    if (session.user.hasRequiredAccess !== true) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. You must be a member of guild ${TARGET_GUILD_ID} with role ${REQUIRED_ROLE_ID}.`
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
  
  if (!session?.user || session.user.hasRequiredAccess !== true) {
    return null;
  }

  return session.user;
}