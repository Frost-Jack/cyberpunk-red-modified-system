/* eslint-disable no-debugger */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */
/* global game, hasProperty, duplicate, mergeObject, Item, fromUuidSync, fromUuid, TokenDocument, debugger */
import * as Migrations from "./scripts/index.js";
import LOGGER from "../../utils/cpr-logger.js";
import CPRSystemUtils from "../../utils/cpr-systemUtils.js";

/**
 * This is the base class for migration scripts. All migrations should extend this class and
 * implement the methods needed, which depends on what changed in the data model (actors, items, etc).
 * Put your migration in the scripts directory and add it to index.js so it is included.
 *
 * @abstract
 */
export default class CPRMigration {
  /**
   * Basic constructor to establish the version and other options
   */
  constructor() {
    LOGGER.trace("constructor | CPRMigration");
    this.version = null; // the data model version this migration will take us to
    this.flush = false; // migrations will stop after this script, even if more are needed
    this.errors = 0; // Increment if there were errors as part of this migration.
    this.statusPercent = 0;
    this.statusMessage = "";
    this.name = "Base CPRMigration Class";
    this.foundryMajorVersion = parseInt(game.version, 10);
    this.migrationFolder = false;
    this.itemMapping = {};
    this.debugMigration = {
      enabled: false,
      actor: { name: "", id: "", uuid: "" },
      scene: { name: "", id: "", uuid: "" },
      compendia: { name: "", id: "", uuid: "" },
    };
  }

  /**
   * Execute the migration code. This should not be overidden with the exception of the legacy
   * migration scripts. (000-base.js)
   */
  async run() {
    LOGGER.trace("run | CPRMigration");
    LOGGER.log(`Migrating to data model version ${this.version}`);

    // These shenanigans are how we dynamically call static methods on whatever migration object is
    // being run that extends this base class. Normally you need to be explicit, e.g.
    // ActiveEffectsMigration.run().
    const classRef = Migrations[this.constructor.name];
    await this.preMigrate();

    // migrate unowned items
    this.statusPercent = 1;
    this.statusMessage =
      `${CPRSystemUtils.Localize("CPR.migration.status.start")} ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.items")}, ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.actors")}, ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.scenes")}, ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.compendia")}...`;
    CPRSystemUtils.updateMigrationBar(this.statusPercent, this.statusMessage);

    // Migrate settings, if any, first.
    if (!(await this.migrateSettings())) {
      CPRSystemUtils.DisplayMessage(
        "error",
        CPRSystemUtils.Localize("CPR.migration.status.settingsErrors")
      );
      return false;
    }

    if (!(await CPRMigration.migrateItems(classRef))) {
      CPRSystemUtils.DisplayMessage(
        "error",
        CPRSystemUtils.Localize("CPR.migration.status.itemErrors")
      );
      return false;
    }

    this.statusPercent += 24;
    this.statusMessage =
      `${CPRSystemUtils.Localize("CPR.migration.status.start")} ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.actors")}, ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.scenes")}, ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.compendia")}...`;
    CPRSystemUtils.updateMigrationBar(this.statusPercent, this.statusMessage);

    // migrate actors
    if (!(await this.migrateActors())) {
      CPRSystemUtils.DisplayMessage(
        "error",
        CPRSystemUtils.Localize("CPR.migration.status.actorErrors")
      );
      return false;
    }

    this.statusPercent += 25;
    this.statusMessage =
      `${CPRSystemUtils.Localize("CPR.migration.status.start")} ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.scenes")}, ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.compendia")}...`;
    CPRSystemUtils.updateMigrationBar(this.statusPercent, this.statusMessage);

    // unlinked actors (tokens)
    if (!(await this.migrateScenes())) {
      CPRSystemUtils.DisplayMessage(
        "error",
        CPRSystemUtils.Localize("CPR.migration.status.tokenErrors")
      );
      return false;
    }

    this.statusPercent += 25;
    this.statusMessage =
      `${CPRSystemUtils.Localize("CPR.migration.status.start")} ` +
      `${CPRSystemUtils.Localize("CPR.migration.status.compendia")}...`;
    CPRSystemUtils.updateMigrationBar(this.statusPercent, this.statusMessage);

    // compendia
    if (!(await this.migrateCompendia(classRef))) {
      CPRSystemUtils.DisplayMessage(
        "error",
        CPRSystemUtils.Localize("CPR.migration.status.compendiaErrors")
      );
      return false;
    }

    this.statusPercent = 100;
    this.statusMessage = `${CPRSystemUtils.Localize(
      "CPR.migration.status.migrationsComplete"
    )}`;
    CPRSystemUtils.updateMigrationBar(this.statusPercent, this.statusMessage);

    // In the future, put top-level migrations for tokens, scenes, and other things here

    await this.postMigrate();

    if (this.errors !== 0) {
      throw Error("Migration errors encountered");
    }
    await game.settings.set(game.system.id, "dataModelVersion", this.version);
    return true;
  }

