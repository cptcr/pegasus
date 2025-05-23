// dashboard/pages/api/dashboard/moderation/automod/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../../lib/auth';
import { DatabaseService } from '../../../../../lib/database';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Automod rule ID is required' });
  }

  const ruleId = parseInt(id);

  if (req.method === 'PATCH') {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Enabled field must be a boolean' });
      }

      await DatabaseService.toggleAutomodRule(ruleId, enabled);
      res.status(200).json({ message: 'Automod rule updated successfully' });
    } catch (error) {
      console.error('Error updating automod rule:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await DatabaseService.deleteAutomodRule(ruleId);
      res.status(200).json({ message: 'Automod rule deleted successfully' });
    } catch (error) {
      console.error('Error deleting automod rule:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}