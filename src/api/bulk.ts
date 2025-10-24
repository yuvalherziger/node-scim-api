import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../common/db.js';
import { Schemas } from './types.js';
import { sendError, setCommonHeaders } from './util.js';
import { ObjectId } from 'mongodb';

export const bulkRouter = Router();

// Minimal sequential Bulk implementation
bulkRouter.post('/Bulk', async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body = req.body;
  if (!body || !Array.isArray(body.Operations)) return sendError(res, 400, 'Invalid Bulk request', 'invalidSyntax');
  const resp = {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkResponse'],
    id: 'bulk-response',
    Operations: [] as any[],
  };
  for (const op of body.Operations) {
    const method = (op.method || '').toUpperCase();
    const path: string = op.path || '';
    const data = op.data;
    try {
      if (path.startsWith('/Users')) {
        const col = db.collection('users');
        if (method === 'POST') {
          const r = await col.insertOne({ ...data, _version: 1, meta: { created: new Date().toISOString() } });
          resp.Operations.push({ location: `/Users/${r.insertedId}`, status: '201' });
        } else if (method === 'PUT' || method === 'PATCH') {
          const id = path.split('/')[2];
          await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
          resp.Operations.push({ location: `/Users/${id}`, status: '200' });
        } else if (method === 'DELETE') {
          const id = path.split('/')[2];
          await col.deleteOne({ _id: new ObjectId(id) });
          resp.Operations.push({ location: `/Users/${id}`, status: '204' });
        } else {
          resp.Operations.push({ status: '400', response: { detail: 'Unsupported method' } });
        }
      } else if (path.startsWith('/Groups')) {
        const col = db.collection('groups');
        if (method === 'POST') {
          const r = await col.insertOne({ ...data, _version: 1, meta: { created: new Date().toISOString() } });
          resp.Operations.push({ location: `/Groups/${r.insertedId}`, status: '201' });
        } else if (method === 'PUT' || method === 'PATCH') {
          const id = path.split('/')[2];
          await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
          resp.Operations.push({ location: `/Groups/${id}`, status: '200' });
        } else if (method === 'DELETE') {
          const id = path.split('/')[2];
          await col.deleteOne({ _id: new ObjectId(id) });
          resp.Operations.push({ location: `/Groups/${id}`, status: '204' });
        } else {
          resp.Operations.push({ status: '400', response: { detail: 'Unsupported method' } });
        }
      } else {
        resp.Operations.push({ status: '400', response: { detail: 'Unsupported path' } });
      }
    } catch (e: any) {
      resp.Operations.push({ status: '500', response: { detail: e?.message || 'Server error' } });
    }
  }
  res.status(200).send(resp);
});
