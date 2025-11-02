import type {
  ChangeStream,
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamReplaceDocument,
  ChangeStreamUpdateDocument,
  Collection,
  Document
} from "mongodb";
import { client, db } from "../common/db.js";
import { logger } from "../common/logger.js";
import type { Group, GroupMember, User } from "../api/types.js";
import { Schemas } from "../api/types.js";
import { getHooks, type GroupMembership, HookNotImplemented } from "./hooks.js";


type ResumeToken = any;

interface ResumeTokensDoc {
  _id: string;
  users?: ResumeToken;
  groups?: ResumeToken;
  groupMemberships?: ResumeToken;
}

const RESUME_COLLECTION = "hookResumeToken"; // single-document collection name
const RESUME_DOC_ID = "resumeTokens"; // fixed id for the single document

function asUser(doc: any): User {
  const { _id, _version: _v, ...rest } = doc || {};
  const id = String(_id);
  const schemas: string[] = Array.isArray(rest?.schemas) && rest.schemas.length > 0 ? rest.schemas : [Schemas.User];
  return { ...(rest as any), id, schemas } as User;
}

function asGroup(doc: any): Group {
  const { _id, _version: _v, ...rest } = doc || {};
  const id = String(_id);
  const schemas: string[] = [Schemas.Group];
  return { ...(rest as any), id, schemas } as Group;
}

function asMembership(doc: any): GroupMembership {
  if (!doc) return {};
  const id = String(doc._id);
  const groupId = String(doc.groupId);
  const member: GroupMember = doc.member;
  return { id, groupId, member };
}

export async function handleUserChange(ev: ChangeStreamInsertDocument | ChangeStreamUpdateDocument | ChangeStreamDeleteDocument | ChangeStreamReplaceDocument) {
  const hooks = getHooks();
  try {
    if (ev.operationType === "insert") {
      const u = asUser((ev as ChangeStreamInsertDocument).fullDocument);
      logger.debug("Dispatching userCreated", { id: u.id });
      await hooks.userCreated(u);
    } else if (ev.operationType === "update") {
      const u = asUser((ev as ChangeStreamUpdateDocument).fullDocument);
      logger.debug("Dispatching userUpdated", { id: u.id });
      await hooks.userUpdated(u);
    } else if (ev.operationType === "replace") {
      const u = asUser((ev as ChangeStreamReplaceDocument).fullDocument);
      logger.debug("Dispatching userReplaced", { id: u.id });
      await hooks.userReplaced(u);
    } else if (ev.operationType === "delete") {
      const id = String((ev as ChangeStreamDeleteDocument).documentKey._id);
      logger.debug("Dispatching userDeleted", { id });
      await hooks.userDeleted(id);
    }
  } catch (e: any) {
    if (e instanceof HookNotImplemented) {
      logger.warn("User hook not implemented", { error: e.message });
    } else {
      logger.error("User hook handler failed", { error: e });
    }
  }
}

export async function handleGroupChange(ev: ChangeStreamInsertDocument | ChangeStreamUpdateDocument | ChangeStreamDeleteDocument | ChangeStreamReplaceDocument) {
  const hooks = getHooks();
  try {
    if (ev.operationType === "insert") {
      const g = asGroup((ev as ChangeStreamInsertDocument).fullDocument);
      logger.debug("Dispatching groupCreated", { id: g.id });
      await hooks.groupCreated(g);
    } else if (ev.operationType === "update") {
      const g = asGroup((ev as ChangeStreamUpdateDocument).fullDocument);
      logger.debug("Dispatching groupUpdated", { id: g.id });
      await hooks.groupUpdated(g);
    } else if (ev.operationType === "replace") {
      const g = asGroup((ev as ChangeStreamReplaceDocument).fullDocument);
      logger.debug("Dispatching groupReplaced", { id: g.id });
      await hooks.groupReplaced(g);
    } else if (ev.operationType === "delete") {
      const id = String((ev as ChangeStreamDeleteDocument).documentKey._id);
      logger.debug("Dispatching groupDeleted", { id });
      await hooks.groupDeleted(id);
    }
  } catch (e: any) {
    if (e instanceof HookNotImplemented) {
      logger.warn("Group hook not implemented", { error: e.message });
    } else {
      logger.error("Group hook handler failed", { error: e });
    }
  }
}

