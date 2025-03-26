/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Custom skills sometimes incorrectly had their level data stored as a string rather than an int.
 * This remedies that.
 */
export default class CustomSkillFix extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | SituaionalFix");
    super();
    this.version = 18;
    this.name = "Custom Skill Migration";
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
    if (item.type === "skill" && typeof item.system.level === "string") {
      const updatedLevel = Number.parseInt(item.system.level, 10);
      return item.update({ "system.level": updatedLevel });
    }
    return null;
  }

  /**
   * Migrate actor owned items.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    for (const item of actor.items) {
      // eslint-disable-next-line no-await-in-loop
      await CustomSkillFix.migrateItem(item); // Migrate each owned item.
    }
  }
}
