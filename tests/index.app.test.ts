import request from "supertest";
import type express from "express";

// Ensure test mode so server doesn't start
process.env.NODE_ENV = "test";

let app: express.Express;

describe("index app integration (without server)", () => {
  beforeAll(async () => {
    // Set a bearer token to ensure middleware is active
    process.env.SCIM_BEARER_TOKEN = "sek";
    const mod = await import("../src/index");
    app = mod.default as any;
  });

  it("exposes public /healthy without auth", async () => {
    const res = await request(app).get("/healthy");
    expect(res.status).toBe(200);
    expect(res.body.healthy).toBe(true);
  });

  it("requires bearer token for protected routes (ServiceProviderConfig)", async () => {
    const res = await request(app).get("/ServiceProviderConfig");
    expect(res.status).toBe(401);
    // With correct token we should pass auth and get 200 from the route
    const ok = await request(app).get("/ServiceProviderConfig").set("authorization", "Bearer sek");
    expect(ok.status).toBe(200);
  });
});