  /**
   * Return a data object that can be merged to delete a document property. This method
   * safely checks if the property exists before passing back the Foundry-specific directive to
   * delete a property. Attempting to delete keys in normal JS ways produces errors when calling
   * Doc.update().
   *
   * Example deletion key that will delete "data.whatever.property":
   *    { "data.whatever.-=property": null }
   *
   * Prior to Foundry V10, all CPR data was stored in "data.data" however with V10, that has
   * been moved to "system" directly off of the object.  Due to this, it is no longer necessary with V10+
   * to pass the object stub (ie "system") in the property name.
   *
   * @param {Document} doc - document (item or actor) that we intend to delete properties on
   * @param {String} prop - dot-notation of the property, "data.roleInfo.role" for example
   * @returns {Object}
   */
  static safeDelete(doc, prop) {
    LOGGER.trace("safeDelete | CPRMigration");
    let key = prop;
    if (this.foundryMajorVersion < 10) {
      if (key.includes("data.data")) key = key.slice(5); // should only be one data for v9
    }

    const systemData = this.foundryMajorVersion < 10 ? "data" : "system";
    const regex = this.foundryMajorVersion < 10 ? /^system./ : /^data./;
    key = key.replace(regex, `${systemData}.`);

    if (hasProperty(doc, key)) {
      key = prop.match(/.\../)
        ? prop.replace(/.([^.]*)$/, ".-=$1")
        : `-=${prop}`;
      return { [key]: null };
    }
    return {};
  }

  /**
   * Takes in an array of object changes (updateList) and a requested object change (itemUpdateData)
   * and if the object is in the array, it will merge the changes to that object in the array, otherwise
   * it appends to the array.
   * Returns an updated array.
   * @param {Array} updateList - Array of objects to be passed to actor.*EmbeddedDocuments()
   * @param {Object} itemUpdateData  - Object with at least _id: set and changes for the object
   * @returns {Array} - Updated updateList including itemUpdateData
   */
  static addToUpdateList(updateList, itemUpdateData) {
    LOGGER.trace("addToUpdateList | CPRMigration");
    let newList = duplicate(updateList);
    const inList = updateList.filter((i) => i._id === itemUpdateData._id);
    if (inList.length > 0) {
      const updatedData = mergeObject(itemUpdateData, inList[0]);
      newList = newList.filter((i) => i._id !== itemUpdateData._id);
      newList.push(updatedData);
    } else {
      newList.push(itemUpdateData);
    }
    return newList;
  }

  /**
   * Does nothing and is meant to be over-ridden.
   *
   */
  async migrateSettings() {
    LOGGER.trace("migrateSettings | CPRMigration");
    // Return true so that if a migration script doesn't override this function, nothing fails.
    return true;
  }

  /**
   * Migrate unowned Items
   */
  static async migrateItems(classRef) {
    LOGGER.trace("migrateItems | CPRMigration");
    let good = true;

    const itemMigrations = game.items.contents.map(async (item) => {
      try {
        return await classRef.migrateItem(item);
      } catch (err) {
        LOGGER.error(err);
        throw new Error(
          `${this.name}: ${item.name} had a migration error: ${err.message}`
        );
      }
    });
    const values = await Promise.allSettled(itemMigrations);
    for (const value of values.filter((v) => v.status !== "fulfilled")) {
      LOGGER.error(`Migration (${this.name}) error: ${value.reason.message}`);
      LOGGER.error(value.reason.stack);
      good = false;
    }
    return good;
  }

  /**
   * Does nothing and is meant to be over-ridden.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.trace("migrateItem | CPRMigration");
  }

  /**
   * Migrate actors
   */
  async migrateActors() {
    LOGGER.trace("migrateActors | CPRMigration");
    // actors in the "directory"
    let good = true;
    const actorMigrations = game.actors.contents.map(async (actor) => {
      try {
        if (
          this.debugMigration.enabled &&
          (actor.name === this.debugMigration.actor.name ||
            actor.id === this.debugMigration.actor.id ||
            actor.uuid === this.debugMigration.actor.uuid)
        ) {
          debugger;
        }
        return await this.migrateActor(actor);
      } catch (err) {
        LOGGER.error(err);
        throw new Error(
          `${this.name}: ${actor.name} had a migration error: ${err.message}`
        );
      }
    });
    const values = await Promise.allSettled(actorMigrations);
    for (const value of values.filter((v) => v.status !== "fulfilled")) {
      LOGGER.error(`Migration (${this.name}) error: ${value.reason.message}`);
      LOGGER.error(value.reason.stack);
      good = false;
    }
    return good;
  }

