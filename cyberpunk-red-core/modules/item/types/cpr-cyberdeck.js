/* global duplicate game randomID Actor Scene canvas fromUuidSync */

import CPR from "../../system/config.js";
import CPRItem from "../cpr-item.js";
import * as CPRRolls from "../../rolls/cpr-rolls.js";
import LOGGER from "../../utils/cpr-logger.js";
import SystemUtils from "../../utils/cpr-systemUtils.js";
import CPRMod from "../../rolls/cpr-modifiers.js";

/**
 * Extend the base CPRItem object with things specific to cyberdecks.
 * @extends {CPRItem}
 */
export default class CPRCyberdeckItem extends CPRItem {
  /**
   * Cyberdeck Code
   *
   * The methods below apply to the CPRItem.type = "cyberdeck"
   */

  async syncPrograms() {
    LOGGER.trace("syncPrograms | CPRCyberdeckItem | Called.");

    const actor = this.isOwned ? this.actor : false;

    /*
    if (!actor) {
      return Promise.reject(new Error("Can not install upgrades in unowned objects."));
    }
    */

    const installedItems = duplicate(this.system.installedItems);

    const uninstallList = [];
    for (const program of this.system.programs.installed) {
      if (!installedItems.list.includes(program.uuid)) {
        const item = !actor
          ? fromUuidSync(program.uuid)
          : actor.getOwnedItem(program.uuid);
        if (item) {
          uninstallList.push(item);
        } else {
          uninstallList.push({ uuid: program.uuid, system: program });
        }
      }
    }

    const installList = [];
    for (const uuid of installedItems.list) {
      const item = !actor ? fromUuidSync(uuid) : actor.getOwnedItem(uuid);
      if (item && item.type === "program") {
        if (
          this.system.programs.installed.filter((p) => p.uuid === uuid)
            .length === 0
        ) {
          installList.push(item);
        }
      }
    }
    if (uninstallList.length > 0) {
      await this.uninstallPrograms(uninstallList);
    }

    if (installList.length > 0) {
      await this.installPrograms(installList);
    }

    const allUpdates = installList.concat(uninstallList);
    const updateList = [];
    for (const item of allUpdates) {
      if (typeof item._id !== "undefined") {
        updateList.push({ _id: item._id, system: item.system });
      }
    }
    updateList.push({ _id: this._id, system: this.system });
    return !actor
      ? this.update({ system: this.system })
      : actor.updateEmbeddedDocuments("Item", updateList);
  }

  /**
   * Returns a list of installed programs.  This is a list of ItemData as the
   * Item itself is not stored because Items can't own Items. As such, if you
   * are looking for a specific program, each Array entry has a entry._id of
   * the Object it represents.
   *
   * @public
   */
  getInstalledPrograms() {
    LOGGER.trace("getInstalledPrograms | CPRCyberdeckItem | Called.");
    return this.system.programs.installed;
  }

  /**
   * Returns a list of rezzed programs.  This is a list of ItemData as the
   * Item itself is not stored because Items can't own Items. As such, if you
   * are looking for a specific program, each Array entry has a entry._id of
   * the Object it represents.
   *
   * @public
   */
  getRezzedPrograms() {
    LOGGER.trace("getRezzedPrograms | CPRCyberdeckItem | Called.");
    return this.system.programs.rezzed;
  }

  /**
   * Install programs from the Cyberdeck
   *
   * @public
   * @param {Array} programs      - Array of CPRItem programs
   */
  installPrograms(programs) {
    LOGGER.trace("installPrograms | CPRCyberdeckItem | Called.");
    const { installed } = this.system.programs;
    programs.forEach((p) => {
      const onDeck = installed.filter((iProgram) => iProgram.uuid === p.uuid);
      if (onDeck.length === 0) {
        const programInstallation = duplicate(p.system);
        programInstallation.isRezzed = false;
        programInstallation.uuid = p.uuid;
        programInstallation.name = p.name;
        programInstallation.flags = p.flags;
        installed.push(programInstallation);
        if (p.isOwned) {
          p.setInstalled();
        }
      }
    });
    this.system.programs.installed = installed;
  }

