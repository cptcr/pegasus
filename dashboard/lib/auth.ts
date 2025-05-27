// dashboard/lib/auth.ts - Fixed Database Access
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { User as NextAuthUser } from 'next-auth';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { DiscordProfile, GuildMemberWithRoles as ImportedGuildMemberWithRoles } from '@/types/index';

// These should be environment variables
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;

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
  member?: ImportedGuildMemberWithRoles | null;
}

export interface AuthenticatedRequest extends NextApiRequest {
  user?: SessionUser;
}

/**
 * Middleware to require authentication for API routes
 */
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

    // Check if user has required access
    if (userSession.hasRequiredAccess !== true) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Ensure you are a member of the correct guild and have the required role.`
      });
    }

    // Attach user to request
    req.user = userSession;
    
    // Call the actual handler
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

/**
 * Validate session without throwing errors
 */
export async function validateSession(req: NextApiRequest, res: NextApiResponse): Promise<SessionUser | null> {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return null;
    }

    const userSession = session.user as SessionUser;

    if (userSession.hasRequiredAccess !== true) {
      return null;
    }

    return userSession;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Check if user has specific permissions
 */
export function hasPermission(user: SessionUser, permission: string): boolean {
  // Add permission checking logic here based on your needs
  // For now, just check if user has required access
  return user.hasRequiredAccess === true;
}

/**
 * Check if user has specific role
 */
export function hasRole(user: SessionUser, roleId: string): boolean {
  return user.member?.roles.includes(roleId) || false;
}

/**
 * Get user's highest role position (for hierarchy checks)
 */
export function getUserRolePosition(user: SessionUser): number {
  // This would need to be implemented based on your role hierarchy
  // For now, return a basic value
  return user.hasRequiredAccess ? 100 : 0;
}

/**
 * Middleware for admin-only routes
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void | NextApiResponse<unknown>>
): Promise<void | NextApiResponse<unknown>> {
  return requireAuth(req, res, async (authReq, authRes) => {
    const user = authReq.user!;
    
    // Add admin check logic here
    // For now, all authenticated users with hasRequiredAccess are considered admins
    if (!hasPermission(user, 'admin')) {
      return authRes.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required.'
      });
    }

    return handler(authReq, authRes);
  });
}