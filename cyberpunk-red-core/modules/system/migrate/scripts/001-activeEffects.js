/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* global duplicate Item game */

import CPR from "../../config.js";
import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class ActiveEffectsMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | 1-activeEffects Migration");
    super();
    this.version = 1;
    this.name = "Active Effects Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   * For this version, we create an item folder to copy items owned by characters. We do
   * this because active effects cannot be added or changed on owned items. So, we copy
   * an owned item here first, migrate it, and then copy it back to the character.
   */
  async preMigrate() {
    LOGGER.trace("preMigrate | 1-activeEffects Migration");
    LOGGER.log(`Starting migration: ${this.name}`);
    CPRSystemUtils.DisplayMessage(
      "notify",
      CPRSystemUtils.Localize("CPR.migration.effects.beginMigration")
    );
    this.migrationFolder = await CPRSystemUtils.GetFolder(
      "Item",
      "Active Effect Migration Workspace"
    );
  }

  /**
   * Copy an (owned) Item into the migration work folder. This will enable active effects to be created
   * or changed on them. If it already exists, just return that.
   *
   * Note: this method is not idempotent intentionally. Tracking what should or should not backed up
   *       is a hard problem because the IDs will always change with each call.
   *
   * @param {CPRItem} item - the item we are copying
   * @returns the copied item data
   */
  async backupOwnedItem(item) {
    LOGGER.trace("backupOwnedItem | 1-activeEffects Migration");
    return Item.create(
      {
        name: item.name,
        type: item.type,
        data: item.system,
        img: item.img,
        folder: this.migrationFolder,
      },
      {
        cprIsMigrating: true,
      }
    );
  }

  /**
   * Takes place after the data migration completes. All we do here is delete the migration
   * folder for owned items, if it is empty. If not, that means 1 or more items did not
   * migrate properly and we leave it behind for a GM to review what to do.
   */
  async postMigrate() {
    LOGGER.trace("postMigrate | 1-activeEffects Migration");
    CPRSystemUtils.DisplayMessage(
      "notify",
      CPRSystemUtils.Localize("CPR.migration.effects.cleanUp")
    );
    if (this.migrationFolder.contents.length === 0) {
      LOGGER.debug("would delete migration folder");
      this.migrationFolder.delete();
    }
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * The actors were updated in 2 ways. No changes to demons, black-ice or containers.
   *    Universal Attack Bonus and Damage --> corresponding AE
   *    Deleted skill and role properties.
   *
   * @async
   * @static
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace("migrateActor | 1-activeEffects Migration");

    if (!(actor.type === "character" || actor.type === "mook")) return;
    let updateData = {};
    if (
      actor.system.universalBonuses?.attack &&
      actor.system.universalBonuses.attack !== 0
    ) {
      const name = CPRSystemUtils.Localize("CPR.migration.effects.attackName");
      const changes = [
        {
          key: "bonuses.universalAttack",
          mode: 2,
          value: actor.system.universalBonuses.attack,
          priority: 0,
        },
      ];
      await ActiveEffectsMigration.addActiveEffect(actor, name, changes);
    }
    if (
      actor.system.universalBonuses?.damage &&
      actor.system.universalBonuses.damage !== 0
    ) {
      const name = CPRSystemUtils.Localize("CPR.migration.effects.damageName");
      const changes = [
        {
          key: "bonuses.universalDamage",
          mode: 2,
          value: actor.system.universalBonuses.damage,
          priority: 0,
        },
      ];
      await ActiveEffectsMigration.addActiveEffect(actor, name, changes);
    }
    // Skill mods are applied directly to the actor because core skill "items" cannot be accessed in
    // the UI. Nor do they have the AE data template.
    for (const skill of actor.items.filter((i) => i.type === "skill")) {
      if (skill.system.skillmod && skill.system.skillmod !== 0) {
        const name = ` ${CPRSystemUtils.Localize(
          "CPR.migration.effects.skill"
        )} ${skill.name}`;
        const changes = [
          {
            key: `bonuses.${CPRSystemUtils.slugify(skill.name)}`,
            mode: 2,
            value: skill.system.skillmod,
            priority: 0,
          },
        ];
        // Note this is the one place with force the change category to "skill". This is required
        // for custom skills to work; they will never be in the CPR.activeEffectsKeys object.
        await ActiveEffectsMigration.addActiveEffect(actor, name, changes, [
          "skill",
        ]);
      }
    }
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(actor, "system.skills"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(actor, "system.roleInfo.roles"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(actor, "system.roleInfo.roleskills"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(actor, "system.universalBonuses"),
    };

    // Update derivedStats with walk/run values
    updateData["system.derivedStats.walk"] = {
      value: actor.system.stats.move.value * 2,
    };
    updateData["system.derivedStats.run"] = {
      value: actor.system.stats.move.value * 4,
    };

    await actor.update(updateData);

    // Finally, migrate their owned items by copying from the item directory to their inventory
    // on success, we delete the item from the directory, they should all be empty at the end.
    // Egregious violation of no-await-in-loop here, but not sure how else to approach.
    // We deliberately skip skills because for core skills their AEs cannot be edited or viewed
    // They are applied to the actor instead for this migration (see earlier code)
    const ownedItems = actor.items.filter((i) => {
      if (i.type === "skill") return false;
      if (i.type === "cyberware" && i.system.core) return false;
      return true;
    });
    const createAeItemTypes = ["program", "weapon", "clothing", "gear"];
    const deleteItems = [];
    const remappedItems = {};
    for (const ownedItem of ownedItems) {
      // We cannot add AEs to owned items, that's a Foundry limitation. If an owned item might get an AE
      // as a result of this migration, we must make an unowned copy first, and then copy that back to
      // the actor. Not all item types require this, and skills are filtered out earlier.
      let newItem = ownedItem;
      if (createAeItemTypes.includes(ownedItem.type)) {
        newItem = await this.backupOwnedItem(ownedItem);
        if (ownedItem.type === "program") {
          newItem.system.size = ownedItem.system.slots;
        }
      }
      try {
        await ActiveEffectsMigration.migrateItem(newItem);
      } catch (err) {
        throw new Error(
          `${ownedItem.name} (${ownedItem._id}) had a migration error: ${err.message}`
        );
      }
      if (createAeItemTypes.includes(ownedItem.type)) {
        const newData = duplicate(newItem.data);
        const createdItem = await actor.createEmbeddedDocuments(
          "Item",
          [newData],
          { cprIsMigrating: true }
        );
        remappedItems[ownedItem._id] = createdItem[0]._id;
        await newItem.delete();
        deleteItems.push(ownedItem._id);
      }
    }
    // delete all of the owned items we have replaced with items that have AEs
    const deleteList = [];
    for (const delItem of deleteItems) {
      if (actor.items.filter((i) => i._id === delItem).length > 0) {
        deleteList.push(delItem);
      }
    }
    // delete all clothing & gear item upgrades that were added as these have been replaced by Active Effects
    const itemUpgrades = actor.items.filter((i) => {
      if (i.type === "itemUpgrade") {
        if (i.system.type === "clothing") {
          return true;
        }
        if (i.system.type === "gear") {
          return true;
        }
      }
      return false;
    });

    for (const itemUpgrade of itemUpgrades) {
      deleteList.push(itemUpgrade._id);
    }

    if (deleteList.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", deleteList, {
        cprIsMigrating: true,
      });
    }

    // Update any item references for items re-created as part of this process
    if (Object.entries(remappedItems).length > 0) {
      const updateList = [];
      for (const deck of actor.items.filter((i) => i.type === "cyberdeck")) {
        const oldPrograms = deck.system.programs;
        const newPrograms = {};
        newPrograms.installed = [];
        newPrograms.rezzed = [];
        for (const oldProgram of oldPrograms.rezzed) {
          if (typeof remappedItems[oldProgram._id] !== "undefined") {
            const newProgramId = remappedItems[oldProgram._id];
            const newProgram = actor.items.filter(
              (np) => np.id === newProgramId
            )[0];
            // eslint-disable-next-line no-undef
            const rezzedInstance = randomID();
            newProgram.setRezzed(rezzedInstance);
            const programInstallation = duplicate(newProgram.system);
            programInstallation.isRezzed = true;
            programInstallation._id = newProgram._id;
            programInstallation.name = newProgram.name;
            programInstallation.flags = newProgram.flags;
            newPrograms.rezzed.push(programInstallation);
          }
        }
        for (const oldProgram of oldPrograms.installed) {
          if (typeof remappedItems[oldProgram._id] !== "undefined") {
            const newProgramId = remappedItems[oldProgram._id];
            const newProgram = actor.items.filter(
              (np) => np.id === newProgramId
            )[0];
            const newProgramData = duplicate(newProgram.system);
            const rezzedIndex = newPrograms.rezzed.findIndex(
              (p) => p._id === newProgramId
            );
            if (rezzedIndex !== -1) {
              newProgramData.isRezzed = true;
            }
            newProgramData._id = newProgram._id;
            newProgramData.name = newProgram.name;
            newProgramData.flags = newProgram.flags;
            newPrograms.installed.push(newProgramData);
          }
        }

        updateList.push({ _id: deck._id, "system.programs": newPrograms });
        newPrograms.rezzed.forEach((program) => {
          updateList.push({ _id: program._id, "system.isRezzed": true });
        });
      }
      await actor.updateEmbeddedDocuments("Item", updateList);
    }
  }

  /**
   * Mutator that adds an active effect to the given Document. Works for CPRActors and unowned CPRItems.
   *
   * @param {Document} document
   * @param {String} effectName - (hopefully localized) name for the active effect
   * @param {Object} changes - array of changes the active effect provides; each element is an object with 4 properties:
   *   key: {String}                    // whatever stat/ability is being modified e.g. "bonuses.universalDamage"
   *   mode: {Number}                   // the AE mode that is appropriate (see cpr-effects.js, you probably want 2)
   *   value: {Number}                  // how much to change the skill by
   *   priority: {Number}               // the order in which the change is applied, start at 0
   * @param {Array:String} cats         // an array of change categories (skill, combat, netrun, etc) to match with changes
   * @returns {CPRActiveEffect}
   */
  static async addActiveEffect(document, effectName, changes, cats = null) {
    LOGGER.trace("addActiveEffect | 1-activeEffects Migration");
    if (document.isOwned) return;
    const [effect] = await document.createEffect();
    const newData = {
      _id: effect.id,
      label: effectName,
      changes,
    };
    let index = 0;
    if (cats === null) {
      changes.forEach((change) => {
        // do a reverse look up on the activeEffectKeys object in config.js; given an AE key, find the category
        // the key category is saved as a flag on the AE document for the UI to pull later
        for (const [category, entries] of Object.entries(
          CPR.activeEffectKeys
        )) {
          if (typeof entries[change.key] !== "undefined") {
            newData[`flags.${game.system.id}.changes.cats.${index}`] = category;
            break;
          }
        }
        index += 1;
      });
    } else {
      changes.forEach(() => {
        newData[`flags.${game.system.id}.changes.cats.${index}`] = cats[index];
        index += 1;
      });
    }
    await document.updateEmbeddedDocuments("ActiveEffect", [newData]);
  }

  /**
   * Items changed in so many ways it seemed best to break out a separate migration
   * path for each item type.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.trace("migrateItem | 1-activeEffects Migration");
    switch (item.type) {
      case "ammo":
        await ActiveEffectsMigration.updateAmmo(item);
        break;
      case "armor":
        await ActiveEffectsMigration.updateArmor(item);
        break;
      case "clothing":
        await ActiveEffectsMigration.updateClothing(item);
        break;
      case "criticalInjury":
        await ActiveEffectsMigration.updateCriticalInjury(item);
        break;
      case "cyberdeck":
        await ActiveEffectsMigration.updateCyberdeck(item);
        break;
      case "cyberware":
        // never call this for "core" cyberware on actors!
        await ActiveEffectsMigration.updateCyberware(item);
        break;
      case "gear":
        await ActiveEffectsMigration.updateGear(item);
        break;
      case "itemUpgrade":
        await ActiveEffectsMigration.updateItemUpgrade(item);
        break;
      case "netarch":
        await ActiveEffectsMigration.updateNetArch(item);
        break;
      case "program":
        await ActiveEffectsMigration.updateProgram(item);
        break;
      case "skill":
        // never call this for owned items!
        await ActiveEffectsMigration.updateSkill(item);
        break;
      case "role":
        await ActiveEffectsMigration.updateRole(item);
        break;
      case "vehicle":
        await ActiveEffectsMigration.updateVehicle(item);
        break;
      case "weapon":
        await ActiveEffectsMigration.updateWeapon(item);
        break;
      default:
        // note: drug was introduced with this release, so it will not fall through here
        LOGGER.warn(
          `An unrecognized item type was ignored: ${item.type}. It was not migrated!`
        );
    }
  }

  /**
   * Set a default price and category under certain conditions. This is meant to fill in empty
   * values that should not have been empty in the first place.
   *
   * @param {Number} price
   * @return {Object} - an object with keys to update in item.update()
   */
  static setPriceData(item, price) {
    LOGGER.trace("setPriceData | 1-activeEffects Migration");
    const updateData = {};
    // here we assume both values were never touched, and useless defaults still exist
    if (
      item.system.price.market === 0 &&
      typeof item.system.price.category !== "undefined" &&
      item.system.price.category === ""
    ) {
      updateData["system.price.market"] = price;
    }
    return updateData;
  }

  /**
   * Some items lost the 'amount' property, which indicates how many are carried. We don't
   * want to lose that information, so we duplicate the items in an actor's inventory.
   * We cap this at 50 in case there is a bad or nonsensical value, like 10,000 pairs of pants.
   *
   * @param {CPRItem} item - the original object we inspect a bit
   * @param {Number} amount - the original value in the amount property (item no longer has it here)
   * @param {Object} dupeData - the item data to duplicate
   */
  static async dupeOwnedItems(item, amount, dupeData) {
    LOGGER.trace("dupeOwnedItems | 1-activeEffects Migration");
    if (item.isOwned && amount > 1) {
      // we assume the character is not actually wearing/wielding all of their (duplicate) items
      if (dupeData.system.equipped === "equipped")
        dupeData.system.equipped = "carried";
      const dupeItems = [];
      let dupeAmount = amount - 1;
      if (dupeAmount > 50) {
        dupeAmount = 50;
        CPRSystemUtils.DisplayMessage(
          "warn",
          "Amount is over 50! Capping it to 50."
        );
      }
      for (let i = 0; i < dupeAmount; i += 1) {
        dupeItems.push(duplicate(dupeData));
      }
      await item.actor.createEmbeddedDocuments("Item", dupeItems, {
        cprIsMigrating: true,
      });
    }
  }

  /**
   * Here's what changed with Ammo:
   *    Lost quality
   *    Lost upgradeable properties
   *    Gained concealable
   *    if price is 0 and category is empty, set to 100/premium
   *    if variety is empty set to heavyPistol
   *    if type is empty set to basic
   *
   * @param {CPRItem} ammo
   */
  static async updateAmmo(ammo) {
    LOGGER.trace("updateAmmo | 1-activeEffects Migration");
    let updateData = {};
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(ammo, "system.quality"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(ammo, "system.isUpgraded"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(ammo, "system.upgrades"),
    };
    updateData["system.concealable"] = {
      concealable: true,
      isConcealed: false,
    };
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(ammo, 100),
    };
    if (ammo.system.variety === "")
      updateData["system.variety"] = "heavyPistol";
    if (ammo.system.type === "") updateData["system.type"] = "basic";
    await ammo.update(updateData);
  }

  /**
   * Armor changed like so:
   *    Lost quality
   *    Gained usage
   *    if price is 0 and category is empty, set to 100/premium
   *    Gained slots for upgrades
   *    Lost amount - create duplicate items in inventory
   *
   * @param {CPRItem} armor
   */
  static async updateArmor(armor) {
    LOGGER.trace("updateArmor | 1-activeEffects Migration");
    const { amount } = armor.system;
    let updateData = {};
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(armor, "system.quality"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(armor, "system.amount"),
    };
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(armor, 100),
    };
    updateData["system.slots"] = 3;
    updateData["system.usage"] = "equipped";
    await armor.update(updateData);
    const newItemData = duplicate(armor.data);
    await ActiveEffectsMigration.dupeOwnedItems(armor, amount, newItemData);
  }

  /**
   * Clothing...
   *    Gained slots for upgrades
   *    Gained usage
   *    if price is 0 and category is empty, set to 50/premium
   *    if type is empty set to jacket
   *    if style is empty set to genericChic
   *    if was upgraded, upgrade converted to active effect
   *
   * @param {CPRItem} clothing
   */
  static async updateClothing(clothing) {
    LOGGER.trace("updateClothing | 1-activeEffects Migration");
    let updateData = {};
    updateData["system.slots"] = 3;
    updateData["system.usage"] = "equipped";
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(clothing, 50),
    };
    if (clothing.system.type === "") updateData["system.type"] = "jacket";
    if (clothing.system.variety === "")
      updateData["system.variety"] = "genericChic";
    // Clothing can only have itemUpgrades which affect either Cool or Wardrobe & BLAH
    // This should be replaced with an Active Effect
    if (clothing.system.isUpgraded) {
      const changes = [];
      let index = 0;
      const name = CPRSystemUtils.Localize("CPR.migration.effects.clothing");
      clothing.system.upgrades.forEach((upgradeItem) => {
        const upgradeModifiers =
          typeof upgradeItem.data !== "undefined"
            ? upgradeItem.data.modifiers
            : upgradeItem.system.modifiers;
        for (const [dataPoint, settings] of Object.entries(upgradeModifiers)) {
          const { value } = settings;
          if (typeof value === "number") {
            const key =
              dataPoint === "cool"
                ? "system.stats.cool.value"
                : "bonuses.wardrobeAndStyle";
            const mode = settings.type === "modifier" ? 2 : 1;
            changes.push({
              key,
              value,
              mode,
              priority: index,
            });
            index += 1;
          }
        }
      });
      if (changes.length > 0) {
        await ActiveEffectsMigration.addActiveEffect(clothing, name, changes);
      }
      updateData["system.isUpgraded"] = false;
      updateData["system.upgrades"] = [];
    }
    await clothing.update(updateData);
  }

  /**
   * Critical Injuries
   *    Gained usage
   *
   * @param {CPRItem} injury
   */
  static async updateCriticalInjury(injury) {
    LOGGER.trace("updateCriticalInjury | 1-activeEffects Migration");
    injury.update({ "system.usage": "toggled" });
  }

  /**
   * Cyberware
   *    Migrate Upgrades
   *    Gained usage
   *    Lost charges
   *    Lost slotSize, renamed to "size"
   *    Gained slots for upgrades
   *    if price is 0 and category is empty, set to 500/premium
   *    if `isWeapon` is a string convert to boolean
   *
   * @param {CPRItem} cyberware
   */
  static async updateCyberware(cyberware) {
    LOGGER.trace("updateCyberware | 1-activeEffects Migration");
    let updateData = {};
    updateData["system.usage"] = "installed";
    updateData["system.slots"] = 3;
    updateData["system.size"] = cyberware.system.slotSize;
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(cyberware, "system.charges"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(cyberware, "system.slotSize"),
    };
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(cyberware, 500),
    };

    // Migrate cyberware to use booleans for `isWeapon`
    // some already are bools so check if we actually need to migrate first
    if (typeof cyberware.system.isWeapon === "string") {
      if (cyberware.system.isWeapon === "true") {
        updateData["system.isWeapon"] = true;
      } else {
        updateData["system.isWeapon"] = false;
      }
    }

    await cyberware.update(updateData);
  }

  /**
   * Cyberdeck. Note we skill "core" cyberware since there is no way it could be edited to
   * have mods that would require AEs to be created. Also we don't support "adding" core cyberware
   * to actors, so even if we did migrate the item and give it AEs, we couldn't add it back to the
   * actor. Here's what changed for everything else though.
   *    Lost quality
   *    Gained usage
   *    if price is 0 and category is empty, set to 500/premium
   *
   * @param {CPRItem} deck
   */
  static async updateCyberdeck(deck) {
    LOGGER.trace("updateCyberdeck | 1-activeEffects Migration");
    let updateData = {};
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(deck, "system.quality"),
    };
    updateData["system.usage"] = "toggled";
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(deck, 500),
    };
    await deck.update(updateData);
  }

  /**
   * Gear
   *    Lost quality
   *    Gained usage
   *    Gained slots for upgrades
   *    if price is 0 and category is empty, set to 100/premium
   *    if was upgraded, upgrade converted to active effect
   *
   * @param {CPRItem} gear
   */
  static async updateGear(gear) {
    LOGGER.trace("updateGear | 1-activeEffects Migration");
    let updateData = {};
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(gear, "system.quality"),
    };
    updateData["system.usage"] = "equipped";
    updateData["system.slots"] = 3;
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(gear, 100),
    };
    if (gear.system.isUpgraded) {
      const changes = [];
      let index = 0;
      const name = CPRSystemUtils.Localize("CPR.migration.effects.gear");
      gear.system.upgrades.forEach((upgradeItem) => {
        for (const [dataPoint, settings] of Object.entries(
          upgradeItem.system.modifiers
        )) {
          const { value } = settings;
          if (typeof value === "number") {
            let key;
            if (dataPoint === "luck" || dataPoint === "emp") {
              key = `system.stats.${dataPoint}.max`;
            } else {
              key = `system.stats.${dataPoint}.value`;
            }
            const mode = settings.type === "modifier" ? 2 : 1;
            changes.push({
              key,
              value,
              mode,
              priority: index,
            });
            index += 1;
          }
        }
      });
      if (changes.length > 0) {
        await ActiveEffectsMigration.addActiveEffect(gear, name, changes);
      }
      updateData["system.isUpgraded"] = false;
      updateData["system.upgrades"] = [];
    }
    await gear.update(updateData);
  }

  /**
   * itemUpgrades
   *    Lost quality
   *    Lost charges
   *    modifiers.secondaryWeapon.configured = false if not already defined
   *    if price is 0 and category is empty, set to 500/premium
   *    Lost amount - create duplicate items
   *
   * @param {CPRItem} upgrade
   */
  static async updateItemUpgrade(upgrade) {
    LOGGER.trace("updateItemUpgrade | 1-activeEffects Migration");
    let updateData = {};
    const { amount } = upgrade.system;
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(upgrade, "system.quality"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(upgrade, "system.charges"),
    };
    if (Object.keys(upgrade.system.modifiers).length === 0) {
      updateData["system.modifiers"] = {
        secondaryWeapon: { configured: false },
      };
    }
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(upgrade, 500),
    };
    await upgrade.update(updateData);
    const newItemData = duplicate(upgrade.data);
    await ActiveEffectsMigration.dupeOwnedItems(upgrade, amount, newItemData);
  }

  /**
   * NetArch
   *    Lost quality
   *    if price is 0 and category is empty, set to 5000/premium
   *    Lost amount - create duplicate items
   *
   * @param {CPRItem} netarch
   */
  static async updateNetArch(netarch) {
    LOGGER.trace("updateNetArch | 1-activeEffects Migration");
    let updateData = {};
    const { amount } = netarch.system;
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(netarch, "system.quality"),
    };
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(netarch, 5000),
    };
    await netarch.update(updateData);
    const newItemData = duplicate(netarch.data);
    await ActiveEffectsMigration.dupeOwnedItems(netarch, amount, newItemData);
  }

  /**
   * Program
   *    Lost quality
   *    Gained usage
   *    Lost slots
   *    Gained size
   *    Lost isDemon
   *    "modifiers" property converted to AEs
   *    if price is 0 and category is empty, set to 100/premium
   *    Lost amount - create duplicate items
   *
   * @param {CPRItem} program
   */
  static async updateProgram(program) {
    LOGGER.trace("updateProgram | 1-activeEffects Migration");
    let updateData = {};
    const { amount } = program.system;
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(program, "system.quality"),
    };
    updateData["system.usage"] = "rezzed";
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(program, "system.slots"),
    };
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(program, "system.isDemon"),
    };
    const changes = [];
    let index = 0;
    const name = CPRSystemUtils.Localize("CPR.migration.effects.program");
    // there's a rare case this is not defined for items that didn't complete previous migration(s)
    if (
      typeof program.system.modifiers === "object" &&
      Object.keys(program.system.modifiers).length > 0
    ) {
      for (const [key, value] of Object.entries(program.system.modifiers)) {
        changes.push({
          key: `bonuses.${CPRSystemUtils.slugify(key)}`,
          value,
          mode: 2,
          priority: index,
        });
        index += 1;
      }
      await ActiveEffectsMigration.addActiveEffect(program, name, changes);
      updateData = {
        ...updateData,
        ...CPRMigration.safeDelete(program, "system.modifiers"),
      };
    }
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(program, 100),
    };
    await program.update(updateData);
    const newItemData = duplicate(program.data);
    await ActiveEffectsMigration.dupeOwnedItems(program, amount, newItemData);
  }

  /**
   * Role:
   *    "skillBonuses" became "bonuses"
   *
   * @param {CPRItem} role
   */
  static async updateRole(role) {
    LOGGER.trace("updateRole | 1-activeEffects Migration");
    let updateData = {};
    updateData["system.bonuses"] = role.system.skillBonuses;
    const roleAbilities = role.system.abilities;
    const updatedRoleAbilities = [];
    roleAbilities.forEach((ra) => {
      const newRoleAbility = ra;
      newRoleAbility.bonuses = ra.skillBonuses;
      delete newRoleAbility.skillBonuses;
      updatedRoleAbilities.push(newRoleAbility);
    });
    updateData["system.abilities"] = updatedRoleAbilities;
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(role, "system.quality"),
    };
    await role.update(updateData);
  }

  /**
   * Skill:
   *    "skillmod" property is removed; use AEs on the actor instead
   *
   * This call assumes the AEs are created on the actor already.
   *
   * @param {CPRItem} skill
   */
  static async updateSkill(skill) {
    LOGGER.trace("updateSkill | 1-activeEffects Migration");
    let updateData = {};
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(skill, "system.skillmod"),
    };
    await skill.update(updateData);
  }

  /**
   * Vehicle
   *    Lost quality
   *    Lost amount - create duplicate items
   *    if price is 0 and category is empty, set to 10000/premium
   *    Gained slots for upgrades
   *
   * @param {CPRItem} vehicle
   */
  static async updateVehicle(vehicle) {
    LOGGER.trace("updateVehicle | 1-activeEffects Migration");
    let updateData = {};
    const { amount } = vehicle.system;
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(vehicle, "system.quality"),
    };
    updateData["system.slots"] = 3;
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(vehicle, 10000),
    };
    await vehicle.update(updateData);
    const newItemData = duplicate(vehicle.data);
    await ActiveEffectsMigration.dupeOwnedItems(vehicle, amount, newItemData);
  }

  /**
   * Weapon
   *    Gained usage
   *    Lost charges
   *    Gained slots for upgrades (attachmentSlots became slots)
   *    if price is 0 and category is empty, set to 100/premium
   *    Lost amount - create duplicate items
   *
   * @param {CPRItem} weapon
   */
  static async updateWeapon(weapon) {
    LOGGER.trace("updateWeapon | 1-activeEffects Migration");
    let updateData = {};
    const { amount } = weapon.system;
    const { quality } = weapon.system;
    const { attackmod } = weapon.system;

    updateData["system.usage"] = "equipped";
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(weapon, "system.charges"),
    };
    updateData["system.slots"] = 3;
    if (quality === "excellent") {
      updateData["system.attackmod"] = attackmod + 1;
    }
    updateData = {
      ...updateData,
      ...CPRMigration.safeDelete(weapon, "system.quality"),
    };
    updateData = {
      ...updateData,
      ...ActiveEffectsMigration.setPriceData(weapon, 100),
    };
    await weapon.update(updateData);
    const newItemData = duplicate(weapon.data);
    await ActiveEffectsMigration.dupeOwnedItems(weapon, amount, newItemData);
  }
}
