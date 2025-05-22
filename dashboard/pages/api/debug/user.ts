// dashboard/pages/api/debug/user.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    const debugInfo = {
      hasSession: !!session,
      user: session?.user ? {
        id: session.user.id,
        username: session.user.username,
        discriminator: session.user.discriminator,
        email: session.user.email,
        name: session.user.name,
        guilds: session.user.guilds?.map((guild: any) => ({
          id: guild.id,
          name: guild.name,
          permissions: guild.permissions
        })) || [],
        targetGuild: session.user.targetGuild || null
      } : null,
      expectedUserId: '797927858420187186',
      expectedGuildId: '554266392262737930',
      timestamp: new Date().toISOString()
    };

    res.status(200).json(debugInfo);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get session info',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}