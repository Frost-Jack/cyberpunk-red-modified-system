/* eslint-disable no-await-in-loop */
/* globals Actor, getProperty, hasProperty, setProperty, duplicate game */
import SystemUtils from "../utils/cpr-systemUtils.js";
import LOGGER from "../utils/cpr-logger.js";

/**
 * Container actors function like loot boxes, player or party stashes, stores, and
 * vending machines. Note this does not extend CPRActor.
 *
 * @extends {Actor}
 */
export default class CPRContainerActor extends Actor {
  /**
   * create() is called when creating the actor, but it's not the same as a constructor. In the
   * code here, we pre-configure a few token options to reduce repetitive clicking.
   */
  static async create(data, options) {
    LOGGER.trace("create | CPRContainerActor | called.");
    const createData = data;
    const newActor = typeof data.system === "undefined";
    if (typeof data.system === "undefined") {
      LOGGER.trace("create | New Actor | CPRContainerActor | called.");
      createData.token = {
        disposition: 0,
      };
      createData.ownership = { default: 3 };
    }
    const newContainerActor = await super.create(createData, options);
    newContainerActor.setContainerType("shop");

    if (!newActor) {
      // An actor was copied/imported, sync all installed items with the UUID corresponding to the new actor.
      newContainerActor.syncInstalledItems();
    }
  }

  /**
   * The three reasons we extend this code are:
   *  - handle an edge case for migrations.
   *  - handle creating items on unlinked tokens
   *  - handle item stacking
   *
   * @override
   * @param {String} embeddedName - document name, usually a category like Item
   * @param {Object} ids - Array of documents to consider
   * @param {Object} context - an object tracking the context in which the method is being called
   * @returns {null}
   */
  async createEmbeddedDocuments(embeddedName, ids, context = {}) {
    LOGGER.trace("createEmbeddedDocuments | CPRContainerActor | called.");
    // Attempt to stack item before creating it
    if (embeddedName === "Item" && !context.CPRsplitStack && ids.length === 1) {
      LOGGER.debug("Attempting to stack items on an actor sheet");
      const doc = ids[0];
      const returnValue = await this.automaticallyStackItems(doc);
      if (returnValue.length > 0) {
        return returnValue;
      }
    }
    return super.createEmbeddedDocuments(embeddedName, ids, context);
  }

