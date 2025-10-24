import type { Request, Response } from 'express';
import { Router } from 'express';
import type { ServiceProviderConfig } from './types.js';
import { Schemas } from './types.js';
import { SCIM_CONTENT_TYPE } from './util.js';

export const serviceProviderConfigRouter = Router();

const config: ServiceProviderConfig = {
  schemas: [Schemas.ServiceProviderConfig],
  id: 'ServiceProviderConfig',
  meta: {
    resourceType: 'ServiceProviderConfig',
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    location: '/ServiceProviderConfig',
    version: 'W/"1"',
  },
  patch: { supported: true },
  bulk: { supported: true, maxOperations: 1000, maxPayloadSize: 1048576 },
  filter: { supported: true, maxResults: 200 },
  changePassword: { supported: false },
  sort: { supported: true },
  etag: { supported: true },
  authenticationSchemes: [
    {
      type: 'oauthbearertoken',
      name: 'OAuth Bearer Token',
      description: 'Bearer token via Authorization header.',
      specUri: 'http://www.rfc-editor.org/info/rfc6750',
      primary: true,
    },
  ],
};

serviceProviderConfigRouter.get('/ServiceProviderConfig', (_req: Request, res: Response) => {
  res.type(SCIM_CONTENT_TYPE).status(200).send(config);
});
