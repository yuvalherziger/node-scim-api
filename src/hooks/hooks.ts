import type { Group, GroupMember, User } from "../api/types.js";

export class HookNotImplemented extends Error {
  constructor(hookName: string) {
    super(`Hook not implemented: ${hookName}`);
    this.name = "HookNotImplemented";
  }
}

export interface GroupMembership {
  id?: string; // change stream may only provide the membership doc id on delete
  groupId?: string;
  member?: GroupMember;
}

export interface Hooks {
  // Users
  userCreated: (user: User) => Promise<void> | void;
  userReplaced: (user: User) => Promise<void> | void;
  userUpdated: (user: User) => Promise<void> | void;
  userDeleted: (userId: string) => Promise<void> | void;
  // Groups
  groupCreated: (group: Group) => Promise<void> | void;
  groupReplaced: (group: Group) => Promise<void> | void;
  groupUpdated: (group: Group) => Promise<void> | void;
  groupDeleted: (groupId: string) => Promise<void> | void;
  // Memberships
  membershipAdded: (membership: GroupMembership) => Promise<void> | void;
  membershipRemoved: (membership: GroupMembership) => Promise<void> | void;
}

function throwing(name: keyof Hooks) {
  return () => {
    throw new HookNotImplemented(String(name));
  };
}

const defaultHooks: Hooks = {
  userCreated: throwing("userCreated"),
  userUpdated: throwing("userUpdated"),
  userDeleted: throwing("userDeleted"),
  userReplaced: throwing("userReplaced"),
  groupCreated: throwing("groupCreated"),
  groupUpdated: throwing("groupUpdated"),
  groupDeleted: throwing("groupDeleted"),
  groupReplaced: throwing("groupReplaced"),
  membershipAdded: throwing("membershipAdded"),
  membershipRemoved: throwing("membershipRemoved"),
};

let registered: Partial<Hooks> = {};

export function registerHooks(hooks: Partial<Hooks>): void {
  registered = { ...registered, ...hooks };
}

export function getHooks(): Hooks {
  return { ...defaultHooks, ...registered } as Hooks;
}
