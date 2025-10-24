import express, { Request, Response } from 'express';
import request from 'supertest';

import {
  baseUrlFrom,
  checkIfMatch,
  error,
  etagNumberFrom,
  listResponse,
  parseListParams,
  SCIM_CONTENT_TYPE,
  scimFilterToMongo,
  setCommonHeaders,
  requireBearer,
  toScim,
  makeMeta,
  asObjectId,
} from '../src/api/util';

import { Schemas } from '../src/api/types';


describe('util.ts', () => {
  it('requireBearer enforces when configured and passes when correct', async () => {
    const app = express();
    app.get('/secure', requireBearer('sek'), (req: Request, res: Response) => res.status(200).json({ ok: true }));
    const r1 = await request(app).get('/secure');
    expect(r1.status).toBe(401);
    const r2 = await request(app).get('/secure').set('authorization', 'Bearer wrong');
    expect(r2.status).toBe(401);
    const r3 = await request(app).get('/secure').set('authorization', 'Bearer sek');
    expect(r3.status).toBe(200);
  });
  it('etagNumberFrom parses weak etag numbers', () => {
    expect(etagNumberFrom('W/"1"')).toBe(1);
    expect(etagNumberFrom('W/"42"')).toBe(42);
    expect(etagNumberFrom('invalid')).toBeUndefined();
    expect(etagNumberFrom(undefined)).toBeUndefined();
  });

  it('checkIfMatch permits when no If-Match header; blocks on mismatch', () => {
    const mkReq = (hdr?: string) => ({ header: (k: string) => (k === 'if-match' ? hdr : undefined) }) as unknown as Request;
    expect(checkIfMatch(mkReq(), 3)).toBe(true);
    expect(checkIfMatch(mkReq('W/"3"'), 3)).toBe(true);
    expect(checkIfMatch(mkReq('W/"2"'), 3)).toBe(false);
  });

  it('baseUrlFrom builds base url from req', () => {
    const req = {
      get: (h: string) => (h === 'x-forwarded-proto' ? 'https' : h === 'host' ? 'example.com' : undefined),
      protocol: 'http',
      baseUrl: '/scim',
    } as unknown as Request;
    expect(baseUrlFrom(req)).toBe('https://example.com/scim');
  });

  it('baseUrlFrom falls back to req.protocol when no x-forwarded-proto', () => {
    const req = {
      get: (h: string) => (h === 'host' ? 'example.com' : undefined),
      protocol: 'http',
      baseUrl: '/scim/',
    } as unknown as Request;
    expect(baseUrlFrom(req)).toBe('http://example.com/scim');
  });

  it('listResponse creates SCIM ListResponse envelope', () => {
    const lr = listResponse<any>('http://h', 'Users', [{ id: '1' }], 10, 1, 1);
    expect(lr.schemas).toContain(Schemas.ListResponse);
    expect(lr.totalResults).toBe(10);
    expect(lr.startIndex).toBe(1);
    expect(lr.itemsPerPage).toBe(1);
    expect(lr.Resources.length).toBe(1);
  });

  it('parseListParams returns defaults and supports sorting', () => {
    const req = {
      query: { startIndex: '2', count: '5', filter: 'userName sw "a"', sortBy: 'userName', sortOrder: 'descending' }
    } as unknown as Request;
    const p = parseListParams(req);
    expect(p.startIndex).toBe(2);
    expect(p.count).toBe(5);
    expect(p.filter).toContain('userName');
    expect(p.sortBy).toBe('userName');
    expect(p.sortOrder).toBe(-1);

    const p2 = parseListParams({ query: {} } as unknown as Request);
    expect(p2.startIndex).toBe(1);
    expect(p2.count).toBe(100);
    expect(p2.filter).toBe('');
    expect(p2.sortBy).toBe('');
    expect(p2.sortOrder).toBe(1);

    const p3 = parseListParams({ query: { startIndex: 'abc', count: '-5', sortBy: 'userName' } } as unknown as Request);
    expect(p3.startIndex).toBe(1);
    expect(p3.count).toBe(0);
    expect(p3.sortBy).toBe('userName');
    expect(p3.sortOrder).toBe(1);
  });

  it('scimFilterToMongo handles eq, co, sw, pr, and/or', () => {
    const f1 = scimFilterToMongo('userName eq "alice"');
    expect(f1).toMatchObject({ userName: 'alice' });

    const f2 = scimFilterToMongo('displayName co "Al"');
    expect(f2.displayName.$regex).toBeDefined();

    const f3 = scimFilterToMongo('userName sw "a"');
    expect(f3.userName.$regex.startsWith('^')).toBe(true);

    const f4 = scimFilterToMongo('name pr');
    expect(f4).toMatchObject({ name: { $exists: true } });

    const f5 = scimFilterToMongo('(userName sw "a") and (displayName co "x")');
    expect(f5.$and).toBeDefined();

    const f6 = scimFilterToMongo('userName sw "a" or userName sw "b"');
    expect(f6.$or).toBeDefined();
  });

  it('toScim builds meta and id for User and Group and handles null', () => {
    const base = 'http://example/scim';
    const userDoc = { _id: '123', userName: 'a', _version: 2, meta: { created: '2020-01-01T00:00:00.000Z' } } as any;
    const user = toScim('User', userDoc, base);
    expect(user.id).toBe('123');
    expect(user.meta.location).toBe(`${base}/Users/123`);
    expect(user.meta.version).toBe('W/"2"');

    const groupDoc = { _id: 'g1', displayName: 'g', _version: 5 } as any;
    const group = toScim('Group', groupDoc, base);
    expect(group.meta.location).toBe(`${base}/Groups/g1`);
    expect(group.meta.version).toBe('W/"5"');

    expect(toScim('User', undefined as any, base)).toBeNull();
  });

  it('makeMeta constructs standard SCIM meta', () => {
    const base = 'http://h';
    const m = makeMeta('User', 'id1', base, 3, '2020-01-01T00:00:00.000Z');
    expect(m.resourceType).toBe('User');
    expect(m.version).toBe('W/"3"');
    expect(m.location.startsWith(base + '/')).toBe(true);
  });

  it('asObjectId returns ObjectId for valid and generates for invalid', () => {
    const valid = asObjectId('507f1f77bcf86cd799439011');
    expect(typeof valid).toBe('object');
    const invalid = asObjectId('not-a-valid-objectid');
    expect(typeof invalid).toBe('object');
  });

  it('setCommonHeaders and error set SCIM content type and envelope', async () => {
    const app = express();
    app.get('/err', (req: Request, res: Response) => {
      setCommonHeaders(res);
      res.status(400).send(error(400, 'bad'));
    });
    const r = await request(app).get('/err');
    expect(r.headers['content-type']).toContain(SCIM_CONTENT_TYPE);
    expect(r.body.schemas).toContain(Schemas.Error);
    expect(r.status).toBe(400);
  });
});
