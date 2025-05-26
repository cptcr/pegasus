// dashboard/lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, User as NextAuthUser } from 'next-auth/next'; // Import User type
import { authOptions } from '../pages/api/auth/[...nextauth]'; // Ensure this path is correct
import { DiscordProfile, GuildMemberWithRoles } from '@/types/index'; // Import shared types

// These should be environment variables
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;
const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;

// Define the shape of the user object within the session
interface SessionUser extends NextAuthUser, Partial<DiscordProfile> { // Merge NextAuthUser with DiscordProfile
  id: string; // Ensure id is always string
  username?: string;
  discriminator?: string;
  avatar?: string | null; // Discord avatar can be null
  guilds?: Array<{ // Type for guilds array from Discord API
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string; // Permissions are usually a bitfield string
    features: string[];
  }>;
  hasRequiredAccess?: boolean; // This will be set in the jwt/session callback
  member?: GuildMemberWithRoles | null; // Store fetched member details including roles
}

export interface AuthenticatedRequest extends NextApiRequest {
  user?: SessionUser; // Use the more specific SessionUser
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void | NextApiResponse<unknown>> // Allow handler to return response
): Promise<void | NextApiResponse<unknown>> { // Allow function to return response
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

    const userSession = session.user as SessionUser; // Cast to our extended user type

    // Check if user has required access (this should be robustly set during the session callback)
    if (userSession.hasRequiredAccess !== true) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Ensure you are a member of the correct guild and have the required role.`
      });
    }

    // Attach user to request for the handler
    req.user = userSession;

    // Call the handler
    return await handler(req, res);
  } catch (error: unknown) { // Catch unknown error type
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

// Add a type for Discord Guild Member with roles for session
export interface GuildMemberWithRoles {
  roles: string[]; // Array of role IDs
  nick?: string | null;
  avatar?: string | null;
  joined_at: string; // ISO8601 timestamp
  // Add other relevant member properties if needed
}