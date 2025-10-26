import type { Request, Response } from 'express';
import { Router } from 'express';
import { Collection, ObjectId } from 'mongodb';
import { db } from '../common/db.js';
import type { ListResponse, PatchRequest, User } from './types.js';
import { Schemas } from './types.js';
import {
  baseUrlFrom,
  checkIfMatch,
  listResponse,
  parseListParams,
  scimFilterToMongo,
  sendError,
  setCommonHeaders
} from './util.js';

export const usersRouter = Router();

const collection = (): Collection => db.collection('users');

function sanitizeUserInput(input: any): any {
  const { id, meta, schemas, ...rest } = input || {};
  return { schemas: [Schemas.User], ...rest };
}

usersRouter.get('/Users', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const { startIndex, count, filter, sortBy, sortOrder } = parseListParams(req);
  const q = scimFilterToMongo(filter);
  const col = collection();
  const total = await col.countDocuments(q);
  const cursor = col.find(q, { skip: startIndex - 1, limit: count });
  if (sortBy && sortOrder) {
    cursor.sort({ [sortBy]: sortOrder })
  }
  const docs = await cursor.toArray();
  const base = baseUrlFrom(req);
  const resources = docs.map((d) => ({
    ...d,
    id: String(d._id),
    schemas: [Schemas.User],
    meta: {
      resourceType: 'User',
      created: d.meta?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: `W/"${d._version ?? 1}"`,
      location: `${base}/Users/${d._id}`
    }
  }));
  const resp: ListResponse<User> = listResponse<User>(base, 'Users', resources, total, startIndex, count);
  res.status(200).send(resp);
});

usersRouter.get('/Users/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const doc = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return sendError(res, 404, 'User not found');
  const base = baseUrlFrom(req);
  const resource = {
    ...doc,
    id: String(doc._id),
    schemas: [Schemas.User],
    meta: {
      resourceType: 'User',
      created: doc.meta?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: `W/"${doc._version ?? 1}"`,
      location: `${base}/Users/${doc._id}`
    }
  };
  res.status(200).send(resource);
});

usersRouter.post('/Users', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body = sanitizeUserInput(req.body);
  if (!body.userName) return sendError(res, 400, 'userName is required', 'invalidValue');
  const now = new Date().toISOString();
  const doc = { ...body, _version: 1, meta: { created: now } };
  const result = await collection().insertOne(doc);
  const id = String(result.insertedId);
  const base = baseUrlFrom(req);
  const resource = {
    ...doc,
    id,
    schemas: [Schemas.User],
    meta: { resourceType: 'User', created: now, lastModified: now, version: 'W/"1"', location: `${base}/Users/${id}` }
  };
  res.status(201).location(`${base}/Users/${id}`).send(resource);
});

usersRouter.put('/Users/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const existing = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) return sendError(res, 404, 'User not found');
  const currentVersion = existing._version ?? 1;
  if (!checkIfMatch(req, currentVersion)) return sendError(res, 412, 'Precondition Failed', 'mutability');
  const body = sanitizeUserInput(req.body);
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const replacement = { ...body, _version: nextVersion, meta: { created: existing.meta?.created || now } };
  await col.replaceOne({ _id: existing._id }, replacement);
  const base = baseUrlFrom(req);
  const resource = {
    ...replacement,
    id: String(existing._id),
    schemas: [Schemas.User],
    meta: {
      resourceType: 'User',
      created: replacement.meta?.created || now,
      lastModified: now,
      version: `W/"${nextVersion}"`,
      location: `${base}/Users/${existing._id}`
    }
  };
  res.status(200).send(resource);
});

function applyPatch(target: any, op: any) {
  const path = op.path;
  if (!path || path === '') {
    if (op.op === 'add' || op.op === 'replace') {
      Object.assign(target, op.value);
    } else if (op.op === 'remove') {
      for (const k of Object.keys(op.value || {})) delete target[k];
    }
    return;
  }
  const parts = path.split('.');
  let obj: any = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in obj)) obj[p] = {};
    obj = obj[p];
  }
  const last = parts[parts.length - 1];
  if (op.op === 'remove') {
    if (Array.isArray(obj[last]) && typeof op.value === 'object') {
      obj[last] = obj[last].filter((v: any) => JSON.stringify(v) !== JSON.stringify(op.value));
    } else {
      delete obj[last];
    }
  } else if (op.op === 'add') {
    if (Array.isArray(obj[last])) {
      if (Array.isArray(op.value)) obj[last].push(...op.value); else obj[last].push(op.value);
    } else if (typeof obj[last] === 'object' && typeof op.value === 'object') {
      Object.assign(obj[last], op.value);
    } else {
      obj[last] = op.value;
    }
  } else if (op.op === 'replace') {
    obj[last] = op.value;
  }
}

usersRouter.patch('/Users/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body: PatchRequest = req.body;
  if (!Array.isArray(body?.Operations)) return sendError(res, 400, 'Invalid PatchOp', 'invalidSyntax');
  const col = collection();
  const existing = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) return sendError(res, 404, 'User not found');
  const currentVersion = existing._version ?? 1;
  if (!checkIfMatch(req, currentVersion)) return sendError(res, 412, 'Precondition Failed', 'mutability');
  let doc = { ...existing };
  for (const op of body.Operations) applyPatch(doc, op);
  const nextVersion = currentVersion + 1;
  doc._version = nextVersion;
  // Unset the _id field if it's present:
  const { _id, ...$set } = doc;
  await col.updateOne({ _id: existing._id }, { $set });
  const base = baseUrlFrom(req);
  const resource = {
    ...doc,
    id: String(existing._id),
    schemas: [Schemas.User],
    meta: {
      resourceType: 'User',
      created: existing.meta?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: `W/"${nextVersion}"`,
      location: `${base}/Users/${existing._id}`
    }
  };
  res.status(200).send(resource);
});

usersRouter.delete('/Users/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const r = await col.deleteOne({ _id: new ObjectId(req.params.id) });
  if (r.deletedCount === 0) return sendError(res, 404, 'User not found');
  res.status(204).send();
});
