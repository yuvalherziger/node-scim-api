import type { Request, Response } from "express";
import { Router } from "express";
import { Collection, ObjectId } from "mongodb";
import { db } from "../common/db.js";
import type { ListResponse, PatchRequest, User } from "./types.js";
import { Schemas } from "./types.js";
import {
  baseUrlFrom,
  checkIfMatch,
  listResponse,
  parseListParams,
  scimFilterToMongo,
  sendError,
  setCommonHeaders
} from "./util.js";

export const usersRouter = Router();

const collection = (): Collection => db.collection("users");

function hasEnterprise(input: any): boolean {
  try {
    if (!input) return false;
    if (Array.isArray(input.schemas) && input.schemas.includes(Schemas.EnterpriseUser)) return true;
    if (input[Schemas.EnterpriseUser]) return true;
  } catch {
  }
  return false;
}

function computeSchemas(obj: any): string[] {
  const base: string[] = [Schemas.User];
  if (hasEnterprise(obj)) base.push(Schemas.EnterpriseUser);
  return base;
}

function toBooleanOrUndefined(v: any): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return undefined;
}

function normalizeRolesPrimary(obj: any): any {
  if (!obj || !Array.isArray(obj.roles)) return obj;
  // 1) Coerce/clean primary values
  const coerced = obj.roles.map((r: any) => {
    if (r && Object.prototype.hasOwnProperty.call(r, "primary")) {
      const b = toBooleanOrUndefined((r as any).primary);
      if (b === undefined) {
        const { primary, ...rest } = r;
        return rest;
      }
      return { ...r, primary: b };
    }
    return r;
  });
  // 2) Ensure only a single primary=true exists per SCIM spec for multi-valued attributes
  let seenPrimary = false;
  obj.roles = coerced.map((r: any) => {
    if (r && r.primary === true) {
      if (seenPrimary) return { ...r, primary: false };
      seenPrimary = true;
      return r;
    }
    return r;
  });
  return obj;
}

function sanitizeUserInput(input: any): any {
  const { id, meta, schemas, _version, ...rest } = input || {};
  const finalObj = { ...rest };
  normalizeRolesPrimary(finalObj);
  finalObj.schemas = computeSchemas(input);
  return finalObj;
}

function sanitizeUserOutput(input: any): any {
  const { _version: _unusedVersion, ...rest } = input || {};
  const out = { ...rest };
  normalizeRolesPrimary(out);
  return out;
}

usersRouter.get("/Users", async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const { startIndex, count, filter, sortBy, sortOrder } = parseListParams(req);
  const q = scimFilterToMongo(filter);
  const col = collection();
  const total = await col.countDocuments(q, { collation: { locale: "en", strength: 2 } });
  const cursor = col.find(q, { skip: startIndex - 1, limit: count }).collation({ locale: "en", strength: 2 });
  if (sortBy && sortOrder) {
    cursor.sort({ [sortBy]: sortOrder })
  }
  const docs = await cursor.toArray();
  const base = baseUrlFrom(req);
  const resources = docs.map((d) => {
    const { _id, ...rest } = d as any;
    const safe = sanitizeUserOutput(rest);
    return {
      ...safe,
      id: String(d._id),
      schemas: computeSchemas(d),
      meta: {
        resourceType: "User",
        created: d.meta?.created || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: `W/"${d._version ?? 1}"`,
        location: `${base}/Users/${d._id}`
      }
    };
  });
  const resp: ListResponse<User> = listResponse<User>(base, "Users", resources, total, startIndex, count);
  res.status(200).send(resp);
});

usersRouter.get("/Users/:id", async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const doc = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return sendError(res, 404, "User not found");
  const base = baseUrlFrom(req);
  const { _id: _unused, ...rest } = doc as any;
  const safe = sanitizeUserOutput(rest);
  const resource = {
    ...safe,
    id: String(doc._id),
    schemas: computeSchemas(doc),
    meta: {
      resourceType: "User",
      created: doc.meta?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: `W/"${doc._version ?? 1}"`,
      location: `${base}/Users/${doc._id}`
    }
  };
  res.set("ETag", resource.meta.version);
  res.status(200).send(resource);
});

