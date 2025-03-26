/* global Item game fromUuidSync */
import * as CPRRolls from "../rolls/cpr-rolls.js";
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

// Item mixins
import Attackable from "./mixins/cpr-attackable.js";
import Effects from "./mixins/cpr-effects.js";
import Electronic from "./mixins/cpr-electronic.js";
import Equippable from "./mixins/cpr-equippable.js";
import Loadable from "./mixins/cpr-loadable.js";
import Installable from "./mixins/cpr-installable.js";
import Physical from "./mixins/cpr-physical.js";
import Stackable from "./mixins/cpr-stackable.js";
import Upgradable from "./mixins/cpr-upgradable.js";
import Valuable from "./mixins/cpr-valuable.js";
import Container from "./mixins/cpr-container.js";

/**
 * We extend the base Item object (document) provided by Foundry. All items in the system derive from it.
 * By itself, it is mostly useless and too generic to be used practically in game.
 *
 * @extends {Item}
 */
export default class CPRItem extends Item {
  /**
   * TODO: figure out what to do with this, hopefully not needed
   * TODO: this should figure out owned vs. not owned items too
   * @override
   * @param {Item} data - details/changes for the Item itself
   * @param {Object} options options (from Foundry) to the Item update process
   */
  update(data, options = {}) {
    LOGGER.trace("update | CPRItem | Called.");
    const cprData = data;
    if (
      data["system.type"] === "cyberwareInternal" ||
      data["system.type"] === "cyberwareExternal" ||
      data["system.type"] === "fashionware"
    ) {
      cprData["system.isFoundational"] = false;
    }
    if (this.type === "weapon") {
      cprData["system.dvTable"] =
        data["system.dvTable"] === null ? "" : data["system.dvTable"];
    }

    // If an AE has a usage !== "toggled", then any active effects should not be disabled
    // (ie: Always On, Installed, etc) otherwise the disabled flag takes precedence when
    // determining if the effect is suppressed or not
    const usage = data["system.usage"];
    if (usage && usage !== this.system.usage) {
      if (usage !== "toggled" && usage !== "snorted") {
        this.effects.forEach((e) => {
          if (e.disabled) {
            this.toggleEffect(e._id);
          }
        });
      }
    }
    return super.update(cprData, options);
  }

  /**
   * We extend this (for now) to handle a migration edge case. Normally, when cloning an item
   * we remove any ammo or upgrades loaded into it. This is because cloning it as-is, the IDs
   * of the included items will be cloned too, which isn't what we want. Longer term, ammo and
   * upgrades should come along for the ride, but be separately created items.
   *
   * During the Active Effects data migration, we did want to keep the included items.
   * To enable that behavior, pass cprIsMigrating as true in the options object when calling Item.create().
   *
   * @param {Item} data - the primitive data for the Item being created
   * @param {Object} options - options (for Foundry) to the Item creation process
   * @param {String} userId - user ID that is creating the Item
   */
  _onCreate(data, options, userId) {
    LOGGER.trace("_onCreate | CPRItem | Called.");
    super._onCreate(data, options, userId);
  }

  /**
   * Load all mixins configured in the Item metadata.
   * TODO: enum this
   *
   * @public
   */
  loadMixins() {
    LOGGER.trace("loadMixins | CPRItem | Called.");
    const mixins = SystemUtils.getDataModelTemplates(this.type);
    const cprItemData = this.system;
    for (let m = 0; m < mixins.length; m += 1) {
      switch (mixins[m]) {
        case "attackable": {
          Attackable.call(CPRItem.prototype);
          break;
        }
        case "effects": {
          Effects.call(CPRItem.prototype);
          cprItemData.allowedUsage = this.getAllowedUsage();
          // To Do: we could toggle on/off if there's exactly 1 effect enforced...
          break;
        }
        case "electronic": {
          Electronic.call(CPRItem.prototype);
          break;
        }
        case "equippable": {
          Equippable.call(CPRItem.prototype);
          break;
        }
        case "loadable": {
          Loadable.call(CPRItem.prototype);
          break;
        }
        case "installable": {
          Installable.call(CPRItem.prototype);
          break;
        }
        case "container": {
          Container.call(CPRItem.prototype);
          break;
        }
        case "physical": {
          Physical.call(CPRItem.prototype);
          break;
        }
        case "stackable": {
          Stackable.call(CPRItem.prototype);
          break;
        }
        case "upgradable": {
          Upgradable.call(CPRItem.prototype);
          break;
        }
        case "valuable": {
          Valuable.call(CPRItem.prototype);
          break;
        }
        default:
          LOGGER.warn(`Tried to load an unknown mixin, ${mixins[m]}`);
      }
      // LOGGER.debug(`Added mixin ${mixins[m]} to ${this.id}`);
    }
  }

