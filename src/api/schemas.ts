import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Schema, SchemaAttribute } from './types.js';
import { Schemas } from './types.js';
import { SCIM_CONTENT_TYPE } from './util.js';

export const schemasRouter = Router();

const SCIM_BASE_URL = process.env.SCIM_BASE_URL || "http://node-scim-api:3999";

let userSchemaEndpoint = new URL(SCIM_BASE_URL);
let groupSchemaEndpoint = new URL(SCIM_BASE_URL);
let enterpriseUserSchemaEndpoint = new URL(SCIM_BASE_URL);
userSchemaEndpoint.pathname = new URL(`Schemas/${Schemas.User}`, userSchemaEndpoint).pathname;
groupSchemaEndpoint.pathname = new URL(`Schemas/${Schemas.Group}`, groupSchemaEndpoint).pathname;
enterpriseUserSchemaEndpoint.pathname = new URL(`Schemas/${Schemas.EnterpriseUser}`, enterpriseUserSchemaEndpoint).pathname;

const userAttributes: SchemaAttribute[] = [
  {
    name: 'userName',
    type: 'string',
    multiValued: false,
    description: 'Unique identifier for the User',
    required: true,
    caseExact: false,
    uniqueness: 'server',
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'name', type: 'complex', multiValued: false, description: 'Components of the user\'s real name', required: false, subAttributes: [
      {
        name: 'formatted', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'familyName', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'givenName', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'middleName', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'honorificPrefix', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'honorificSuffix', type: 'string', multiValued: false, description: '', required: false,
        mutability: "readWrite",
        returned: "default",
        caseExact: false
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'displayName', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'nickName', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'profileUrl', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'title', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'userType', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'preferredLanguage', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'locale', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'timezone', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'active', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'password', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'writeOnly',
    returned: 'default',
  },
  {
    name: 'emails', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'primary', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'phoneNumbers', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'primary', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'addresses', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'formatted', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'streetAddress', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'locality', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'region', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'postalCode', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'country', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'primary', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'groups', type: 'complex', multiValued: true, description: '', required: false, mutability: 'readOnly', subAttributes: [
      {
        name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: '$ref', type: 'reference', multiValued: false, description: '', required: false, referenceTypes: ['User', 'Group'], mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'display', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    returned: 'default',
  },
  {
    name: 'entitlements', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'display', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'primary', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'roles', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'display', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'primary', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'x509Certificates', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'value', type: 'binary', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'display', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'primary', type: 'boolean', multiValued: false, description: '', required: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
];

const groupAttributes: SchemaAttribute[] = [
  {
    name: 'displayName', type: 'string', multiValued: false, description: '', required: true, caseExact: false, mutability: 'readWrite',
    returned: 'default',
  },
  {
    name: 'members', type: 'complex', multiValued: true, description: '', required: false, subAttributes: [
      {
        name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: '$ref', type: 'reference', multiValued: false, description: '', required: false, referenceTypes: ['User', 'Group'], mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'display', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
      {
        name: 'type', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite',
        returned: 'default',
      },
    ],
    mutability: 'readWrite',
    returned: 'default',
  },
];

const userSchema: Schema = {
  schemas: [Schemas.Schema],
  id: Schemas.User,
  name: 'User',
  description: 'User Account',
  attributes: userAttributes,
  meta: {
    location: userSchemaEndpoint.toString(),
    resourceType: 'Schema',
    lastModified: "2025-10-25T18:51:33.173Z",
    created: "2025-10-25T18:51:33.173Z"
  }
};

const groupSchema: Schema = {
  schemas: [Schemas.Schema],
  id: Schemas.Group,
  name: 'Group',
  description: 'Group',
  attributes: groupAttributes,
  meta: {
    location: groupSchemaEndpoint.toString(),
    resourceType: 'Schema',
    lastModified: "2025-10-25T18:51:33.173Z",
    created: "2025-10-25T18:51:33.173Z"
  }
};

const enterpriseUserAttributes: SchemaAttribute[] = [
  { name: 'employeeNumber', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
  { name: 'costCenter', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
  { name: 'organization', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
  { name: 'division', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
  { name: 'department', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
  {
    name: 'manager', type: 'complex', multiValued: false, description: '', required: false, mutability: 'readWrite', returned: 'default', subAttributes: [
      { name: 'value', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
      { name: '$ref', type: 'reference', multiValued: false, description: '', required: false, referenceTypes: ['User'], mutability: 'readWrite', returned: 'default' },
      { name: 'display', type: 'string', multiValued: false, description: '', required: false, caseExact: false, mutability: 'readWrite', returned: 'default' },
    ]
  }
];

const enterpriseUserSchema: Schema = {
  schemas: [Schemas.Schema],
  id: Schemas.EnterpriseUser,
  name: 'EnterpriseUser',
  description: 'User Enterprise Extension',
  attributes: enterpriseUserAttributes,
  meta: {
    location: enterpriseUserSchemaEndpoint.toString(),
    resourceType: 'Schema',
    lastModified: "2025-10-25T18:51:33.173Z",
    created: "2025-10-25T18:51:33.173Z"
  }
};

const byId: Record<string, Schema> = {
  [Schemas.User]: userSchema,
  [Schemas.Group]: groupSchema,
  [Schemas.EnterpriseUser]: enterpriseUserSchema,
};

schemasRouter.get('/Schemas', (_req: Request, res: Response) => {
  const Resources = [userSchema, groupSchema, enterpriseUserSchema];
  res.type(SCIM_CONTENT_TYPE).send({
    schemas: [Schemas.ListResponse],
    totalResults: Resources.length,
    startIndex: 1,
    itemsPerPage: Resources.length,
    Resources,
  });
});

schemasRouter.get('/Schemas/:id', (req: Request, res: Response) => {
  let s;
  if (req?.params?.id) {
    s = byId[req.params.id];
  }
  if (!s) return res.status(404).type(SCIM_CONTENT_TYPE).send({
    schemas: [Schemas.Error],
    status: '404',
    detail: 'Schema not found'
  });
  res.type(SCIM_CONTENT_TYPE).send(s);
});
