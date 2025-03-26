/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* global CONFIG duplicate expandObject foundry game mergeObject */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";

export default class BaseMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | 0-base Migration");
    super();
    this.version = 0;
  }

  async run() {
    LOGGER.trace("run | 0-base Migration");
    LOGGER.log(
      `Migrating to data model version ${this.version} (legacy migration script)`
    );
    let totalCount = game.items.contents.length;
    let watermarkCount = totalCount / 24 + 1;
    let loopIndex = 0;

    // Migrate World Items
    for (const i of game.items.contents) {
      loopIndex += 1;
      if (loopIndex > watermarkCount) {
        this.statusPercent += 1;
        CPRSystemUtils.updateMigrationBar(
          this.statusPercent,
          this.statusMessage
        );
        loopIndex = 0;
      }
      try {
        const updateData = BaseMigration.migrateItemData(i.toObject());
        if (!foundry.utils.isObjectEmpty(updateData)) {
          BaseMigration._migrationLog(`Migrating Item entity ${i.name}`);
          await i.update(updateData, { diff: false });
        }
      } catch (err) {
        LOGGER.error(
          `CPR MIGRATION | Failed ${game.system.id} system migration for Item ${i.name}: ${err.message}`
        );
        this.errors += 1;
        LOGGER.error(err);
      }
    }
    totalCount = game.actors.contents.length;
    watermarkCount = totalCount / 24 + 1;
    loopIndex = 0;

    // Migrate World Actors
    for (const a of game.actors.contents) {
      loopIndex += 1;
      if (loopIndex > watermarkCount) {
        this.statusPercent += 1;
        CPRSystemUtils.updateMigrationBar(
          this.statusPercent,
          this.statusMessage
        );
        loopIndex = 0;
      }

      try {
        // Create any new items needed for the character or mook before manipulating
        // any data points, example: Missing core Cyberware, Critical Injury Items, etc
        if (a.type === "character" || a.type === "mook") {
          await BaseMigration.createActorItems(a);
        }

        const updateData =
          typeof a.data === "undefined"
            ? {}
            : BaseMigration.migrateActorData(a.data, "actor");
        if (!foundry.utils.isObjectEmpty(updateData)) {
          BaseMigration._migrationLog(`Migrating Actor entity ${a.name}`);
          await a.update(updateData, { enforceTypes: false });
        }
      } catch (err) {
        LOGGER.error(
          `CPR MIGRATION | Failed ${game.system.id} system migration for Actor ${a.name}: ${err.message}`
        );
        this.errors += 1;
        LOGGER.error(err);
      }
    }

    totalCount = game.packs.size;
    watermarkCount = totalCount / 24 + 1;
    loopIndex = 0;

    // Migrate World Compendiums
    for (const p of game.packs) {
      loopIndex += 1;
      if (loopIndex > watermarkCount) {
        this.statusPercent += 1;
        CPRSystemUtils.updateMigrationBar(
          this.statusPercent,
          this.statusMessage
        );
        loopIndex = 0;
      }

      if (p.metadata.package === "world") {
        BaseMigration.migrateCompendium(p);
      }
    }

    // Migrate Actor Override Tokens
    for (const s of game.scenes.contents) {
      try {
        const updateData = BaseMigration.migrateSceneData(s.data);
        if (!foundry.utils.isObjectEmpty(updateData)) {
          BaseMigration._migrationLog(`Migrating Scene entity ${s.name}`);
          await s.update(updateData, { enforceTypes: false });
          // If we do not do this, then synthetic token actors remain in cache
          // with the un-updated actorData.
          s.tokens.contents.forEach((t) => {
            // eslint-disable-next-line no-param-reassign
            t._actor = null;
          });
        }
      } catch (err) {
        LOGGER.error(
          `CPR MIGRATION | Failed ${game.system.id} system migration for Scene ${s.name}: ${err.message}`
        );
        this.errors += 1;
        LOGGER.error(err);
      }
    }
    if (this.errors !== 0) {
      return false;
    }
    game.settings.set(game.system.id, "dataModelVersion", this.version);
    return true;
  }

  // @param {object} actorData    The actor data object to update
  static migrateActorData(actorData, dataSource) {
    LOGGER.trace("migrateActorData | 0-base Migration");
    const foundryVersion = parseInt(game.version, 10);
    const stub = foundryVersion >= 10 ? "system" : "data";
    const updateData = {};

    // Remove flags from container actors, they should be configured on token actors
    if (
      actorData.type === "container" &&
      dataSource === "actor" &&
      !actorData.token.actorLink
    ) {
      updateData[`flags.${game.system.id}.-=infinite-stock`] = null;
      updateData[`flags.${game.system.id}.-=items-free`] = null;
      updateData[`flags.${game.system.id}.-=players-create`] = null;
      updateData[`flags.${game.system.id}.-=players-delete`] = null;
      updateData[`flags.${game.system.id}.-=players-modify`] = null;
      updateData[`flags.${game.system.id}.-=shop`] = null;
      updateData[`flags.${game.system.id}.-=stash`] = null;
      updateData[`flags.${game.system.id}.-=loot`] = null;
      updateData[`flags.${game.system.id}.-=custom`] = null;
    }

    // Migrate Owned Items
    if (actorData.items) {
      const items = actorData.items.reduce((arr, i) => {
        // Migrate the Owned Item
        const itemData =
          i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
        const itemUpdate = BaseMigration.migrateItemData(itemData);

        if (foundryVersion >= 10) {
          Object.keys(itemUpdate).forEach((key) => {
            if (key.search(/^data\./g !== -1)) {
              const value = itemUpdate[key];
              const newKey = key.replace(/^data\./, "system.");
              itemUpdate[newKey] = value;
              delete itemUpdate[key];
            }
          });
        }

        // Update the Owned Item
        if (!foundry.utils.isObjectEmpty(itemUpdate)) {
          itemUpdate._id = itemData._id;
          arr.push(expandObject(itemUpdate));
        }

        return arr;
      }, []);

      if (items.length > 0) {
        updateData.items = items;
      }
    }

    /*
    After version 0.53, we moved deathSave to 3 values to support the rules:
    There are two things that can modify your Death Save rolls, the "Death Save Penalty" and the "Base Death Save Penalty".

    Your "Death Save Penalty" increases by 1 every time you succeed at a Death Save, and is applied to the roll. For example,
    if you succeed your first Death Save, your next is made with a +1. If you succeed again, the next is made with a +2.

    Your "Base Death Save Penalty" increases when you receive certain Critical Injuries. It is also added to your Death Save
    rolls along with the regular "Death Save Penalty". For example, if you get a Whiplash Critical Injury, "Base Death Save Penalty"
    is increased by 1, and gets added to any Death Saving throws that are made. This would get added to the regular "Death Save Penalty"
    if any Death Saves have succeeded.

    When you are healed to 1 hit point by stabilization, your "Death Save Penalty" resets to your "Base Death Save Penalty".
    Only by healing critical injuries can you lower your "Base Death Save Penalty". This means that if your
    "Base Death Save Penalty" is +2, your "Death Save Penalty" can be reset to no lower than +2, and thus you have will have
    a +4 to Death Saves until those critical injuries are healed. It could also mean that if you are stabilized,
    only your "Base Death Save Penalty" applies to Death Saves and from our example, you would only add +2 to Death Saves until the
    critical injuries are healed. p221
    */

    // The following only applies to the character data model
    if (actorData.type === "character") {
      // Original Data Model had a spelling issue
      if (typeof actorData.data.lifepath.familyBackground === "undefined") {
        updateData[`${stub}.lifepath.familyBackground`] = "";
        if (typeof actorData.data.lifepath.familyBackgrond !== "undefined") {
          updateData[`${stub}.lifepath.familyBackground`] =
            actorData.data.lifepath.familyBackgrond;
          updateData[`${stub}.lifepath.-=familyBackgrond`] = null;
        }
      }
      if (typeof actorData.data.lifestyle.fashion === "undefined") {
        updateData[`${stub}.lifestyle.fashion`] = "";
        if (typeof actorData.data.lifestyle.fasion !== "undefined") {
          updateData[`${stub}.lifestyle.fashion`] =
            actorData.data.lifestyle.fasion;
          updateData[`${stub}.lifestyle.-=fasion`] = null;
        }

        if (typeof actorData.data.improvementPoints.total !== "undefined") {
          updateData[`${stub}.improvementPoints.-=total`] = null;
        }

        // Removed in 0.72
        if (typeof actorData.data.hp !== "undefined") {
          updateData[`${stub}.-=hp`] = null;
        }
      }

      // Lifepath migration/fixes
      // Changed in 0.72
      if (typeof actorData.data.lifepath.friends === "object") {
        updateData[`${stub}.lifepath.friends`] = "";
      }
      // Changed in 0.72
      if (typeof actorData.data.lifepath.tragicLoveAffairs === "object") {
        updateData[`${stub}.lifepath.tragicLoveAffairs`] = "";
      }
      // Changed in 0.72
      if (typeof actorData.data.lifepath.enemies === "object") {
        updateData[`${stub}.lifepath.enemies`] = "";
      }

      // Lifestyle migration/fixes
      // Changed in 0.72
      if (typeof actorData.data.lifestyle.fashion === "string") {
        const oldData = actorData.data.lifestyle.fashion;
        updateData[`${stub}.lifestyle.fashion`] = { description: oldData };
      }

      // Changed in 0.72
      if (typeof actorData.data.lifestyle.housing === "string") {
        const oldData = actorData.data.lifestyle.housing;
        updateData[`${stub}.lifestyle.housing`] = {
          description: oldData,
          cost: 0,
        };
      }
      // Changed in 0.72
      if (typeof actorData.data.lifestyle.lifestyle === "string") {
        const oldData = actorData.data.lifestyle.lifestyle;
        updateData[`${stub}.lifestyle.lifestyle`] = {
          description: oldData,
          cost: 0,
        };
      }

      // Removed in 0.72
      if (typeof actorData.data.lifestyle.rent !== "undefined") {
        updateData[`${stub}.lifestyle.-=rent`] = null;
      }

      // Added in 0.72
      if (typeof actorData.data.lifestyle.traumaTeam === "undefined") {
        updateData[`${stub}.lifestyle.traumaTeam`] = {
          description: "",
          cost: 0,
        };
      }
      // Added in 0.72
      if (typeof actorData.data.lifestyle.extras === "undefined") {
        updateData[`${stub}.lifestyle.extras`] = { description: "", cost: 0 };
      }

      // Improvement Points migration/fixes
      if (typeof actorData.data.improvementPoints === "undefined") {
        updateData[`${stub}.improvementPoints`] = {
          value: 0,
          transactions: [],
        };
      } else if (
        typeof actorData.data.improvementPoints.value === "undefined"
      ) {
        let ipValue = 0;
        if (typeof actorData.data.improvementPoints.total !== "undefined") {
          ipValue = actorData.data.improvementPoints.total;
        }
        updateData[`${stub}.improvementPoints`] = {
          value: ipValue,
          transactions: [],
        };
      }

      // Wealth/Eddies migration/fixes
      if (typeof actorData.data.wealth === "undefined") {
        updateData[`${stub}.wealth`] = {
          value: 0,
          transactions: [],
        };
      } else if (typeof actorData.data.wealth.value === "undefined") {
        let eddies = 0;
        if (typeof actorData.data.wealth.eddies !== "undefined") {
          eddies = actorData.data.wealth.eddies;
        }
        updateData[`${stub}.wealth`] = {
          value: eddies,
          transactions: [],
        };
      }

      if (typeof actorData.data.wealth.eddies !== "undefined") {
        updateData[`${stub}.wealth.-=eddies`] = null;
      }

      // Reputation migration/fixes
      if (typeof actorData.data.reputation === "undefined") {
        updateData[`${stub}.reputation`] = {
          value: 0,
          transactions: [],
        };
      }
      if (typeof actorData.data["reputation:"] !== "undefined") {
        updateData[`${stub}.-=reputation:`] = null;
      }
    }

    if (actorData.type === "character" || actorData.type === "mook") {
      // Applies to both characters and mooks
      // Death Save/Death Penalty migration/fixes
      if (typeof actorData.data.derivedStats.deathSave === "number") {
        const oldDeathSave = actorData.data.derivedStats.deathSave;
        let oldDeathPenalty = 0;
        if (
          typeof actorData.data.derivedStats.deathSavePenlty !== "undefined"
        ) {
          oldDeathPenalty = actorData.data.derivedStats.deathSavePenlty;
        }
        updateData[`${stub}.derivedStats.deathSave`] = {
          value: oldDeathSave,
          penalty: oldDeathPenalty,
          basePenalty: 0,
        };
      }

      if (typeof actorData.data.derivedStats.deathSavePenlty !== "undefined") {
        updateData[`${stub}.derivedStats.-=deathSavePenlty`] = null;
      }

      if (typeof actorData.data.roleInfo.activeRole === "undefined") {
        let configuredRole = "solo";
        if (actorData.data.roleInfo.roles.length > 0) {
          // eslint-disable-next-line prefer-destructuring
          configuredRole = actorData.data.roleInfo.roles[0];
        }
        updateData[`${stub}.roleInfo.activeRole`] = configuredRole;
      }

      // New data point needed for Roles as items implementation (0.79.1)
      if (actorData.data.roleInfo.activeNetRole === "") {
        if (typeof actorData.data.roleInfo.roles !== "undefined") {
          if (actorData.data.roleInfo.roles.includes("netrunner")) {
            updateData[`${stub}.roleInfo.activeNetRole`] = "Netrunner";
          }
        }
      }

      // make the first letter of activeRole uppercase to match
      switch (actorData.data.roleInfo.activeRole) {
        case "exec":
          updateData[`${stub}.roleInfo.activeRole`] = "Exec";
          break;
        case "fixer":
          updateData[`${stub}.roleInfo.activeRole`] = "Fixer";
          break;
        case "lawman":
          updateData[`${stub}.roleInfo.activeRole`] = "Lawman";
          break;
        case "media":
          updateData[`${stub}.roleInfo.activeRole`] = "Media";
          break;
        case "medtech":
          updateData[`${stub}.roleInfo.activeRole`] = "Medtech";
          break;
        case "netrunner":
          updateData[`${stub}.roleInfo.activeRole`] = "Netrunner";
          break;
        case "nomad":
          updateData[`${stub}.roleInfo.activeRole`] = "Nomad";
          break;
        case "rockerboy":
          updateData[`${stub}.roleInfo.activeRole`] = "Rockerboy";
          break;
        case "solo":
          updateData[`${stub}.roleInfo.activeRole`] = "Solo";
          break;
        case "tech":
          updateData[`${stub}.roleInfo.activeRole`] = "Tech";
          break;
        default:
      }

      if (typeof actorData.data.criticalInjuries === "undefined") {
        updateData[`${stub}.criticalInjuries`] = [];
      }

      // Humanity migration/fixes
      // Moved to derivedStats in 0.72
      if (typeof actorData.data.humanity !== "undefined") {
        updateData[`${stub}.derivedStats.humanity`] = actorData.data.humanity;
      }

      if (typeof actorData.data.humanity !== "undefined") {
        updateData[`${stub}a.-=humanity`] = null;
      }

      // Wound State migration/fixes
      // Moved to derivedStats in 0.72
      if (typeof actorData.data.currentWoundState !== "undefined") {
        updateData[`${stub}.derivedStats.currentWoundState`] =
          actorData.data.currentWoundState;
      }

      if (typeof actorData.data.woundState !== "undefined") {
        updateData[`${stub}a.-=woundState`] = null;
      }

      // Critical Injuries migration/fixes
      // Moved to items in 0.72
      if (typeof actorData.data.criticalInjuries !== "undefined") {
        updateData[`${stub}.-=criticalInjuries`] = null;
      }

      // Adds external data points to actorData (e.g. for Armor SP resource bars)
      if (typeof actorData.data.externalData === "undefined") {
        updateData[`${stub}.externalData`] = {
          currentArmorBody: {
            id: "",
            value: 0,
            max: 0,
          },

          currentArmorHead: {
            id: "",
            value: 0,
            max: 0,
          },

          currentArmorShield: {
            id: "",
            value: 0,
            max: 0,
          },

          currentWeapon: {
            id: "",
            value: 0,
            max: 0,
          },
        };
      }

      // Adds universal bonuses to actorData (for current implementation of roles
      // providing bonuses to attacks and damage, and future implementation of active effects).
      if (typeof actorData.data.universalBonuses === "undefined") {
        updateData[`${stub}.universalBonuses`] = {
          attack: 0,
          damage: 0,
        };
      }

      if (typeof actorData.data.roleInfo.roleskills !== "undefined") {
        updateData[`${stub}.roleInfo.-=roleskills`] = null;
      }
    }

    return updateData;
  }

  static async migrateTokenActor(actor) {
    LOGGER.trace("migrateTokenActor | 0-base Migration");
    const foundryVersion = parseInt(game.version, 10);

    if (actor.type === "character" || actor.type === "mook") {
      await BaseMigration.createActorItems(actor);
    }

    if (actor.type === "container") {
      const actorFlags = foundryVersion >= 10 ? actor.flags : actor.data.flags;
      if (typeof actorFlags[game.system.id] === "undefined") {
        if (foundryVersion >= 10) {
          actor.flags[game.system.id] = {};
        } else {
          actor.data.flags[game.system.id] = {};
        }
      }

      const systemFlags =
        foundryVersion >= 10
          ? actor.flags[game.system.id]
          : actor.data.flags[game.system.id];

      if (typeof systemFlags["container-type"] === "undefined") {
        actor.setFlag(game.system.id, "container-type", "shop");
        actor.setFlag(game.system.id, "players-sell", true);
      }
    }

    return BaseMigration.migrateActorData(actor.data, "token");
  }

  // Segmented out the creation of items for the Actors as they are not just
  // manipulating the Actor Data, they are creating new Item entities in the
  // world and adding them to the actors.
  static async createActorItems(actorDocument) {
    LOGGER.trace("createActorItems | 0-base Migration");

    let newItems = [];
    const actorData = actorDocument.data;
    // Migrate critical injures to items
    if (typeof actorData.data.criticalInjuries !== "undefined") {
      if (actorData.data.criticalInjuries.length > 0) {
        const migratedInjuries = this.migrateCriticalInjuries(actorData);
        if (!foundry.utils.isObjectEmpty(migratedInjuries)) {
          BaseMigration._migrationLog(
            `Migration critical injuries for Actor "${actorData.name}" (${actorData._id})`
          );
          newItems = migratedInjuries;
        }
      }
    }

    // Migrate role abilities to items and assign correct values.
    const { roleskills } = actorData.data.roleInfo;
    if (typeof roleskills !== "undefined") {
      const content = await CPRSystemUtils.GetCompendiumDocs(
        `${game.system.id}.roles-items`
      );
      Object.entries(roleskills).forEach(([role, roleSkills]) => {
        let newRole;
        Object.entries(roleSkills).forEach(([skillName, skillValue]) => {
          if (skillName !== "subSkills") {
            if (actorData.data.roleInfo.roles.includes(role)) {
              const hasRoleObject = actorDocument.itemTypes.role.find(
                (r) => r.name.toLowerCase() === role
              );
              if (typeof hasRoleObject === "undefined") {
                newRole = duplicate(
                  content.find((c) => c.name.toLowerCase() === role).data
                );
                if (typeof newRole.data !== "undefined") {
                  newRole.data.rank = skillValue;
                }
                if (typeof newRole.system !== "undefined") {
                  newRole.system.rank = skillValue;
                }
              }
            }
          }
          if (skillName === "subSkills" && newRole) {
            Object.entries(skillValue).forEach(
              ([subSkillName, subSkillValue]) => {
                const niceSubRoleName = CPRSystemUtils.Localize(
                  `CPR.global.role.${role}.ability.${subSkillName}`
                );
                if (typeof newRole.data !== "undefined") {
                  newRole.data.abilities.find(
                    (a) => a.name === niceSubRoleName
                  ).rank = subSkillValue;
                }
                if (typeof newRole.system !== "undefined") {
                  newRole.system.abilities.find(
                    (a) => a.name === niceSubRoleName
                  ).rank = subSkillValue;
                }
              }
            );
          }
        });
        if (newRole) {
          switch (role) {
            case "medtech": {
              const medtechCryo =
                typeof newRole.data !== "undefined"
                  ? newRole.data.abilities.find(
                      (a) => a.name === "Medical Tech (Cryosystem Operation)"
                    ).rank
                  : newRole.system.abilities.find(
                      (a) => a.name === "Medical Tech (Cryosystem Operation)"
                    ).rank;
              const medtechPharma =
                typeof newRole.data !== "undefined"
                  ? newRole.data.abilities.find(
                      (a) => a.name === "Medical Tech (Pharmaceuticals)"
                    ).rank
                  : newRole.system.abilities.find(
                      (a) => a.name === "Medical Tech (Pharmaceuticals)"
                    ).rank;
              if (typeof newRole.data !== "undefined") {
                newRole.data.abilities.find(
                  (a) => a.name === "Medical Tech"
                ).rank = medtechCryo + medtechPharma;
              }
              if (typeof newRole.system !== "undefined") {
                newRole.system.abilities.find(
                  (a) => a.name === "Medical Tech"
                ).rank = medtechCryo + medtechPharma;
              }

              break;
            }
            case "fixer": {
              if (typeof newRole.data !== "undefined") {
                newRole.data.abilities.find((a) => a.name === "Haggle").rank =
                  newRole.data.rank;
              }
              if (typeof newRole.system !== "undefined") {
                newRole.system.abilities.find((a) => a.name === "Haggle").rank =
                  newRole.system.rank;
              }

              break;
            }
            default:
          }
          newItems.push(newRole);
        }
      });
    }

    // This was added as part of 0.72.  We had one report of
    // a scenario where the actors somehow lost their core Cyberware items
    // so this ensures all actors have them.
    // put into basickSkills array
    const content = await CPRSystemUtils.GetCoreCyberware();
    const missingContent = this._validateCoreContent(actorData, content);
    if (missingContent.length > 0) {
      missingContent.forEach((c) => {
        const missingItem = c.data;
        BaseMigration._migrationLog(
          `Actor "${actorData.name}" (${actorData._id}) is missing "${missingItem.name}". Creating.`
        );
        newItems.push(missingItem);
      });
    }

    // Previously we supported stackable programs, but with the upcoming Netrunning changes
    // programs should be handled like Cyberware as the Program ID gets correlated to the Cyberdeck
    // Item
    const programList = actorDocument.itemTypes.program;
    programList.forEach((p) => {
      const itemData = p.data;
      let quantity = itemData.data.amount;
      if (quantity > 1) {
        BaseMigration._migrationLog(
          `Splitting Program "${itemData.name}" (${itemData._id}) ` +
            `Quanity: ${quantity} on actor "${actorData.name}" (${
              actorData._id
            }). Net new items: ${quantity - 1}`
        );
        itemData.data.amount = 1;
        while (quantity > 1) {
          newItems.push(itemData);
          quantity -= 1;
        }
      }
    });

    if (newItems.length > 0) {
      await actorDocument.createEmbeddedDocuments("Item", newItems, {
        cprIsMigrating: true,
      });
    }
  }

  static _validateCoreContent(actorData, content) {
    LOGGER.trace("_validateCoreContent | 0-base Migration");

    const ownedCyberware = actorData.items.filter(
      (o) => o.type === "cyberware"
    );
    const installedCyberware = ownedCyberware.filter((i) => {
      let isInstalled = false;
      if (typeof i.data.isInstalled !== "undefined") {
        isInstalled = i.data.isInstalled;
      }
      if (typeof i.system.isInstalled !== "undefined") {
        isInstalled = i.system.isInstalled;
      }
      return isInstalled;
    });

    // Remove any installed items from the core content since the actorData has those items
    let coreContent = content;
    installedCyberware.forEach((c) => {
      coreContent = coreContent.filter((cw) => cw.name !== c.name);
    });

    // Anything left in content is missing
    return coreContent;
  }

  static _migrateCriticalInjuries(actorData) {
    LOGGER.trace("_migrateCriticalInjuries | 0-base Migration");
    const { criticalInjuries } = actorData.data;
    const injuryItems = [];
    criticalInjuries.forEach(async (injury) => {
      const { mods } = injury;
      const hasPenalty = mods.filter(
        (mod) => mod.name === "deathSavePenalty"
      )[0].value;
      const cprData = {
        location: injury.location,
        description: {
          value: injury.effect,
          chat: "",
          unidentified: "",
        },
        quickFix: {
          type: "firstAidParamedic",
          dvFirstAid: 0,
          dvParamedic: 0,
        },
        treatment: {
          type: "paramedicSurgery",
          dvParamedic: 0,
          dvSurgery: 0,
        },
        deathSaveIncrease: hasPenalty,
      };
      const itemData = {
        type: "criticalInjury",
        name: injury.name,
      };
      const foundryVersion = parseInt(game.version, 10);
      const stub = foundryVersion >= 10 ? "system" : "data";
      itemData[stub] = cprData;
      injuryItems.push({ _id: injury.id, data: itemData });
    });
    return injuryItems;
  }

  // @param {object} itemData    The actor data object to update
  static migrateItemData(itemData) {
    LOGGER.trace("migrateItemData | 0-base Migration");
    let updateData = {};

    if (typeof itemData.data.description === "string") {
      const oldDescription = itemData.data.description;
      updateData["data.description"] = {
        value: oldDescription,
        chat: "",
        unidentified: "",
      };
    }
    switch (itemData.type) {
      case "weapon": {
        updateData = this._migrateWeapon(itemData, updateData);
        break;
      }
      case "program": {
        updateData = this._migrateProgram(itemData, updateData);
        break;
      }
      case "vehicle": {
        updateData = this._migrateVehicle(itemData, updateData);
        break;
      }
      case "gear": {
        updateData = this._migrateGear(itemData, updateData);
        break;
      }
      case "skill": {
        updateData = this._migrateSkill(itemData, updateData);
        break;
      }
      case "cyberware": {
        updateData = this._migrateCyberware(itemData, updateData);
        break;
      }
      case "netarch": {
        this._migrateNetArchitecture(itemData, updateData);
        break;
      }
      case "armor": {
        this._migrateArmor(itemData, updateData);
        break;
      }
      default:
    }
    return updateData;
  }

  // Item specific migration tasks
  static _migrateWeapon(itemData, updateData) {
    LOGGER.trace("_migrateWeapon | 0-base Migration");

    if (typeof itemData.data.isConcealed === "undefined") {
      updateData["data.isConcealed"] = false;
    }
    if (typeof itemData.data.dvTable === "undefined") {
      updateData["data.dvTable"] = "";
    }
    if (typeof itemData.data.attackMod === "undefined") {
      updateData["data.attackMod"] = 0;
    }
    // Added with 0.75.1
    if (typeof itemData.data.unarmedAutomaticCalculation === "undefined") {
      updateData["data.unarmedAutomaticCalculation"] = true;
    }
    return updateData;
  }

  static _migrateArmor(itemData, updateData) {
    LOGGER.trace("_migrateArmor | 0-base Migration");

    if (typeof itemData.data.headLocation.sp !== "number") {
      let newValue = 0;
      if (typeof itemData.data.headLocation.sp !== "undefined") {
        const spValue = Number(itemData.data.headLocation.sp);
        if (typeof spValue === "number") {
          newValue = spValue;
        }
      }
      updateData["data.headLocation.sp"] = newValue;
    }

    if (typeof itemData.data.bodyLocation.sp !== "number") {
      let newValue = 0;
      if (typeof itemData.data.bodyLocation.sp !== "undefined") {
        const spValue = Number(itemData.data.bodyLocation.sp);
        if (typeof spValue === "number") {
          newValue = spValue;
        }
      }
      updateData["data.bodyLocation.sp"] = newValue;
    }

    if (typeof itemData.data.shieldHitPoints.max !== "number") {
      let newValue = 0;
      if (typeof itemData.data.shieldHitPoints.max !== "undefined") {
        const hpValue = Number(itemData.data.shieldHitPoints.max);
        if (typeof hpValue === "number") {
          newValue = hpValue;
        }
      }
      updateData["data.shieldHitPoints.max"] = newValue;
    }

    if (typeof itemData.data.shieldHitPoints.value !== "number") {
      let newValue = 0;
      if (typeof itemData.data.shieldHitPoints.value !== "undefined") {
        const hpValue = Number(itemData.data.shieldHitPoints.value);
        if (typeof hpValue === "number") {
          newValue = hpValue;
        }
      }
      updateData["data.shieldHitPoints.value"] = newValue;
    }

    return updateData;
  }

  static _migrateProgram(itemData, updateData) {
    LOGGER.trace("_migrateProgram | 0-base Migration");

    if (
      typeof itemData.data.slots === "undefined" ||
      itemData.data.slots === null
    ) {
      updateData["data.slots"] = 1;
    }
    if (
      typeof itemData.data.install === "undefined" ||
      itemData.data.install === null
    ) {
      updateData["data.install"] = "";
    }
    if (
      typeof itemData.data.isInstalled === "undefined" ||
      itemData.data.isInstalled === null
    ) {
      updateData["data.isInstalled"] = false;
    }

    if (typeof itemData.data.modifiers !== "object") {
      updateData["data.modifiers"] = {};
    }

    if (typeof itemData.data.damage !== "object") {
      updateData["data.damage"] = { standard: "1d6", blackIce: "" };
    }

    if (itemData.data.amount !== 1) {
      updateData["data.amount"] = 1;
    }

    if (
      typeof itemData.data.blackIceType === "undefined" ||
      itemData.data.blackIceType === null
    ) {
      updateData["data.blackIceType"] = "antipersonnel";
    }

    if (
      typeof itemData.data.prototypeActor === "undefined" ||
      itemData.data.prototypeActor === null
    ) {
      updateData["data.prototypeActor"] = "";
    }

    const lowerName = itemData.name.toLowerCase().replace(/\s/g, "");

    // Setting a default program class since we are moving from
    // a free-form text to a selectable program class
    updateData["data.class"] = "antipersonnelattacker";
    // Set program class based on name
    switch (lowerName) {
      case "eraser":
      case "seeya":
      case "see-ya":
      case "speedygonzalez":
      case "worm": {
        updateData["data.class"] = "booster";
        break;
      }
      case "armor":
      case "flak":
      case "shield": {
        updateData["data.class"] = "defender";
        break;
      }
      case "banhammer":
      case "sword": {
        updateData["data.class"] = "antiprogramattacker";
        break;
      }
      case "deckkrash":
      case "hellbolt":
      case "nervescrub":
      case "poisonflatline":
      case "superglue":
      case "vrizzbolt": {
        updateData["data.class"] = "antipersonnelattacker";
        break;
      }
      case "asp":
      case "giant":
      case "hellhound":
      case "kracken":
      case "liche":
      case "raven":
      case "scorpion":
      case "skunk":
      case "wisp": {
        updateData["data.class"] = "blackice";
        updateData["data.blackIceType"] = "antipersonnel";
        break;
      }
      case "dragon":
      case "killer":
      case "sabertooth": {
        updateData["data.class"] = "blackice";
        updateData["data.blackIceType"] = "antiprogram";
        break;
      }

      default:
    }

    switch (itemData.data.class) {
      case "Anti-Program Attacker": {
        updateData["data.class"] = "antiprogramattacker";
        break;
      }
      case "Anti-Personnel Attacker": {
        updateData["data.class"] = "antipersonnelattacker";
        break;
      }
      case "Booster": {
        updateData["data.class"] = "booster";
        break;
      }
      case "Defender": {
        updateData["data.class"] = "defender";
        break;
      }
      case "BlackICE":
      case "Black ICE":
      case "Black-ICE": {
        updateData["data.class"] = "blackice";
        updateData["data.blackIceType"] = "other";
        break;
      }
      default:
    }

    if (
      typeof itemData.data.equipped === "undefined" ||
      itemData.data.equipped === null
    ) {
      updateData["data.equipped"] = "owned";
    }
    return updateData;
  }

  static _migrateVehicle(itemData, updateData) {
    LOGGER.trace("_migrateVehicle | 0-base Migration");

    if (typeof itemData.data.sdp === "undefined") {
      updateData["data.sdp"] = 0;
    } else if (typeof itemData.data.sdp !== "number") {
      let newSdp = Number(itemData.data.sdp);
      if (typeof newSdp !== "number") {
        newSdp = 0;
      }
      updateData["data.sdp"] = newSdp;
    }

    if (typeof itemData.data.spd !== "undefined") {
      let newSdp = Number(itemData.data.spd);
      if (typeof newSdp !== "number") {
        newSdp = 0;
      }
      updateData["data.sdp"] = newSdp;
      updateData["data.-=spd"] = null;
    }

    if (typeof itemData.data.seats !== "number") {
      let newSeats = Number(itemData.data.seats);
      if (typeof newSeats !== "number") {
        newSeats = 0;
      }
      updateData["data.seats"] = newSeats;
    }

    if (typeof itemData.data.speedCombat !== "number") {
      const currentSetting = itemData.data.speedCombat;
      let newSpeedCombat = 0;
      if (typeof currentSetting === "string") {
        const stringParts = currentSetting.split(" ");
        if (stringParts.length > 0) {
          const oldSpeed = Number(stringParts[0]);
          if (typeof oldSpeed === "number") {
            newSpeedCombat = oldSpeed;
          }
        }
      }
      updateData["data.speedCombat"] = newSpeedCombat;
    }

    return updateData;
  }

  static _migrateGear(itemData, updateData) {
    LOGGER.trace("_migrateGear | 0-base Migration");

    if (typeof itemData.data.equipped === "undefined") {
      updateData["data.equipped"] = "owned";
    }

    const gearName = itemData.name.toLowerCase();

    // Cyberdecks became their own item type, so any "Gear" object with the name "cyberdeck"
    // in it's name will be prepended with a MIGRATE tag to let users know there's a new item type.
    if (gearName.includes("cyberdeck")) {
      const oldName = itemData.name;
      updateData.name = `${CPRSystemUtils.Localize(
        "CPR.migration.tag"
      )} ${oldName}`;
    }

    return updateData;
  }

  static _migrateCyberware(itemData, updateData) {
    LOGGER.trace("_migrateCyberware | 0-base Migration");

    if (typeof itemData.data.slotSize !== "number") {
      updateData["data.slotSize"] = 1;
    }

    if (
      itemData.data.isInstalled === true &&
      itemData.data.isFoundational === true
    ) {
      if (Array.isArray(itemData.data.optionalIds)) {
        updateData["data.installedOptionSlots"] =
          itemData.data.optionalIds.length;
      } else {
        updateData["data.installedOptionSlots"] = 0;
        updateData["data.optionalIds"] = [];
      }
    }

    if (itemData.data.type === "") {
      updateData["data.type"] = "cyberArm";
    }

    if (typeof itemData.data.isWeapon !== "boolean") {
      updateData["data.isWeapon"] = false;
    }
    return updateData;
  }

  // I (Jalen) spoke with Darin and he mentioned it might make most sense for
  // migration code like this to check if the value isn't a number rather
  // than if it is undefined because sometimes the value shows up as null.
  // Testing that theory here.
  static _migrateSkill(itemData, updateData) {
    LOGGER.trace("_migrateSkill | 0-base Migration");

    if (typeof itemData.data.skillmod !== "number") {
      updateData["data.skillmod"] = 0;
    }

    return updateData;
  }

  static _migrateNetArchitecture(itemData, updateData) {
    LOGGER.trace("_migrateNetArchitecture | 0-base Migration");

    if (itemData.data.floors.length !== 0) {
      const newfloors = [];
      itemData.data.floors.forEach((floor) => {
        if (!floor.content.startsWith("CPR.netArchitecture.floor.options")) {
          const splitString = floor.content.split(".");
          const editedFloor = duplicate(floor);
          switch (splitString[1]) {
            case "password":
            case "file":
            case "controlnode": {
              editedFloor.content = `CPR.netArchitecture.floor.options.${splitString[1]}`;
              break;
            }
            case "demon":
            case "balron":
            case "efreet":
            case "imp": {
              editedFloor.content = `CPR.netArchitecture.floor.options.demon.${splitString[1]}`;
              break;
            }
            case "blackice": {
              editedFloor.content = "CPR.global.programClass.blackice";
              break;
            }
            default: {
              editedFloor.content = `CPR.netArchitecture.floor.options.blackIce.${splitString[1]}`;
            }
          }
          newfloors.push(editedFloor);
        } else {
          newfloors.push(floor);
        }
      });
      updateData["data.floors"] = newfloors;
    }

    return updateData;
  }

  static async migrateCompendium(pack) {
    LOGGER.trace("migrateCompendium | 0-base Migration");

    const { entity } = pack.metadata;
    if (!["Actor", "Item", "Scene"].includes(entity)) return;
    // Unlock the pack for editing
    const wasLocked = pack.locked;
    await pack.configure({ locked: false });

    // Begin by requesting server-side data model migration and get the migrated content
    await pack.migrate();
    const documents = await pack.getDocuments();

    // Iterate over compendium entries - applying fine-tuned migration functions
    for (const doc of documents) {
      let updateData = {};
      try {
        switch (entity) {
          case "Actor": {
            updateData = BaseMigration.migrateActorData(doc.data, "compendium");
            break;
          }
          case "Item": {
            updateData = BaseMigration.migrateItemData(doc.toObject());
            break;
          }
          default:
        }

        // Save the entry
        await doc.update(updateData);
      } catch (err) {
        err.message = `Failed ${game.system.id} system migration for entity ${doc.name} in pack ${pack.collection}: ${err.message}`;
        this.errors += 1;
        LOGGER.error(err);
      }
    }

    // Apply the original locked status for the pack
    await pack.configure({ locked: wasLocked });
  }

  static migrateSceneData(scene) {
    LOGGER.trace("migrateSceneData | 0-base Migration");

    // Tokens contain an actorData element which is a diff from the original actor
    // and does NOT have all of the data elements of the original actor.  As best
    // as I can tell, token.actor.data is from the original actor with
    // the token.actorData merged to it.
    const tokens = scene.tokens.map((token) => {
      const t = token.toJSON();
      if (!t.actorId || t.actorLink) {
        // If we get here, we have a linked token and don't have
        // to do anything as the link actor was already migrated
        t.actorData = {};
      } else if (!game.actors.has(t.actorId)) {
        // If we get here, the token has an ID and is unlinked, however
        // the original actor that the token was created from was deleted.
        // This makes token.actor null so we don't have a full view of all
        // of the actor data.  I am unsure where the token charactersheet
        // is pulling the data from?  Either way, this is technically a broken
        // token and even Foundry throws errors when you do certain things
        // with this token.
        BaseMigration._migrationLog(
          `WARNING: Token "${t.name}" (${t.actorId}) on Scene "${scene.name}" (${scene._id})` +
            `appears to be missing the source Actor and may cause Foundry issues.`
        );
        t.actorId = null;
        t.actorData = {};
      } else if (!t.actorLink) {
        // If we get here, we have an unlinked token actor, but the original
        // actor still exists.
        const actorData = duplicate(token.actor.data);
        actorData.type = token.actor?.type;

        const updateData = this.migrateTokenActor(token.actor);
        ["items", "effects"].forEach((embeddedName) => {
          if (!updateData[embeddedName]?.length) return;
          const embeddedUpdates = new Map(
            updateData[embeddedName].map((u) => [u._id, u])
          );
          if (t.actorData[embeddedName]) {
            t.actorData[embeddedName].forEach((original) => {
              const updateMerge = embeddedUpdates.get(original._id);
              if (updateMerge) mergeObject(original, updateMerge);
            });
          }
          delete updateData[embeddedName];
        });

        mergeObject(t.actorData, updateData);
      }
      return t;
    });
    return { tokens };
  }

  static _migrationLog(message) {
    // eslint-disable-next-line foundry-cpr/logger-after-function-definition
    LOGGER.log(`CPR MIGRATION | ${message}`);
  }
}
