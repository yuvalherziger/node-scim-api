import express from 'express';
import request from 'supertest';
import { Schemas } from '../src/api/types';
let app;
let client;
let db;
beforeAll(async () => {
    // Unique DB per run and import modules after setting env
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    process.env.DB_NAME = `scim_users_test_${uniqueSuffix}`;
    const dbMod = await import('../src/common/db');
    client = dbMod.client;
    db = dbMod.db;
    await client.connect();
    const { usersRouter } = await import('../src/api/users');
    app = express();
    app.use(express.json());
    app.use('/scim', usersRouter);
});
afterAll(async () => {
    try {
        // await db.dropDatabase();
    }
    finally {
        await client.close();
    }
});
function expectScim(res) {
    expect(res.headers['content-type']).toContain('application/scim+json');
}
describe('Users API', () => {
    it('lists empty users', async () => {
        const res = await request(app).get('/scim/Users');
        expectScim(res);
        expect(res.status).toBe(200);
        expect(res.body.schemas).toContain(Schemas.ListResponse);
        expect(res.body.totalResults).toBe(0);
    });
    it('validates create requires userName', async () => {
        const res = await request(app).post('/scim/Users').send({ displayName: 'NoName' });
        expectScim(res);
        expect(res.status).toBe(400);
        expect(res.body.schemas).toContain(Schemas.Error);
    });
    let userId = '';
    let etag = 'W/"1"';
    it('creates a user', async () => {
        const res = await request(app).post('/scim/Users').send({ userName: 'alice', displayName: 'Alice' });
        expectScim(res);
        expect(res.status).toBe(201);
        expect(res.header['location']).toMatch(/\/scim\/Users\//);
        userId = res.body.id;
        expect(userId).toBeTruthy();
        expect(res.body.meta.version).toBe('W/"1"');
    });
    it('gets the user by id', async () => {
        const res = await request(app).get(`/scim/Users/${userId}`);
        expectScim(res);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(userId);
    });
    it('filters users (sw)', async () => {
        const res = await request(app).get('/scim/Users').query({ filter: 'userName sw "a"' });
        expect(res.status).toBe(200);
        expect(res.body.totalResults).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(res.body.Resources)).toBe(true);
    });
    it('PUT with wrong If-Match returns 412', async () => {
        const res = await request(app)
            .put(`/scim/Users/${userId}`)
            .set('If-Match', 'W/"999"')
            .send({ userName: 'alice', displayName: 'Alice Cooper' });
        expectScim(res);
        expect(res.status).toBe(412);
    });
    it('updates user with correct If-Match', async () => {
        const res = await request(app)
            .put(`/scim/Users/${userId}`)
            .set('If-Match', etag)
            .send({ userName: 'alice', displayName: 'Alice Cooper' });
        expectScim(res);
        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('Alice Cooper');
        expect(res.body.meta.version).toBe('W/"2"');
        etag = 'W/"2"';
    });
    it('PATCH with wrong If-Match returns 412', async () => {
        const res = await request(app)
            .patch(`/scim/Users/${userId}`)
            .set('If-Match', 'W/"1"')
            .send({ schemas: [Schemas.PatchOp], Operations: [{ op: 'replace', path: 'displayName', value: 'Alice C.' }] });
        expectScim(res);
        expect(res.status).toBe(412);
    });
    it('PATCH updates user with correct If-Match', async () => {
        const res = await request(app)
            .patch(`/scim/Users/${userId}`)
            .set('If-Match', etag)
            .send({ schemas: [Schemas.PatchOp], Operations: [{ op: 'replace', path: 'displayName', value: 'Alice C.' }] });
        expectScim(res);
        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('Alice C.');
        expect(res.body.meta.version).toBe('W/"3"');
        etag = 'W/"3"';
    });
    it('deletes user and 404s on repeat', async () => {
        const res = await request(app).delete(`/scim/Users/${userId}`);
        expect(res.status).toBe(204);
        const res2 = await request(app).delete(`/scim/Users/${userId}`);
        expectScim(res2);
        expect(res2.status).toBe(404);
    });
});
//# sourceMappingURL=users.api.test.js.map