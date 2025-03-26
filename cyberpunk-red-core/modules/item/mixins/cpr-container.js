/* eslint-disable no-await-in-loop */
/* global duplicate fromUuidSync Item game Folder */
import LOGGER from "../../utils/cpr-logger.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";

/**
 * If an item can ACCEPT upgrades (i.e. it has slots), then it should include this
 * mixin. This does not accommodate items that are upgrades.
 */
const Container = function Container() {
  /*
   ** Return the number of available slots, taking into
   * considerations any upgrades which may change the number
   * of slots
   * @returns Integer - Total number of available slots
   */
  this.availableInstallSlots = function availableInstallSlots() {
    LOGGER.trace("availableInstallSlots | Container | Called.");
    const itemTemplates = SystemUtils.GetTemplateItemTypes("upgradable");
    let totalSlots = this.system.installedItems.slots;
    if (itemTemplates.includes(this.type)) {
      const upgradeData = this.getTotalUpgradeValues("slots");
      totalSlots =
        upgradeData.type === "override"
          ? upgradeData.value
          : totalSlots + upgradeData.value;
    }
    return parseInt(totalSlots - this.system.installedItems.usedSlots, 10);
  };

  /**
   * Get an array of the objects installed in this Item. An optional
   * string parameter may be passed to filter the return list by a
   * specific Item type.
   *
   * @param {String} type - Optionally return a list of a specific item type
   * @returns {Array} - Array of objects that are installed
   */
  this.getInstalledItems = function getInstalledItems(type = false) {
    LOGGER.trace("getInstalledItems | Container | Called.");

    const installedItems = [];

    this.system.installedItems.list.forEach((uuid) => {
      const item = fromUuidSync(uuid);
      if (!type || item.type === type) {
        installedItems.push(item);
      }
    });
    return installedItems;
  };

  /**
   * Get an array of the objects installed in this Item. An optional
   * string parameter may be passed to filter the return list by a
   * specific Item type.
   *
   * @returns {Array} - Array of objects that are installed
   */
  this.recursiveGetAllInstalledItems =
    function recursiveGetAllInstalledItems() {
      LOGGER.trace("recursiveGetAllInstalledItems | Container | Called.");

      const installedItems = [];
      const containerTypes = SystemUtils.GetTemplateItemTypes("container");

      if (this.system.installedItems.list.length > 0) {
        let uuidList = this.system.installedItems.list;
        while (uuidList.length > 0) {
          for (const uuid of uuidList) {
            const item = fromUuidSync(uuid);
            if (item !== null) {
              if (!item?.isOwned) {
                item.system.isInstalled = true;
                item.system.installedIn = this.uuid;
              }
              if (containerTypes.includes(item.type)) {
                uuidList = uuidList.concat(item.system.installedItems.list);
              }
              installedItems.push(item);
            }
            uuidList = uuidList.filter((itemUUID) => itemUUID !== uuid);
          }
        }
      }
      return installedItems;
    };

  /**
   * Determine if a set of objects can be installed into this Item. Checks for
   * the following criteria:
   *  - Items are allowed to be installed
   *  - Item in itemLists are all in the allowedTypes of this item
   *  - Cumulative size of items in itemList is less than or equal to available slots
   *
   * @param {Array} itemList - Array of objects to wanting to be installed
   * @returns {Boolean} - Whether this item can install all objects passed to it
   */
  this.canInstallItems = function canInstallItems(itemList) {
    LOGGER.trace("canInstallItems | Container | Called.");
    if (!Array.isArray(itemList)) {
      LOGGER.debug(
        `CPRActor.canInstallItems argument is not an array: ${itemList}`
      );
      return false;
    }

    let result = this.system.installedItems.allowed;

    let totalInstallationSize = 0;
    itemList.forEach((item) => {
      if (
        this.system.installedItems.allowedTypes.includes(item.type) &&
        SystemUtils.getDataModelTemplates(item.type).includes("installable")
      ) {
        totalInstallationSize += item.system.size;
      } else {
        SystemUtils.DisplayMessage(
          "error",
          SystemUtils.Format("CPR.messages.installInvalidType", {
            target: this.name,
            item: item.name,
          })
        );
        result = false;
      }
    });

    const availableSlots = this.availableInstallSlots();
    if (totalInstallationSize > availableSlots) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.messages.installInsufficientSlots", {
          item: this.name,
        })
      );
      result = false;
    }
    return result;
  };

  /**
   * This will install items into this item.
   * @param {Array} itemList - Array of Item Objects to be installed
   * @returns {Promise} - Promise containing an updated list of objects from updateEmbeddedDocuments()
   */
  this.installItems = async function installItems(itemList) {
    LOGGER.trace("_installItems | Container | Called.");
    if (!Array.isArray(itemList)) {
      return Promise.reject(
        new Error(`CPRItem.installItems argument is not an array: ${itemList}`)
      );
    }

    const updateList = [];

    if (!this.canInstallItems(itemList)) {
      return updateList;
    }

    const actor = this.isOwned ? this.actor : false;

    const installedItems = duplicate(this.system.installedItems);
    const equippableTypes = SystemUtils.GetTemplateItemTypes("equippable");

    itemList.forEach((item) => {
      if (!installedItems.list.includes(item.uuid)) {
        installedItems.list.push(item.uuid);
      }
      installedItems.usedSlots += item.system.size;
      const itemData = {
        _id: item.id,
        "system.isInstalled": true,
        "system.installedIn": this.uuid,
      };
      if (equippableTypes.includes(item.type)) {
        itemData["system.equipped"] = equippableTypes.includes(this.type)
          ? this.system.equipped
          : "equipped";
      }
      updateList.push(itemData);
    });
    updateList.push({ _id: this.id, "system.installedItems": installedItems });

    return !actor
      ? this.update({ "system.installedItems": installedItems })
      : actor.updateEmbeddedDocuments("Item", updateList);
  };

  /**
   * This will uninstall all items in itemList from this item.  By default, any installed items
   * which also have installed items will NOT have those items removed from it.  Example:
   * Uninstalling a Cyberdeck from a Bodyweight Suit will NOT also uninstall any programs/upgrades
   * from the Cyberdeck.
   *
   * An exception here is the uninstallation of Cyberware.  Cyberware is always removed recursively
   * so if you uninstall a CyberArm which has a Cyberdeck in it, all programs and upgrades from the
   * Cyberdeck are also uninstalled.
   *
   * TODO: Determine if we should stop recursiveness on an item type change.  IE, if this
   *       is a cyberware item, only remove all embedded cyberware items and if something else
   *       is installed, like a cyberdeck, don't uninstall whatever it has installed.
   * @param {Array} itemList - Array of objects to uninstall
   * @param {Boolean} recursive  - Boolean stating if the uninstallation should be recursive
   *                               in that each item uninstalled should also have it's own
   *                               installed items removed.  This is needed for Cyberware uninstallations.
   * @returns {Promise} - Promise containing an updated list of objects from updateEmbeddedDocuments()
   */
  this.uninstallItems = async function uninstallItems(
    itemList,
    recursive = false
  ) {
    LOGGER.trace("uninstallItems | Container | Called.");
    if (!Array.isArray(itemList)) {
      return Promise.reject(
        new Error(
          `Container.installItems argument is not an array: ${itemList}`
        )
      );
    }

    const containerTypes = SystemUtils.GetTemplateItemTypes("container");
    const actor = this.isOwned ? this.actor : false;

    const installedItems = duplicate(this.system.installedItems);
    const updateList = [];

    const uninstallList = JSON.parse(JSON.stringify(itemList));

    for (const item of itemList) {
      installedItems.list = installedItems.list.filter(
        (uuid) => item.uuid !== uuid
      );
      installedItems.usedSlots =
        installedItems.usedSlots < item.system.size
          ? 0
          : installedItems.usedSlots - item.system.size;
      if (recursive && containerTypes.includes(item.type)) {
        let embeddedItemList = item.getInstalledItems();

        while (embeddedItemList.length > 0) {
          let updatedEmbeddedItemList = [];
          for (const embeddedItem of embeddedItemList) {
            uninstallList.push(embeddedItem);
            if (
              containerTypes.includes(embeddedItem.type) &&
              embeddedItem.system.installedItems.list.length > 0
            ) {
              updatedEmbeddedItemList = updatedEmbeddedItemList.concat(
                embeddedItem.getInstalledItems()
              );
            }
          }
          embeddedItemList = updatedEmbeddedItemList;
        }
      }
    }

    const equippableTypes = SystemUtils.GetTemplateItemTypes("equippable");

    uninstallList.forEach((item) => {
      const updateData = {
        _id: item._id,
        "system.isInstalled": false,
        "system.installedIn": "",
      };
      if (recursive) {
        updateData["system.installedItems.list"] = [];
        updateData["system.installedItems.usedSlots"] = 0;
      }
      if (equippableTypes.includes(item.type)) {
        updateData["system.equipped"] = item.isOwned ? "carried" : "owned";
      }
      updateList.push(updateData);
    });

    updateList.push({ _id: this.id, "system.installedItems": installedItems });
    return !actor
      ? this.update({ "system.installedItems": installedItems })
      : actor.updateEmbeddedDocuments("Item", updateList);
  };

  /**
   * This function is called from the createItem hook and it will create any items that are
   * installed in this container object at the location of this container object. In other words:
   *
   * If this object is created on an actor, the installed items are created on the same actor
   * If this object is created in the world, the installed items are created as world items
   *
   * World items that are created, are created in in a folder defined by the localized variable:
   *
   *  "CPR.settings.installedItemsFolder".
   *
   * @returns {Promise} - Promise of updated document
   */
  this.createInstalledItems = async function createInstalledItems() {
    LOGGER.trace("createInstalledItems | Container | Called.");
    const actor = this.isOwned ? this.actor : false;

    const equipTypes = SystemUtils.GetTemplateItemTypes("equippable");
    const upgradableTypes = SystemUtils.GetTemplateItemTypes("upgradable");
    const creationList = [];
    for (const installedUUID of this.system.installedItems.list) {
      const installedItem = fromUuidSync(installedUUID);
      if (installedItem?.actor?._id !== actor._id) {
        const newItemData = installedItem.toObject();
        if (equipTypes.includes(installedItem.type)) {
          newItemData.system.equipped = "carried";
        }
        newItemData.system.isInstalled = !!actor;
        newItemData.system.installedIn = actor ? this.uuid : "";
        creationList.push({
          name: newItemData.name,
          img: newItemData.img,
          type: newItemData.type,
          system: newItemData.system,
          effects: duplicate(newItemData.effects),
        });
      }
    }

    const newInstalledList = [];

    if (creationList.length > 0) {
      const containerTypes = SystemUtils.GetTemplateItemTypes("container");
      let createdItems = [];
      if (actor) {
        createdItems = await actor.createEmbeddedDocuments(
          "Item",
          creationList
        );
      } else {
        const folderName = SystemUtils.Localize(
          "CPR.settings.installedItemsFolder"
        );
        const folderList = game.folders.filter(
          (folder) => folder.name === folderName && folder.type === "Item"
        );
        const workingFolder =
          folderList.length === 1
            ? folderList[0]
            : await Folder.create({ name: folderName, type: "Item" });
        for (const item of creationList) {
          const newItem = await Item.create({
            name: item.name,
            type: item.type,
            img: item.img,
            system: item.system,
            effects: duplicate(item.effects),
            folder: workingFolder,
          });
          createdItems.push(newItem);
        }
      }
      for (const item of createdItems) {
        newInstalledList.push(item.uuid);
      }
    }

    this.system.installedItems.list = newInstalledList;

    if (this.type === "cyberdeck") {
      await this.syncPrograms();
    }

    if (upgradableTypes.includes(this.type)) {
      await this.syncUpgrades();
    }

    return !actor
      ? this.update({ "system.installedItems.list": newInstalledList })
      : actor.updateEmbeddedDocuments("Item", [
          { _id: this._id, "system.installedItems.list": newInstalledList },
        ]);
  };

  /**
   * This function is called when an actor is duplicated.  It ensures that the installed items of
   * the copied actor are all now pointing to the new object on the new actor.
   */
  this.recursiveInstallSync = async function recursiveInstallSync() {
    LOGGER.trace("recursiveInstallSync | Container | Called.");
    const containerTypes = SystemUtils.GetTemplateItemTypes("container");
    const upgradableTypes = SystemUtils.GetTemplateItemTypes("upgradable");
    const actor = this.isOwned ? this.actor : false;
    if (actor) {
      const actorUUID = actor.uuid;
      const updateList = [];
      const installedList = [];
      for (const installedItemUUID of this.system.installedItems.list) {
        const sourceItemId = installedItemUUID.split(".").pop();
        const newItemId = `${actorUUID}.Item.${sourceItemId}`;
        installedList.push(newItemId);
        const installedItem = actor.getOwnedItem(newItemId);
        updateList.push({
          _id: installedItem.id,
          "system.isInstalled": true,
          "system.installedIn": this.uuid,
        });
        if (
          containerTypes.includes(installedItem.type) &&
          installedItem.system.installedItems.list.length > 0
        ) {
          await installedItem.recursiveInstallSync();
        }
      }

      if (this.type === "cyberdeck") {
        const oldPrograms = this.system.programs;
        const newPrograms = {
          installed: [],
          rezzed: [],
        };

        for (const programData of oldPrograms.installed) {
          const originalProgramID = programData.uuid.split(".").pop();
          programData.uuid = `${actorUUID}.Item.${originalProgramID}`;
          newPrograms.installed.push(programData);
        }

        for (const programData of oldPrograms.rezzed) {
          const originalProgramID = programData.uuid.split(".").pop();
          programData.uuid = `${actorUUID}.Item.${originalProgramID}`;
          newPrograms.rezzed.push(programData);
        }
        updateList.push({
          _id: this.id,
          "system.installedItems.list": installedList,
          "system.programs": newPrograms,
        });
      } else {
        updateList.push({
          _id: this.id,
          "system.installedItems.list": installedList,
        });
      }
      await actor.updateEmbeddedDocuments("Item", updateList);

      // Do this last because `syncUpgrades` relies on the updates above to work.
      if (upgradableTypes.includes(this.type)) {
        await this.syncUpgrades();
      }
    }
  };
};

export default Container;