  /**
   * Uninstall programs from the Cyberdeck
   *
   * @public
   * @param {Array} programs      - Array of CPRItem programs
   */
  uninstallPrograms(programs) {
    LOGGER.trace("uninstallPrograms | CPRCyberdeckItem | Called.");
    let { rezzed } = this.system.programs;
    let { installed } = this.system.programs;
    const tokenList = [];
    let sceneId;
    programs.forEach(async (program) => {
      if (program.system.class === "blackice" && this.isRezzed(program)) {
        const rezzedIndex = this.system.programs.rezzed.findIndex(
          (p) => p.uuid === program.uuid
        );
        const programData = this.system.programs.rezzed[rezzedIndex];
        const cprFlags = programData.flags[game.system.id];
        if (cprFlags.biTokenId) {
          tokenList.push(cprFlags.biTokenId);
        }
        if (cprFlags.sceneId) {
          sceneId = cprFlags.sceneId;
        }
      }
      installed = installed.filter((p) => p.uuid !== program.uuid);
      rezzed = rezzed.filter((p) => p.uuid !== program.uuid);
    });
    this.system.programs.installed = installed;
    this.system.programs.rezzed = rezzed;

    if (tokenList.length > 0 && sceneId) {
      const sceneList = game.scenes.filter((s) => s.id === sceneId);
      if (sceneList.length === 1) {
        const [scene] = sceneList;
        return scene.deleteEmbeddedDocuments("Token", tokenList);
      }
    }
    return null;
  }

  /**
   * Return true/false if the program is Rezzed
   *
   * @public
   * @param {CPRItem} program      - CPRItem of the program to check
   */
  isRezzed(program) {
    LOGGER.trace("isRezzed | CPRCyberdeckItem | Called.");
    const rezzedPrograms = this.system.programs.rezzed.filter(
      (p) => p.uuid === program.uuid
    );
    const { installed } = this.system.programs;
    const installIndex = installed.findIndex((p) => p.uuid === program.uuid);
    const programState = installed[installIndex];
    programState.isRezzed = rezzedPrograms.length > 0;
    installed[installIndex] = programState;
    this.system.programs.installed = installed;
    // Passed by reference
    // eslint-disable-next-line no-param-reassign
    program.isRezzed = rezzedPrograms.length > 0;
    return rezzedPrograms.length > 0;
  }

  /**
   * Rez a program by setting the isRezzed boolean on the program to true
   * and push the program onto the rezzed array of the Cyberdeck
   *
   * @public
   * @param {CPRItem} program      - CPRItem of the program to REZ
   */
  async rezProgram(program, callingToken) {
    LOGGER.trace("rezProgram | CPRCyberdeckItem | Called.");
    const programData = duplicate(program.system);
    const { installed } = this.system.programs;
    const installIndex = installed.findIndex((p) => p.uuid === program.uuid);
    const programState = installed[installIndex];

    // This instance ID is being added pro-actively because the rulebook
    // is a bit fuzzy on the bottom of Page 201 with regards to rezzing the
    // same program multiple times.  The rulebook says:
    // "You can run multiple copies of the same Program on your Cyberdeck"
    // however when I asked on the Discord, I was told you can not do this,
    // you have to install a program twice on the Cyberdeck if you want to
    // rez it twice.  So the code here supports what was told to me in Discord.
    // If it ever comes back that a single install of a program can be run
    // multiple times, we will already have a an instance ID to differentiate
    // the different rezzes.
    const rezzedInstance = randomID();
    program.setRezzed(rezzedInstance);
    programState.isRezzed = true;
    programState.flags = duplicate(program.flags);
    installed[installIndex] = programState;
    if (programData.class === "blackice") {
      await this._rezBlackIceToken(programState, callingToken);
    }
    this.system.programs.installed = installed;
    this.system.programs.rezzed.push(programState);
  }

