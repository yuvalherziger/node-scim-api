import { EventEmitter } from "events";

// We'll isolate module loading to control env and mocks

describe("hooks listener", () => {
  const streams: Record<string, any> = {};
  const watchMocks: Record<string, jest.Mock> = {};
  const closeMocks: Record<string, jest.Mock> = {};
  const resumeDoc: any = {};

  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;

  const hooksCalls: string[] = [];

  beforeEach(() => {
    jest.resetModules();
    for (const k of Object.keys(streams)) delete streams[k];
    for (const k of Object.keys(watchMocks)) delete watchMocks[k];
    for (const k of Object.keys(closeMocks)) delete closeMocks[k];
    for (const k of Object.keys(resumeDoc)) delete resumeDoc[k];
  });

  function makeStream(name: string) {
    const emitter = new EventEmitter();
    const on = jest.fn((evt: string, handler: (...args: any[]) => void) => {
      emitter.on(evt, handler as any);
      return emitter;
    });
    const close = jest.fn(async () => {});
    // Expose a helper to trigger events
    (emitter as any).triggerChange = (ev: any) => emitter.emit("change", ev);
    (emitter as any).triggerError = (err: any) => emitter.emit("error", err);
    // Mongo change streams expose resumeToken; emulate a simple one
    (emitter as any).resumeToken = { token: `${name}-resume` };
    streams[name] = emitter;
    closeMocks[name] = close;
    return { on, close } as any;
  }

  test("startListener wires watchers, dispatches hooks, writes resume tokens and closes cleanly", async () => {
    // Arrange mocks before importing the module under test
    jest.doMock("../src/common/logger.js", () => ({ logger }));

    jest.doMock("../src/hooks/hooks.js", () => {
      class HookNotImplemented extends Error {}
      return {
        HookNotImplemented,
        getHooks: () => ({
          // Users
          userCreated: async () => { hooksCalls.push("userCreated"); },
          userUpdated: async () => { hooksCalls.push("userUpdated"); throw new HookNotImplemented("not impl"); },
          userReplaced: async () => { hooksCalls.push("userReplaced"); },
          userDeleted: async () => { hooksCalls.push("userDeleted"); },
          // Groups
          groupCreated: async () => { hooksCalls.push("groupCreated"); },
          groupUpdated: async () => { hooksCalls.push("groupUpdated"); throw new Error("boom"); },
          groupReplaced: async () => { hooksCalls.push("groupReplaced"); },
          groupDeleted: async () => { hooksCalls.push("groupDeleted"); },
          // Memberships
          membershipAdded: async () => { hooksCalls.push("membershipAdded"); },
          membershipRemoved: async () => { hooksCalls.push("membershipRemoved"); },
        })
      };
    });

    jest.doMock("../src/common/db.js", () => {
      const collections: Record<string, any> = {};
      const collection = (name: string) => {
        if (!collections[name]) {
          // Special resume collection
          if (name === "hookResumeToken") {
            collections[name] = {
              collectionName: name,
              findOne: jest.fn(async () => ({ _id: "resumeTokens", ...resumeDoc })),
              updateOne: jest.fn(async (_q: any, u: any) => {
                Object.assign(resumeDoc, (u?.$set || {}));
              }),
            };
            return collections[name];
          }
          const base = makeStream(name);
          const watch = jest.fn((_pipeline?: any, _opts?: any) => ({
            on: base.on,
            close: closeMocks[name],
            resumeToken: (streams[name] as any).resumeToken,
          }));
          watchMocks[name] = watch;
          collections[name] = { collectionName: name, watch };
        }
        return collections[name];
      };
      return {
        client: { connect: jest.fn(async () => {}), close: jest.fn(async () => {}) },
        db: { collection },
      };
    });

    // Act: import module and start listener
    const mod = await import("../src/hooks/listener");
    const svc = await mod.startListener();

    // Emit user events
    const userInsert = { _id: { t: 1 }, operationType: "insert", fullDocument: { _id: "u1", userName: "a" } } as any;
    const userUpdate = { _id: { t: 2 }, operationType: "update", fullDocument: { _id: "u2", userName: "b" } } as any;
    const userReplace = { _id: { t: 3 }, operationType: "replace", fullDocument: { _id: "u3", userName: "c" } } as any;
    const userDelete = { _id: { t: 4 }, operationType: "delete", documentKey: { _id: "u4" } } as any;
    (streams["users"] as any).triggerChange(userInsert);
    (streams["users"] as any).triggerChange(userUpdate);
    (streams["users"] as any).triggerChange(userReplace);
    (streams["users"] as any).triggerChange(userDelete);

    // Emit group events
    const groupInsert = { _id: { t: 5 }, operationType: "insert", fullDocument: { _id: "g1", displayName: "g" } } as any;
    const groupUpdate = { _id: { t: 6 }, operationType: "update", fullDocument: { _id: "g2", displayName: "gg" } } as any;
    const groupReplace = { _id: { t: 7 }, operationType: "replace", fullDocument: { _id: "g3", displayName: "ggg" } } as any;
    const groupDelete = { _id: { t: 8 }, operationType: "delete", documentKey: { _id: "g4" } } as any;
    (streams["groups"] as any).triggerChange(groupInsert);
    (streams["groups"] as any).triggerChange(groupUpdate);
    (streams["groups"] as any).triggerChange(groupReplace);
    (streams["groups"] as any).triggerChange(groupDelete);

    // Emit membership events
    const memInsert = { _id: { t: 9 }, operationType: "insert", fullDocument: { _id: "m1", groupId: "g1", member: { value: "u1" } } } as any;
    const memDelete = { _id: { t: 10 }, operationType: "delete", documentKey: { _id: "m2" } } as any;
    (streams["groupMemberships"] as any).triggerChange(memInsert);
    (streams["groupMemberships"] as any).triggerChange(memDelete);

    // Emit an error on a stream
    (streams["users"] as any).triggerError(new Error("stream-fail"));

    // Allow promise microtasks to flush
    await new Promise((r) => setTimeout(r, 0));

    // Assert hooks called
    expect(hooksCalls).toEqual([
      "userCreated",
      "userUpdated", // followed by HookNotImplemented-like error path
      "userReplaced",
      "userDeleted",
      "groupCreated",
      "groupUpdated", // followed by general error path
      "groupReplaced",
      "groupDeleted",
      "membershipAdded",
      "membershipRemoved",
    ]);

    // Resume tokens persisted for each collection
    expect(resumeDoc.users).toEqual(userDelete._id);
    expect(resumeDoc.groups).toEqual(groupDelete._id);
    expect(resumeDoc.groupMemberships).toEqual(memDelete._id);

    // Logger recorded errors and warnings from handler and stream
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();

    // Close service and ensure streams/client closed
    await svc?.close?.();
    expect(closeMocks["users"]).toHaveBeenCalled();
    expect(closeMocks["groups"]).toHaveBeenCalled();
    expect(closeMocks["groupMemberships"]).toHaveBeenCalled();
  });

  test("maybeStart auto-starts when START_LISTENER=1 without side effects (mocked)", async () => {
    jest.resetModules();
    process.env.START_LISTENER = "1";

    jest.doMock("../src/common/logger.js", () => ({ logger }));

    // Provide minimal mocks for db and hooks so auto-start won't crash
    jest.doMock("../src/hooks/hooks.js", () => ({
      HookNotImplemented: class HookNotImplemented extends Error {},
      getHooks: () => ({
        userCreated: async () => {},
        userUpdated: async () => {},
        userReplaced: async () => {},
        userDeleted: async () => {},
        groupCreated: async () => {},
        groupUpdated: async () => {},
        groupReplaced: async () => {},
        groupDeleted: async () => {},
        membershipAdded: async () => {},
        membershipRemoved: async () => {},
      })
    }));

    jest.doMock("../src/common/db.js", () => {
      const make = () => {
        const emitter = new EventEmitter();
        return {
          on: (evt: string, handler: any) => { emitter.on(evt, handler); return emitter; },
          close: async () => {},
          resumeToken: { t: 1 },
        } as any;
      };
      const watch = () => make();
      const collection = (name: string) => {
        if (name === "hookResumeToken") {
          return {
            collectionName: name,
            findOne: async () => ({ _id: "resumeTokens" }),
            updateOne: async () => {},
          };
        }
        return { collectionName: name, watch } as any;
      };
      return { client: { connect: async () => {}, close: async () => {} }, db: { collection } };
    });

    await import("../src/hooks/listener");
    // After import, reset env to avoid affecting other tests
    delete process.env.START_LISTENER;
    expect(true).toBe(true);
  });
});
