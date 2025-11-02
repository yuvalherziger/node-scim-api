import { handleUserChange, handleGroupChange } from "../src/hooks/listener";
import { registerHooks } from "../src/hooks/hooks";

function makeInsert(doc: any) {
  return { operationType: "insert", fullDocument: doc } as any;
}
function makeUpdate(doc: any) {
  return { operationType: "update", fullDocument: doc } as any;
}
function makeDelete(id: string) {
  return { operationType: "delete", documentKey: { _id: id } } as any;
}

describe("listener handlers", () => {
  beforeEach(() => {
    registerHooks({});
  });

  test("user change dispatch", async () => {
    const calls: string[] = [];
    registerHooks({
      userCreated: async () => { calls.push("created"); },
      userUpdated: async () => { calls.push("updated"); },
      userDeleted: async () => { calls.push("deleted"); },
    });
    await handleUserChange(makeInsert({ _id: "1", userName: "a", schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"] }));
    await handleUserChange(makeUpdate({ _id: "1", userName: "a", schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"] }));
    await handleUserChange(makeDelete("1"));
    expect(calls).toEqual(["created", "updated", "deleted"]);
  });

  test("group change dispatch", async () => {
    const calls: string[] = [];
    registerHooks({
      groupCreated: async () => { calls.push("gcreated"); },
      groupUpdated: async () => { calls.push("gupdated"); },
      groupDeleted: async () => { calls.push("gdeleted"); },
    });
    await handleGroupChange(makeInsert({ _id: "1", displayName: "g" }));
    await handleGroupChange(makeUpdate({ _id: "1", displayName: "g" }));
    await handleGroupChange(makeDelete("1"));
    expect(calls).toEqual(["gcreated", "gupdated", "gdeleted"]);
  });
});