  /**
   * Create a roll object appropriate for rolling for programs located on a cyberdeck.
   *
   * @param {CPRCharacterActor} actor - the actor associated with this cyberdeck item
   * @param {Object} extraData - more roll configuration data
   * @returns {CPRRoll}
   */
  _createCyberdeckRoll(actor, extraData = {}) {
    LOGGER.trace("_createCyberdeckRoll | CPRCyberdeckItem | Called.");
    let cprRoll;
    const { programUUID } = extraData;
    const program = this.getInstalledPrograms().find(
      (iProgram) => iProgram.uuid === programUUID
    );
    if (!program) {
      LOGGER.error(
        `_createCyberdeckRoll | CPRCyberdeckItem | Unable to locate program ${programUUID}.`
      );
      return CPRRolls.CPRRoll("Unknown Program", "1d10");
    }

    const roleName = extraData.netRoleItem.system.mainRoleAbility;
    const roleValue = Number.parseInt(extraData.netRoleItem.system.rank, 10);
    const pgmName = program.name;
    const { executionType } = extraData;
    const statValue = program[executionType];
    const statName = SystemUtils.Localize(
      `CPR.global.blackIce.stats.${executionType}`
    );

    const damageFormula = program.damage.standard;
    // Attack and defense rolls from programs are treated as Interface Rolls.
    // Damage rolls from programs are treated as normal Damage Rolls.
    switch (executionType) {
      case "atk": {
        cprRoll = new CPRRolls.CPRInterfaceRoll(
          "attack",
          roleName,
          roleValue,
          statName,
          statValue
        );
        cprRoll.rollCardExtraArgs.program = program;
        cprRoll.rollCardExtraArgs.cyberdeck = this;
        cprRoll.ability = "attack";
        cprRoll.setProgramRollCard();
        break;
      }
      case "def": {
        cprRoll = new CPRRolls.CPRInterfaceRoll(
          "defense",
          roleName,
          roleValue,
          statName,
          statValue
        );
        cprRoll.ability = "defense";
        break;
      }
      case "damage": {
        cprRoll = new CPRRolls.CPRDamageRoll(pgmName, damageFormula, "program");
        cprRoll.rollCardExtraArgs.program = program;
        cprRoll.setNetCombat(pgmName);
        break;
      }
      default:
        break;
    }
    cprRoll.rollTitle = pgmName;

    const effects = Array.from(actor.allApplicableEffects()); // Active effects on the actor.
    const allMods = CPRMod.getAllModifiers(effects); // Effects list converted into CPRMods.
    // Filter for mods that should always be on (not situational) or are situational but on by default.
    const filteredMods = allMods.filter(
      (m) => !m.isSituational || (m.isSituational && m.onByDefault)
    );

    const damageMods = CPRMod.getRelevantMods(filteredMods, "universalDamage");

    const netrunnerMods = CPRMod.getRelevantMods(filteredMods, cprRoll.ability);
    const roleMods = CPRMod.getRelevantMods(
      filteredMods,
      SystemUtils.slugify(roleName)
    );

    // Mods that affect all actions.
    const allActionsMods = CPRMod.getRelevantMods(filteredMods, [
      "allActions",
      "allActionsSpeech",
      "allActionsHands",
    ]);

    // Bonuses from roles, active effects, and wound state should not modify damage rolls.
    if (executionType === "damage") {
      cprRoll.addMod(damageMods);
    } else {
      cprRoll.addMod(netrunnerMods);
      cprRoll.addMod(roleMods);
      cprRoll.addMod(allActionsMods);
      cprRoll.addMod([
        {
          value: actor.getWoundStateMods(),
          source: SystemUtils.Localize(
            "CPR.rolls.modifiers.sources.woundStatePenalty"
          ),
        },
      ]);
    }
    return cprRoll;
  }

