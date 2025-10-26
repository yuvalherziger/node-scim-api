import express from 'express';
import request from 'supertest';
import { resourceTypesRouter } from '../src/api/resource-type';
import { Schemas } from '../src/api/types';
const app = express();
app.use(express.json());
app.use('/scim', resourceTypesRouter);
describe('ResourceTypes API', () => {
    it('lists resource types', async () => {
        const res = await request(app).get('/scim/ResourceTypes');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
        expect(res.body[0].schemas).toContain(Schemas.ResourceType);
    });
    it('gets Users resource type', async () => {
        const res = await request(app).get('/scim/ResourceTypes/Users');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('Users');
        expect(res.body.schemas).toContain(Schemas.ResourceType);
    });
    it('404s for unknown resource type', async () => {
        const res = await request(app).get('/scim/ResourceTypes/Unknown');
        expect(res.status).toBe(404);
        expect(res.body.schemas).toContain(Schemas.Error);
    });
});
//# sourceMappingURL=resource-types.api.test.js.map