usersRouter.post("/Users", async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body = sanitizeUserInput(req.body);
  if (!body.userName) return sendError(res, 400, "userName is required", "invalidValue");
  // Prevent creating duplicate users by userName (case-insensitive)
  const col = collection();
  const existing = await col.findOne({ userName: body.userName }, { collation: { locale: "en", strength: 2 } });
  if (existing) return sendError(res, 409, "Duplicate userName", "uniqueness");
  const now = new Date().toISOString();
  const doc = { ...body, _version: 1, meta: { created: now } };
  const result = await col.insertOne(doc);
  const id = String(result.insertedId);
  const base = baseUrlFrom(req);
  const { _id: _unusedPost, ...postRest } = doc as any;
  const safePost = sanitizeUserOutput(postRest);
  const resource = {
    ...safePost,
    id,
    schemas: computeSchemas(doc),
    meta: { resourceType: "User", created: now, lastModified: now, version: "W/\"1\"", location: `${base}/Users/${id}` }
  };
  res.set("ETag", resource.meta.version);
  res.status(201).location(`${base}/Users/${id}`).send(resource);
});

usersRouter.put("/Users/:id", async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  const existing = await col.findOne({ _id: new ObjectId(req.params.id) });
  if (!existing) return sendError(res, 404, "User not found");
  const currentVersion = existing._version ?? 1;
  if (!checkIfMatch(req, currentVersion)) return sendError(res, 412, "Precondition Failed", "mutability");
  const body = sanitizeUserInput(req.body);
  const nextVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const replacement = { ...body, _version: nextVersion, meta: { created: existing.meta?.created || now } };
  const { _id, ...withoutId } = replacement;
  await col.replaceOne({ _id: existing._id }, withoutId);
  const base = baseUrlFrom(req);
  const { _id: _unusedPut, ...putRest } = replacement as any;
  const safePut = sanitizeUserOutput(putRest);
  const resource = {
    ...safePut,
    id: String(existing._id),
    schemas: computeSchemas(replacement),
    meta: {
      resourceType: "User",
      created: replacement.meta?.created || now,
      lastModified: now,
      version: `W/"${nextVersion}"`,
      location: `${base}/Users/${existing._id}`
    }
  };
  res.set("ETag", resource.meta.version);
  res.status(200).send(resource);
});