  /**
   * Does nothing and is meant to be over-ridden.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace("migrateActor | CPRMigration");
  }

  /**
   * Migrate scenes. We specifically focus on unlinked tokens for now.
   */
  async migrateScenes() {
    LOGGER.trace("migrateScenes | CPRMigration");
    let good = true;
    const sceneMigrations = game.scenes.contents.map(async (scene) => {
      try {
        if (
          this.debugMigration.enabled &&
          (scene.name === this.debugMigration.scene.name ||
            scene.id === this.debugMigration.scene.id ||
            scene.uuid === this.debugMigration.scene.uuid)
        ) {
          debugger;
        }
        return await this.migrateScene(scene);
      } catch (err) {
        LOGGER.error(err);
        throw new Error(
          `${this.name}: ${scene.name} had a migration error: ${err.message}`
        );
      }
    });
    const values = await Promise.allSettled(sceneMigrations);
    for (const value of values.filter((v) => v.status !== "fulfilled")) {
      LOGGER.error(`Migration (${this.name}) error: ${value.reason.message}`);
      LOGGER.error(value.reason.stack);
      good = false;
    }
    return good;
  }

  /**
   * Migrate scene
   */
  async migrateScene(scene) {
    LOGGER.trace("migrateScene | CPRMigration");
    const tokens = scene.tokens.contents.filter((token) => {
      const tokenData = this.foundryMajorVersion < 10 ? token.data : token;
      if (!game.actors.has(tokenData.actorId)) {
        // Degenerate case where the actor that the token is derived from was since
        // deleted. This makes token.actor null so we don't have a full view of all of the actor data.
        // This is technically a broken token and even Foundry throws errors when you do certain things
        // with this token. We skip it.
        LOGGER.warn(
          `WARNING: Token "${tokenData.name}" (${tokenData.actorId}) on Scene "${scene.name}" (${scene.id})` +
            ` is missing the source Actor, so we will skip migrating it. Consider replacing or deleting it.`
        );
        return false;
      }
      if (!tokenData.actorLink) return true; // unlinked tokens, this is what we're after
      // anything else is a linked token, we assume they're already migrated
      return false;
    });
    const tokenMigrations = tokens.map(async (token) => {
      try {
        // Essentially we have to update every token with a dummy update so that items aren't
        // deleted from unlinked tokens. This is a foundry bug. See migration script `020-tokenItemLossFix.js`
        // TODO: REMOVE THIS AFTER 0.88.X
        if (Object.getPrototypeOf(this).migrateToken) {
          await this.migrateToken(token); // This only exists in migration script 020.
        }
        return this.migrateActor(token.actor);
      } catch (err) {
        LOGGER.error(err);
        throw new Error(
          `${this.name}: ${token.actor.name} token had a migration error: ${err.message}`
        );
      }
    });
    const values = await Promise.allSettled(tokenMigrations);
    for (const value of values.filter((v) => v.status !== "fulfilled")) {
      LOGGER.error(`Migration (${this.name}) error: ${value.reason.message}`);
      LOGGER.error(value.reason.stack);
    }
  }

