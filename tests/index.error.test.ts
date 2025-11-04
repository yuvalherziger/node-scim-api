import request from "supertest";
import type express from "express";

// Ensure test mode so server doesn't start
process.env.NODE_ENV = "test";

let app: express.Express;

describe("index error handling", () => {
  beforeAll(async () => {
    process.env.SCIM_BEARER_TOKEN = "sek";
    const mod = await import("../src/index");
    app = mod.default as any;
  });

  it("returns SCIM 500 on body parser error with SCIM envelope", async () => {
    const res = await request(app)
      .post("/Users")
      .set("authorization", "Bearer sek")
      .set("content-type", "application/scim+json")
      .send("{ this is not valid json }");
    // Express 5 body parser yields 400 by default, but our error handler normalizes to 500 SCIM Error
    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toContain("application/scim+json");
    expect(res.body.schemas).toContain("urn:ietf:params:scim:api:messages:2.0:Error");
    expect(res.body.status).toBe("500");
  });
});
