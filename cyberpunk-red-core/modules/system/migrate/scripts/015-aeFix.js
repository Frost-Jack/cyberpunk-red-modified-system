/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global duplicate */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class aeFix extends CPRMigration {
  /**
   * This migration script addresses issue #830. Occasionally we would find actors
   * with useless active effects that could not be deleted. The behavior happens
   * when the AE origins include IDs that do not match with the actor or owned item.
   * The root cause was never figured out; we just delete them in the actor migration.
   */
  constructor() {
    LOGGER.trace("constructor | SituaionalFix");
    super();
    this.version = 15;
    this.name = "Active Effects Hotfix Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | aeFix | ${this.version}-${this.name}`);
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
    LOGGER.trace(`postMigrate | aeFix | ${this.version}-${this.name}`);
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * This is where the useless active effects are deleted.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | aeFix | ${this.version}-${this.name}`);
    const effects = duplicate(actor.effects);
    const eids = [];
    effects.forEach((e) => {
      if (e.origin !== null) {
        if (e.origin.startsWith("Actor")) {
          if (e.origin.includes("Item")) {
            const bits = e.origin.split(".");
            const actorBit = bits[1];
            const itemBit = bits[3];
            const item = actor.items.find((i) => i._id === itemBit);
            if (actorBit !== actor._id && item === undefined) {
              eids.push(e._id);
            }
          }
        }
      }
    });
    actor.deleteEmbeddedDocuments("ActiveEffect", eids);
  }
}
