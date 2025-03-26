/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * See #740 and #590. We decided to break up the source property into more fields so we could
 * be more precise about where rules are coming from. There are book and page fields.
 */
export default class SourceMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | Source Migration");
    super();
    this.version = 9;
    this.name = "Source Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | ${this.version}-${this.name}`);
    CPRSystemUtils.DisplayMessage(
      "notify",
      CPRSystemUtils.Localize("CPR.migration.effects.beginMigration")
    );
    LOGGER.log(`Starting migration: ${this.name}`);
  }

  /**
   * Takes place after the data migration completes.
   */
  async postMigrate() {
    LOGGER.trace(`postMigrate | ${this.version}-${this.name}`);
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * Here's the real work.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.debug(`migrateItem | ${this.version}-${this.name}`);
    const updateData = item.isOwned ? { _id: item._id } : {};
    const itemSource = item.system.source;

    // If the `source` field is not a string we have probably already migrated it
    // so skip the migration
    if (typeof itemSource === "string") {
      // Replace `pg` (case insensitive) with a pipe,
      // remove any "."
      // remove any spaces
      // returns "foo|123" or "|123" or "foo|"
      const cleanSource = itemSource
        .replace(/pg/gi, "|")
        .replace(/\./g, "")
        .replace(" ", "");
      const source = cleanSource.split("|");
      const book = source[0] ? source[0] : "";
      const page = source[1] ? source[1].replace(/\D/g, "") : "";
      updateData["system.source"] = { book, page };
      return item.isOwned ? updateData : item.update(updateData);
    }

    return null;
  }

  /**
   * Simply make sure owned items are updated too.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    const itemUpdates = [];
    for (const item of actor.items) {
      // eslint-disable-next-line no-await-in-loop
      const updateData = await SourceMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
