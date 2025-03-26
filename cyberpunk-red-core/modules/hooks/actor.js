/* global Hooks game */
import CPRMacros from "../utils/cpr-macros.js";
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

/**
 * Hooks have a set of args that are passed to them from Foundry. Even if we do not use them here,
 * we document them all for clarity's sake and to make future development/debugging easier.
 *
 * Hooks are documented here: https://foundryvtt.com/api/modules/hookEvents.html
 */
const actorHooks = () => {
  /**
   * The preCreateActor Hook is provided by Foundry and triggered here. When an Actor is created, this hook is called just
   * prior to creation. In here, we inject a default portrait (icon) for the actor.
   *
   * @public
   * @memberof hookEvents
   * @param {Document} doc          The pending Actor document which is requested for creation
   * @param {object} createData     The initial data object provided to the document creation request
   * @param {object} (unused)       Additional options which modify the creation request
   * @param {string} (unused)       The ID of the requesting user, always game.user.id
   */
  Hooks.on("preCreateActor", (doc, createData) => {
    LOGGER.trace("preCreateActor | actorHooks | Called.");
    if (typeof createData.img === "undefined") {
      const actorImage = SystemUtils.GetDefaultImage("Actor", createData.type);
      doc.updateSource({
        img: actorImage,
        "prototypeToken.texture.src": actorImage,
      });
    }
  });

  /**
   * The preUpdateActor Hook is provided by Foundry and triggered here. When an Actor is updated, this hook is called just
   * prior to update. This hook has 3 purposes.
   *
   * 1. Check the role stats and issue a warning if points are not allocated per rules
   * 2. If the corresponding token for the actor is displaying a resource bar for armor SP, update it to use newly equipped
   *    armor items when the equipment changes.
   * 3. If the actor being updated is Black-ICE, reflect those changes on the owned items too.
   *
   * @public
   * @memberof hookEvents
   * @param {CPRCharacterActor} actor     The pending document which is requested for creation
   * @param {object} updatedData          The changed data object provided to the document creation request
   * @param {object} (unused)             Additional options which modify the creation request
   * @param {string} (unused)               The ID of the requesting user, always game.user.id
   */
  Hooks.on("preUpdateActor", (doc, updatedData) => {
    LOGGER.trace("preUpdateActor | actorHooks | Called.");
    if (updatedData.system && updatedData.system.externalData) {
      Object.keys(updatedData.system.externalData).forEach((itemType) => {
        if (!updatedData.system.externalData[itemType].id) {
          const itemId = doc.system.externalData[itemType].id;
          const item = doc.getOwnedItem(itemId);
          const currentValue = updatedData.system.externalData[itemType].value;
          if (item) {
            switch (item.type) {
              case "armor": {
                if (itemType === "currentArmorBody") {
                  const armorList = doc.getEquippedArmors("body");
                  const updateList = [];
                  const diff =
                    item.system.bodyLocation.sp -
                    item.system.bodyLocation.ablation -
                    currentValue;
                  armorList.forEach((a) => {
                    const armorData = a.system;
                    if (diff > 0) {
                      armorData.bodyLocation.ablation = Math.min(
                        armorData.bodyLocation.ablation + diff,
                        armorData.bodyLocation.sp
                      );
                    }
                    if (diff < 0 && item._id === a._id) {
                      armorData.bodyLocation.ablation = Math.max(
                        armorData.bodyLocation.ablation + diff,
                        0
                      );
                    }
                    updateList.push({ _id: a.id, system: armorData });
                  });
                  doc.updateEmbeddedDocuments("Item", updateList);
                }
                if (itemType === "currentArmorHead") {
                  const armorList = doc.getEquippedArmors("head");
                  const updateList = [];
                  const diff =
                    item.system.headLocation.sp -
                    item.system.headLocation.ablation -
                    currentValue;
                  armorList.forEach((a) => {
                    const armorData = a.system;
                    if (diff > 0) {
                      armorData.headLocation.ablation = Math.min(
                        armorData.headLocation.ablation + diff,
                        armorData.headLocation.sp
                      );
                    }
                    if (diff < 0 && item._id === a._id) {
                      armorData.headLocation.ablation = Math.max(
                        armorData.headLocation.ablation + diff,
                        0
                      );
                    }
                    updateList.push({ _id: a.id, system: armorData });
                  });
                  doc.updateEmbeddedDocuments("Item", updateList);
                }
                if (itemType === "currentArmorShield") {
                  item.system.shieldHitPoints.value = currentValue;
                  doc.updateEmbeddedDocuments("Item", [
                    { _id: item.id, system: item.system },
                  ]);
                }
                break;
              }
              default:
            }
          }
        }
      });
    }

    if (
      doc.type === "blackIce" &&
      doc.isToken &&
      updatedData.system &&
      updatedData.system.stats
    ) {
      const biToken = doc.token;

      const netrunnerTokenId = biToken.getFlag(
        game.system.id,
        "netrunnerTokenId"
      );
      const cyberdeckId = biToken.getFlag(game.system.id, "sourceCyberdeckId");
      const programUUID = biToken.getFlag(game.system.id, "programUUID");
      const sceneId = biToken.getFlag(game.system.id, "sceneId");
      const sceneList = game.scenes.filter((s) => s.id === sceneId);
      if (sceneList.length === 1) {
        const scene = sceneList[0];
        const tokenList = scene.tokens.filter((t) => t.id === netrunnerTokenId);
        if (tokenList.length === 1) {
          const netrunnerToken = tokenList[0];
          const netrunner = netrunnerToken.actor;
          const cyberdeck = netrunner.getOwnedItem(cyberdeckId);
          cyberdeck.updateRezzedProgram(programUUID, updatedData.system.stats);
          netrunner.updateEmbeddedDocuments("Item", [
            { _id: cyberdeck.id, system: cyberdeck.system },
          ]);
        }
      }
    }

    if (
      updatedData.system &&
      updatedData.system.stats &&
      (updatedData.system.stats.emp || updatedData.system.stats.luck)
    ) {
      const updatedValue = updatedData.system.stats.emp
        ? updatedData.system.stats.emp.value
        : updatedData.system.stats.luck.value;
      const updatedMax = updatedData.system.stats.emp
        ? updatedData.system.stats.emp.max
        : updatedData.system.stats.luck.max;
      if (updatedValue && Number(updatedValue) > 99) {
        SystemUtils.DisplayMessage(
          "warn",
          SystemUtils.Localize("CPR.messages.tripleDigitStatValueWarn")
        );
      }
      if (updatedMax && Number(updatedMax) > 99) {
        SystemUtils.DisplayMessage(
          "warn",
          SystemUtils.Localize("CPR.messages.tripleDigitStatMaxWarn")
        );
      }
    }
  });
};

export default actorHooks;