  /**
   * Create a roll object appropriate for rolling Interface actions.
   *
   * @param {CPRCharacterActor} actor - the actor associated with this cyberdeck item
   * @param {Object} rollInfo - more roll configuration data
   * @returns {CPRRoll}
   */
  _createInterfaceRoll(actor, rollInfo) {
    LOGGER.trace("_createInterfaceRoll | CPRCyberdeckItem | Called.");
    let rollTitle;
    const roleName = rollInfo.netRoleItem.system.mainRoleAbility;
    const roleValue = Number.parseInt(rollInfo.netRoleItem.system.rank, 10);
    const interfaceAbility =
      rollInfo.interfaceAbility === "perception"
        ? "perception_net"
        : rollInfo.interfaceAbility;
    let rollType = "action";
    switch (interfaceAbility) {
      case "speed": {
        rollTitle = SystemUtils.Localize("CPR.global.generic.speed");
        break;
      }
      case "defense": {
        rollTitle = SystemUtils.Localize("CPR.global.generic.defense");
        break;
      }
      default: {
        rollTitle = SystemUtils.Localize(
          CPR.interfaceAbilities[interfaceAbility]
        );
      }
    }
    // Declare the roll;
    let cprRoll;

    // If interfaceAbiltiy is Zap, we will handle roll either as a Damage Roll or an Attack Roll.
    // If interfaceAbility is anything else, we will handle roll as as an Interface Roll.
    if (rollInfo.executionType === "damage") {
      const zap = SystemUtils.Localize(
        "CPR.global.role.netrunner.interfaceAbility.zap"
      );
      cprRoll = new CPRRolls.CPRDamageRoll(zap, "1d6", "program");
      cprRoll.setNetCombat(zap);
    } else {
      if (interfaceAbility === "zap") rollType = "attack";
      cprRoll = new CPRRolls.CPRInterfaceRoll(rollType, roleName, roleValue);
      cprRoll.ability = interfaceAbility;
      cprRoll.rollCardExtraArgs.cyberdeck = this;
    }

    // Set the roll title to the name of the interface action.
    cprRoll.rollTitle = rollTitle;

    // Figure out all applicable modifiers.
    const effects = Array.from(actor.allApplicableEffects()); // Active effects on the actor.
    const allMods = CPRMod.getAllModifiers(effects); // Effects list converted into CPRMods.
    // Filter for mods that should always be on (not situational) or are situational but on by default.
    const filteredMods = allMods.filter(
      (m) => !m.isSituational || (m.isSituational && m.onByDefault)
    );

    const damageMods = CPRMod.getRelevantMods(filteredMods, "universalDamage");
    const netrunnerMods = CPRMod.getRelevantMods(
      filteredMods,
      interfaceAbility
    );
    const roleMods = CPRMod.getRelevantMods(
      filteredMods,
      SystemUtils.slugify(roleName)
    );

    // Mods that affect all actions.
    const allActionsMods = CPRMod.getRelevantMods(filteredMods, [
      "allActions",
      "allActionsSpeech",
      "allActionsHands",
    ]);

    // Bonuses from roles, active effects, and wound state should not modify damage rolls.
    if (rollInfo.executionType === "damage") {
      cprRoll.addMod(damageMods);
    } else {
      cprRoll.addMod(netrunnerMods);
      cprRoll.addMod(roleMods);
      cprRoll.addMod(allActionsMods);
      cprRoll.addMod([
        {
          value: actor.getWoundStateMods(),
          source: SystemUtils.Localize(
            "CPR.rolls.modifiers.sources.woundStatePenalty"
          ),
        },
      ]);
    }
    return cprRoll;
  }

