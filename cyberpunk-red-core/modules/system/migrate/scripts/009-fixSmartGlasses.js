/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

const SMART_GLASSES = [
  "Gafas inteligentes",
  "Lunettes connectées",
  "Occhiali Intelligenti",
  "Óculos Inteligentes",
  "Smart-Brille",
  "Smart Glasses",
  "Smartkulary",
  "Smart Lens",
  "Умные очки",
];

/**
 * This migration addressed an unreported bug where Smart Glasses/Lens could not
 * be added to Cybereyes.
 */
export default class ItemSmartGlassesMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | ItemSmartGlassesMigration Migration");
    super();
    this.version = 9;
    this.name = "SmartGlasses Migration";
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

    // Electronic gear
    if (SMART_GLASSES.includes(item.name)) {
      const updateData = item.isOwned ? { _id: item._id } : {};
      updateData["system.installedItems.allowedTypes"] = [
        "cyberware",
        "itemUpgrade",
      ];
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
      const updateData = await ItemSmartGlassesMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
