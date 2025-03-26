/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* global game, duplicate, mergeObject */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class FoundryV10Migration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | 2-foundryV10 Migration");
    super();
    this.version = 2;
    this.name = "Foundry V10 Initial Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace("preMigrate | 2-foundryV10 Migration");
    LOGGER.log(`Starting migration: ${this.name}`);
  }

  /**
   * Takes place after the data migration completes.
   */
  async postMigrate() {
    LOGGER.trace("postMigrate | 2-foundryV10 Migration");
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * The actors were updated in 2 ways. No changes to demons, black-ice or containers.
   *    Universal Attack Bonus and Damage --> corresponding AE
   *    Deleted skill and role properties.
   *
   * @async
   * @static
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace("migrateActor | 2-foundryV10 Migration");
    let updatedItemList = [];
    for (const item of actor.items) {
      const systemChanges = FoundryV10Migration.scrubItem(item);

      if (item.system.upgrades && item.system.upgrades.length > 0) {
        const newUpgrades = [];
        for (const upgrade of item.system.upgrades) {
          if (typeof upgrade.data !== "undefined") {
            const upgradeData = duplicate(upgrade.data);
            delete upgrade.data;
            upgrade.system = upgradeData;
          }
          newUpgrades.push(upgrade);
        }
        systemChanges.upgrades = newUpgrades;
      }

      if (Object.keys(systemChanges).length !== 0) {
        updatedItemList = CPRMigration.addToUpdateList(updatedItemList, {
          _id: item.id,
          system: systemChanges,
        });
      }
    }

    const cyberdecks = actor.items.filter((i) => i.type === "cyberdeck");
    for (const item of cyberdecks) {
      const systemChanges = {};
      if (item.system.programs.installed.length > 0) {
        const newInstalled = [];
        for (const program of item.system.programs.installed) {
          const programData =
            typeof program.data === "undefined"
              ? duplicate(program)
              : duplicate(program.data);
          delete program.data;
          newInstalled.push(mergeObject(program, programData));
        }
        systemChanges.installed = newInstalled;
      }
      if (item.system.programs.rezzed.length > 0) {
        const newRezzed = [];
        for (const program of item.system.programs.rezzed) {
          const programData =
            typeof program.data === "undefined"
              ? duplicate(program)
              : duplicate(program.data);
          delete program.data;
          newRezzed.push(mergeObject(program, programData));
        }
        systemChanges.rezzed = newRezzed;
      }
      if (Object.keys(systemChanges).length !== 0) {
        updatedItemList = CPRMigration.addToUpdateList(updatedItemList, {
          _id: item.id,
          system: systemChanges,
        });
      }
    }

    if (updatedItemList.length > 0) {
      await actor.updateEmbeddedDocuments("Item", updatedItemList);
    }
  }

  /**
   * The Foundry object migration handles most of the changes here.  The things that we are doing here
   * is cleaning up stale data points which somehow slipped through the cracks during previous migrations.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.trace("migrateItem | 2-foundryV10 Migration");

    const systemChanges = FoundryV10Migration.scrubItem(item);

    await item.update(
      { system: systemChanges },
      { CPRmigration: true, mergeDeletes: true }
    );
  }

  /**
   * Clean data points that shouldn't exist on our data model which must have slipped through the cracks
   * in the past migration code.
   *
   * @param {CPRItem} item
   */
  static scrubItem(item) {
    LOGGER.trace("scrubItem | 2-foundryV10 Migration");
    let systemChanges = {};
    if (typeof item.system.attachmentSlots !== "undefined") {
      systemChanges = {
        ...systemChanges,
        ...CPRMigration.safeDelete(item, "system.attachmentSlots"),
      };
    }

    if (
      game.system.template.Item[item.type].templates.includes("physical") &&
      typeof item.system.concealable !== "object"
    ) {
      systemChanges.concealable = {
        concealable: item.system.concealable,
        isConcealed: item.system.isConcealed,
      };
      systemChanges = {
        ...systemChanges,
        ...CPRMigration.safeDelete(item, "system.isConcealed"),
      };
    }

    if (
      !game.system.template.Item[item.type].templates.includes("stackable") &&
      typeof item.system.amount !== "undefined"
    ) {
      systemChanges = {
        ...systemChanges,
        ...CPRMigration.safeDelete(item, "system.amount"),
      };
    }

    if (typeof item.system.upgrade !== "undefined") {
      systemChanges = {
        ...systemChanges,
        ...CPRMigration.safeDelete(item, "system.upgrade"),
      };
    }
    return systemChanges;
  }
}
