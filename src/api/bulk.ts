import type { Request, Response } from "express";
import { Router } from "express";
import { db } from "../common/db.js";
import { Schemas } from "./types.js";
import { sendError, setCommonHeaders } from "./util.js";
import { ObjectId } from "mongodb";

export const bulkRouter = Router();

function isValidBulkRequest(body: any): boolean {
  return !!body && Array.isArray(body.Operations);
}

function buildBulkResponseSkeleton() {
  return {
    schemas: [Schemas.BulkResponse],
    id: "bulk-response",
    Operations: [] as any[],
  };
}

const MISSING_RESOURCE_ID = { status: "400", response: { detail: "Missing resource id" } };

function extractIdFromPath(path: string): string | null {
  const parts = (path || "").split("/");
  return parts.length > 2 && parts[2] ? parts[2] : null;
}

async function insertWithMeta(collectionName: "users" | "groups", data: any) {
  const col = db.collection(collectionName);
  return col.insertOne({ ...data, _version: 1, meta: { created: new Date().toISOString() } });
}

async function handleUsersOperation(method: string, path: string, data: any) {
  const col = db.collection("users");
  if (method === "POST") {
    const r = await insertWithMeta("users", data);
    return { location: `/Users/${r.insertedId}`, status: "201" };
  }
  if (method === "PUT" || method === "PATCH") {
    const id = extractIdFromPath(path);
    if (!id) return MISSING_RESOURCE_ID;
    await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
    return { location: `/Users/${id}`, status: "200" };
  }
  if (method === "DELETE") {
    const id = extractIdFromPath(path);
    if (!id) return MISSING_RESOURCE_ID;
    await col.deleteOne({ _id: new ObjectId(id) });
    return { location: `/Users/${id}`, status: "204" };
  }
  return { status: "400", response: { detail: "Unsupported method" } };
}

async function handleGroupsOperation(method: string, path: string, data: any) {
  const col = db.collection("groups");
  if (method === "POST") {
    const r = await insertWithMeta("groups", data);
    return { location: `/Groups/${r.insertedId}`, status: "201" };
  }
  if (method === "PUT" || method === "PATCH") {
    const id = extractIdFromPath(path);
    if (!id) return MISSING_RESOURCE_ID;
    await col.updateOne({ _id: new ObjectId(id) }, { $set: data });
    return { location: `/Groups/${id}`, status: "200" };
  }
  if (method === "DELETE") {
    const id = extractIdFromPath(path);
    if (!id) return MISSING_RESOURCE_ID;
    await col.deleteOne({ _id: new ObjectId(id) });
    return { location: `/Groups/${id}`, status: "204" };
  }
  return { status: "400", response: { detail: "Unsupported method" } };
}

async function executeOperation(op: any) {
  const method = (op.method || "").toUpperCase();
  const path: string = op.path || "";
  const data = op.data;

  try {
    if (path.startsWith("/Users")) {
      return await handleUsersOperation(method, path, data);
    }
    if (path.startsWith("/Groups")) {
      return await handleGroupsOperation(method, path, data);
    }
    return { status: "400", response: { detail: "Unsupported path" } };
  } catch (e: any) {
    return { status: "500", response: { detail: e?.message || "Server error" } };
  }
}

async function processOperations(operations: any[]) {
  const results: any[] = [];
  for (const op of operations) {
    results.push(await executeOperation(op));
  }
  return results;
}

// ---- Route handler (delegates to helpers) ----
bulkRouter.post("/Bulk", async (req: Request, res: Response) => {
  setCommonHeaders(res);
  const body = req.body;
  if (!isValidBulkRequest(body)) {
    return sendError(res, 400, "Invalid Bulk request", "invalidSyntax");
  }

  const resp = buildBulkResponseSkeleton();
  resp.Operations = await processOperations(body.Operations);
  res.status(200).send(resp);
});
