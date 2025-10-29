import express from "express";
import request from "supertest";
import { Schemas } from "../src/api/types";

let app: express.Express;
let client: any;
let db: any;

beforeAll(async () => {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  process.env.DB_NAME = `scim_bulk_test_${uniqueSuffix}`;

  const dbMod = await import("../src/common/db");
  client = dbMod.client;
  db = dbMod.db;
  await client.connect();

  const { bulkRouter } = await import("../src/api/bulk");

  app = express();
  app.use(express.json());
  app.use("/scim", bulkRouter);
});

afterAll(async () => {
  try {
    await db.dropDatabase();
  } finally {
    await client.close();
  }
});

function expectScim(res: request.Response) {
  expect(res.headers["content-type"]).toContain("application/scim+json");
}

describe("Bulk API", () => {
  it("rejects invalid bulk request", async () => {
    const res = await request(app).post("/scim/Bulk").send({});
    expectScim(res);
    expect(res.status).toBe(400);
    expect(res.body.schemas).toContain(Schemas.Error);
  });

  it("supports user CRUD operations", async () => {
    // Create user
    let res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "POST", path: "/Users", data: { userName: "bulk.alice", displayName: "Bulk Alice" } }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain(Schemas.BulkResponse);
    expect(Array.isArray(res.body.Operations)).toBe(true);
    expect(res.body.Operations[0].status).toBe("201");
    const loc: string = res.body.Operations[0].location;
    expect(loc).toMatch(/^\/Users\//);
    const userId = loc.split("/")[2];

    // Update user with PUT
    res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "PUT", path: `/Users/${userId}`, data: { displayName: "Bulk Alice Cooper" } }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0].status).toBe("200");

    // Patch user (treated as update)
    res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "PATCH", path: `/Users/${userId}`, data: { active: true } }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0].status).toBe("200");

    // Delete user
    res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "DELETE", path: `/Users/${userId}` }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0].status).toBe("204");
  });

  it("supports group CRUD operations", async () => {
    // Create group
    let res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "POST", path: "/Groups", data: { displayName: "Bulk Group" } }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain(Schemas.BulkResponse);
    expect(res.body.Operations[0].status).toBe("201");
    const groupId: string = res.body.Operations[0].location.split("/")[2];

    // Update group
    res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "PUT", path: `/Groups/${groupId}`, data: { displayName: "Bulk Group 2" } }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0].status).toBe("200");

    // Delete group
    res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "DELETE", path: `/Groups/${groupId}` }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0].status).toBe("204");
  });

  it("returns 400 for missing resource id on update/delete", async () => {
    const res = await request(app)
      .post("/scim/Bulk")
      .send({
        Operations: [
          { method: "PUT", path: "/Users", data: {} },
          { method: "PATCH", path: "/Groups", data: {} },
          { method: "DELETE", path: "/Users" }
        ]
      });
    expectScim(res);
    expect(res.status).toBe(200);
    const ops = res.body.Operations;
    expect(ops[0]).toMatchObject({ status: "400", response: { detail: "Missing resource id" } });
    expect(ops[1]).toMatchObject({ status: "400", response: { detail: "Missing resource id" } });
    expect(ops[2]).toMatchObject({ status: "400", response: { detail: "Missing resource id" } });
  });

  it("returns 400 for unsupported method and path", async () => {
    const res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "GET", path: "/Users" }, { method: "POST", path: "/Foos" }] });
    expectScim(res);
    expect(res.status).toBe(200);
    const ops = res.body.Operations;
    expect(ops[0]).toMatchObject({ status: "400", response: { detail: "Unsupported method" } });
    expect(ops[1]).toMatchObject({ status: "400", response: { detail: "Unsupported path" } });
  });

  it("returns 400 for unsupported method on Groups (line 73)", async () => {
    const res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "GET", path: "/Groups" }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0]).toMatchObject({ status: "400", response: { detail: "Unsupported method" } });
  });

  it("wraps server errors and returns 500 in Operation", async () => {
    const res = await request(app)
      .post("/scim/Bulk")
      .send({ Operations: [{ method: "PUT", path: "/Users/this-is-not-a-valid-objectid", data: { x: 1 } }] });
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body.Operations[0].status).toBe("500");
    expect(res.body.Operations[0].response?.detail).toBeTruthy();
  });
});
