import { Router } from 'express';
import { sendError, setCommonHeaders } from './util.js';
export const selfRouter = Router();
selfRouter.get('/Me', async (_req, res) => {
    setCommonHeaders(res);
    // Not implemented: mapping token to user resource
    return sendError(res, 501, 'Not Implemented');
});
//# sourceMappingURL=self.js.map