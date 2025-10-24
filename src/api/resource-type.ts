import type { Request, Response } from 'express';
import { Router } from 'express';
import type { ResourceType } from './types.js';
import { Schemas } from './types.js';
import { SCIM_CONTENT_TYPE } from './util.js';

export const resourceTypesRouter = Router();

const usersType: ResourceType = {
  schemas: [Schemas.ResourceType],
  id: 'Users',
  name: 'User',
  endpoint: '/Users',
  description: 'User Account',
  schema: Schemas.User,
};

const groupsType: ResourceType = {
  schemas: [Schemas.ResourceType],
  id: 'Groups',
  name: 'Group',
  endpoint: '/Groups',
  description: 'Group',
  schema: Schemas.Group,
};

const map: Record<string, ResourceType> = {
  Users: usersType,
  Groups: groupsType,
};

resourceTypesRouter.get('/ResourceTypes', (_req: Request, res: Response) => {
  res.type(SCIM_CONTENT_TYPE).send([usersType, groupsType]);
});

resourceTypesRouter.get('/ResourceTypes/:id', (req: Request, res: Response) => {
  let r: ResourceType | undefined;
  if (req.params.id) {
    r = map[req.params.id];
  }
  if (!r) {
    return res.status(404).type(SCIM_CONTENT_TYPE).send({
      schemas: [Schemas.Error],
      status: '404',
      detail: 'ResourceType not found'
    });
  }
  res.type(SCIM_CONTENT_TYPE).send(r);
});
