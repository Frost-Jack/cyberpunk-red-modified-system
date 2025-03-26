/* global game getProperty fromUuidSync */
import CPRDialog from "../../dialog/cpr-dialog-application.js";
import * as CPRRolls from "../../rolls/cpr-rolls.js";
import LOGGER from "../../utils/cpr-logger.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";

/**
 * The Loadable mixin is meant for items that can be loaded with something. Usually
 * that means ammunition, but there are edge cases like batteries or other charges
 * that do not have a finite amount of shots. Note that "shooting" logic does not
 * belong here, this is just for loading and unloading.
 */
const Loadable = function Loadable() {
  /**
   * set the list of ammo types this item can load
   *
   * @async
   * @param {String} ammoList - the ammo type that can be loaded
   * @returns - the updated item document
   */
  this.setCompatibleAmmo = async function setCompatibleAmmo(ammoList) {
    LOGGER.trace("setCompatibleAmmo | Loadable | Called.");
    this.system.ammoVariety = ammoList;
    if (this.actor) {
      this.actor.updateEmbeddedDocuments("Item", [
        { _id: this.id, system: this.system },
      ]);
    }
    return this.update({ "system.ammoVariety": ammoList });
  };

  /**
   * Set DV table that a TOKEN (from an actor) will use when measuring distance. This also takes
   * whether the item is set to autofire or not.
   *
   * @async
   * @param {CPRActor} actor - actor associated with the token
   * @param {String} dvTable - which dvTable to use, overridden if autofire is set.
   */
  this._setDvTable = async function _setDvTable(actor, dvTable) {
    LOGGER.trace("_setDvTable | Loadable | Called.");
    const flag = getProperty(
      actor,
      `flags.${game.system.id}.firetype-${this._id}`
    );
    const activeTable = flag === "autofire" ? `${dvTable} (Autofire)` : dvTable;
    if (actor.sheet.token !== null)
      return SystemUtils.SetDvTable(actor.sheet.token.object, activeTable);
    return Promise.resolve();
  };

  /**
   * Unload this item if it has any ammo in it.
   *
   * @async
   * @returns {Promise} - updated actor document, or null if this is not an owned item
   */
  this._unloadItem = async function _unloadItem() {
    LOGGER.trace("_unloadItem | Loadable | Called.");
    if (this.actor) {
      // recover the ammo to the right object
      let ammo = this.actor.getOwnedItem(this.system.magazine.ammoData.uuid);
      if (typeof ammo !== "object") {
        await this.createAmmoItems();
        ammo = this.actor.getOwnedItem(this.system.magazine.ammoData.uuid);
        if (!ammo) {
          return Promise.resolve();
        }
      }

      if (this.system.magazine.value > 0) {
        await ammo._ammoIncrement(this.system.magazine.value);
      }
      this.system.magazine.value = 0;
      this.system.magazine.ammoData = { name: "", uuid: "" };
      return this.actor.updateEmbeddedDocuments("Item", [
        { _id: this.id, system: this.system },
      ]);
    }
    return Promise.resolve();
  };

  /**
   * Load ammunition into this item. The only time an ammo ID is passed to this is
   * when it is being reloaded, meaning the ammo type is already set.
   *
   * @async
   * @param {String} reloadAmmoId - Id of the ammo being reloaded, null otherwise.
   * @returns {Promise}
   */
  this._loadItem = async function _loadItem(reloadAmmoId) {
    LOGGER.trace("_loadItem | Loadable | Called.");
    let selectedAmmoId = reloadAmmoId;
    if (reloadAmmoId) {
      const reloadAmmo = this.actor.getOwnedItem(reloadAmmoId);
      if (!(reloadAmmo && reloadAmmo.system.amount !== 0)) {
        selectedAmmoId = "";
      }
    }
    const loadedAmmo = this.system.magazine.ammoData?.uuid
      ? this.actor.getOwnedItem(this.system.magazine.ammoData.uuid)
      : null;
    const loadUpdate = [];
    if (this.actor) {
      if (!selectedAmmoId) {
        const ownedAmmo = this.actor.itemTypes.ammo;
        const validAmmo = [];
        Object.keys(ownedAmmo).forEach((index) => {
          const ammo = ownedAmmo[index];
          if (
            this.getRollData().ammoVariety.includes(ammo.getRollData().variety)
          ) {
            validAmmo.push(ammo);
            if (!selectedAmmoId) {
              selectedAmmoId = ammo.uuid;
            }
          }
        });

        if (loadedAmmo) {
          selectedAmmoId = loadedAmmo.system.amount > 0 ? loadedAmmo.uuid : "";
        } else if (
          this.system.magazine.ammoData?.uuid &&
          this.system.magazine.ammoData.uuid !== ""
        ) {
          selectedAmmoId = "";
        } else if (validAmmo.length > 0) {
          selectedAmmoId = validAmmo[0].uuid;
        } else {
          SystemUtils.DisplayMessage(
            "warn",
            SystemUtils.Localize("CPR.messages.noValidAmmo")
          );
          return Promise.resolve();
        }

        let dialogData = {
          weapon: this,
          ammoList: validAmmo,
          selectedAmmo: selectedAmmoId,
          returnType: "string",
        };

        // Show "Load Ammo" dialog,
        dialogData = await CPRDialog.showDialog(dialogData, {
          // Set the options for the dialog.
          template: `systems/${game.system.id}/templates/dialog/cpr-load-ammo-prompt.hbs`,
          title: SystemUtils.Localize("CPR.dialog.selectAmmo.title"),
        }).catch((err) => LOGGER.debug(err));
        if (dialogData === undefined) {
          return Promise.resolve();
        }
        selectedAmmoId = dialogData.selectedAmmo;
      }

      if (
        this.system.magazine.ammoData?.uuid !== selectedAmmoId &&
        this.system.magazine.ammoData?.uuid !== ""
      ) {
        await this._unloadItem();
      }

      if (selectedAmmoId) {
        const magazineData = this.system.magazine;
        const ammo = this.actor.getOwnedItem(selectedAmmoId);

        magazineData.ammoData.uuid = ammo.uuid;
        magazineData.ammoData.name = ammo.name;
        loadUpdate.push({
          _id: this._id,
          "system.magazine.ammoData.uuid": ammo.uuid,
          "system.magazine.ammoData.name": ammo.name,
        });

        if (ammo.getRollData().amount === 0) {
          SystemUtils.DisplayMessage(
            "warn",
            SystemUtils.Localize("CPR.messages.reloadOutOfAmmo")
          );
          return Promise.resolve();
        }

        // By the time we reach here, we know the weapon and ammo we are loading
        // Let's find out how much space is in the gun.
        const upgradeData = this.getTotalUpgradeValues("magazine");
        const magazineSpace =
          upgradeData.type === "override"
            ? upgradeData.value - magazineData.value
            : magazineData.max - magazineData.value + upgradeData.value;

        if (magazineSpace > 0) {
          if (Number(ammo.system.amount) >= magazineSpace) {
            magazineData.value += magazineSpace;
            await ammo._ammoDecrement(magazineSpace);
          } else {
            magazineData.value =
              Number(this.system.magazine.value) + Number(ammo.system.amount);
            await ammo._ammoDecrement(ammo.system.amount);
          }
        }
        loadUpdate.push({ _id: this._id, "system.magazine": magazineData });
      }
      return this.actor.updateEmbeddedDocuments("Item", loadUpdate);
    }
    return Promise.resolve();
  };

  /**
   * Figure out how many bullets to consume given a roll. Autofire and Suppressive
   * fire are 10 says the rules, it's 1 otherwise.
   *
   * @param {CPRRoll} cprRoll - a roll (presumably an attack roll)
   * @returns {Number} how many bullets to consume given the roll
   */
  this.bulletConsumption = function bulletConsumption(cprRoll) {
    LOGGER.trace("bulletConsumption | Loadable | Called.");
    let bulletCount = 1;
    if (
      cprRoll instanceof CPRRolls.CPRAutofireRoll ||
      cprRoll instanceof CPRRolls.CPRSuppressiveFireRoll
    ) {
      bulletCount = cprRoll.rollCardExtraArgs.autoFireAmmoConsumption;
    }
    return bulletCount;
  };

  /**
   * Does this item have enough ammo for the attack?
   * @returns - true or false
   */
  this.hasAmmo = function hasAmmo(cprRoll) {
    LOGGER.trace("hasAmmo | Loadable | Called.");
    return this.system.magazine.value - this.bulletConsumption(cprRoll) >= 0;
  };

  /**
   * Set the amount of ammo in this item. If value has a + or - in front of it,
   * then the amount of ammo is changed by the value, rather than set to it.
   *
   * @param {String} value - a number with an optional + or - prefixing it
   */
  this.setWeaponAmmo = function setWeaponAmmo(value) {
    LOGGER.trace("setWeaponAmmo | Loadable | Called.");
    const maxAmmo = this.getRollData().magazine.max;
    if (this.type === "weapon") {
      if (value.charAt(0) === "+" || value.charAt(0) === "-") {
        this.getRollData().magazine.value = Math.clamped(
          0,
          this.getRollData().magazine.value + parseInt(value, 10),
          maxAmmo
        );
      } else {
        this.getRollData().magazine.value = Math.clamped(0, value, maxAmmo);
      }
    }
  };

  /**
   * Get a property of the ammo that is currently loaded in this weapon.
   *
   * @param {String} - the desired property to look up and return the value of
   * @returns {*} - value of the ammo property
   */
  this._getLoadedAmmoProp = function _getLoadedAmmoProp(prop) {
    LOGGER.trace("_getLoadedAmmoProp | Loadable | Called.");
    if (this.actor) {
      const ammo = this.actor.getOwnedItem(this.system.magazine.ammoData.uuid);
      if (ammo) {
        return getProperty(ammo.system, prop);
      }
    }
    return undefined;
  };

  /**
   * When a loadable item has an upgrade removed we need to sync the magazine data
   * in case the magazine size decreased, we need to remove the extra bullets.
   *
   * @param {Object} data - the data the item is being created from
   */
  this.syncMagazine = function syncMagazine() {
    const updateData = [];
    const { actor } = this;
    const magazineData = this.system.magazine;
    const upgradeData = this.getTotalUpgradeValues("magazine");
    const magazineSize =
      upgradeData.type === "override"
        ? upgradeData.value
        : magazineData.max + upgradeData.value;
    if (magazineSize < magazineData.value) {
      const overage = magazineData.value - magazineSize;
      updateData.push({ _id: this._id, "system.magazine.value": magazineSize });
      const ammoItem = actor.getOwnedItem(magazineData.ammoData.uuid);
      if (ammoItem) {
        const newAmmoAmount = ammoItem.system.amount + overage;
        updateData.push({ _id: ammoItem._id, "system.amount": newAmmoAmount });
      }
    }
    return updateData;
  };

  /**
   * When a loadable item has ammo installed in it, it needs to be associated with
   * an ammo item in the actor's inventory so that it can be unloaded/reloaded.
   * This function is called when a loaded weapon is created. Depending on where it
   * is created:
   * - Created in actor: Attempts to create associated ammunition objects on actor
   *                     to use for unload/reload.
   * - Created in world: Ammo is zeroed/reset on the weapon & warning is displayed.
   *
   * @returns {Promise}- the updated item document
   */
  this.createAmmoItems = async function createAmmoItems() {
    LOGGER.trace("createAmmoItems | Loadable | Called.");
    const actor = this.isOwned ? this.actor : false;
    const magazineData = this.system.magazine;
    const ammoData = { name: "", uuid: "" };
    if (this.system.magazine.ammoData.uuid !== "") {
      if (!actor) {
        const warningMessage = `${SystemUtils.Format(
          "CPR.messages.creatingLoadedWeaponWorldItemsNotSupported",
          {
            ammoName: this.system.magazine.ammoData.name,
          }
        )}`;
        SystemUtils.DisplayMessage("warn", warningMessage);
        magazineData.value = 0;
      } else {
        // First we need to identify the source ammo to model after in the
        // event we do need to create the ammo on the actor. This may or may not exist
        // on the actor who owns this weapon, so we search for it by UUID.
        let ammo = fromUuidSync(this.system.magazine.ammoData.uuid);
        if (!ammo) {
          // In this instance, we have a UUID that does not exist in the world. We will see if we have a name match
          // first on the actor and then secondly in the world.
          ammo = actor.items.find(
            (i) =>
              i.type === "ammo" && i.name === this.system.magazine.ammoData.name
          )
            ? actor.items.find(
                (i) =>
                  i.type === "ammo" &&
                  i.name === this.system.magazine.ammoData.name
              )
            : game.items.find(
                (i) =>
                  i.type === "ammo" &&
                  i.name === this.system.magazine.ammoData.name
              );
        }

        if (typeof ammo === "object") {
          // We have a source ammo to model from; if ammo is created from an
          // unloaded weapon, a new instance of the ammo is created if one
          // doesn't exist in an actor or if it does exist, updates the values
          // of the existing ammo with the unloaded amount.
          const newItemData = ammo.toObject();
          newItemData.system.amount = magazineData.value;
          const itemMatch = actor.items.find(
            (i) => i.type === ammo.type && i.name === ammo.name
          );
          if (itemMatch) {
            // if match found, update existing ammo stack amount
            ammoData.name = itemMatch.name;
            ammoData.uuid = itemMatch.uuid;
            await itemMatch.update({
              "system.amount": itemMatch.system.amount + magazineData.value,
            });
          } else {
            // if not found, build new ammo stack with unloaded amount
            const createdItems = await actor.createEmbeddedDocuments("Item", [
              newItemData,
            ]);
            ammoData.name = createdItems[0].name;
            ammoData.uuid = createdItems[0].uuid;
          }
        } else {
          // Unable to find ammo to model after and therefore can not create any new ammo. Throw error
          // and clear ammo from weapon.
          SystemUtils.DisplayMessage(
            "error",
            SystemUtils.Localize("CPR.messages.ammoMissingFromGear")
          );
        }
      }
    }
    magazineData.ammoData = ammoData;
    magazineData.value = 0;
    return !actor
      ? this.update({ "system.magazine": magazineData })
      : actor.updateEmbeddedDocuments("Item", [
          { _id: this._id, "system.magazine": magazineData },
        ]);
  };
};

export default Loadable;
