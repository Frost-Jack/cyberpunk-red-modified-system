/* globals fromUuidSync */
/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";
import CPR from "../../config.js";

/**
 * See #808 for details about this migration.
 */
export default class InstalledItemMigrationFix extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | InstalledItemMigrationFix Migration");
    super();
    this.version = 12;
    this.name = "Migration Fix for Installed Items";
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
   * Simply make sure owned items are updated too.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);

    // If the actor doesn't have any installed items, resolve the promise and return
    if (typeof actor.system.installedItems !== "object" || actor.compendium) {
      return Promise.resolve();
    }

    // If the actor has installed items, start the migration process
    if (actor.system.installedItems.list.length > 0) {
      // This array will hold the migrated items
      const actorInstalledItems = [];

      // Iterate over all installed items
      for (const installedItemUuid of actor.system.installedItems.list) {
        // Split the installed item's UUID into parts
        const installedItemUuidParts = installedItemUuid.split(".");
        // Update the second part of the UUID to be the actor's ID
        installedItemUuidParts[1] = actor._id;
        // Reconstruct the UUID
        const newInstalledItemUuid = installedItemUuidParts.join(".");

        // Fetch the item using the updated UUID
        const item = fromUuidSync(newInstalledItemUuid);

        // If the item exists, is owned by the actor, and the UUIDs match,
        // add it to the array
        if (item && item.isOwned && item.actor.uuid === actor.uuid) {
          actorInstalledItems.push(item.uuid);
        }
      }

      // If the migrated items list is different from the original list, update
      // the actor
      if (actorInstalledItems !== actor.system.installedItems.list) {
        await actor.update({
          "system.installedItems.list": actorInstalledItems,
        });
      }
    }

    // Get all container and upgradable types
    const containerTypes = CPRSystemUtils.GetTemplateItemTypes("container");
    const upgradableTypes = CPRSystemUtils.GetTemplateItemTypes("upgradable");

    // These arrays will hold the updates for owned items and upgraded items
    const ownedItemUpdates = [];
    const upgradeItems = [];

    // Iterate over all of the actor's items
    for (const item of actor.items) {
      // If the item is a container and has installed items
      if (
        containerTypes.includes(item.type) &&
        item.system.installedItems.list.length > 0
      ) {
        // Initialize an array to hold the list of migrated installed items
        const installedItemsList = [];
        // Initialize an object to hold updates to the item
        const itemUpdates = { _id: item.id };

        // Initialize a variable to keep track of the total size of installed items
        let installedSize = 0;

        // Loop through each installed item
        for (const installedItemUUID of item.system.installedItems.list) {
          let installedItem;
          try {
            // Try to get the installed item
            installedItem = fromUuidSync(installedItemUUID);
          } catch (error) {
            // This shouldn't happen because we're iterating over actor.items
            // but we're being defensive in case something changed while we're
            // migrating data.
            LOGGER.warn(
              `Item could not be found on actor, "${installedItemUUID}". Skipping`
            );
          }

          // If the installed item was found and is not null, proceed with migration
          if (installedItem && installedItem !== null) {
            // Increment the installed size by the size of the installed item
            installedSize += installedItem.system.size;

            // Prepare to update the system properties of the installed item
            const systemUpdate = installedItem.system;

            // If the installed item is not marked as installed, correct that
            if (!installedItem.system.isInstalled) {
              systemUpdate.isInstalled = true;
              systemUpdate.installedIn = item.uuid;
            }

            // Prepare the updated item
            const updatedItem = {
              _id: installedItem.id,
              system: systemUpdate,
            };

            // Add the updated item to the owned item updates
            ownedItemUpdates.push(updatedItem);

            // Add the installed item to the list of installed items
            installedItemsList.push(installedItem.uuid);
            // If the item is of upgradable type and the installed item is an
            // upgrade
            if (
              upgradableTypes.includes(item.type) &&
              installedItem.type === "itemUpgrade"
            ) {
              // Extract the modifiers from the installed item system data
              const upgradeModifiers = installedItem.system.modifiers;
              // Initialize a list of modifiers
              const modList = {};

              // Iterate through each modifier in the upgrade
              Object.keys(upgradeModifiers).forEach((index) => {
                const modifier = upgradeModifiers[index];

                // If modifier exists, corresponding data point exists in the
                // CPR.upgradableDataPoints, modifier.configured is true
                // (secondaryWeapon), and the modifier is not 0, null or
                // empty string, then add it to the list
                if (
                  typeof modifier !== "undefined" &&
                  modifier.configured &&
                  typeof CPR.upgradableDataPoints[item.type][index] !==
                    "undefined" &&
                  modifier !== 0 &&
                  modifier !== null &&
                  modifier !== ""
                ) {
                  // If the modifier's value is not undefined or null, then add ]
                  // it to the list
                  if (
                    typeof modifier.value === "undefined" ||
                    modifier.value !== null
                  ) {
                    modList[index] = modifier;
                  }
                }
              });

              // Construct the upgrade data
              const upgradeData = {
                _id: installedItem._id,
                uuid: installedItem.uuid,
                name: installedItem.name,
                type: installedItem.system.type,
                size: installedItem.system.size,
                system: {
                  modifiers: modList,
                },
              };

              // Add the upgrade data to the list of upgrade items
              upgradeItems.push(upgradeData);
            }
          }
        }

        // If the original installed items list is different from the migrated list,
        // update the item
        if (
          item.system.installedItems.list.length !== installedItemsList.length
        ) {
          itemUpdates["system.installedItems.list"] = installedItemsList;
          itemUpdates["system.installedItems.usedSlots"] = installedSize;
        }

        // If there are any upgrades, add them to the item updates
        if (upgradeItems.length > 0) {
          itemUpdates["system.upgrades"] = upgradeItems;
        }

        // If there are any item updates (i.e., the itemUpdates object has more
        // than just the _id field), add the updates to the owned item updates
        if (Object.keys(itemUpdates).length > 1) {
          ownedItemUpdates.push(itemUpdates);
        }
      }
    }
    return actor.updateEmbeddedDocuments("Item", ownedItemUpdates);
  }
}
