/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global duplicate */

import CPRMigration from "../cpr-migration.js";
import SystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class v11TokenMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | Unlinked Tokens (v11) Migration");
    super();
    this.version = 23;
    this.name = "Unlinked Tokens (v11) Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | ${this.version}-${this.name}`);
    SystemUtils.DisplayMessage(
      "notify",
      SystemUtils.Localize("CPR.migration.effects.beginMigration")
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
   * In Foundry v11, items on unlinked tokens had their UUIDs changed.
   * It used to be of form "Scene.id.Token.id.Item.id", and now it is of
   * form "Scene.id.Token.id.Actor.id.Item.id". Notice the "Actor.id" that
   * was added. Hopefully this script rectifies that in all the places
   * we track uuids.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);

    // Declare the uuid mutation function for later use.
    function mutateUuid(actorId, uuid) {
      const splitUuids = uuid.split(".");
      // Only do this if the uuid does not contain "Actor"
      // to avoid erroneously remutating already migrated data
      // Like in the case of a half-done migration.
      if (!splitUuids.includes("Actor")) {
        const i = splitUuids.indexOf("Item");
        splitUuids.splice(i, 0, "Actor", actorId);
      }
      return splitUuids.join(".");
    }

    // Return if not on unlinked tokens.
    if (!actor.token || actor.token.actorLink) {
      return Promise.resolve();
    }

    // Return if not on mooks or characters.
    if (actor.type !== "character" && actor.type !== "mook") {
      return Promise.resolve();
    }

    // The actor data that we will manipulate and then give to actor.update().
    const actorUpdateData = duplicate(actor.system);

    // The array that will eventually be given to actor.updateEmbeddedDocuments().
    const itemUpdateArray = [];

    // Mutate uuids in the actor.system.installedItems.list.
    const newInstalledUuids = [];
    for (const uuid of actorUpdateData.installedItems.list) {
      newInstalledUuids.push(mutateUuid(actor.id, uuid));
    }

    // Only items with the following mixins have data points that track uuids.
    const relevantTypes = [
      ...SystemUtils.GetTemplateItemTypes("installable"),
      ...SystemUtils.GetTemplateItemTypes("container"),
      ...SystemUtils.GetTemplateItemTypes("loadable"),
    ];
    const relevantItems = actor.items.filter((i) =>
      relevantTypes.includes(i.type)
    );
    // Mutate uuids in the actor's items.
    for (const item of relevantItems) {
      const itemUpdateData = { _id: item.id, system: duplicate(item.system) };

      if (item.system.installedItems?.list) {
        // Take care of item.system.installedItems.list.
        const masterInstalledList = [];
        item.system.installedItems.list.forEach((uuid) => {
          masterInstalledList.push(mutateUuid(actor.id, uuid));
        });
        itemUpdateData.system.installedItems.list = masterInstalledList;
      }

      // Take care of item.system.installedIn.
      if (item.system.installedIn) {
        const newInstalledIn = mutateUuid(actor.id, item.system.installedIn);
        itemUpdateData.system.installedIn = newInstalledIn;
      }

      // Take care of item.system.magazine.ammoData.uuid.
      if (item.system.magazine?.ammoData?.uuid) {
        const newAmmoUuid = mutateUuid(
          actor.id,
          item.system.magazine.ammoData.uuid
        );
        itemUpdateData.system.magazine.ammoData.uuid = newAmmoUuid;
      }

      // Take care of item.system.upgrades.
      if (item.system.upgrades) {
        const newUpgrades = duplicate(item.system.upgrades);
        newUpgrades.forEach((u) => {
          u.uuid = mutateUuid(actor.id, u.uuid);
        });
        itemUpdateData.system.upgrades = newUpgrades;
      }

      // Take care of item.system.programs.installed and item.system.programs.rezzed.
      if (item.type === "cyberdeck") {
        // Installed programs.
        const newInstalledPrograms = duplicate(item.system.programs.installed);
        newInstalledPrograms.forEach((p) => {
          p.uuid = mutateUuid(actor.id, p.uuid);
        });
        itemUpdateData.system.programs.installed = newInstalledPrograms;

        // Rezzed programs.
        const newRezzedPrograms = duplicate(item.system.programs.rezzed);
        newRezzedPrograms.forEach((p) => {
          p.uuid = mutateUuid(actor.id, p.uuid);
        });
        itemUpdateData.system.programs.rezzed = newRezzedPrograms;
      }

      // Add to itemUpdateData to the array.
      itemUpdateArray.push(itemUpdateData);
    }

    // Perform the updates.
    await actor.updateEmbeddedDocuments("Item", itemUpdateArray);
    return actor.update({ "system.installedItems.list": newInstalledUuids });
  }
}
