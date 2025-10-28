import { type IMigration, Index } from "./scripts/migrate.js";
import { MongoClient, ObjectId } from "mongodb";

/**
 *  Dos:
 *   - Implement rollback logic for any failure you'd like to avoid handling manually in the database.
 *   - Some MongoDB actions are idempotent - if you want to rely on non-idempotent actions,
 *     make sure you implement them (and their rollback) accordingly.
 *   - Implement as many helper methods as you want.
 *   - If you're building a large index in an Atlas cluster, consider using a rolling build (see <Index> class).
 *   - Use the Index class to build new indexes. Example:
 *
 *       const ix = new Index({
 *         rolling: false, db: "db", collection: "coll", keys: [{ "foo": 1 }]
 *       });
 *       await ix.build(client);
 *
 *  Don'ts:
 *   - Avoid changing the file name.
 *   - Avoid changing the 'id' member's type or value.
 *   - Avoid removing the core methods: up(), dataUp(), down(), dataDown(). Removing them breaks your migration.
 *   - Avoid changing their signature either, for the same reason.
 *   - Avoid making any changes to the 'migrations' collection itself.
 */
export class Migration implements IMigration {

  /**
   * Name:        initial
   * ID:          68ffcf9109896402c42d84a7
   * Created At:  20251027T200121
   */
  public readonly id: ObjectId = new ObjectId("68ffcf9109896402c42d84a7");
  public readonly createdAt: string = "20251027T200121";

  async up(client: MongoClient): Promise<void> {
    const db = "scim";
    const indexes: Index[] = [
      new Index({
        rolling: false,
        db,
        collection: "users",
        keys: [{ userName: 1 }],
        options: { unique: true }
      }),
      new Index({
        rolling: false,
        db,
        collection: "users",
        keys: [{ externalId: 1 }],
      }),
      new Index({
        rolling: false,
        db,
        collection: "groups",
        keys: [{ displayName: 1 }],
        options: { unique: true }
      }),
      new Index({
        rolling: false,
        db,
        collection: "groups",
        keys: [{ externalId: 1 }],
      }),
      new Index({
        rolling: false,
        db,
        collection: "groups",
        keys: [{ groupId: 1 }],
      }),
    ];
    await Promise.all(indexes.map(ix => ix.build(client)));
  }

  async dataUp(client: MongoClient): Promise<void> {
    // TODO: implement data population forward logic
  }

  async down(client: MongoClient): Promise<void> {
    // TODO: implement schema and index rollback logic
  }

  async dataDown(client: MongoClient): Promise<void> {
    // TODO: implement data population rollback logic
  }
}