  /**
   * This is a helper function to sync installed item UUIDs on Actors and their respective owned items.
   * This is a 'twin' to the function `CPRActor.syncInstalledItems(actor)`. What is the difference?
   * Typically, we use the parent document's `document.system.installedItems.list` as the "source of truth"
   * for what things are installed into what. This is a list of UUIDs of installed items.
   * In rare instances (specifically with migration script 012), some actors in compendia were getting this
   * data-point wiped out. Luckily, on the installed items themselves, there is a datapoint called `item.installedIn`,
   * which did not get wiped out. This function reconstructs `installedItems.list` using the above data-point,
   * and makes sure all UUIDs match. The other, more often-used function reconstructs installed item
   * info from `installedItems.list` (as is best-practice). The following function is hopefully seldom used.
   *
   * Note: Much of this code is duplicated from CPRActor.
   *
   * @async
   */
  async syncInstalledViaInstalledIn() {
    LOGGER.trace("syncInstalledViaInstalledIn | CPRActor | called.");
    const actorUUID = this.uuid;
    const updateList = [];
    const currentItems = this.items.filter((item) => {
      // Match for UUID's that do not contain "Item" (i.e. actors)
      return item.system.isInstalled && !item.system.installedIn?.match("Item");
    });
    const containerTypes = SystemUtils.GetTemplateItemTypes("container");

    /**
     * This function adapts `item.recursiveInstallSync()` for this particular use-case.
     * It shouldn't be needed outside of its parent function.
     *
     * @async
     * @param {CPRActor} actor - The actor who the parent function is fixing.
     * @param {CPRItem} item - An owned item on the actor that we are fixing.
     */
    async function recursiveInstall(actor, item) {
      const itemUpdateList = [];
      const installedList = actor.items.filter(
        // Match for UUIDs that contain "Item" (i.e. items)
        (i) => i.system.isInstalled && i.system.installedIn?.match(item.id)
      );
      for (const i of installedList) {
        itemUpdateList.push({
          _id: i.id,
          "system.isInstalled": true,
          "system.installedIn": item.uuid,
        });
        if (containerTypes.includes(i.type)) {
          await recursiveInstall(actor, i);
        }
      }
      await item.update({
        "system.installedItems.list": installedList.map((i) => i.uuid),
      });
      await actor.updateEmbeddedDocuments("Item", itemUpdateList);

      // Do this last because `syncUpgrades` relies on the updates above to work.
      const upgradableTypes = SystemUtils.GetTemplateItemTypes("upgradable");
      if (upgradableTypes.includes(item.type)) {
        await item.syncUpgrades();
      }
    }

    for (const item of currentItems) {
      updateList.push({
        _id: item.id,
        "system.isInstalled": true,
        "system.installedIn": actorUUID,
      });
      if (containerTypes.includes(item.type)) {
        await recursiveInstall(this, item);
      }
    }

    // Sync any owned items that are containers
    for (const itemType of Object.keys(this.itemTypes)) {
      if (containerTypes.includes(itemType)) {
        for (const item of this.itemTypes[itemType]) {
          await recursiveInstall(this, item);
        }
      }
    }
    // Sync any loaded weapons
    for (const item of this.itemTypes.weapon) {
      if (
        item.system.isRanged &&
        item.system.magazine.ammoData.uuid.length > 0
      ) {
        const sourceItemId = item.system.magazine.ammoData.uuid
          .split(".")
          .pop();
        const newItemId = `${actorUUID}.Item.${sourceItemId}`;
        updateList.push({
          _id: item.id,
          "system.magazine.ammoData.uuid": newItemId,
        });
      }
    }
    await this.updateEmbeddedDocuments("Item", updateList);
  }

  /**
   * This is a helper function to sync installed item UUIDs on Actors and their respective owned items.
   * We need this because there are issues importing actors with installed items. Essentially,
   * the uuids in `installedIn` and `installedItems.list` (and `magazine.ammoData.uuid` for weapons)
   * do not get updated with the ID of the new actor. This function rectifies that and should be called
   * where relevant (e.g. importing an actor from JSON in actor.importFromJSON(), duplicating an actor
   * in actor.create(), etc.)
   *
   * Note: Much of this code is duplicated from CPRActor.
   *
   * @async
   */
  async syncInstalledItems() {
    LOGGER.trace("syncInstalledItems | CPRActor | called.");
    const actorUUID = this.uuid;
    const updateList = [];
    const containerTypes = SystemUtils.GetTemplateItemTypes("container");

    // Sync any owned items that are containers
    for (const itemType of Object.keys(this.itemTypes)) {
      if (containerTypes.includes(itemType)) {
        for (const item of this.itemTypes[itemType]) {
          if (item.system.installedItems.list.length > 0) {
            await item.recursiveInstallSync();
          }
        }
      }
    }
    // Sync any loaded weapons
    for (const item of this.itemTypes.weapon) {
      if (
        item.system.isRanged &&
        item.system.magazine.ammoData.uuid.length > 0
      ) {
        const sourceItemId = item.system.magazine.ammoData.uuid
          .split(".")
          .pop();
        const newItemId = `${actorUUID}.Item.${sourceItemId}`;
        updateList.push({
          _id: item.id,
          "system.magazine.ammoData.uuid": newItemId,
        });
      }
    }
    await this.updateEmbeddedDocuments("Item", updateList);
  }

