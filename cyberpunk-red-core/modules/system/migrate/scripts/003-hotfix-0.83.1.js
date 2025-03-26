/* eslint-disable foundry-cpr/logger-after-function-definition */
/* eslint-disable no-await-in-loop */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class HotfixEightyThreeDotOne extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | 3-Hotfix 0.83.1 Migration");
    super();
    this.version = 3;
    this.name = "Hotfix 0.83.1 Migration";
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
   * Lifepath data was stored in the wrong place, this
   * moves any stored data to the correct location.
   *
   * @async
   * @static
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    let updateData = [];
    if (actor.type === "character") {
      if (typeof actor.system.lifepath.lovers !== "undefined") {
        updateData["system.lifepath.tragicLoveAffairs"] =
          actor.system.lifepath.lovers;
        updateData = {
          ...updateData,
          ...CPRMigration.safeDelete(actor, "system.lifepath.lovers"),
        };
      }
      if (typeof actor.system.lifepath.affectation !== "undefined") {
        updateData["system.lifepath.affectations"] =
          actor.system.lifepath.affectation;
        updateData = {
          ...updateData,
          ...CPRMigration.safeDelete(actor, "system.lifepath.affectation"),
        };
      }
    }
    return actor.update(updateData);
  }
}
