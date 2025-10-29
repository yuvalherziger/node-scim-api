import express from "express";
import request from "supertest";
import { Schemas } from "../src/api/types";

let app: express.Express;
let client: any;
let db: any;

beforeAll(async () => {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  process.env.DB_NAME = `scim_users_extra_test_${uniqueSuffix}`;

  const dbMod = await import("../src/common/db");
  client = dbMod.client;
  db = dbMod.db;
  await client.connect();

  const { usersRouter } = await import("../src/api/users");

  app = express();
  app.use(express.json());
  app.use("/scim", usersRouter);
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

describe("Users API extra coverage", () => {
  let userId = "";
  let etag = 'W/"1"';

  it("creates baseline user", async () => {
    const res = await request(app)
      .post("/scim/Users")
      .send({ userName: "alice", displayName: "Alice" });
    expectScim(res);
    expect(res.status).toBe(201);
    userId = res.body.id;
    expect(res.body.meta.version).toBe('W/"1"');
  });

  it("rejects duplicate userName (case-insensitive) with 409", async () => {
    const res = await request(app)
      .post("/scim/Users")
      .send({ userName: "ALICE", displayName: "Duplicate" });
    expectScim(res);
    expect(res.status).toBe(409);
    expect(res.body.schemas).toContain(Schemas.Error);
  });

  it("GET returns ETag and resource", async () => {
    const res = await request(app).get(`/scim/Users/${userId}`);
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.headers["etag"]).toBeDefined();
    etag = res.headers["etag"];
  });

  it("DELETE with invalid ObjectId format returns 404", async () => {
    const res = await request(app).delete(`/scim/Users/not-an-objectid`);
    expectScim(res);
    expect(res.status).toBe(404);
    expect(res.body.schemas).toContain(Schemas.Error);
  });

  it("PATCH supports URN paths: manager scalar coerced to object and employeeNumber replace", async () => {
    const res1 = await request(app)
      .patch(`/scim/Users/${userId}`)
      .set("If-Match", etag)
      .send({
        schemas: [Schemas.PatchOp],
        Operations: [
          {
            op: "add",
            path:
              "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager",
            value: "mgr-123"
          },
          {
            op: "replace",
            path:
              "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:employeeNumber",
            value: "999"
          }
        ]
      });
    expectScim(res1);
    expect(res1.status).toBe(200);
    expect(res1.body[Schemas.EnterpriseUser]).toBeDefined();
    expect(res1.body[Schemas.EnterpriseUser].manager).toEqual({ value: "mgr-123" });
    expect(res1.body[Schemas.EnterpriseUser].employeeNumber).toBe("999");
    etag = res1.body.meta.version;
  });

  it("PATCH object root with URN key having colon leaf is applied", async () => {
    // Using empty path and value object with URN manager sub-attribute set as object
    const payload: any = {
      schemas: [Schemas.PatchOp],
      Operations: [
        {
          op: "add",
          path: "",
          value: {
            [Schemas.EnterpriseUser + ":manager"]: { value: "mgr-456", display: "Boss" }
          }
        }
      ]
    };
    const res = await request(app)
      .patch(`/scim/Users/${userId}`)
      .set("If-Match", etag)
      .send(payload);
    expectScim(res);
    expect(res.status).toBe(200);
    expect(res.body[Schemas.EnterpriseUser].manager.value).toBe("mgr-456");
    etag = res.body.meta.version;
  });

  it("PATCH supports array filter segments add/replace/remove", async () => {
    const res = await request(app)
      .patch(`/scim/Users/${userId}`)
      .set("If-Match", etag)
      .send({
        schemas: [Schemas.PatchOp],
        Operations: [
          { op: "add", path: "emails", value: [{ value: "b@x.com" }, { value: "c@x.com" }] },
          { op: "replace", path: 'emails[value eq "b@x.com"]', value: { display: "Bee" } },
          { op: "remove", path: 'emails[value eq "c@x.com"]' }
        ]
      });
    expectScim(res);
    expect(res.status).toBe(200);
    const emails = res.body.emails as Array<any>;
    expect(emails.find(e => e.value === "b@x.com")?.display).toBe("Bee");
    expect(emails.find(e => e.value === "c@x.com")).toBeUndefined();
    etag = res.body.meta.version;
  });

  it("normalizes roles.primary values: only one true, coercions applied, invalid removed", async () => {
    const res = await request(app)
      .post("/scim/Users")
      .send({
        userName: "charlie",
        roles: [
          { value: "r1", primary: true },
          { value: "r2", primary: "true" as any },
          { value: "r3", primary: 1 as any },
          { value: "r4", primary: "maybe" as any }
        ]
      });
    expectScim(res);
    expect(res.status).toBe(201);
    const roles = res.body.roles as Array<any>;
    // Only the first true should remain true; others coerced to false or removed if invalid
    const r1 = roles.find(r => r.value === "r1");
    const r2 = roles.find(r => r.value === "r2");
    const r3 = roles.find(r => r.value === "r3");
    const r4 = roles.find(r => r.value === "r4");
    expect(r1?.primary).toBe(true);
    expect(r2?.primary).toBe(false);
    expect(r3?.primary).toBe(false);
    // invalid string "maybe" should drop the primary property
    expect(Object.prototype.hasOwnProperty.call(r4 || {}, "primary")).toBe(false);
  });
});
