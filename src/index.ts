import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import expressWinston from 'express-winston';
import { client } from './common/db.js';
import { requireBearer, SCIM_CONTENT_TYPE } from './api/util.js';
import { serviceProviderConfigRouter } from './api/service-provider-config.js';
import { schemasRouter } from './api/schemas.js';
import { resourceTypesRouter } from './api/resource-type.js';
import { usersRouter } from './api/users.js';
import { groupsRouter } from './api/group.js';
import { searchRouter } from './api/search.js';
import { bulkRouter } from './api/bulk.js';
import { selfRouter } from './api/self.js';
import { logger } from './common/logger.js';

const app = express();

app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
  // Skip logging for health checks to reduce noise
  ignoreRoute: (req, _res) => req.path === '/healthy'
}));

app.use(express.json({ type: [SCIM_CONTENT_TYPE, 'application/json'] }));

// Public health endpoint (no authentication)
app.get('/healthy', (_req: Request, res: Response) => {
  res.status(200).json({ healthy: true });
});

const token = process.env.SCIM_BEARER_TOKEN;
app.use(requireBearer(token));

app.use('/', serviceProviderConfigRouter);
app.use('/', schemasRouter);
app.use('/', resourceTypesRouter);
app.use('/', usersRouter);
app.use('/', groupsRouter);
app.use('/', searchRouter);
app.use('/', bulkRouter);
app.use('/', selfRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).type(SCIM_CONTENT_TYPE).send({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: '500',
    detail: 'Internal Server Error'
  });
});

app.use(expressWinston.errorLogger({
  winstonInstance: logger
}));

const PORT = Number(process.env.SCIM_SERVER_PORT || 3999);

async function start() {
  await client.connect();
  app.listen(PORT, "0.0.0.0", () => {
    logger.info('SCIM server listening', { port: PORT });
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((e) => {
    logger.error('Failed to start server', { error: e });
    process.exit(1);
  });
}

export default app;
