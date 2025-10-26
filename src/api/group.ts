import type { Request, Response } from 'express';
import { Router } from 'express';
import { Collection, ObjectId } from 'mongodb';
import { db } from '../common/db.js';
import type { Group, ListResponse, PatchRequest } from './types.js';
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

export const groupsRouter = Router();

const collection = (): Collection => db.collection('groups');

function sanitizeGroupInput(input: any): any {
  const { id, meta, schemas, ...rest } = input || {};
  return { schemas: [Schemas.Group], ...rest };
}

groupsRouter.get('/Groups', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const { startIndex, count, filter, sortBy, sortOrder } = parseListParams(req);
  const q = scimFilterToMongo(filter);
  const col = collection();
  const total = await col.countDocuments(q, { collation: { locale: 'en', strength: 2 } });
  const cursor = col.find(q, { skip: startIndex - 1, limit: count, collation: { locale: 'en', strength: 2 } });
  if (sortBy && sortOrder) {
    cursor.sort({ [sortBy]: sortOrder })
  }
  const docs = await cursor.toArray();
  const base = baseUrlFrom(req);
  const resources = docs.map((d) => {
    const { _id, ...rest } = d as any;
    return {
      ...rest,
      id: String(d._id),
      schemas: [Schemas.Group],
      meta: {
        resourceType: 'Group',
        created: d.meta?.created || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: `W/"${d._version ?? 1}"`,
        location: `${base}/Groups/${d._id}`
      }
    };
  });
  const resp: ListResponse<Group> = listResponse<Group>(base, 'Groups', resources, total, startIndex, count);
  res.status(200).send(resp);
});

groupsRouter.get('/Groups/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const doc = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return sendError(res, 404, 'Group not found');
  const base = baseUrlFrom(req);
  const { _id: _unused, ...rest } = doc as any;
  const resource = {
    ...rest,
    id: String(doc._id),
    schemas: [Schemas.Group],
    meta: {
      resourceType: 'Group',
      created: doc.meta?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: `W/"${doc._version ?? 1}"`,
      location: `${base}/Groups/${doc._id}`
    }
  };
  res.status(200).send(resource);
});

groupsRouter.post('/Groups', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body = sanitizeGroupInput(req.body);
  if (!body.displayName) return sendError(res, 400, 'displayName is required', 'invalidValue');
  // Prevent creating duplicate groups by displayName (case-insensitive)
  const col = collection();
  const existing = await col.findOne({ displayName: body.displayName }, { collation: { locale: 'en', strength: 2 } });
  if (existing) return sendError(res, 409, 'Duplicate displayName', 'uniqueness');
  const now = new Date().toISOString();
  const doc = { ...body, _version: 1, meta: { created: now } };
  const result = await col.insertOne(doc);
  const id = String(result.insertedId);
  const base = baseUrlFrom(req);
  const { _id: _unusedPost, ...postRest } = doc as any;
  const resource = {
    ...postRest,
    id,
    schemas: [Schemas.Group],
    meta: { resourceType: 'Group', created: now, lastModified: now, version: 'W/"1"', location: `${base}/Groups/${id}` }
  };
  res.status(201).location(`${base}/Groups/${id}`).send(resource);
});

groupsRouter.put('/Groups/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const existing = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) return sendError(res, 404, 'Group not found');
  const currentVersion = existing._version ?? 1;
  if (!checkIfMatch(req, currentVersion)) return sendError(res, 412, 'Precondition Failed', 'mutability');
  const body = sanitizeGroupInput(req.body);
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const replacement = { ...body, _version: nextVersion, meta: { created: existing.meta?.created || now } };
  const { _id, ...withoutId } = replacement;
  await col.replaceOne({ _id: existing._id }, withoutId);
  const base = baseUrlFrom(req);
  const { _id: _unusedPut, ...putRest } = replacement as any;
  const resource = {
    ...putRest,
    id: String(existing._id),
    schemas: [Schemas.Group],
    meta: {
      resourceType: 'Group',
      created: replacement.meta?.created || now,
      lastModified: now,
      version: `W/"${nextVersion}"`,
      location: `${base}/Groups/${existing._id}`
    }
  };
  res.status(200).send(resource);
});

