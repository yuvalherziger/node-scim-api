import { Router } from 'express';
import { Schemas } from './types.js';
import { baseUrlFrom, listResponse, scimFilterToMongo, setCommonHeaders } from './util.js';
import { db } from '../common/db.js';
export const searchRouter = Router();
async function performSearch(req, res, collectionName) {
    setCommonHeaders(res);
    const body = req.body || {};
    const startIndex = body.startIndex ?? 1;
    const count = body.count ?? 100;
    const filter = body.filter;
    const sortBy = body.sortBy;
    const sortOrder = (body.sortOrder || 'ascending') === 'descending' ? -1 : 1;
    const q = scimFilterToMongo(filter);
    const col = db.collection(collectionName);
    const total = await col.countDocuments(q);
    const cursor = col.find(q, { skip: startIndex - 1, limit: count });
    if (sortBy && sortOrder) {
        cursor.sort({ [sortBy]: sortOrder });
    }
    const docs = await cursor.toArray();
    const base = baseUrlFrom(req);
    const typeUrn = collectionName === 'users' ? Schemas.User : Schemas.Group;
    const plural = collectionName === 'users' ? 'Users' : 'Groups';
    const resources = docs.map((d) => ({
        ...d,
        id: String(d._id),
        schemas: [typeUrn],
        meta: {
            resourceType: plural.slice(0, -1),
            created: d.meta?.created || new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: `W/"${d._version ?? 1}"`,
            location: `${base}/${plural}/${d._id}`
        }
    }));
    const resp = listResponse(base, plural, resources, total, startIndex, count);
    res.status(200).send(resp);
}
searchRouter.post('/.search', async (req, res) => {
    const body = req.body || {};
    const resourceTypes = Array.isArray(body.schemas) ? body.schemas : [];
    // For simplicity, search only Users or Groups depending on provided path; here default to Users
    return performSearch(req, res, 'users');
});
searchRouter.post('/Users/.search', async (req, res) => performSearch(req, res, 'users'));
searchRouter.post('/Groups/.search', async (req, res) => performSearch(req, res, 'groups'));
//# sourceMappingURL=search.js.map