  /**
   * This is a helper function for when syncing installed items fails irrecoverably.
   * It forcibly uninstalls all items from all other items so that the character sheet
   * can reset from a neutral state. This function should reveal items that are "invisible" on actors
   * due to UUIDs not matching up. Unfortunately, it means that users will have to manually
   * reinstall all their items, but at least other stats on those items aren't lost.
   * Ideally, this is also seldomly used.
   *
   * Note: Much of this code is duplicated from CPRActor.
   *
   * @async
   */
  async resetInstalledItems() {
    LOGGER.trace("resetInstalledItems | CPRActor | called.");

    const containerTypes = SystemUtils.GetTemplateItemTypes("container");
    const installableTypes = SystemUtils.GetTemplateItemTypes("installable");
    const relevantItems = this.items.filter(
      (i) =>
        containerTypes.includes(i.type) || installableTypes.includes(i.type)
    );
    const updateList = [];
    for (const item of relevantItems) {
      const updateData = {
        _id: item.id,
        "system.isInstalled": item.system.core ?? false,
        "system.installedIn": item.system.core ? this.uuid : "",
      };

      if (item.system.installedItems?.list) {
        updateData["system.installedItems.list"] = [];
      }

      if (item.system.upgrades) {
        updateData["system.upgrades"] = [];
        updateData["system.isUpgraded"] = [];
      }

      if (item.system.installedItems?.slots) {
        updateData["system.installedItems.usedSlots"] = 0;
      }

      if (item.type === "cyberdeck") {
        updateData["system.programs"] = {
          installed: [],
          rezzed: [],
        };
      } else if (item.type === "program") {
        updateData["system.isRezzed"] = false;
      }

      if (item.type === "weapon") {
        updateData["system.magazine.ammoData"] = {
          name: "",
          uuid: "",
        };
      }

      updateList.push(updateData);
    }

    await this.updateEmbeddedDocuments("Item", updateList);
  }

  /**
   * We override this function so that we can properly sync installed items on the imported actor.
   * This is necessary due to how we handle installed items.
   *
   * @param {*} json
   * @override
   */
  async importFromJSON(json) {
    LOGGER.trace("importFromJSON | CPRActor | Called.");
    const actor = await super.importFromJSON(json);
    await actor.syncInstalledItems();
  }

  /**
   * automaticallyStackItems searches for an identical item on the actor
   * and if found increments the amount and price for the item on the actor
   * instead of adding it as a new item.
   *
   * @param {Object} newItem - an object containing the new item
   * @returns {boolean} - true if thee item should be added normally
   *                    - false if it has been stacked on an existing item
   */
  automaticallyStackItems(newItem) {
    LOGGER.trace("automaticallyStackItems | CPRActor | Called.");
    const itemTemplates = SystemUtils.getDataModelTemplates(newItem.type);
    if (itemTemplates.includes("stackable")) {
      const itemMatch = this.items.find((i) => {
        if (i.type === newItem.type && i.name === newItem.name) {
          if (
            itemTemplates.includes("upgradable") &&
            i.system.upgrades.length !== 0
          ) {
            return false;
          }
          return i;
        }
        return false;
      });

      if (itemMatch) {
        let oldAmount = parseInt(itemMatch.system.amount, 10);
        let addedAmount = parseInt(newItem.system.amount, 10);
        if (Number.isNaN(oldAmount)) {
          oldAmount = 1;
        }
        if (Number.isNaN(addedAmount)) {
          addedAmount = 1;
        }
        const newAmount = oldAmount + addedAmount;
        return this.updateEmbeddedDocuments("Item", [
          { _id: itemMatch._id, "system.amount": newAmount },
        ]);
      }
    }
    // If not stackable, then return true to continue adding the item.
    return [];
  }

