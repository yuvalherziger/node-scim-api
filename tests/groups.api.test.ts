import express from 'express';
import request from 'supertest';
import { Schemas } from '../src/api/types';
import { ObjectId } from 'mongodb';

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

    // verify persistence: no embedded members field in groups doc, memberships stored separately
    const groupsCol = db.collection('groups');
    const g = await groupsCol.findOne({ _id: new ObjectId(groupId) });
    expect(g).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(g, 'members')).toBe(false);
    const mems = await db.collection('groupMemberships').find({ groupId: new ObjectId(groupId) }).toArray();
    expect(mems.length).toBe(1);
    expect(mems[0].member.value).toBe('u2');
  });

  // Additional coverage: create a group with members and test list hydration + filtered path operations
  let groupId2 = '';
  let etag2 = 'W/"1"';

  it('creates a group with members and returns members in response', async () => {
    const res = await request(app).post('/scim/Groups').send({ displayName: 'QA', members: [{ value: 'u1' }, { value: 'u2' }] });
    expectScim(res);
    expect(res.status).toBe(201);
    groupId2 = res.body.id;
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(res.body.members.map((m: any) => m.value).sort()).toEqual(['u1', 'u2']);
    expect(res.body.meta.version).toBe('W/"1"');
    etag2 = res.body.meta.version;

    // verify memberships were written
    const mems = await db.collection('groupMemberships').find({ groupId: new ObjectId(groupId2) }).toArray();
    expect(mems.length).toBe(2);
  });

  it('lists groups and hydrates members for groups with memberships', async () => {
    const res = await request(app).get('/scim/Groups');
    expectScim(res);
    expect(res.status).toBe(200);
    const found = res.body.Resources.find((r: any) => r.id === groupId2);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.members)).toBe(true);
    expect(found.members.length).toBe(2);
  });

  it('PATCH supports SCIM filtered path remove and replace for members', async () => {
    const res = await request(app)
      .patch(`/scim/Groups/${groupId2}`)
      .set('If-Match', etag2)
      .send({
        schemas: [Schemas.PatchOp],
        Operations: [
          { op: 'remove', path: 'members[value eq "u1"]' },
          { op: 'replace', path: "members[value eq 'u2']", value: { value: 'u3' } }
        ]
      });
    expectScim(res);
    expect(res.status).toBe(200);
    // members should now be only u3
    expect(res.body.members.map((m: any) => m.value)).toEqual(['u3']);
    // version bumped
    expect(res.body.meta.version).toMatch(/^W\/\"\d+\"$/);
    etag2 = res.body.meta.version;
  });

  it('deletes group and 404s on repeat', async () => {
    const res = await request(app).delete(`/scim/Groups/${groupId}`);
    expect(res.status).toBe(204);
    const res2 = await request(app).delete(`/scim/Groups/${groupId}`);
    expectScim(res2);
    expect(res2.status).toBe(404);
  });
});
