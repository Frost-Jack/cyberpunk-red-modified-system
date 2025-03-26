/* global duplicate CONST fromUuid */
import CPR from "../../system/config.js";
import LOGGER from "../../utils/cpr-logger.js";

/**
 * If an item can ACCEPT upgrades (i.e. it has slots), then it should include this
 * mixin. This does not accommodate items that are upgrades.
 */
const Upgradable = function Upgradable() {
  /**
   * Sync the upgrade list with the installed Items list. When
   * this function is called, the expectation is that the
   * installedItems properly accurately reflects what is installed
   * which may or may not be an upgrade.
   *
   * @param {Array} upgrades - the list of upgrades to install
   * @returns the updated item document after the installation
   */
  this.syncUpgrades = async function syncUpgrades() {
    LOGGER.trace("syncUpgrades | Upgradable | Called.");

    const actor = this.isOwned ? this.actor : false;

    const installedItems = duplicate(this.system.installedItems);
    let installedUpgrades = duplicate(this.system.upgrades);

    // First, remove any upgrades that were uninstalled
    for (const upgrade of this.system.upgrades) {
      if (!installedItems.list.includes(upgrade.uuid)) {
        installedUpgrades = installedUpgrades.filter(
          (u) => u.uuid !== upgrade.uuid
        );
      }
    }

    let upgradeStatus = installedUpgrades.length > 0;
    // Next identify any upgrades that are installed but not recorded
    // as an upgraded data point
    const newUpgrades = [];
    for (const uuid of installedItems.list) {
      // eslint-disable-next-line no-await-in-loop
      const installedItem = await fromUuid(uuid);
      if (
        installedItem.type === "itemUpgrade" &&
        installedUpgrades.filter((upgrade) => upgrade.uuid === uuid).length ===
          0
      ) {
        newUpgrades.push(installedItem);
      }
    }

    for (const upgrade of newUpgrades) {
      upgradeStatus = true;
      const upgradeModifiers = upgrade.system.modifiers;
      const modList = {};
      Object.keys(upgradeModifiers).forEach((index) => {
        const modifier = upgradeModifiers[index];
        /*
              Before we add this modifier to the list of upgrades for this item, we need to do several checks:
              1. Ensure the modifier is defined as the key could have been added but the value never set
              2. Ensure the modifier is valid for this item type. As this information is stored in an
                object, it's possible keys may exist that are not valid if one changes the itemUpgrade type.
              3. The next couple checks ensure we are only adding actual modifications, null, 0 or empty strings don't modify
                anything, so we ignore those.
            */
        if (
          typeof modifier !== "undefined" &&
          typeof CPR.upgradableDataPoints[this.type][index] !== "undefined" &&
          modifier !== 0 &&
          modifier !== null &&
          modifier !== ""
        ) {
          if (
            typeof modifier.value === "undefined" ||
            modifier.value !== null
          ) {
            modList[index] = modifier;
          }
        }
      });
      if (Object.keys(modList).length > 0) {
        const upgradeData = {
          _id: upgrade._id,
          uuid: upgrade.uuid,
          name: upgrade.name,
          type: upgrade.system.type,
          size: upgrade.system.size,
          system: {
            modifiers: modList,
          },
        };
        installedUpgrades.push(upgradeData);
      }
    }
    let upgradeData = [
      {
        _id: this._id,
        "system.isUpgraded": upgradeStatus,
        "system.upgrades": installedUpgrades,
      },
    ];
    this.system.isUpgraded = upgradeStatus;
    this.system.upgrades = installedUpgrades;

    if (
      this.type === "weapon" &&
      this.system.isRanged &&
      this.system.magazine.ammoData.uuid !== ""
    ) {
      const additionalUpdates = await this.syncMagazine();
      if (additionalUpdates.length > 0) {
        upgradeData = upgradeData.concat(additionalUpdates);
      }
    }
    return !actor
      ? this.update({ system: this.system })
      : actor.updateEmbeddedDocuments("Item", upgradeData);
  };

  /**
   * Given a data point that this upgrade improves, find out the type of upgrade and total up all
   * of the modifications being applied to it, and consider overrides. In some ways
   * this is a reimplementation of what Active Effects provides, returnign the "mode" and value.
   * We could not use AEs here because AE cannot modify other items, only actors. Do not confuse
   * this with the upgradeType property either, which controls what item types this upgrade is applicable for.
   *
   * @param {String} dataPoint - a stat/property/value that this upgrade modifies on the parent item
   * @returns {Object} upgradeData - an object with a key for "type" and "value" of the upgrade
   *
   */
  this.getTotalUpgradeValues = function getTotalUpgradeValues(dataPoint) {
    LOGGER.trace("getTotalUpgradeValues | Upgradable | Called.");
    let upgradeNumber = 0;
    let baseOverride = -100000;
    const upgradeData = {
      type: "modifier",
      value: 0,
    };
    if (
      this.actor &&
      typeof this.system.isUpgraded === "boolean" &&
      this.system.isUpgraded
    ) {
      const installedUpgrades = this.system.upgrades;
      installedUpgrades.forEach((upgrade) => {
        if (typeof upgrade.system.modifiers[dataPoint] !== "undefined") {
          const modType = upgrade.system.modifiers[dataPoint].type;
          const modValue = upgrade.system.modifiers[dataPoint].value;
          if (typeof modValue === "number" && modValue !== 0) {
            if (modType === "override") {
              baseOverride = modValue > baseOverride ? modValue : baseOverride;
            } else {
              upgradeNumber += modValue;
            }
          }
        }
      });
      if (baseOverride === 0 || baseOverride === -100000) {
        upgradeData.type = "modifier";
        upgradeData.value = upgradeNumber;
      } else {
        upgradeData.type = "override";
        upgradeData.value = baseOverride;
      }
    }
    return upgradeData;
  };

  /**
   * Given a data point, return an array of all modifications being applied to it. If one of the modifier types is
   * set to "override", use that value and ignore others (favoring the largest override).
   *
   * Note: We structure each object in the array similar to a CPRMod so that we can add these mods to rolls.
   *
   * @param {} dataPoint - a stat/property/value that this upgrade modifies on the parent item
   * @returns
   */
  this.getAllUpgradeMods = function getAllUpgradeMods(dataPoint) {
    LOGGER.trace("getAllUpgradeMods | Upgradable | Called.");
    const relevantUpgrades = [];
    if (
      this.actor &&
      typeof this.system.isUpgraded === "boolean" &&
      this.system.isUpgraded
    ) {
      // Get all installed upgrades.
      const installedUpgrades = this.system.upgrades;

      // Get all installed upgrades of type override.
      const overrides = installedUpgrades.filter(
        (u) => u.system.modifiers[dataPoint]?.type === "override"
      );

      // Key and category are used to display what the bonus upgrades.
      // Currently the only applicable category is combat, but conceivably there could be others.
      let key;
      let category;
      switch (dataPoint) {
        case "attackmod":
          key = "bonuses.universalAttack";
          category = "combat";
          break;
        case "damage":
          key = "bonuses.universalDamage";
          category = "combat";
          break;
        default:
          break;
      }

      // If there is an override, create an CPRMod-like object out of the highest one.
      // Because upgrades can provide situational bonuses, we must add all of the following
      // information (id, source, key, category, changemode) for everything to look/function correctly in a roll dialog.
      if (overrides.length > 0) {
        overrides.sort(
          (a, b) =>
            b.system.modifiers[dataPoint].value -
            a.system.modifiers[dataPoint].value
        );
        const mod = overrides[0].system.modifiers[dataPoint];
        mod.id = `${overrides[0].name}-${key}-0`; // This should create a unique ID for the mod.
        mod.source = overrides[0].name; // Where the upgrade comes from.
        mod.key = key; // Datapoint being upgraded.
        mod.category = category; // Category of above key.
        mod.changeMode = CONST.ACTIVE_EFFECT_MODES.ADD; // const = 2. This comes from foundry.
        relevantUpgrades.push(mod);
      } else {
        installedUpgrades.forEach((u, index) => {
          if (u.system.modifiers[dataPoint]?.value > 0) {
            const mod = duplicate(u.system.modifiers[dataPoint]);
            mod.id = `${u.name}-${key}-${index}`; // This should create a unique ID for the mod.
            mod.source = u.name; // Where the upgrade comes from.
            mod.key = key; // Datapoint being upgraded.
            mod.category = category; // Category of above key.
            mod.changeMode = CONST.ACTIVE_EFFECT_MODES.ADD; // const = 2. This comes from foundry.
            relevantUpgrades.push(mod);
          }
        });
      }
    }
    return relevantUpgrades;
  };

  /**
   * Whenever a new upgradeable item is created, we automatically clear the upgrades associated with it.
   * Otherwise, a copied Item will contain references to upgrades used in the original item.
   *
   * @param {Object} data - the data the item is being created from
   */
  this.clearUpgrades = function clearUpgrades(data) {
    LOGGER.trace("clearUpgrades | Upgradable | Called.");
    const newData = data;
    newData.system.isUpgraded = false;
    newData.system.upgrades = [];
    return newData;
  };
};

export default Upgradable;
