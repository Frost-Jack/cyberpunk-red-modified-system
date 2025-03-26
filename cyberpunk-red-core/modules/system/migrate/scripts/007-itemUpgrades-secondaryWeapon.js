/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * See issue #617 for details about what is migrating here. itemUpgrades
 * were storing `modifiers:secondaryWeapon:configured` as a string rather
 * than a bool. This fixes that.
 */
export default class ItemSecondaryWeaponMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | ItemSecondaryWeapon Migration");
    super();
    this.version = 7;
    this.name = "ItemSecondaryWeapon Migration";
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
    LOGGER.trace(`migrateItemUpgrade | ${this.version}-${this.name}`);
    if (item.type === "itemUpgrade") {
      const updateData = item.isOwned ? { _id: item._id } : {};
      if (item.system.modifiers.secondaryWeapon.configured === "true") {
        updateData["system.modifiers.secondaryWeapon.configured"] = true;
      } else {
        updateData["system.modifiers.secondaryWeapon.configured"] = false;
      }
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
      const updateData = await ItemSecondaryWeaponMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
