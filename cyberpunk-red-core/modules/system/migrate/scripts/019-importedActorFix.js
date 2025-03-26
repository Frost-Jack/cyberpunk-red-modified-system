/* globals */
/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Migration script ./012-installedItemMigrationFix.js introduces a bug that wipes
 * `actor.system.installedItems.list` from compendium actors. This is bad, because we use
 * that field as the "source of truth" for what things should be installed where.
 * This migration script attempts to identify actors that got botched from script 012,
 * and then uses `actor.syncInstalledViaInstalledIn()`, which reconstructs this list
 * from each item's `installedIn` property, hopefully setting things right.
 *
 */
export default class ImportedActorFix extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | InstalledItemMigrationFix Migration");
    super();
    this.version = 19;
    this.name = "Imported Actor Fix";
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
   * Resync all installed items on actors.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);

    // Only run if the actor is from a compendium and can have installed items.
    if (
      actor.type === "character" ||
      actor.type === "mook" ||
      actor.type === "container"
    ) {
      // Determine if the actor has its installed items messed up.
      const actorHasInstalledItems =
        actor.system.installedItems?.list.length === 0 &&
        actor.items.some(
          (i) => i.system.isInstalled && i.system?.installedIn.match(actor.id)
        );

      // Determine if any owned items on the actor has their installed items messed up.
      const ownedItemsHaveInstalledItems = actor.items.some(
        (i) =>
          i.system.installedItems?.list.length === 0 &&
          actor.items.some(
            (i2) => i2.system.isInsatalled && i2.system?.installedIn.match(i.id)
          )
      );

      // If either of the above are true, migration script 012 broke the actor,
      // so we will fix it with a method specific to the issue in that script.
      if (actorHasInstalledItems || ownedItemsHaveInstalledItems) {
        return actor.syncInstalledViaInstalledIn();
      }

      // If either of the following are true, actor|item.system installedItems.list does not
      // correspond to the UUIDs of the actual items installed. This likely means a user imported
      // a .json of an actor with installed items. We can fix that using the more general
      // method (syncInstalledItems)
      const brokenJsonImportActorList =
        actor.system.installedItems?.list.length > 0 &&
        !actor.system.installedItems?.list.some((uuid) => {
          const idFragments = uuid.split(".");
          return idFragments.includes(actor.id);
        });
      const brokenJsonImportItemList = actor.items.some(
        (i) =>
          i.system.installedItems?.list.length > 0 &&
          !i.system.installedItems?.list.some((uuid) => {
            const idFragments = uuid.split(".");
            return idFragments.includes(actor.id);
          })
      );
      if (brokenJsonImportActorList || brokenJsonImportItemList) {
        return actor.syncInstalledItems();
      }
    }

    return Promise.resolve();
  }
}
