import express from "express";
import request from "supertest";
import { Schemas } from "../src/api/types";

let app: express.Express;

beforeAll(async () => {
  const { selfRouter } = await import("../src/api/self");
  app = express();
  app.use(express.json());
  app.use("/scim", selfRouter);
});

describe("Self API /Me", () => {
  it("returns 501 Not Implemented with SCIM error envelope", async () => {
    const res = await request(app).get("/scim/Me");
    expect(res.status).toBe(501);
    expect(res.headers["content-type"]).toContain("application/scim+json");
    expect(res.body.schemas).toContain(Schemas.Error);
    expect(res.body.status).toBe("501");
  });
});
