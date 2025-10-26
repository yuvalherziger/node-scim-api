import express from 'express';
import request from 'supertest';
import { Schemas } from '../src/api/types';

let app: express.Express;
let client: any;
let db: any;

beforeAll(async () => {
  // Unique DB per run and import modules after setting env
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  process.env.DB_NAME = `scim_groups_test_${uniqueSuffix}`;

  const dbMod = await import('../src/common/db');
  client = dbMod.client;
  db = dbMod.db;
  await client.connect();

  const { groupsRouter } = await import('../src/api/group');

  app = express();
  app.use(express.json());
  app.use('/scim', groupsRouter);
});

afterAll(async () => {
  try {
    await db.dropDatabase();
  } finally {
    await client.close();
  }
});

function expectScim(res: request.Response) {
  expect(res.headers['content-type']).toContain('application/scim+json');
}

describe('Groups API', () => {
  it('lists empty groups', async () => {
    const res = await request(app).get('/scim/Groups');
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain(Schemas.ListResponse);
    expect(res.body.totalResults).toBe(0);
  });

  it('validates create requires displayName', async () => {
    const res = await request(app).post('/scim/Groups').send({});
    expectScim(res);
    expect(res.status).toBe(400);
    expect(res.body.schemas).toContain(Schemas.Error);
  });

  let groupId = '';
  let etag = 'W/"1"';

  it('creates a group', async () => {
    const res = await request(app).post('/scim/Groups').send({ displayName: 'Devs' });
    expectScim(res);
    expect(res.status).toBe(201);
    expect(res.header['location']).toMatch(/\/scim\/Groups\//);
    groupId = res.body.id;
    expect(groupId).toBeTruthy();
    expect(res.body.meta.version).toBe('W/"1"');
  });

  it('gets the group by id', async () => {
    const res = await request(app).get(`/scim/Groups/${groupId}`);
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(groupId);
  });

  it('filters groups (co) and supports sorting', async () => {
    const res = await request(app)
      .get('/scim/Groups')
      .query({ filter: 'displayName co "Dev"', sortBy: 'displayName', sortOrder: 'descending' });
    expect(res.status).toBe(200);
    expect(res.body.totalResults).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.Resources)).toBe(true);
  });

  it('PUT with wrong If-Match returns 412', async () => {
    const res = await request(app)
      .put(`/scim/Groups/${groupId}`)
      .set('If-Match', 'W/"999"')
      .send({ displayName: 'Developers' });
    expectScim(res);
    expect(res.status).toBe(412);
  });

  it('updates group with correct If-Match', async () => {
    const res = await request(app)
      .put(`/scim/Groups/${groupId}`)
      .set('If-Match', etag)
      .send({ displayName: 'Developers' });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Developers');
    expect(res.body.meta.version).toBe('W/"2"');
    etag = 'W/"2"';
  });

  it('PATCH with wrong If-Match returns 412', async () => {
    const res = await request(app)
      .patch(`/scim/Groups/${groupId}`)
      .set('If-Match', 'W/"1"')
      .send({ schemas: [Schemas.PatchOp], Operations: [{ op: 'replace', path: 'displayName', value: 'Devs Team' }] });
    expectScim(res);
    expect(res.status).toBe(412);
  });

  it('PATCH updates group with correct If-Match', async () => {
    const res = await request(app)
      .patch(`/scim/Groups/${groupId}`)
      .set('If-Match', etag)
      .send({ schemas: [Schemas.PatchOp], Operations: [{ op: 'replace', path: 'displayName', value: 'Devs Team' }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Devs Team');
    expect(res.body.meta.version).toBe('W/"3"');
    etag = 'W/"3"';
  });

  it('PATCH supports add/remove at root, array push/remove, and object merge for groups', async () => {
    const res = await request(app)
      .patch(`/scim/Groups/${groupId}`)
      .set('If-Match', etag)
      .send({
        schemas: [Schemas.PatchOp],
        Operations: [
          { op: 'add', path: '', value: { members: [{ value: 'u1' }], meta: { attributes: { temp: true } } } },
          { op: 'add', path: 'members', value: { value: 'u2' } },
          { op: 'remove', path: 'members', value: { value: 'u1' } },
          { op: 'replace', path: 'meta.attributes.temp', value: false },
          { op: 'remove', path: '', value: { nonExisting: 1 } }
        ]
      });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(1);
    expect(res.body.meta.version).toBe('W/"4"');
    etag = 'W/"4"';
  });

  it('deletes group and 404s on repeat', async () => {
    const res = await request(app).delete(`/scim/Groups/${groupId}`);
    expect(res.status).toBe(204);
    const res2 = await request(app).delete(`/scim/Groups/${groupId}`);
    expectScim(res2);
    expect(res2.status).toBe(404);
  });
});
