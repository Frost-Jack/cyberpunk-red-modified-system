/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global game */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Rename the critical injury compendium to be consistent with the other names too
 */
export default class criticalInjuryCompendiumMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | criticalInjuryCompendium Migration");
    super();
    this.version = 17;
    this.name = "criticalInjuryCompendium Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | ${this.version}-${this.name}`);
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
   * Migrate settings. This is a new function introduced in this migration (015-dvCompendium).
   *
   */
  async migrateSettings() {
    LOGGER.trace(`migrateSettings | ${this.version}-${this.name}`);
    const settingName = "criticalInjuryRollTableCompendium";
    const newValue = `${game.system.id}.critical-injury-tables`;
    const oldValue = `${game.system.id}.criticalInjuryTables`;
    const currentValue = game.settings.get(game.system.id, settingName);

    if (currentValue === oldValue) {
      LOGGER.trace(`migrateSettings | Updating ${settingName} to ${newValue}`);
      await game.settings.set(game.system.id, settingName, newValue);
    }
    // Return true so that migration continues if the setting was already correct.
    return true;
  }
}