  /**
   * Create a Black ICE Token on the active scene as it was just rezzed
   *
   * @private
   * @param {CPRItem} program      - CPRItem of the program create the Token for
   */
  async _rezBlackIceToken(programData, callingToken) {
    LOGGER.trace("_rezBlackIceToken | CPRCyberdeckItem | Called.");
    let netrunnerToken = callingToken;
    let scene;
    const blackIceName = programData.name;

    if (!netrunnerToken && this.actor.isToken) {
      netrunnerToken = this.actor.token;
    }

    if (!netrunnerToken) {
      // Search for a token associated with this Actor ID.
      const tokenList = game.scenes
        .map((tokenDoc) =>
          tokenDoc.tokens.filter((t) => t.id === this.actor.id)
        )
        .filter((s) => s.length > 0);
      if (tokenList.length === 1) {
        [netrunnerToken] = tokenList;
      } else {
        LOGGER.error(
          `Attempting to create a Black ICE Token failed because we were unable to find a Token associated with World Actor "${this.actor.name}".`
        );
        SystemUtils.DisplayMessage(
          "error",
          SystemUtils.Localize("CPR.messages.rezBlackIceWithoutToken")
        );
        return;
      }
    }

    if (netrunnerToken.isEmbedded && netrunnerToken.parent instanceof Scene) {
      scene = netrunnerToken.parent;
    } else {
      LOGGER.error(
        `_rezBlackIceToken | CPRItem | Attempting to create a Black ICE Token failed because the token does not appear to be part of a scene.`
      );
      SystemUtils.DisplayMessage(
        "error",
        SystemUtils.Localize("CPR.rezbiwithoutscene")
      );
      return;
    }

    // First, let's see if an Actor exists that is a blackIce Actor with the same name, if so, we will use that
    // to model the token Actor Data.
    const blackIceActors = game.actors.filter(
      (bi) => bi.type === "blackIce" && bi.name === blackIceName
    );
    let blackIce;
    if (blackIceActors.length === 0) {
      try {
        // We didn't find a blackIce Actor with a matching name so we need to create one dynamically.
        // We will keep all auto-generated Actors in a Folder called CPR Autogenerated to ensure the Actors
        // list of the user stays clean.
        const dynamicFolderName = "CPR Autogenerated";
        const dynamicFolder = await SystemUtils.GetFolder(
          "Actor",
          dynamicFolderName
        );
        // Create a new Black ICE Actor
        blackIce = await Actor.create({
          name: blackIceName,
          type: "blackIce",
          folder: dynamicFolder,
          img: `systems/${game.system.id}/icons/netrunning/Black_Ice.png`,
        });
        // Configure the Actor based on the Black ICE Program Stats.
        blackIce.programmaticallyUpdate(
          programData.blackIceType,
          programData.per,
          programData.spd,
          programData.atk,
          programData.def,
          programData.rez,
          programData.description.value
        );
      } catch (error) {
        LOGGER.error(
          `_rezBlackIceToken | CPRItem | Attempting to create a Black ICE Actor failed. Error: ${error}`
        );
        return;
      }
    } else {
      // We found a matching Actor so we will use that to model our Token Data
      [blackIce] = blackIceActors;
    }

    const tokenFlags = {
      netrunnerTokenId: netrunnerToken.id,
      sourceCyberdeckId: this.id,
      programUUID: programData.uuid,
      sceneId: scene.id,
    };
    const tokenData = [
      {
        name: blackIce.name,
        actorId: blackIce._id,
        actorData: blackIce.system,
        actorLink: false,
        img: blackIce.img,
        x: netrunnerToken.x + 75,
        y: netrunnerToken.y,
        flags: { [game.system.id]: tokenFlags },
      },
    ];
    try {
      const biTokenList = await scene.createEmbeddedDocuments(
        "Token",
        tokenData
      );
      const biToken = biTokenList.length > 0 ? biTokenList[0] : null;
      if (biToken !== null) {
        // Update the Token Actor based on the Black ICE Program Stats, leaving any effect description in place.
        biToken.actor.programmaticallyUpdate(
          programData.blackIceType,
          programData.per,
          programData.spd,
          programData.atk,
          programData.def,
          programData.rez,
          programData.description.value
        );
        const cprFlags =
          typeof programData.flags[game.system.id] !== "undefined"
            ? programData.flags[game.system.id]
            : {};
        cprFlags.biTokenId = biToken.id;
        cprFlags.sceneId = scene.id;
        // Passed by reference
        // eslint-disable-next-line no-param-reassign
        programData.flags[game.system.id] = cprFlags;
      }
    } catch (error) {
      LOGGER.error(
        `_rezBlackIceToken | CPRItem | Attempting to create a Black ICE Token failed. Error: ${error}`
      );
    }
  }

  /**
   * Remove a program from the rezzed list on the Cyberdeck
   *
   * @public
   * @param {CPRItem} program      - CPRItem of the program de-rez
   */
  async derezProgram(program) {
    LOGGER.trace("derezProgram | CPRCyberdeckItem | Called.");
    const { rezzed } = this.system.programs;
    const rezzedIndex = rezzed.findIndex((p) => p.uuid === program.uuid);
    const { installed } = this.system.programs;
    const installIndex = installed.findIndex((p) => p.uuid === program.uuid);
    const programState = installIndex >= 0 ? installed[installIndex] : null;
    const programData = rezzedIndex >= 0 ? rezzed[rezzedIndex] : null;
    program.unsetRezzed();
    if (programState !== null) {
      programState.isRezzed = false;
      installed[installIndex] = programState;
    }
    if (program.system.class === "blackice") {
      await CPRCyberdeckItem._derezBlackIceToken(programData);
    }
    const newRezzed = this.system.programs.rezzed.filter(
      (p) => p.uuid !== program.uuid
    );
    this.system.programs.rezzed = newRezzed;
  }