  /**
   * This is the callback for setting the container type.
   *
   * @callback
   * @public
   * @param {} event - object capturing event data (what was clicked and where?)
   */
  async setContainerType(containerType) {
    LOGGER.trace("setContainerType | CPRContainerActor | Called.");
    await this.setFlag(game.system.id, "container-type", containerType);
    switch (containerType) {
      case "shop": {
        await this.unsetFlag(game.system.id, "items-free");
        await this.unsetFlag(game.system.id, "players-create");
        await this.unsetFlag(game.system.id, "players-delete");
        await this.unsetFlag(game.system.id, "players-modify");
        await this.setFlag(game.system.id, "players-sell", true);
        await this.unsetFlag(game.system.id, "players-move");
        break;
      }
      case "loot": {
        await this.unsetFlag(game.system.id, "infinite-stock");
        await this.setFlag(game.system.id, "items-free", true);
        await this.unsetFlag(game.system.id, "players-create");
        await this.unsetFlag(game.system.id, "players-delete");
        await this.unsetFlag(game.system.id, "players-modify");
        await this.unsetFlag(game.system.id, "players-sell");
        await this.unsetFlag(game.system.id, "players-move");
        break;
      }
      case "stash": {
        await this.unsetFlag(game.system.id, "infinite-stock");
        await this.unsetFlag(game.system.id, "players-sell");
        await this.setFlag(game.system.id, "items-free", true);
        await this.setFlag(game.system.id, "players-create", true);
        await this.setFlag(game.system.id, "players-delete", true);
        await this.setFlag(game.system.id, "players-modify", true);
        await this.setFlag(game.system.id, "players-move", true);
        break;
      }
      case "custom": {
        break;
      }
      default: {
        break;
      }
    }
  }

  /**
   * A utility method that toggles a flag back and forth. If defined, it is
   * set to true, but when it should be "false" we just remove it.
   *
   * @param {*} flagName - a name for the flag to set/unset
   * @returns {Document} representing the flag
   */
  async toggleFlag(flagName) {
    LOGGER.trace("toggleFlag | CPRContainerActor | Called.");
    const flag = this.getFlag(game.system.id, flagName);
    if (flag === undefined || flag === false) {
      return this.setFlag(game.system.id, flagName, true);
    }
    return this.unsetFlag(game.system.id, flagName);
  }

  /**
   * Get all records from the associated ledger of a property. Currently the only
   * ledger that the container actor supports is the wealth ledger, however the
   * actor data model does have hit points listed as a ledger so we will
   * leave this as is.
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Array} - Each element is a tuple: [value, reason], or null if not found
   */
  listRecords(prop) {
    LOGGER.trace("listRecords | CPRContainerActor | Called.");
    if (prop === "wealth") {
      return getProperty(this.system, `${prop}.transactions`);
    }
    return null;
  }

