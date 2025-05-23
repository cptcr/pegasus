
// dashboard/pages/api/dashboard/moderation/quarantine/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../../lib/auth';
import { DatabaseService } from '../../../../../lib/database';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Quarantine entry ID is required' });
  }

  try {
    const entryId = parseInt(id);
    await DatabaseService.deleteQuarantineEntry(entryId);
    res.status(200).json({ message: 'Quarantine entry removed successfully' });
  } catch (error) {
    console.error('Error removing quarantine entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}