  /**
   * Migrate compendia. This code is not meant to be run on the system-provided compendia
   * that we provide. They are updated and imported on the side. The benefit of that approach
   * to users is decreased migration times. I.e., we already migrated our compendia.
   *
   * We respect whether a compendium is locked. If it is, do not touch it. This does invite problems
   * later on if a user tries to use entries with an outdated data model. However, the discord
   * community for Foundry preferred locked things to be left alone.
   */
  async migrateCompendia(classRef) {
    LOGGER.trace("migrateCompendia | CPRMigration");
    let good = true;

    // Pack types we provide migrations for
    const packTypes = ["Actor", "Item", "Scene"];

    // Read setting to check which pack.sourceTypes we are migrating
    const sourceTypes = ["world"];

    // If we are migrating module compendia add it to the sourceTypes array
    if (game.settings.get(game.system.id, "migrateModuleCompendia")) {
      sourceTypes.push("module");
    }

    // During dev you might want to run migrations on our own packs rather than
    // migrate by hand, if so uncomment this and set migration of locked packs
    // to true in the game settings and run your migrations.
    // sourceTypes.push("system");

    // Check if we are migrating locked packs
    const migrateLockedPacks = game.settings.get(
      game.system.id,
      "migrateLockedCompendia"
    );

    // Get a list of packs to migrate based on the settings above
    const packsToMigrate = game.packs.filter(
      (p) =>
        packTypes.includes(p.metadata.type) &&
        sourceTypes.includes(p.metadata.packageType) &&
        (migrateLockedPacks || !p.locked)
    );

    LOGGER.debug(
      `CPRC Migration | Migrating packs: ${packsToMigrate
        .map((p) => p.metadata.id)
        .join(", ")}`
    );

    for (const pack of packsToMigrate) {
      // If we are migrating locked packs we need to unlock them before migrating
      const wasLocked = pack.locked;
      await pack.configure({ locked: false });

      // Perform Foundry server-side migration of the pack data model
      await pack.migrate();

      if (
        this.debugMigration.enabled &&
        (pack.name === this.debugMigration.compendia.name ||
          pack.id === this.debugMigration.compendia.id ||
          pack.uuid === this.debugMigration.compendia.uuid)
      ) {
        debugger;
      }

      // Iterate over compendium entries - applying fine-tuned migration functions
      const docs = await pack.getDocuments();
      const packMigrations = docs.map(async (doc) => {
        switch (pack.metadata.type) {
          case "Actor": {
            await this.migrateActor(doc);
            break;
          }
          case "Item": {
            await classRef.migrateItem(doc);
            break;
          }
          case "Scene": {
            await this.migrateScene(doc);
            break;
          }
          default:
            CPRSystemUtils.DisplayMessage(
              "error",
              `Unexpected doc type in compendia: ${doc}`
            );
        }
      });

      const values = await Promise.allSettled(packMigrations);
      for (const value of values.filter((v) => v.status !== "fulfilled")) {
        LOGGER.error(`Migration (${this.name}) error: ${value.reason.message}`);
        LOGGER.error(value.reason.stack);
        good = false;
      }
      // Lock packs if they were locked pre-migration
      await pack.configure({ locked: wasLocked });
    }
    return good;
  }

  /**
   * Create a migration folder for object editing.
   *
   * Some things, such as Active Effects can not be edited on on owned item.  To make changes
   * to these items, the item needs to be cloned or "backed up" into a world item, edited
   * and then put back onto the Actor.
   *
   * If your migration needs to do this, you should call createMigrationFolder() from your
   * preMigrate function passing the name of the migration.  This will return a folder object
   * to store the backed up objects.
   * @param {String} migrationName - the name of the migration running
   * @returns {Folder}
   */
  static async createMigrationFolder(migrationName) {
    LOGGER.trace("createMigrationFolder | CPRMigration");
    return CPRSystemUtils.GetFolder("Item", `${migrationName} Workspace`);
  }

  /**
   * Delete the migration folder for object editing.
   *
   * If your migration code is making use of the backupOwnedItem and restoreOwnedItem
   * and a migration folder, you should call deleteMigrationFolder() from your
   * postMigrate() function passing the migration Folder object.
   *
   * If the folder is not empty, it will not delete the folder and instead throw
   * debug messages to the console in order to help figure out why there are still
   * objects in the folder.
   *
   * @param {Folder} migratonFolder - the folder we are storing the items in
   */
  static async deleteMigrationFolder(migrationFolder) {
    LOGGER.trace("deleteMigrationFolder | CPRMigration");
    if (migrationFolder && migrationFolder.contents.length === 0) {
      LOGGER.debug("would delete migration folder");
      migrationFolder.delete();
    } else {
      LOGGER.error(`MIGRATION FOLDER NOT EMPTY: ${migrationFolder.name}`);
      for (const item of migrationFolder.contents) {
        const mappingData = this.itemMapping[item.uuid];
        const sourceItem = mappingData?.item
          ? await fromUuid(mappingData.item)
          : { name: "<OBJECT MISSING>" };
        const sourceActor = mappingData?.actor
          ? await fromUuid(mappingData.actor)
          : { name: "<OBJECT MISSING>" };

        let errorMessage = `Folder Name: ${migrationFolder.name} | Folder Item: ${item.name} (${item.uuid}) | Source Item: ${sourceItem.name} (${mappingData.item}) | Source Actor: ${sourceActor.name} (${mappingData.actor})`;
        if (
          mappingData.actor.match(/Compendium/) &&
          !sourceActor.name.match(/OBJECT MISSING/)
        ) {
          const compendiumTitle = sourceActor.compendium?.title;
          errorMessage = `${errorMessage} | Compendium: ${compendiumTitle}`;
          const UuidParts = mappingData.actor.split(".");
          UuidParts.splice(4);
          const CompendiumObjectUuid = UuidParts.join(".");
          const CompendiumObject = await fromUuid(CompendiumObjectUuid);
          if (CompendiumObject) {
            errorMessage = `${errorMessage} | Compendium Entry: ${CompendiumObject.name} (${CompendiumObjectUuid})`;
          }
        }
        LOGGER.error(errorMessage);
      }
    }
  }

