/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global game */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Here we rename the dvTables compendium to be consistent with the other names
 */
export default class dvCompendiumMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | dvCompendium Migration");
    super();
    this.version = 16;
    this.name = "dvCompendium Migration";
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
    const settingName = "dvRollTableCompendium";
    const newValue = `${game.system.id}.dv-tables`;
    const oldValue = `${game.system.id}.dvTables`;
    const currentValue = game.settings.get(game.system.id, settingName);

    if (currentValue === oldValue) {
      LOGGER.trace(`migrateSettings | Updating ${settingName} to ${newValue}`);
      await game.settings.set(game.system.id, settingName, newValue);
    }
    // Return true so that migration continues if the setting was already correct.
    return true;
  }
}