  /**
   * Whenever an item is created or updated this method is called by Foundry. We use it
   * to add in the "mixins" enabled for this item type.
   *
   * This seems excessive (once on item creation seems enough) but this is what DND5E does.
   *
   * @override
   */
  prepareDerivedData() {
    LOGGER.trace("prepareDerivedData | CPRItem | Called.");
    super.prepareDerivedData();
    this.loadMixins();
  }

  /**
   * Generic item.doAction() method so any item can be called to
   * perform an action.  This can be easily extended in the
   * switch statement and adding additional methods for each item.
   * Prepatory work for
   * Click to Consume (Apply mods / effect / state change)
   * Opening Agent Dialog
   * Any calls to functions not related to rolls, triggered from actions.
   *
   * @param {Actor} actor - the actor (parent) associated with the item doing something
   * @param {*} actionAttributes - arbitrary data to control the action
   */
  doAction(actor, actionAttributes) {
    LOGGER.trace("doAction | CPRItem | Called.");
    const itemType = this.type;
    switch (itemType) {
      case "cyberware": {
        return this._cyberwareAction(actor, actionAttributes);
      }
      case "itemUpgrade": {
        return this._itemUpgradeAction(actor, actionAttributes);
      }
      case "weapon": {
        return this._weaponAction(actor, actionAttributes);
      }
      case "ammo": {
        return this._ammoAction(actionAttributes);
      }
      default:
    }
    return Promise.resolve();
  }

  /**
   * Dispatcher for update-specific actions.
   *
   * @param {CPRActor} actor - who is performing the upgrade action?
   * @param {Object} actionAttributes - details from the event data about the action
   * @returns null for invalid actions
   */
  _itemUpgradeAction(actor, actionAttributes) {
    LOGGER.trace("_itemUpgradeAction | CPRItem | Called.");
    switch (this.system.type) {
      case "weapon": {
        if (this.system.modifiers.secondaryWeapon.configured) {
          return this._weaponAction(actor, actionAttributes);
        }
        break;
      }
      default:
    }
    return null;
  }

  /**
   * Pop up a confirmation dialog box when performing a roll. Depending on the type,
   * the fields may be changed in the form. Properties in the CPRRoll object may
   * be modified by the form answers, and that is what is returned.
   *
   * @param {CPRRoll} cprRoll
   * @returns {CPRRoll}
   */
  confirmRoll(cprRoll) {
    LOGGER.trace("confirmRoll | CPRItem | Called.");
    const itemType = this.type;
    const cprItemData = this.system;
    const localCprRoll = cprRoll;
    const itemEntities = game.system.template.Item;

    if (itemEntities[itemType].templates.includes("loadable")) {
      if (localCprRoll instanceof CPRRolls.CPRAttackRoll) {
        if (cprItemData.isRanged) {
          this.dischargeItem(localCprRoll);
          const ammoType = this._getLoadedAmmoProp("type");
          if (ammoType !== "undefined") {
            localCprRoll.rollCardExtraArgs.ammoType = ammoType;
          }
        }
      }
      if (localCprRoll instanceof CPRRolls.CPRDamageRoll) {
        if (localCprRoll.isAutofire) {
          localCprRoll.setAutofire();
        }
      }
    }
    return localCprRoll;
  }

  /**
   * Set whether the item is a favorite for the player, highlighting it in the UI/sheet
   */
  toggleFavorite() {
    LOGGER.trace("toggleFavorite | CPRItem | Called.");
    this.update({ "system.favorite": !this.system.favorite });
  }

  /**
   * Dispatcher method for creating item-based rolls.
   *
   * @param {String} type - type of roll to be created
   * @param {CPRActor} actor - actor doing the roll
   * @param {Object} extraData - extra data about the roll to consider
   * @returns {CPRRoll} or null for invalid roll types
   */
  createRoll(type, actor, extraData = []) {
    LOGGER.trace("createRoll | CPRItem | Called.");
    switch (type) {
      case CPRRolls.rollTypes.SKILL: {
        return this._createSkillRoll(actor);
      }
      case CPRRolls.rollTypes.INTERFACEABILITY:
        return this._createInterfaceRoll(actor, extraData);
      case CPRRolls.rollTypes.ROLEABILITY: {
        return this._createRoleRoll(type, actor, extraData);
      }
      case CPRRolls.rollTypes.SUPPRESSIVE:
      case CPRRolls.rollTypes.AUTOFIRE:
      case CPRRolls.rollTypes.AIMED:
      case CPRRolls.rollTypes.ATTACK: {
        return this._createAttackRoll(type, actor);
      }
      case CPRRolls.rollTypes.DAMAGE: {
        const damageType = extraData.damageType ? extraData.damageType : type;
        return this._createDamageRoll(damageType, actor);
      }
      case CPRRolls.rollTypes.CYBERDECKPROGRAM: {
        return this._createCyberdeckRoll(actor, extraData);
      }
      default:
    }
    return null;
  }
}
