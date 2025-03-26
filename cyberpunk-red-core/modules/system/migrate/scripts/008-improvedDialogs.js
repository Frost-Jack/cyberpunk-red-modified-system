/* eslint-disable no-await-in-loop */
/* global game duplicate fromUuidSync */
/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * This migration will rearrange and introduce new flags on effects that exist on items/actors.
 * It will also give a couple new data points to roles and their subabilities.
 *
 */
export default class ImprovedDialogMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | ImprovedDialog Migration");
    super();
    this.version = 8;
    this.name = "Improved Dialog Migration";
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
    this.migrationFolder = await CPRMigration.createMigrationFolder(this.name);

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
   * Here's the real work.
   *
   * @param {CPRItem} item
   * @override
   */
  static async migrateItem(item) {
    LOGGER.trace(`migrateItem | ${this.version}-${this.name}`);
    const updateData = duplicate(item);
    if (updateData.effects.length > 0) {
      updateData.effects.forEach(async (e) => {
        e.changes.forEach(async (c, i) => {
          const newFlag = e.flags[game.system.id].changes[i];
          e.flags[`${game.system.id}.changes.cats.${i}`] = newFlag;
          e.flags[
            `${game.system.id}.changes.situational.${i}.isSituational`
          ] = false;
          e.flags[
            `${game.system.id}.changes.situational.${i}.onByDefault`
          ] = false;
          e.flags[`${game.system.id}.changes.-=${i}`] = null;
        });
      });
    }
    if (item.type === "role") {
      updateData.system.isSituational = false;
      updateData.system.onByDefault = false;
      updateData.system.abilities.forEach((a) => {
        a.isSituational = false;
        a.onByDefault = false;
      });
    }

    return item.isOwned ? updateData : item.update(updateData);
  }

  /**
   * Update effects created directly on the actor.
   *
   * @param {CPRActor} actor
   * @override
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    const updateList = [];
    if (actor.effects.contents.length > 0) {
      actor.effects.contents.forEach((e) => {
        const effectData = duplicate(e);
        e.changes.forEach((c, i) => {
          const newFlag = e.flags[game.system.id].changes[i];
          effectData.flags[`${game.system.id}.changes.cats.${i}`] = newFlag;
          effectData.flags[
            `${game.system.id}.changes.situational.${i}.isSituational`
          ] = false;
          effectData.flags[
            `${game.system.id}.changes.situational.${i}.onByDefault`
          ] = false;
          effectData.flags[`${game.system.id}.changes.-=${i}`] = null;
        });
        updateList.push(effectData);
      });
    }

    await actor.updateEmbeddedDocuments("ActiveEffect", updateList);

    const ownedEffectItems = actor.items.filter((i) => {
      if (i.type === "skill") return false;
      if (i.type === "cyberware" && i.system.core) return false;
      if (i.type !== "role" && i.effects.size === 0) return false;
      return true;
    });

    const deleteItems = [];

    for (const ownedItem of ownedEffectItems) {
      // We cannot add AEs to owned items, that's a Foundry limitation. If an owned item might get an AE
      // as a result of this migration, we must make an unowned copy first, and then copy that back to
      // the actor. Not all item types require this, and skills/core cyberware are filtered out earlier.
      const newWorldItem = await CPRMigration.backupOwnedItem(
        ownedItem,
        this.migrationFolder
      );

      try {
        await ImprovedDialogMigration.migrateItem(newWorldItem);
      } catch (err) {
        throw new Error(
          `${ownedItem.name} (${ownedItem._id}) had a migration error: ${err.message}`
        );
      }

      await CPRMigration.restoreOwnedItem(newWorldItem);
      deleteItems.push(ownedItem._id);
    }

    if (deleteItems.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", deleteItems, {
        cprIsMigrating: true,
      });
    }
  }
}
