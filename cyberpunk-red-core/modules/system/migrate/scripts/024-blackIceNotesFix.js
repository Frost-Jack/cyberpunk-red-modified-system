/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global duplicate */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class BlackIceNotesMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | Black Ice Notes - Migration");
    super();
    this.version = 24;
    this.name = "Black Ice Notes - Migration";
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
   * Black Ice have two note sections that could easily be combined into one.
   * This will combine the two note sections.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    // Return if not Black Ice.
    if (actor.type !== "blackIce") {
      return Promise.resolve();
    }

    const updateData = duplicate(actor.system);

    // Combine effects and notes.
    const newNotes =
      actor.system.effect?.length > 0 && actor.system.notes.length > 0
        ? `${actor.system.effect}<hr>${actor.system.notes}`
        : `${actor.system.effect}${actor.system.notes}`;

    updateData.notes = newNotes;

    // Remove now-unnecessary field.
    updateData["-=effect"] = null;
    return actor.update({ system: updateData });
  }
}
