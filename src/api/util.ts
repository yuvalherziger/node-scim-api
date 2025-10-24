import type { NextFunction, Request, Response } from 'express';
import { ObjectId, type WithId } from 'mongodb';
import { type ErrorResponse, type ListResponse, Schemas, type ScimMeta } from './types.js';

export const SCIM_CONTENT_TYPE = 'application/scim+json';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeMeta(resourceType: string, id: string, baseUrl: string, versionNum: number, created?: string): ScimMeta {
  const createdAt = created ?? nowIso();
  const lastModified = nowIso();
  return {
    resourceType,
    created: createdAt,
    lastModified,
    location: `${baseUrl}/${resourceType}${resourceType === 'ServiceProviderConfig' || resourceType === 'ResourceType' || resourceType === 'Schema' ? '' : ''}`,
    version: `W/"${versionNum}"`,
  };
}

export function toScim<T extends { _id?: ObjectId; meta?: ScimMeta; _version?: number }>(
  resourceType: string,
  doc: WithId<any> | any,
  baseUrl: string,
): any {
  if (!doc) return null;
  const id = String(doc.id || doc._id || doc._id?.toString?.() || doc.id?.toString?.());
  const versionNum = doc._version ?? 1;
  const created = doc.meta?.created;
  const meta: ScimMeta = {
    resourceType,
    created: created || nowIso(),
    lastModified: nowIso(),
    location: `${baseUrl}/${resourceType === 'User' ? 'Users' : resourceType === 'Group' ? 'Groups' : resourceType}` + (id ? `/${id}` : ''),
    version: `W/"${versionNum}"`,
  };
  const { _id, _version, ...rest } = doc;
  return { ...rest, id, meta };
}

export function listResponse<T>(
  baseUrl: string,
  resourceType: string,
  resources: any[],
  totalResults: number,
  startIndex: number,
  count: number,
): ListResponse<T> {
  return {
    schemas: [Schemas.ListResponse],
    id: `${resourceType}-list-${startIndex}-${count}`,
    totalResults,
    startIndex,
    itemsPerPage: count,
    Resources: resources,
  } as unknown as ListResponse<T>;
}

export function error(status: number, detail: string, scimType?: string): ErrorResponse {
  return {
    schemas: [Schemas.Error],
    id: `${status}`,
    status: String(status),
    detail,
    scimType,
  } as ErrorResponse;
}

export function sendError(res: Response, status: number, detail: string, scimType?: string) {
  res.status(status).type(SCIM_CONTENT_TYPE).send(error(status, detail, scimType));
}

export function requireBearer(token?: string) {
  const configured = token && token.length > 0;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!configured) return next();
    const auth = req.header('authorization') || '';
    const expected = `Bearer ${token}`;
    if (auth !== expected) {
      return sendError(res, 401, 'Unauthorized', 'invalidToken');
    }
    next();
  };
}

export function baseUrlFrom(req: Request): string {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const base = `${proto}://${host}${req.baseUrl}`.replace(/\/$/, '');
  return base;
}

// Very small SCIM filter to MongoDB converter supporting: eq, co, sw, pr, and, or for simple expressions.
export function scimFilterToMongo(filter?: string): any {
  if (!filter) return {};
  const tokens = tokenizeFilter(filter);
  const ast = parseExpression(tokens);
  return astToMongo(ast);
}

type Token =
  | { type: 'attr'; value: string }
  | { type: 'string'; value: string }
  | { type: 'lparen' | 'rparen' | 'and' | 'or' | 'pr' | 'eq' | 'co' | 'sw' };

function tokenizeFilter(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch && /\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    const rest = input.slice(i).toLowerCase();
    if (rest.startsWith('and')) {
      tokens.push({ type: 'and' });
      i += 3;
      continue;
    }
    if (rest.startsWith('or')) {
      tokens.push({ type: 'or' });
      i += 2;
      continue;
    }
    if (rest.startsWith('pr')) {
      tokens.push({ type: 'pr' });
      i += 2;
      continue;
    }
    if (rest.startsWith('eq')) {
      tokens.push({ type: 'eq' });
      i += 2;
      continue;
    }
    if (rest.startsWith('co')) {
      tokens.push({ type: 'co' });
      i += 2;
      continue;
    }
    if (rest.startsWith('sw')) {
      tokens.push({ type: 'sw' });
      i += 2;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      const quote = ch;
      i++;
      let s = '';
      while (i < input.length && input[i] !== quote) {
        s += input[i++];
      }
      i++; // skip quote
      tokens.push({ type: 'string', value: s });
      continue;
    }
    // attribute or bare value
    let word = '';
    while (i < input.length && /[^\s()]/.test(input?.[i] || "")) {
      word += input[i++];
    }
    tokens.push({ type: 'attr', value: word });
  }
  return tokens;
}

