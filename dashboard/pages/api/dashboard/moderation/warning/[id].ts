// dashboard/pages/api/dashboard/moderation/warning/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../../lib/auth';
import { DatabaseService } from '../../../../../lib/database';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Warning ID is required' });
  }

  try {
    const warningId = parseInt(id);
    await DatabaseService.deleteWarn(warningId);
    res.status(200).json({ message: 'Warning deleted successfully' });
  } catch (error) {
    console.error('Error deleting warning:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}