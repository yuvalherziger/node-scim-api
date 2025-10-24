import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, setCommonHeaders } from './util.js';

export const selfRouter = Router();

selfRouter.get('/Me', async (_req: Request, res: Response) => {
  setCommonHeaders(res);
  // Not implemented: mapping token to user resource
  return sendError(res, 501, 'Not Implemented');
});
