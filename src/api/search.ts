import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Group, ListResponse, SearchRequest, User } from './types.js';
import { Schemas } from './types.js';
import { baseUrlFrom, listResponse, scimFilterToMongo, setCommonHeaders } from './util.js';
import { db } from '../common/db.js';

export const searchRouter = Router();

async function performSearch(req: Request, res: Response, collectionName: 'users' | 'groups') {
  setCommonHeaders(res);
  const body: SearchRequest = req.body || {};
  const startIndex = body.startIndex ?? 1;
  const count = body.count ?? 100;
  const filter = body.filter;
  const sortBy = body.sortBy;
  const sortOrder = (body.sortOrder || 'ascending') === 'descending' ? -1 : 1;
  const q = scimFilterToMongo(filter);
  const col = db.collection(collectionName);
  const total = await col.countDocuments(q, { collation: { locale: 'en', strength: 2 } });
  const cursor = col.find(q, { skip: startIndex - 1, limit: count });
  if (sortBy && sortOrder) {
    cursor.sort({ [sortBy]: sortOrder })
  }
  const docs = await cursor.toArray();
  const base = baseUrlFrom(req);
  const typeUrn = collectionName === 'users' ? Schemas.User : Schemas.Group;
  const plural = collectionName === 'users' ? 'Users' : 'Groups';
  const resources = docs.map((d) => {
    const { _id, ...rest } = d as any;
    return {
      ...rest,
      id: String(d._id),
      schemas: [typeUrn],
      meta: {
        resourceType: plural.slice(0, -1),
        created: d.meta?.created || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: `W/"${d._version ?? 1}"`,
        location: `${base}/${plural}/${d._id}`
      }
    };
  });
  const resp: ListResponse<User | Group> = listResponse(base, plural, resources, total, startIndex, count);
  res.status(200).send(resp);
}

searchRouter.post('/.search', async (req: Request, res: Response) => {
  const body: SearchRequest = req.body || {};
  const resourceTypes = Array.isArray(body.schemas) ? body.schemas : [];
  // For simplicity, search only Users or Groups depending on provided path; here default to Users
  return performSearch(req, res, 'users');
});

searchRouter.post('/Users/.search', async (req: Request, res: Response) => performSearch(req, res, 'users'));
searchRouter.post('/Groups/.search', async (req: Request, res: Response) => performSearch(req, res, 'groups'));
