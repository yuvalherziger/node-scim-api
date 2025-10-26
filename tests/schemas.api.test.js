import express from 'express';
import request from 'supertest';
import { schemasRouter } from '../src/api/schemas';
import { Schemas } from '../src/api/types';
const app = express();
app.use(express.json());
app.use('/scim', schemasRouter);
describe('Schemas API', () => {
    it('lists schemas', async () => {
        const res = await request(app).get('/scim/Schemas');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const ids = res.body.map((s) => s.id);
        expect(ids).toEqual(expect.arrayContaining([Schemas.User, Schemas.Group]));
    });
    it('gets User schema by id', async () => {
        const res = await request(app).get(`/scim/Schemas/${Schemas.User}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(Schemas.User);
    });
    it('404s for unknown schema id', async () => {
        const res = await request(app).get('/scim/Schemas/unknown');
        expect(res.status).toBe(404);
        expect(res.body.schemas).toContain(Schemas.Error);
    });
});
//# sourceMappingURL=schemas.api.test.js.map