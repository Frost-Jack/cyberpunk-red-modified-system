/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global game */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Here we rename the dvTables compendium to be consistent with the other names
 */
export default class packNameMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | packNameMigration");
    super();
    this.version = 22;
    this.name = "packName Migration";
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
   * Migrate settings.
   */
  async migrateSettings() {
    LOGGER.trace(`migrateSettings | ${this.version}-${this.name}`);
    const settings = [
      {
        name: "dvRollTableCompendium",
        old: `${game.system.id}.dv-tables`,
        new: `${game.system.id}.internal_dv-tables`,
      },
      {
        name: "netArchRollTableCompendium",
        old: `${game.system.id}.net-rolltables`,
        new: `${game.system.id}.internal_net-rolltables`,
      },
      {
        name: "criticalInjuryRollTableCompendium",
        old: `${game.system.id}.critical-injury-tables`,
        new: `${game.system.id}.internal_critical-injury-tables`,
      },
    ];

    for (const setting of settings) {
      const settingName = setting.name;
      const currentValue = game.settings.get(game.system.id, setting.name);
      const oldValue = setting.old;
      const newValue = setting.new;

      if (currentValue === oldValue) {
        LOGGER.trace(
          `migrateSettings | Updating ${settingName} to ${newValue}`
        );
        game.settings.set(game.system.id, settingName, newValue);
      }
    }

    // Return true so that migration continues if the setting was already correct.
    return true;
  }
}