type AST = any;

function parseExpression(tokens: any[]): AST {
  let i = 0;

  function parsePrimary(): AST {
    const t = tokens[i++];
    if (!t) return null;
    if (t.type === 'lparen') {
      const expr = parseOr();
      if (tokens[i]?.type === 'rparen') i++;
      return expr;
    }
    if (t.type === 'attr') {
      const attr = t.value;
      const next = tokens[i];
      if (next?.type === 'pr') {
        i++;
        return { type: 'pr', attr };
      }
      if (next && (next.type === 'eq' || next.type === 'co' || next.type === 'sw')) {
        i++; // consume operator
        const valTok = tokens[i++];
        const value = valTok?.value;
        return { type: next.type, attr, value };
      }
      return { type: 'pr', attr }; // fallback: treat as present
    }
    return null;
  }

  function parseAnd(): AST {
    let left = parsePrimary();
    while (tokens[i]?.type === 'and') {
      i++;
      const right = parsePrimary();
      left = { type: 'and', left, right };
    }
    return left;
  }

  function parseOr(): AST {
    let left = parseAnd();
    while (tokens[i]?.type === 'or') {
      i++;
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  return parseOr();
}

function astToMongo(ast: AST): any {
  if (!ast) return {};
  switch (ast.type) {
    case 'and':
      return { $and: [astToMongo(ast.left), astToMongo(ast.right)] };
    case 'or':
      return { $or: [astToMongo(ast.left), astToMongo(ast.right)] };
    case 'pr':
      return pathToMongo(ast.attr, { $exists: true });
    case 'eq':
      return pathToMongo(ast.attr, normalizeValue(ast.value));
    case 'co':
      return pathToMongo(ast.attr, { $regex: escapeRegExp(String(ast.value)), $options: 'i' });
    case 'sw':
      return pathToMongo(ast.attr, { $regex: '^' + escapeRegExp(String(ast.value)), $options: 'i' });
    default:
      return {};
  }
}

function pathToMongo(path: string, value: any): any {
  const mongoPath = path.replace(/\./g, '.');
  return { [mongoPath]: value };
}

function normalizeValue(v: any): any {
  if (typeof v !== 'string') return v;
  // try boolean or number
  if (v.toLowerCase() === 'true') return true;
  if (v.toLowerCase() === 'false') return false;
  const num = Number(v);
  if (!Number.isNaN(num)) return num;
  return v;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function etagNumberFrom(header?: string): number | undefined {
  if (!header) return undefined;
  const m = header.match(/W\/\"(\d+)\"/);
  if (!m) return undefined;
  return Number(m[1]);
}

export function checkIfMatch(req: Request, currentVersion: number): boolean {
  const ifMatch = req.header('if-match');
  if (!ifMatch) return true;
  const expected = etagNumberFrom(ifMatch);
  return expected === currentVersion;
}

export function parseListParams(req: Request): {
  startIndex: number;
  count: number;
  filter: string;
  sortBy: string;
  sortOrder?: 1 | -1
} {
  const startIndex = Math.max(1, parseInt(String(req.query.startIndex ?? '1')) || 1);
  const count = Math.max(0, Math.min(1000, parseInt(String(req.query.count ?? '100')) || 100));
  const filter = typeof req.query.filter === 'string' ? req.query.filter : "";
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : "";
  const sortOrderParam = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : undefined;
  const sortOrder: 1 | -1 = sortOrderParam?.toLowerCase() === 'descending' ? -1 : 1;
  return { startIndex, count, filter, sortBy, sortOrder };
}

export function asObjectId(id: string): ObjectId {
  try {
    return new ObjectId(id);
  } catch {
    return new ObjectId();
  }
}

export function setCommonHeaders(res: Response) {
  res.type(SCIM_CONTENT_TYPE);
}