  /**
   * Return whether a property in actor data is a ledgerProperty. This means it has
   * two (sub-)properties, "value", and "transactions".
   *
   * XXX: This method is copied from cpr-actor.js because CPRContainerActor does not inherit
   *      from that class. We could fix that, but then all other code in this file would be added
   *      to an already long file. If you make changes here, be sure to consider them there too.
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Boolean}
   */
  isLedgerProperty(prop) {
    LOGGER.trace("isLedgerProperty | CPRContainerActor | Called.");
    const ledgerData = getProperty(this.system, prop);
    if (!hasProperty(ledgerData, "value")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.ledger.errorMessage.missingValue", { prop })
      );
      return false;
    }
    if (!hasProperty(ledgerData, "transactions")) {
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Format("CPR.ledger.errorMessage.missingTransactions", {
          prop,
        })
      );
      return false;
    }
    return true;
  }

  /**
   * Change the value of a property and store a record of the change in the corresponding
   * ledger.
   *
   * @param {Number} value - how much to increase or decrease the value by
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  recordTransaction(value, reason, seller = null) {
    LOGGER.trace("recordTransaction | CPRContainerActor | Called.");
    // update "value"; it may be negative
    // If Containers ever get Active Effects, this code will be a problem. See Issue #583.
    const cprData = duplicate(this.system);
    let newValue = getProperty(cprData, "wealth.value") || 0;
    let transactionSentence;
    let transactionType = "set";

    if (seller) {
      if (seller._id === this._id) {
        transactionType = "add";
      } else {
        transactionType = "subtract";
      }
    } else {
      // eslint-disable-next-line prefer-destructuring
      transactionType = reason.split(" ")[2];
    }

    switch (transactionType) {
      case "set": {
        newValue = value;
        transactionSentence = "CPR.ledger.setSentence";
        break;
      }
      case "add": {
        newValue += value;
        transactionSentence = "CPR.ledger.increaseSentence";
        break;
      }
      case "subtract": {
        newValue -= value;
        transactionSentence = "CPR.ledger.decreaseSentence";
        break;
      }
      default:
    }

    setProperty(cprData, "wealth.value", newValue);
    // update the ledger with the change
    const ledger = getProperty(cprData, "wealth.transactions");
    ledger.push([
      SystemUtils.Format(transactionSentence, {
        property: "wealth",
        amount: value,
        total: newValue,
      }),
      reason,
    ]);
    setProperty(cprData, "wealth.transactions", ledger);
    // update the actor and return the modified property
    this.update({ system: cprData });
    return getProperty(this.system, "wealth");
  }

  /**
   * Given a property name on the actor model, wipe out all records in the corresponding ledger
   * for it. Effectively this sets it back to [].
   *
   * @param {String} prop - name of the property that has a ledger
   * @returns {Array} - empty or null if the property was not found
   */
  clearLedger(prop) {
    LOGGER.trace("clearLedger | CPRActor | Called.");
    if (this.isLedgerProperty(prop)) {
      const valProp = `system.${prop}.value`;
      const ledgerProp = `system.${prop}.transactions`;
      this.update({
        [valProp]: 0,
        [ledgerProp]: [],
      });
      return getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Change the value of a property and store a record of the change in the corresponding
   * ledger.
   *
   * @param {String} prop - name of the property that has a ledger
   * @param {Number} value - how much to increase or decrease the value by
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  deltaLedgerProperty(prop, value, reason) {
    LOGGER.trace("deltaLedgerProperty | CPRActor | Called.");
    if (this.isLedgerProperty(prop)) {
      // update "value"; it may be negative
      const valProp = `system.${prop}.value`;
      let newValue = getProperty(this, valProp);
      newValue += value;
      // update the ledger with the change
      const ledgerProp = `system.${prop}.transactions`;
      const ledger = getProperty(this, ledgerProp);
      if (value > 0) {
        ledger.push([
          SystemUtils.Format("CPR.ledger.increaseSentence", {
            property: prop,
            amount: value,
            total: newValue,
          }),
          reason,
        ]);
      } else {
        ledger.push([
          SystemUtils.Format("CPR.ledger.decreaseSentence", {
            property: prop,
            amount: -1 * value,
            total: newValue,
          }),
          reason,
        ]);
      }
      // update the actor and return the modified property
      this.update({
        [valProp]: newValue,
        [ledgerProp]: ledger,
      });
      return getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Set the value of a property and store a record of the change in the corresponding
   * ledger. This is different from applying a delta, here we just set the value.
   *
   * @param {String} prop - name of the property that has a ledger
   * @param {Number} value - what to set the value to
   * @param {String} reason - a user-provided reason for the change
   * @returns {Number} (or null if not found)
   */
  setLedgerProperty(prop, value, reason) {
    LOGGER.trace("setLedgerProperty | CPRActor | Called.");
    if (this.isLedgerProperty(prop)) {
      const valProp = `system.${prop}.value`;
      const ledgerProp = `system.${prop}.transactions`;
      const ledger = getProperty(this, ledgerProp);
      ledger.push([
        SystemUtils.Format("CPR.ledger.setSentence", {
          property: prop,
          total: value,
        }),
        reason,
      ]);
      this.update({
        [valProp]: value,
        [ledgerProp]: ledger,
      });
      return getProperty(this.system, prop);
    }
    return null;
  }

  /**
   * Return the Item object given an Id
   *
   * @public
   * @param {String} itemId - Id or UUID of the item to get
   * @returns {CPRItem}
   */
  getOwnedItem(itemId) {
    LOGGER.trace("getOwnedItem | CPRActor | Called.");
    const item = this.items.find((i) => i._id === itemId)
      ? this.items.find((i) => i._id === itemId)
      : this.items.find((i) => i.uuid === itemId);
    return item;
  }
}