  /**
   * Copy an (owned) Item into the migration work folder. This will enable active effects to be created
   * or changed on them. If it already exists, just return that.
   *
   * Note: this method is not idempotent intentionally. Tracking what should or should not backed up
   *       is a hard problem because the IDs will always change with each call.
   *
   * @param {CPRItem} item - the item we are copying
   * @param {Folder} migratonFolder - the folder we are storing the items in
   * @returns the copied item data
   */
  static async backupOwnedItem(item, migrationFolder) {
    LOGGER.trace("backupOwnedItem | CPRMigration");

    const newItem = await Item.create(
      {
        name: item.name,
        type: item.type,
        system: item.system,
        img: item.img,
        folder: migrationFolder,
      },
      {
        cprIsMigrating: true,
      }
    );

    if (item.effects.size > 0) {
      for (const sourceEffect of item.effects) {
        // const [effect] = await newItem.createEffect(false);
        let newData = {
          // _id: effect.id,
          name: sourceEffect.name,
          icon: sourceEffect.icon,
          system: sourceEffect.system,
          changes: sourceEffect.changes,
          flags: sourceEffect.flags,
          disabled: sourceEffect.disabled,
        };
        if (this.foundryMajorVersion >= 11) {
          newData = {
            // _id: effect.id,
            name: sourceEffect.name,
            icon: sourceEffect.icon,
            system: sourceEffect.system,
            changes: sourceEffect.changes,
            flags: sourceEffect.flags,
            disabled: sourceEffect.disabled,
          };
        }

        await newItem.createEmbeddedDocuments("ActiveEffect", [newData]);
      }
    }
    if (!this.itemMapping) this.itemMapping = {};
    this.itemMapping[newItem.uuid] = {
      item: item.uuid,
      actor: item.actor.uuid,
    };
    return newItem;
  }

