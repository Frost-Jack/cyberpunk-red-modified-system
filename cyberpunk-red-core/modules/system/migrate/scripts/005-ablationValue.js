/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * See issue #565 for details about what is migrating here. ablationValue was added
 * to ammo items and we decided to set it to things other than 1 depending on the
 * ammo type.
 */
export default class AblationValueMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | AblationValue Migration");
    super();
    this.version = 5;
    this.name = "AblationValue Migration";
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
    LOGGER.trace(`migrateItem | ${this.version}-${this.name}`);
    if (item.type === "ammo") {
      const updateData = item.isOwned ? { _id: item._id } : {};
      if (item.system.type === "rubber") {
        updateData["system.ablationValue"] = 0;
        return item.isOwned ? updateData : item.update(updateData);
      }
      if (item.system.type === "armorPiercing") {
        updateData["system.ablationValue"] = 2;
        return item.isOwned ? updateData : item.update(updateData);
      }
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
      const updateData = await AblationValueMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
