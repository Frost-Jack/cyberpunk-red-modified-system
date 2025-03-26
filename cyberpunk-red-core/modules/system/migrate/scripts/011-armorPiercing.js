/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Here we rename Armor-piercing ammo items to include the hyphen, which was
 * mistakenly omitted previously.
 */
export default class ArmorPiercingMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | ArmorPiercing Migration");
    super();
    this.version = 11;
    this.name = "ArmorPiercing Migration";
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

    // Replace "Armor Piercing" with "Armor-Piercing"
    if (item.type === "ammo") {
      if (item.name.includes("Armor Piercing")) {
        const updateData = item.isOwned ? { _id: item._id } : {};
        updateData.name = item.name.replace(
          /Armor Piercing/g,
          "Armor-Piercing"
        );
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
      const updateData = await ArmorPiercingMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