  /**
   * Remove a Black ICE Token from the game as it is de-rezzed
   *
   * @private
   * @param {CPRItem} program      - CPRItem of the program to remove the token for
   */
  static async _derezBlackIceToken(programData) {
    LOGGER.trace("_derezBlackIceToken | CPRCyberdeckItem | Called.");
    if (typeof programData.flags[game.system.id] !== "undefined") {
      const cprFlags = programData.flags[game.system.id];
      const { biTokenId } = cprFlags;
      const { sceneId } = cprFlags;
      if (typeof biTokenId !== "undefined" && typeof sceneId !== "undefined") {
        const sceneList = game.scenes.filter((s) => s.id === sceneId);
        if (sceneList.length === 1) {
          const [scene] = sceneList;
          const tokenList = scene.tokens.filter((t) => t.id === biTokenId);
          if (tokenList.length === 1) {
            await scene.deleteEmbeddedDocuments("Token", [biTokenId]);
          } else {
            LOGGER.warn(
              `_derezBlackIceToken | CPRItem | Unable to find biTokenId (${biTokenId}) in scene ${Scene.name} (${Scene.id}). May have been already deleted.`
            );
          }
        } else {
          LOGGER.error(
            `_derezBlackIceToken | CPRItem | Unable to locate sceneId ${Scene.id}`
          );
        }
      } else {
        LOGGER.error(
          `_derezBlackIceToken | CPRItem | Unable to retrieve biTokenId and sceneId from programData: ${programData.name} (${programData._id})`
        );
      }
    } else {
      LOGGER.error(
        `_derezBlackIceToken | CPRItem | No flags found in programData.`
      );
    }
  }

  /**
   * Reset a rezzed program numbers to be that of the installed version of the program
   *
   * @public
   * @param {CPRItem} program      - CPRItem of the program to reset
   */
  resetRezProgram(program) {
    LOGGER.trace("resetRezProgram | CPRCyberdeckItem | Called.");
    const { rezzed } = this.system.programs;
    const rezzedIndex = rezzed.findIndex((p) => p._id === program.id);
    const { installed } = this.system.programs;
    const installedIndex = installed.findIndex((p) => p._id === program.id);
    this.system.programs.rezzed[rezzedIndex] =
      this.system.programs.installed[installedIndex];
  }

  /**
   * Reduce the rezzed value of a rezzed program.
   *
   * @public
   * @param {CPRItem} program     - The program to reduce the REZ of
   * @param {Number} reduceAmount - Amount to reduce REZ by. Defaults to 1.
   */
  reduceRezProgram(program, reduceAmount = 1) {
    LOGGER.trace("reduceRezProgram | CPRCyberdeckItem | Called.");
    const { rezzed } = this.system.programs;
    const rezzedIndex = rezzed.findIndex((p) => p.uuid === program.uuid);
    const programState = rezzed[rezzedIndex];
    const newRez = Math.max(programState.rez - reduceAmount, 0);
    programState.rez = newRez;
    this.system.programs.rezzed[rezzedIndex] = programState;
    if (
      programState.class === "blackice" &&
      typeof programState.flags[game.system.id] !== "undefined"
    ) {
      const cprFlags = programState.flags[game.system.id];
      if (typeof cprFlags.biTokenId !== "undefined") {
        const { biTokenId } = cprFlags;
        const tokenList = canvas.scene.tokens
          .map((tokenDoc) => tokenDoc.actor.token)
          .filter((token) => token)
          .filter((t) => t.id === biTokenId);
        if (tokenList.length === 1) {
          const [biToken] = tokenList;
          biToken.actor.programmaticallyUpdate(
            programState.blackIceType,
            programState.per,
            programState.spd,
            programState.atk,
            programState.def,
            programState.rez,
            programState.description.value
          );
        }
      }
    }
  }

  /**
   * Update a rezzed program with updated data
   *
   * @param {String} programUUID - the _id of the program to be updated
   * @param {Object} updatedData - object data of the program to update with
   */
  updateRezzedProgram(programUUID, updatedData) {
    LOGGER.trace("updateRezzedProgram | CPRCyberdeckItem | Called.");
    const { rezzed } = this.system.programs;
    const rezzedIndex = rezzed.findIndex((p) => p.uuid === programUUID);
    const programState = rezzed[rezzedIndex];
    const dataPoints = Object.keys(updatedData);
    dataPoints.forEach((attribute) => {
      switch (attribute) {
        case "per":
        case "spd":
        case "atk":
        case "def": {
          programState[attribute] = updatedData[attribute];
          break;
        }
        case "rez": {
          if (updatedData.rez.value) programState.rez = updatedData.rez.value;
          break;
        }
        default:
      }
    });
  }
}
