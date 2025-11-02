import { getHooks, registerHooks, HookNotImplemented, type GroupMembership } from "../src/hooks/hooks";

describe("hooks API", () => {
  beforeEach(() => {
    // reset hooks by re-registering an empty object
    registerHooks({});
  });

  test("default hooks throw HookNotImplemented", async () => {
    const hooks = getHooks();
    const expects = [
      () => hooks.userCreated({ id: "1", schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "a" } as any),
      () => hooks.userUpdated({ id: "1", schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "a" } as any),
      () => hooks.userDeleted("1"),
      () => hooks.groupCreated({ id: "1", schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"], displayName: "g" } as any),
      () => hooks.groupUpdated({ id: "1", schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"], displayName: "g" } as any),
      () => hooks.groupDeleted("1"),
      () => hooks.membershipAdded({} as GroupMembership),
      () => hooks.membershipRemoved({} as GroupMembership),
    ];
    for (const fn of expects) {
      expect(fn).toThrow(HookNotImplemented);
    }
  });

  test("registerHooks overrides selected hooks", async () => {
    const called: string[] = [];
    registerHooks({
      userCreated: async () => { called.push("userCreated"); },
      groupDeleted: () => { called.push("groupDeleted"); },
    });
    const hooks = getHooks();
    await hooks.userCreated({ id: "1", schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "a" } as any);
    await hooks.groupDeleted("2");

    expect(called).toEqual(["userCreated", "groupDeleted"]);

    // and non-overridden ones still throw
    expect(() => hooks.userUpdated({ id: "1", schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "a" } as any)).toThrow(HookNotImplemented);
  });
});
