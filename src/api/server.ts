import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { statusRouter } from './routes/status';
import { logger } from '../utils/logger';

const app = express();
const PORT = process.env.API_PORT || 2000;

app.use(cors());
app.use(express.json());

const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'No token provided' 
    });
    return;
  }

  if (token !== process.env.API_TOKEN) {
    res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Invalid token' 
    });
    return;
  }

  next();
};

app.use('/status', authenticateToken, statusRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.path} not found` 
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});

export function startApiServer() {
  app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`);
  });
}

export { app };