  /**
   * Restores the changed item back onto the original actor ensuring all
   * data points are updated. Once the object is re-created on the Actor
   * it is cleaned up from the Migration Folder.
   *
   * Note: The OLD item needs to be deleted from the actor by the migration code.
   *
   * @param {CPRItem} item - the item we modified and has to be re-created on the Actor
   */
  static async restoreOwnedItem(item) {
    LOGGER.trace("restoreOwnedItems | CPRMigration");
    const originalData = this.itemMapping[item.uuid];

    if (!originalData) {
      LOGGER.error(
        `Attempting to restore item (${item.name}) however source data does not exist.`
      );
      return;
    }

    const compendiumRegex = /Compendium/g;

    let actor = originalData.actor.match(compendiumRegex)
      ? await fromUuid(originalData.actor)
      : fromUuidSync(originalData.actor);
    if (actor instanceof TokenDocument) {
      actor = actor.actor;
    }
    const oldOwnedItem = originalData.item.match(compendiumRegex)
      ? await fromUuid(originalData.item)
      : fromUuidSync(originalData.item);
    const resultArray = await actor.createEmbeddedDocuments("Item", [
      item.toObject(),
    ]);
    if (resultArray.length === 0) {
      LOGGER.error(
        `Attempting to restore item (${item.name}) however new item creation failed on actor ${actor.name}.`
      );
      return;
    }

    const newOwnedItem = resultArray[0];
    const originalUuid = oldOwnedItem.uuid;

    const installableTypes = CPRSystemUtils.GetTemplateItemTypes("installable");
    const containerTypes = CPRSystemUtils.GetTemplateItemTypes("container");
    const upgradableTypes = CPRSystemUtils.GetTemplateItemTypes("upgradable");
    const loadableTypes = CPRSystemUtils.GetTemplateItemTypes("loadable");

    if (
      installableTypes.includes(item.type) &&
      actor.system.installedItems?.list.includes(originalUuid)
    ) {
      const newInstalledItems = actor.system.installedItems.list.filter(
        (uuid) => uuid !== originalUuid
      );
      newInstalledItems.push(newOwnedItem.uuid);
      await actor.update({ "system.installedItems.list": newInstalledItems });
    }

    const ownedItems = actor.items.filter((i) => {
      if (
        containerTypes.includes(i.type) &&
        i.system.installedItems?.list.includes(originalUuid)
      )
        return true;
      if (
        installableTypes.includes(i.type) &&
        i.system.isInstalled &&
        i.system.installedIn === originalUuid
      )
        return true;
      if (
        loadableTypes.includes(i.type) &&
        i.system.magazine.ammoData.uuid === originalUuid
      )
        return true;
      return false;
    });

    const updateList = [];

    if (containerTypes.includes(oldOwnedItem.type)) {
      updateList.push({
        _id: newOwnedItem._id,
        "system.installedItems": oldOwnedItem.system.installedItems,
      });
    }

    for (const ownedItem of ownedItems) {
      const itemUpdates = {
        _id: ownedItem._id,
        system: {},
      };

      if (
        containerTypes.includes(ownedItem.type) &&
        ownedItem.system.installedItems.list.includes(originalUuid)
      ) {
        const newInstallList = ownedItem.system.installedItems.list.filter(
          (u) => u !== originalUuid
        );
        newInstallList.push(newOwnedItem.uuid);
        itemUpdates.system.installedItems = { list: newInstallList };
      }

      if (
        installableTypes.includes(ownedItem.type) &&
        ownedItem.system.installedIn === originalUuid
      ) {
        itemUpdates.system.installedIn = newOwnedItem.uuid;
      }

      if (
        upgradableTypes.includes(ownedItem.type) &&
        ownedItem.system.upgrades.length > 0 &&
        ownedItem.system.upgrades.filter((u) => u.uuid === originalUuid)
          .length > 0
      ) {
        const newUpgrades = [];
        for (const upgradeData of ownedItem.system.upgrades) {
          if (upgradeData.uuid === originalUuid) {
            upgradeData.uuid = newOwnedItem.uuid;
          }
          newUpgrades.push(upgradeData);
        }
        itemUpdates.system.upgrades = newUpgrades;
      }

      if (
        loadableTypes.includes(ownedItem.type) &&
        ownedItem.system.magazine.ammoData.uuid === originalUuid
      ) {
        itemUpdates.system.magazine = {
          ammoData: { name: newOwnedItem.name, uuid: newOwnedItem.uuid },
        };
      }

      if (
        ownedItem.type === "cyberdeck" &&
        ownedItem.system.programs.installed.filter(
          (p) => p.uuid === originalUuid
        ).length > 0
      ) {
        const oldPrograms = ownedItem.system.programs;
        const newPrograms = {
          installed: [],
          rezzed: [],
        };

        for (const programData of oldPrograms.installed) {
          if (programData.uuid === originalUuid) {
            programData.uuid = newOwnedItem.uuid;
          }
          newPrograms.installed.push(programData);
        }

        for (const programData of oldPrograms.rezzed) {
          if (programData.uuid === originalUuid) {
            programData.uuid = newOwnedItem.uuid;
          }
          newPrograms.rezzed.push(programData);
        }
        itemUpdates.system.programs = newPrograms;
      }

      if (
        ownedItem.type === "role" &&
        originalUuid.includes(actor.system.roleInfo.activeNetRole)
      ) {
        await actor.update({
          "system.roleInfo.activeNetRole": newOwnedItem._id,
        });
      }

      if (Object.keys(itemUpdates.system).length > 0) {
        updateList.push(itemUpdates);
      }
    }

    if (updateList.length > 0) {
      await actor.updateEmbeddedDocuments("Item", updateList);
    }
    await item.delete();
  }
  /**
   * This block of abstract methods breaks down how each document type is migrated. If there
   * are any steps that need to be taken before migrating, put them in preMigrate. Likewise
   * any clean up or changes after go in postMigrate. Note that uncommenting these will cause
   * the linter to traceback for some ridiculous reason.
   *
   * They all assume data model changes are sent to the server (they're mutators).
   *
   * async preMigrate() {}
   * async migrateActor(actor) {}
   * static async migrateItem(item) {}
   * static async migrateMacro(macro) {}
   * static async migrateToken(token) {}
   * static async migrateTable(table) {}
   * async postMigrate() {}
   */
}
