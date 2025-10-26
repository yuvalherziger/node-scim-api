// Tests for MongoDB connection using real database
// These tests assume MONGODB_URI is provided in environment
// Choose a unique DB name per test run to avoid collisions
const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const TEST_DB_NAME = process.env.DB_NAME || `scim_api_test_${uniqueSuffix}`;
process.env.DB_NAME = TEST_DB_NAME;
let client;
let db;
beforeAll(async () => {
    // Import after setting env var so db.ts uses the test DB name
    const mod = await import("../src/common/db");
    client = mod.client;
    db = mod.db;
    await client.connect();
});
afterAll(async () => {
    try {
        // Drop the entire test database regardless of test success
        // await db.dropDatabase();
    }
    finally {
        await client.close();
    }
});
describe("MongoDB real DB smoke test", () => {
    it("can insert and read a document", async () => {
        const col = db.collection("smoke_items");
        const payload = { name: "node-scim-api-unit-test", createdAt: new Date(), n: 42 };
        const insertResult = await col.insertOne(payload);
        expect(insertResult.acknowledged).toBe(true);
        const found = await col.findOne({ _id: insertResult.insertedId });
        expect(found).toBeTruthy();
        expect(found.name).toBe(payload.name);
        expect(found.n).toBe(payload.n);
    });
    it("can create an index", async () => {
        const col = db.collection("smoke_items");
        const idxName = await col.createIndex({ name: 1 }, { unique: false });
        expect(typeof idxName).toBe("string");
        const idxes = await col.indexes();
        expect(idxes.some(i => i.name === idxName)).toBe(true);
    });
});
export {};
//# sourceMappingURL=db.test.js.map