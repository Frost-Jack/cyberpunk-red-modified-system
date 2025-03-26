/* global Item fromUuidSync */
/* eslint-disable foundry-cpr/logger-after-function-definition */
/* eslint-disable no-await-in-loop */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * Migrations in here were not for specific features but rather fixes to bugs and
 * otherwise corrupted data. See #546, #554, and #484.
 */
export default class ReleaseEightyFourDotZero extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | 4-Release 0.84.0 Migration");
    super();
    this.version = 4;
    this.name = "Release 0.84.0 Migration";
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
    this.migrationFolder = CPRMigration.createMigrationFolder(this.name);
    LOGGER.log(`Starting migration: ${this.name}`);
  }

  /**
   * Takes place after the data migration completes.
   */
  async postMigrate() {
    LOGGER.trace(`postMigrate | ${this.version}-${this.name}`);
    CPRMigration.deleteMigrationFolder(this.migrationFolder);
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * Update each of the items if needed.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    let itemUpdates = [];
    const itemDeletions = [];
    const itemCreations = [];
    for (const item of actor.items) {
      if (
        typeof item.system.price !== "undefined" ||
        typeof item.changes !== "undefined"
      ) {
        const updatedItem = ReleaseEightyFourDotZero.migrateItem(item);
        if (Object.keys(updatedItem).length > 1) {
          itemUpdates.push(updatedItem);
        }
      }
    }

    for (const activeEffect of actor.effects) {
      // Using this to see if there's any updates to the ActiveEffect
      const aeChanges = await ReleaseEightyFourDotZero.updateActiveEffect(
        activeEffect
      );
      if (aeChanges) {
        const aeSource = fromUuidSync(activeEffect.origin);
        if (aeSource instanceof Item) {
          const newItem = await CPRMigration.backupOwnedItem(
            aeSource,
            this.migrationFolder
          );
          await ReleaseEightyFourDotZero.migrateItem(newItem);
          itemCreations.push(newItem.toObject());
          itemDeletions.push(aeSource._id);
          itemUpdates = itemUpdates.filter((i) => i._id !== aeSource._id);
          await newItem.delete();
        }
      }
    }

    // Update activeNetRole to use ID instead of Name.
    const netRoleItem = actor.itemTypes.role.find(
      (r) => r.name === actor.system.roleInfo.activeNetRole
    );
    if (netRoleItem) {
      // If activeNetRole is set and has an item with the same name, set it to the ID of that item.
      actor.update({ "system.roleInfo.activeNetRole": netRoleItem.id });
    } else if (actor.itemTypes.role.length > 0) {
      // If there is no netRoleItem, assign activeNetRole the ID of the first role in the list.
      actor.update({
        "system.roleInfo.activeNetRole": actor.itemTypes.role[0].id,
      });
    } else {
      // If there are no roles on the actor, set activeNetRole to "".
      actor.update({ "system.roleInfo.activeNetRole": "" });
    }

    if (itemDeletions.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", itemDeletions, {
        cprIsMigrating: true,
      });
    }

    if (itemCreations.length > 0) {
      await actor.createEmbeddedDocuments("Item", itemCreations, {
        cprIsMigrating: true,
      });
    }

    return itemUpdates.length > 0
      ? actor.updateEmbeddedDocuments("Item", itemUpdates)
      : Promise.resolve();
  }

  /**
   * The Foundry object migration handles most of the changes here.  The things that we are doing here
   * is cleaning up stale data points which somehow slipped through the cracks during previous migrations.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.trace(`migrateItem | ${this.version}-${this.name}`);
    let updateData = item.isOwned ? { _id: item._id } : {};
    // Migration code for Issue #546
    // Only fix AE on unowned items here, owned item AE's fixed as part of Actor Migration
    if (!item.isOwned) {
      for (const activeEffect of item.effects) {
        const aeChanges = await ReleaseEightyFourDotZero.updateActiveEffect(
          activeEffect
        );
        if (aeChanges) {
          await item.updateEmbeddedDocuments("ActiveEffect", [
            { _id: activeEffect._id, changes: aeChanges },
          ]);
        }
      }
    }

    // Migration code for Issue #554
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(item, "system.price.category"),
    };

    return item.isOwned ? updateData : item.update(updateData);
  }

  static async updateActiveEffect(effect) {
    let needsUpdate = false;
    const newChanges = [];
    if (effect.changes.length > 0) {
      for (const change of effect.changes) {
        switch (change.key) {
          case "bonuses.cybertech": {
            change.key = "bonuses.cybertech";
            needsUpdate = true;
            break;
          }
          case "bonuses.weaponstech": {
            change.key = "bonuses.weaponstech";
            needsUpdate = true;
            break;
          }
          default:
        }
        newChanges.push(change);
      }
    }
    return needsUpdate ? Promise.resolve(newChanges) : Promise.resolve();
  }
}
