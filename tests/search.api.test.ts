import express from "express";
import request from "supertest";
import { Schemas } from "../src/api/types";

let app: express.Express;
let client: any;
let db: any;

beforeAll(async () => {
  // Use a unique database for isolation
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  process.env.DB_NAME = `scim_search_test_${unique}`;

  const dbMod = await import("../src/common/db");
  client = dbMod.client;
  db = dbMod.db;
  await client.connect();

  // Seed Users and Groups directly
  const users = db.collection("users");
  const groups = db.collection("groups");
  await users.insertMany([
    { userName: "alice", displayName: "Alice", meta: { created: new Date().toISOString() }, _version: 1 },
    { userName: "alex", displayName: "Alex", meta: { created: new Date().toISOString() }, _version: 2 },
    { userName: "bob", displayName: "Bob", meta: { created: new Date().toISOString() }, _version: 3 },
  ]);
  await groups.insertMany([
    { displayName: "devs", meta: { created: new Date().toISOString() }, _version: 1 },
    { displayName: "admins", meta: { created: new Date().toISOString() }, _version: 2 },
  ]);

  const { searchRouter } = await import("../src/api/search");

  app = express();
  app.use(express.json());
  app.use("/scim", searchRouter);
});

afterAll(async () => {
  try {
    await db.dropDatabase();
  } finally {
    await client.close();
  }
});

describe("Search API", () => {
  it("POST /Users/.search returns filtered, sorted, and paginated users", async () => {
    const res = await request(app)
      .post("/scim/Users/.search")
      .send({
        filter: 'userName sw "a"',
        sortBy: "userName",
        sortOrder: "descending",
        startIndex: 1,
        count: 2,
      });
    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain(Schemas.ListResponse);
    expect(res.body.startIndex).toBe(1);
    expect(res.body.itemsPerPage).toBe(2);
    // Matching users: "alice", "alex" -> sorted desc gives ["alice", "alex"]
    expect(res.body.Resources.length).toBeGreaterThanOrEqual(2);
    expect(res.body.Resources[0].userName).toBe("alice");
    expect(res.body.Resources[1].userName).toBe("alex");
    // Ensure SCIM envelope on resources
    expect(res.body.Resources[0].schemas).toContain(Schemas.User);
    expect(res.body.Resources[0].meta.location).toMatch(/\/scim\/Users\//);
  });

  it("POST /.search defaults to Users search", async () => {
    const res = await request(app)
      .post("/scim/.search")
      .send({ filter: 'userName eq "bob"' });
    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain(Schemas.ListResponse);
    expect(Array.isArray(res.body.Resources)).toBe(true);
    expect(res.body.Resources.some((r: any) => r.userName === "bob")).toBe(true);
  });

  it("POST /Groups/.search searches groups collection", async () => {
    const res = await request(app)
      .post("/scim/Groups/.search")
      .send({ filter: 'displayName co "min"', sortBy: "displayName", sortOrder: "ascending" });
    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain(Schemas.ListResponse);
    expect(res.body.Resources.length).toBeGreaterThan(0);
    expect(res.body.Resources[0].schemas).toContain(Schemas.Group);
    expect(res.body.Resources[0].meta.location).toMatch(/\/scim\/Groups\//);
  });
});
