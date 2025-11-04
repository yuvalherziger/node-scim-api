import request from "supertest";
import type express from "express";

// Ensure test mode so server doesn't start
process.env.NODE_ENV = "test";

let app: express.Express;

describe("ServiceProviderConfig API", () => {
  beforeAll(async () => {
    process.env.SCIM_BEARER_TOKEN = "sek";
    const mod = await import("../src/index");
    app = mod.default as any;
  });

  it("returns ServiceProviderConfig with SCIM envelope and requires auth", async () => {
    // Without auth -> 401 by bearer middleware
    const unauth = await request(app).get("/ServiceProviderConfig");
    expect(unauth.status).toBe(401);

    // With auth -> 200 and SCIM ServiceProviderConfig
    const res = await request(app)
      .get("/ServiceProviderConfig")
      .set("authorization", "Bearer sek");

    expect(res.status).toBe(200);
    expect(res.body.schemas).toContain("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig");
    expect(res.body.meta?.resourceType).toBe("ServiceProviderConfig");
    expect(res.body.meta?.location).toBe("/ServiceProviderConfig");
    expect(typeof res.body.meta?.version).toBe("string");
  });
});
