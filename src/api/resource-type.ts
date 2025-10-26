import type { Request, Response } from 'express';
import { Router } from 'express';
import type { ResourceType } from './types.js';
import { Schemas } from './types.js';
import { SCIM_CONTENT_TYPE } from './util.js';

export const resourceTypesRouter = Router();

const SCIM_BASE_URL = process.env.SCIM_BASE_URL || "http://node-scim-api:3999";

let usersEndpoint = new URL(SCIM_BASE_URL);
let groupsEndpoint = new URL(SCIM_BASE_URL);
usersEndpoint.pathname = new URL("ResourceTypes/Users", usersEndpoint).pathname;
groupsEndpoint.pathname = new URL("ResourceTypes/Groups", groupsEndpoint).pathname;

const usersType: ResourceType = {
  schemas: [Schemas.ResourceType],
  id: 'Users',
  name: 'User',
  endpoint: '/Users',
  description: 'User Account',
  schema: Schemas.User,
  meta: {
    location: usersEndpoint.toString(),
    resourceType: 'ResourceType',
    lastModified: "2025-10-25T18:51:33.173Z",
    created: "2025-10-25T18:51:33.173Z"
  }
};

const groupsType: ResourceType = {
  schemas: [Schemas.ResourceType],
  id: 'Groups',
  name: 'Group',
  endpoint: '/Groups',
  description: 'Group',
  schema: Schemas.Group,
  meta: {
    location: groupsEndpoint.toString(),
    resourceType: 'ResourceType',
    lastModified: "2025-10-25T18:51:33.173Z",
    created: "2025-10-25T18:51:33.173Z"
  }
};

const map: Record<string, ResourceType> = {
  users: usersType,
  groups: groupsType,
};

resourceTypesRouter.get('/ResourceTypes', (_req: Request, res: Response) => {
  const Resources = [usersType, groupsType];
  res.type(SCIM_CONTENT_TYPE).send({
    schemas: [Schemas.ListResponse],
    totalResults: Resources.length,
    startIndex: 1,
    itemsPerPage: Resources.length,
    Resources,
  });
});

resourceTypesRouter.get('/ResourceTypes/:id', (req: Request, res: Response) => {
  let r: ResourceType | undefined;
  if (req.params.id) {
    r = map[req.params.id.toLowerCase()];
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
