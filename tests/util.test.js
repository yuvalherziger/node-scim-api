import express, { Request, Response } from 'express';
import request from 'supertest';
import { baseUrlFrom, checkIfMatch, error, etagNumberFrom, listResponse, parseListParams, SCIM_CONTENT_TYPE, scimFilterToMongo, setCommonHeaders, } from '../src/api/util';
import { Schemas } from '../src/api/types';
describe('util.ts', () => {
    it('etagNumberFrom parses weak etag numbers', () => {
        expect(etagNumberFrom('W/"1"')).toBe(1);
        expect(etagNumberFrom('W/"42"')).toBe(42);
        expect(etagNumberFrom('invalid')).toBeUndefined();
        expect(etagNumberFrom(undefined)).toBeUndefined();
    });
    it('checkIfMatch permits when no If-Match header; blocks on mismatch', () => {
        const mkReq = (hdr) => ({ header: (k) => (k === 'if-match' ? hdr : undefined) });
        expect(checkIfMatch(mkReq(), 3)).toBe(true);
        expect(checkIfMatch(mkReq('W/"3"'), 3)).toBe(true);
        expect(checkIfMatch(mkReq('W/"2"'), 3)).toBe(false);
    });
    it('baseUrlFrom builds base url from req', () => {
        const req = {
            get: (h) => (h === 'x-forwarded-proto' ? 'https' : h === 'host' ? 'example.com' : undefined),
            protocol: 'http',
            baseUrl: '/scim',
        };
        expect(baseUrlFrom(req)).toBe('https://example.com/scim');
    });
    it('listResponse creates SCIM ListResponse envelope', () => {
        const lr = listResponse('http://h', 'Users', [{ id: '1' }], 10, 1, 1);
        expect(lr.schemas).toContain(Schemas.ListResponse);
        expect(lr.totalResults).toBe(10);
        expect(lr.startIndex).toBe(1);
        expect(lr.itemsPerPage).toBe(1);
        expect(lr.Resources.length).toBe(1);
    });
    it('parseListParams returns defaults and supports sorting', () => {
        const req = {
            query: { startIndex: '2', count: '5', filter: 'userName sw "a"', sortBy: 'userName', sortOrder: 'descending' }
        };
        const p = parseListParams(req);
        expect(p.startIndex).toBe(2);
        expect(p.count).toBe(5);
        expect(p.filter).toContain('userName');
        expect(p.sortBy).toBe('userName');
        expect(p.sortOrder).toBe(-1);
        const p2 = parseListParams({ query: {} });
        expect(p2.startIndex).toBe(1);
        expect(p2.count).toBe(100);
        expect(p2.filter).toBe('');
        expect(p2.sortBy).toBe('');
        expect(p2.sortOrder).toBe(1);
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
    it('setCommonHeaders and error set SCIM content type and envelope', async () => {
        const app = express();
        app.get('/err', (req, res) => {
            setCommonHeaders(res);
            res.status(400).send(error(400, 'bad'));
        });
        const r = await request(app).get('/err');
        expect(r.headers['content-type']).toContain(SCIM_CONTENT_TYPE);
        expect(r.body.schemas).toContain(Schemas.Error);
        expect(r.status).toBe(400);
    });
});
//# sourceMappingURL=util.test.js.map