function applyPatch(target: any, op: any) {
  const opType = String(op?.op ?? "").toLowerCase() as "add" | "replace" | "remove";

  // Helper: coerce values for comparison
  function toComparable(v: any): any {
    if (typeof v === "string") {
      let s = v.trim();
      // strip surrounding quotes if present first
      if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("\"") && s.endsWith("\""))) s = s.slice(1, -1);
      const sl = s.toLowerCase();
      if (sl === "true" || sl === "1") return true;
      if (sl === "false" || sl === "0") return false;
      // number?
      const n = Number(s);
      if (!Number.isNaN(n) && String(n) === s) return n;
      return s;
    }
    return v;
  }

  // Helper: parse a single segment, possibly with a filter [attr eq "value"]
  function parseSegment(seg: string | undefined): { key: string; filter?: { attr: string; value: any } } {
    const s = seg ?? "";
    const m = s.match(/^(.+?)\[(.+?)\]$/);
    if (!m) return { key: s };
    const key = m[1] ?? s;
    const cond = m[2] ?? "";
    const cm = cond.match(/^\s*([^\s]+)\s+eq\s+(.+)\s*$/i);
    if (cm) {
      const attr = cm[1]!;
      let val: any = cm[2]!;
      val = toComparable(val);
      return { key, filter: { attr, value: val } };
    }
    return { key };
  }

  // Helper: split path into segments but keep bracket expressions intact
  // Additionally, do NOT split on dots that are part of a URN prefix (e.g., urn:ietf:...:2.0:User)
  // We treat everything from the beginning of a segment that starts with "urn:" up to and including ":User"
  // as a single segment so that a trailing attribute like ".employeeNumber" is parsed correctly.
  function splitPath(pathStr: string): string[] {
    const result: string[] = [];
    let cur = "";
    let depth = 0; // bracket filter depth [...]
    let urnActive = false; // inside a URN prefix (up to :User)

    for (let i = 0; i < pathStr.length; i++) {
      const ch = pathStr[i];

      // If starting a new segment, detect URN prefix
      if (cur === "" && pathStr.startsWith("urn:", i)) {
        urnActive = true;
      }

      if (ch === "[") {
        depth++;
        cur += ch;
        continue;
      }
      if (ch === "]") {
        depth = Math.max(0, depth - 1);
        cur += ch;
        continue;
      }

      // Split on dot only when not inside filter and not inside URN prefix
      if (ch === "." && depth === 0 && !urnActive) {
        result.push(cur);
        cur = "";
        continue;
      }

      cur += ch;

      // Turn off URN mode after we"ve included ":User"
      if (urnActive && cur.endsWith(":User")) {
        urnActive = false;
      }
    }
    if (cur) result.push(cur);
    return result;
  }

  // Helper: ensure array element by filter exists and return it
  function ensureFilteredElement(parent: any, key: string, filter: { attr: string; value: any }): any {
    if (!Array.isArray(parent[key])) parent[key] = [];
    const arr = parent[key];
    const idx = arr.findIndex((it: any) => {
      const a = it?.[filter.attr];
      if (typeof a === "string" && typeof filter.value === "string") return a.toLowerCase() === filter.value.toLowerCase();
      return a === filter.value;
    });
    if (idx >= 0) return arr[idx];
    // create new element seeded with the filter attr if it"s a string or boolean
    const seed: any = {};
    seed[filter.attr] = filter.value;
    arr.push(seed);
    return seed;
  }

  // Core setter logic using path with optional filters
  function setByPath(root: any, pathStr: string, value: any, opType: "add" | "replace" | "remove") {
    const parts = splitPath(pathStr);

    // Helper: detect enterprise extension manager path (urn:...:User.manager)
    function isEnterpriseManagerPath(partsArr: string[], lastKey: string): boolean {
      const parent = partsArr.length >= 2 ? partsArr[partsArr.length - 2] : "";
      return (
        lastKey === "manager" &&
        parent === "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"
      );
    }

    function asManagerObject(v: any): any {
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
      return { value: v };
    }

    let obj = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const { key, filter } = parseSegment(parts[i]);
      if (filter) {
        obj = ensureFilteredElement(obj, key, filter);
      } else {
        if (!(key in obj) || typeof obj[key] !== "object") obj[key] = {};
        obj = obj[key];
      }
    }
    const lastSeg = parts[parts.length - 1];
    const { key: lastKey, filter: lastFilter } = parseSegment(lastSeg);

    if (opType === "remove") {
      if (lastFilter) {
        // remove matching element from array
        if (Array.isArray(obj[lastKey])) {
          obj[lastKey] = obj[lastKey].filter((it: any) => {
            const a = it?.[lastFilter.attr];
            if (typeof a === "string" && typeof lastFilter.value === "string") return a.toLowerCase() !== lastFilter.value.toLowerCase();
            return a !== lastFilter.value;
          });
        } else {
          delete obj[lastKey];
        }
      } else {
        // remove property or remove matching value from array if op provides a value
        if (Array.isArray(obj[lastKey]) && typeof value === "object") {
          obj[lastKey] = obj[lastKey].filter((v: any) => JSON.stringify(v) !== JSON.stringify(value));
        } else {
          delete obj[lastKey];
        }
      }
      return;
    }

    if (opType === "add") {
      if (lastFilter) {
        const el = ensureFilteredElement(obj, lastKey, lastFilter);
        if (typeof value === "object" && !Array.isArray(value)) Object.assign(el, value); else Object.assign(el, { value });
      } else if (Array.isArray(obj[lastKey])) {
        if (Array.isArray(value)) obj[lastKey].push(...value); else obj[lastKey].push(value);
      } else if (typeof obj[lastKey] === "object" && typeof value === "object" && obj[lastKey] !== null) {
        Object.assign(obj[lastKey], value);
      } else {
        // Special-case: enterprise manager must be a complex object with sub-attribute "value"
        if (isEnterpriseManagerPath(parts, lastKey)) {
          obj[lastKey] = asManagerObject(value);
        } else {
          obj[lastKey] = value;
        }
      }
      return;
    }

    // replace
    if (lastFilter) {
      const el = ensureFilteredElement(obj, lastKey, lastFilter);
      if (typeof value === "object" && !Array.isArray(value)) {
        Object.assign(el, value);
      } else {
        // When replacing a scalar sub-attribute via filter, we assume the step before included the attribute key, so we set "value" property
        el.value = value;
      }
      return;
    }
    // Special-case: enterprise manager must be a complex object with sub-attribute "value"
    if (isEnterpriseManagerPath(parts, lastKey)) {
      obj[lastKey] = asManagerObject(value);
    } else {
      obj[lastKey] = value;
    }
  }

  let path = op.path as string | undefined;
  if (!path || path === "") {
    // Expand object keys using dotted or URN paths rather than flat assign
    if (opType === "add" || opType === "replace") {
      const objVal = op.value || {};
      if (objVal && typeof objVal === "object" && !Array.isArray(objVal)) {
        for (const [k0, v] of Object.entries(objVal)) {
          // Convert URN leaf colon into dot, preserving any trailing path (e.g. .value)
          let pathKey = String(k0);
          const urnMatch = pathKey.match(/^(urn:[^]+:User):([^\.\[]+)(.*)$/);
          if (urnMatch) pathKey = `${urnMatch[1]}.${urnMatch[2]}${urnMatch[3]}`;
          setByPath(target, pathKey, v, "replace");
        }
      } else {
        // primitive replace of root
        Object.assign(target, objVal);
      }
    } else if (opType === "remove") {
      for (const k of Object.keys(op.value || {})) delete target[k];
    }
    return;
  }

  // Non-empty path: normalize URN leaf colon to dot
  const urnPath = path.match(/^(urn:[^]+:User):([^\.\[]+)(.*)$/);
  if (urnPath) path = `${urnPath[1]}.${urnPath[2]}${urnPath[3]}`;
  setByPath(target, path, op.value, opType);
}

usersRouter.patch("/Users/:id", async (req: Request, res: Response) => {
  try {
    setCommonHeaders(res);
    const body: PatchRequest = req.body;
    if (!Array.isArray(body?.Operations)) return sendError(res, 400, "Invalid PatchOp", "invalidSyntax");
    const col = collection();
    const existing = await col.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return sendError(res, 404, "User not found");
    const currentVersion = existing._version ?? 1;
    if (!checkIfMatch(req, currentVersion)) return sendError(res, 412, "Precondition Failed", "mutability");
    let doc = { ...existing };
    for (const op of body.Operations) applyPatch(doc, op);
    // Normalize roles.primary before persisting
    normalizeRolesPrimary(doc);
    const nextVersion = currentVersion + 1;
    doc._version = nextVersion;
    // Prepare full replacement without _id so that removals are persisted
    const { _id, ...withoutId } = doc;
    await col.replaceOne({ _id: existing._id }, withoutId);
    const base = baseUrlFrom(req);
    const { _id: _unusedPatch, ...patchRest } = doc as any;
    const safePatch = sanitizeUserOutput(patchRest);
    const resource = {
      ...safePatch,
      id: String(existing._id),
      schemas: computeSchemas(doc),
      meta: {
        resourceType: "User",
        created: existing.meta?.created || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: `W/"${nextVersion}"`,
        location: `${base}/Users/${existing._id}`
      }
    };
    res.set("ETag", resource.meta.version);
    res.status(200).send(resource);
  } catch (e) {
    console.error(e);
    return sendError(res, 500, "Invalid PatchOp", "invalidSyntax")
  }
});

usersRouter.delete("/Users/:id", async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const col = collection();
  try {
    const id = new ObjectId(req.params.id);
    const r = await col.deleteOne({ _id: id });
    if (r.deletedCount === 0) return sendError(res, 404, "User not found");
    res.status(204).send();
  } catch {
    // Invalid ObjectId format should be treated as not found
    return sendError(res, 404, "User not found");
  }
});