function applyPatch(target: any, op: any) {
  const path: string | undefined = op.path;
  // Handle empty path: apply operation to the root object
  if (!path || path === '') {
    if (op.op === 'add' || op.op === 'replace') {
      Object.assign(target, op.value);
    } else if (op.op === 'remove') {
      for (const k of Object.keys(op.value || {})) delete target[k];
    }
    return;
  }

  // Support simple SCIM array filter on path, e.g., members[value eq "<id>"]
  // Minimal implementation to support removing a member by id
  const m = path.match(/^([^\[]+)\[(.+)\]$/);
  if (m) {
    const arrProp = m[1] as string;
    const condition = (m[2] as string | undefined) ?? '';
    // Only implement the common case: value eq "id" (single or double quotes)
    const idMatch = condition && condition.match(/value\s+eq\s+['\"]([^'\"]+)['\"]/i);
    const arr = (target as Record<string, any>)[arrProp];
    if (idMatch && Array.isArray(arr)) {
      const id = idMatch[1];
      if (op.op === 'remove') {
        (target as Record<string, any>)[arrProp] = arr.filter((v: any) => {
          const val = typeof v === 'object' && v !== null ? v.value ?? v.id ?? v["$ref"] : v;
          return String(val) !== String(id);
        });
        return;
      } else if (op.op === 'replace') {
        // Replace the matching elements entirely with op.value (rare). We'll map over array.
        (target as Record<string, any>)[arrProp] = arr.map((v: any) => {
          const val = typeof v === 'object' && v !== null ? v.value ?? v.id ?? v["$ref"] : v;
          if (String(val) === String(id)) return op.value;
          return v;
        });
        return;
      }
      // For add with a filtered path, SCIM would append to the array; fall through below if needed
    }
  }

  // Fallback: standard dotted path resolution
  const parts = path.split('.');
  let obj: any = target as Record<string, any>;
  for (let i = 0; i < parts.length - 1; i++) {
    const p: string = String(parts[i] ?? '');
    const rec = obj as Record<string, any>;
    if (!(p in rec)) rec[p] = {};
    obj = rec[p];
  }
  const lastKey = parts[parts.length - 1] as string | undefined;
  if (!lastKey) return;
  const rec = obj as Record<string, any>;

  if (op.op === 'remove') {
    if (Array.isArray(rec[lastKey])) {
      // Enhance removal semantics for arrays: allow removing by matching the element's value field or by primitive equality
      const toRemove = op.value;
      rec[lastKey] = (rec[lastKey] as any[]).filter((v: any) => {
        if (toRemove === undefined) return true; // no value provided, do nothing
        // If op.value is an object with a value field, match by that
        if (typeof toRemove === 'object' && toRemove !== null) {
          if ('value' in toRemove) {
            const val = typeof v === 'object' && v !== null ? v.value ?? v.id ?? v["$ref"] : v;
            return String(val) !== String((toRemove as any).value);
          }
          // Fallback to deep-ish equality via JSON
          return JSON.stringify(v) !== JSON.stringify(toRemove);
        }
        // If op.value is a primitive, match either the element itself or its value property
        const val = typeof v === 'object' && v !== null ? v.value ?? v.id ?? v["$ref"] : v;
        return String(val) !== String(toRemove);
      });
    } else {
      delete rec[lastKey];
    }
  } else if (op.op === 'add') {
    if (Array.isArray(rec[lastKey])) {
      if (Array.isArray(op.value)) (rec[lastKey] as any[]).push(...op.value); else (rec[lastKey] as any[]).push(op.value);
    } else if (typeof rec[lastKey] === 'object' && typeof op.value === 'object' && rec[lastKey] !== null) {
      Object.assign(rec[lastKey] as object, op.value);
    } else {
      rec[lastKey] = op.value;
    }
  } else if (op.op === 'replace') {
    rec[lastKey] = op.value;
  }
}

groupsRouter.patch('/Groups/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body: PatchRequest = req.body;
  if (!Array.isArray(body?.Operations)) return sendError(res, 400, 'Invalid PatchOp', 'invalidSyntax');
  const col = collection();
  const existing = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) return sendError(res, 404, 'Group not found');
  const currentVersion = existing._version ?? 1;
  if (!checkIfMatch(req, currentVersion)) return sendError(res, 412, 'Precondition Failed', 'mutability');
  let doc = { ...existing };
  for (const op of body.Operations) applyPatch(doc, op);
  const nextVersion = currentVersion + 1;
  doc._version = nextVersion;
  const { _id, ...$set } = doc;
  await col.updateOne({ _id: existing._id }, { $set });
  const base = baseUrlFrom(req);
  const { _id: _unusedPatch, ...patchRest } = doc as any;
  const resource = {
    ...patchRest,
    id: String(existing._id),
    schemas: [Schemas.Group],
    meta: {
      resourceType: 'Group',
      created: existing.meta?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: `W/"${nextVersion}"`,
      location: `${base}/Groups/${existing._id}`
    }
  };
  res.status(200).send(resource);
});

groupsRouter.delete('/Groups/:id', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const id = req.params.id;
  if (!id || !ObjectId.isValid(id)) return sendError(res, 404, 'Group not found');
  const col = collection();
  const r = await col.deleteOne({ _id: new ObjectId(id) });
  if (r.deletedCount === 0) return sendError(res, 404, 'Group not found');
  res.status(204).send();
});