async function handleMembershipChange(ev: ChangeStreamInsertDocument | ChangeStreamUpdateDocument | ChangeStreamDeleteDocument | ChangeStreamReplaceDocument) {
  const hooks = getHooks();
  try {
    if (ev.operationType === "insert" || ev.operationType === "replace" || ev.operationType === "update") {
      const m = asMembership((ev as ChangeStreamInsertDocument).fullDocument);
      logger.debug("Dispatching membershipAdded", { groupId: m.groupId, member: m.member?.value });
      await hooks.membershipAdded(m);
    } else if (ev.operationType === "delete") {
      const keyId = String((ev as ChangeStreamDeleteDocument).documentKey._id);
      const m: GroupMembership = { id: keyId };
      logger.debug("Dispatching membershipRemoved", { id: keyId });
      await hooks.membershipRemoved(m);
    }
  } catch (e: any) {
    if (e instanceof HookNotImplemented) {
      logger.warn("Membership hook not implemented", { error: e.message });
    } else {
      logger.error("Membership hook handler failed", { error: e });
    }
  }
}

async function getResumeCollection(): Promise<Collection<ResumeTokensDoc>> {
  return db.collection<ResumeTokensDoc>(RESUME_COLLECTION);
}

async function readResumeToken(collectionName: string): Promise<ResumeToken | undefined> {
  const resumeCol = await getResumeCollection();
  const doc = await resumeCol.findOne({ _id: RESUME_DOC_ID });
  return (doc as any)?.[collectionName];
}

async function writeResumeToken(collectionName: string, token: ResumeToken): Promise<void> {
  const resumeCol = await getResumeCollection();
  // TODO: add an index if queries beyond _id are introduced in the future
  await resumeCol.updateOne(
    { _id: RESUME_DOC_ID },
    { $set: { [collectionName]: token } },
    { upsert: true }
  );
}

function watchCollection(col: Collection<Document>, handler: (ev: any) => Promise<void>, resumeToken?: ResumeToken): ChangeStream {
  const options: any = { fullDocument: "updateLookup" };
  if (resumeToken) {
    options.resumeAfter = resumeToken;
    logger.info("Starting change stream with resume token", { collection: col.collectionName });
  } else {
    logger.info("Starting change stream fresh", { collection: col.collectionName });
  }
  const stream = col.watch([], options);
  stream.on("change", async (ev: any) => {
    try {
      await handler(ev);
      const token = ev?._id ?? stream.resumeToken;
      if (token) {
        await writeResumeToken(col.collectionName, token);
      }
    } catch (e) {
      logger.error("Change handler failed", { collection: col.collectionName, error: e });
    }
  });
  stream.on("error", (err) => {
    logger.error("Change stream error", { collection: col.collectionName, error: err });
  });
  return stream;
}

export async function startListener(): Promise<{ close: () => Promise<void> } | void> {
  await client.connect();
  logger.info("Starting hooks listener");

  const users = db.collection("users");
  const groups = db.collection("groups");
  const memberships = db.collection("groupMemberships");

  // Read resume tokens if available
  const [usersToken, groupsToken, membershipsToken] = await Promise.all([
    readResumeToken("users"),
    readResumeToken("groups"),
    readResumeToken("groupMemberships"),
  ]);

  const userStream = watchCollection(users, handleUserChange, usersToken);
  const groupStream = watchCollection(groups, handleGroupChange, groupsToken);
  const memStream = watchCollection(memberships, handleMembershipChange, membershipsToken);

  return {
    close: async () => {
      try {
        await userStream.close();
      } catch {
      }
      try {
        await groupStream.close();
      } catch {
      }
      try {
        await memStream.close();
      } catch {
      }
      try {
        await client.close();
      } catch {
      }
      logger.info("Hooks listener stopped");
    }
  };
}

// If this module is executed directly (e.g., `node dist/hooks/listener.js`),
// or explicitly requested via env var, start the listener service.
(function maybeStart() {
  try {
    const argv1 = (typeof process !== "undefined" && Array.isArray(process.argv)) ? (process.argv[1] || "") : "";
    const shouldStart =
      (typeof process !== "undefined" && process.env && process.env.START_LISTENER === "1") ||
      /(^|\/)hooks\/listener\.(js|ts)$/.test(argv1);

    if (!shouldStart) return;

    (async () => {
      logger.info("Hooks listener entrypoint");
      const svc = await startListener();

      const shutdown = async (signal: string) => {
        try {
          logger.info("Shutting down hooks listener", { signal });
          await svc?.close?.();
        } catch (e) {
          logger.error("Failed to shutdown hooks listener", { error: e });
        } finally {
          process.exit(0);
        }
      };

      process.on("SIGINT", () => void shutdown("SIGINT"));
      process.on("SIGTERM", () => void shutdown("SIGTERM"));

      process.on("unhandledRejection", (reason) => {
        logger.error("Unhandled promise rejection in listener", { error: reason });
      });
      process.on("uncaughtException", (err) => {
        logger.error("Uncaught exception in listener", { error: err });
      });
    })();
  } catch {
    // no-op
  }
})();
