/* global Hooks game ui */
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

/**
 * Hooks have a set of args that are passed to them from Foundry. Even if we do not use them here,
 * we document them all for clarity's sake and to make future development/debugging easier.
 */
const tokenHooks = () => {
  /**
   * The preUpdateToken Hook is provided by Foundry and triggered here. When a token is updated, this hook is called
   * just before. This hook is for container tokens being updated. The GM can set a flag that prevents
   * players from moving the container, and we check that here. If a player tries to move a container they're not
   * allowed to, we emit a warning.
   *
   * @public
   * @memberof hookEvents
   * @param {tokenDocument} tokenDocument           The tokenDocument object being updated
   * @param {object} data           A trimmed object with the data being updated
   * @param {object} (unused)       Additional options which modify the update request
   * @param {string} (unused)       The ID of the requesting user, always game.user.id
   */
  Hooks.on("preUpdateToken", (tokenDocument, data) => {
    LOGGER.trace("preUpdateToken | tokenHooks | Called.");
    if (tokenDocument.actor.type === "container" && !game.user.isGM) {
      // Defined x and/or y properties indicate the token is attempting to move to a new coordinate location.
      // this indicates a moved token, so we check the permissions.
      if (typeof data.x !== "undefined" || typeof data.y !== "undefined") {
        if (
          typeof tokenDocument.actor.getFlag(game.system.id, "players-move") ===
          "undefined"
        ) {
          SystemUtils.DisplayMessage(
            "warn",
            SystemUtils.Localize("CPR.messages.insufficientPermissions")
          );
          return false;
        }
      }
    }
    return true;
  });

  /**
   * The deleteToken Hook is provided by Foundry and triggered here. When a token is deleted, this hook is called
   * just before. This hook is for unlinked  tokens being deleted.  If you have a sheet open for an unlinked token
   * and you delete the token, the data in the sheet is essentially orphaned as it lost the source of the data.
   * This causes foundry to throw an error.
   *
   * @public
   * @memberof hookEvents
   * @param {TokenDocument} tokenDocument  The token object being deleted
   * @param {object} (unused)              Additional options passed by Foundry which modify the delete request
   * @param {string} (unused)              The ID of the requesting user, always game.user.id
   */
  Hooks.on("deleteToken", (tokenDocument) => {
    LOGGER.trace("deleteToken | tokenHooks | Called.");
    if (!tokenDocument.isLinked) {
      const tokenId = tokenDocument.id;
      const actorId = tokenDocument.actor.id;
      const currentWindows = Object.values(ui.windows);
      currentWindows.forEach((window) => {
        if (window.id === `actor-${actorId}-${tokenId}`) {
          window.close();
        }
      });
    }
  });

  /**
   * The createToken Hook is provided by Foundry and triggered here. When a token is created, this hook is called
   * just after. This hook is for unlinked tokens being created.  When an unlinked token is created, the actor data
   * becomes a synthetic actor and only differential data is stored to the token. With the Universal Install system,
   * without this hook, all installed items and items that have installed items would have references back to the
   * original actor that was used to create this token.  This hook updates all owned items which have references to
   * other owned items.
   *
   * Note: When this hook is called, it is called for all users, players included. You can avoid this by checking if
   * tokenDocument.isOwner.
   *
   * @public
   * @memberof hookEvents
   * @param {TokenDocument} tokenDocument  The token object created
   * @param {object} (unused)              Additional options passed by Foundry which modify the create request
   * @param {string} (unused)              The ID of the requesting user, always game.user.id
   */
  Hooks.on("createToken", (tokenDocument, options, user) => {
    LOGGER.trace("createToken | tokenHooks | Called.");
    const installableActors = ["mook", "character"]; // Define actors that can have items 'installed' into them.
    if (
      !tokenDocument.isLinked &&
      tokenDocument.isOwner && // Only fire if the user owns the token being created. preventing permissions errors.
      installableActors.includes(tokenDocument.actor.type) // Only fire for actors that can have installed items.
    ) {
      // Update items installed in the actor
      const actorInstallList = [];
      const updateList = [];
      for (const oldUuid of tokenDocument.actor.system.installedItems.list) {
        const itemId = oldUuid.split(".").pop();
        const item = tokenDocument.actor.getOwnedItem(itemId);
        actorInstallList.push(item.uuid);
        updateList.push({
          _id: item._id,
          "system.installedIn": tokenDocument.uuid,
        });
      }
      tokenDocument.actor.update({
        "system.installedItems.list": actorInstallList,
      });

      const installableTypes = SystemUtils.GetTemplateItemTypes("installable");
      const containerTypes = SystemUtils.GetTemplateItemTypes("container");
      const upgradableTypes = SystemUtils.GetTemplateItemTypes("upgradable");
      const loadableTypes = SystemUtils.GetTemplateItemTypes("loadable");

      const ownedItems = tokenDocument.actor.items.filter((i) => {
        if (
          containerTypes.includes(i.type) &&
          i.system.installedItems.list.length > 0
        )
          return true;
        if (installableTypes.includes(i.type) && i.system.isInstalled)
          return true;
        if (
          loadableTypes.includes(i.type) &&
          i.system.magazine.ammoData.uuid !== ""
        )
          return true;
        return false;
      });

      for (const item of ownedItems) {
        const itemUpdates = {
          _id: item._id,
          system: {},
        };

        if (containerTypes.includes(item.type)) {
          itemUpdates.system.installedItems = { list: [] };
          for (const oldUuid of item.system.installedItems.list) {
            const itemId = oldUuid.split(".").pop();
            const installedItem = tokenDocument.actor.getOwnedItem(itemId);
            itemUpdates.system.installedItems.list.push(installedItem.uuid);
          }
        }

        if (installableTypes.includes(item.type)) {
          const installedInId = item.system.installedIn.split(".").pop();
          const installedInItem =
            tokenDocument.actor.getOwnedItem(installedInId);
          if (installedInItem) {
            itemUpdates.system.installedIn = installedInItem.uuid;
          }
        }

        if (upgradableTypes.includes(item.type)) {
          const newUpgrades = [];
          for (const upgradeData of item.system.upgrades) {
            const upgradeId = upgradeData.uuid.split(".").pop();
            const upgradeItem = tokenDocument.actor.getOwnedItem(upgradeId);
            if (upgradeItem) {
              upgradeData.uuid = upgradeItem.uuid;
            }
            newUpgrades.push(upgradeData);
          }
          itemUpdates.system.upgrades = newUpgrades;
        }

        if (loadableTypes.includes(item.type)) {
          const ammoId = item.system.magazine.ammoData.uuid.split(".").pop();
          const ammoItem = tokenDocument.actor.getOwnedItem(ammoId);
          if (ammoItem) {
            itemUpdates.system.magazine = { ammoData: { name: "", uuid: "" } };
            itemUpdates.system.magazine.ammoData = {
              name: ammoItem.name,
              uuid: ammoItem.uuid,
            };
          }
        }

        if (
          item.type === "cyberdeck" &&
          item.system.programs.installed.length > 0
        ) {
          const oldPrograms = item.system.programs;
          const newPrograms = {
            installed: [],
            rezzed: [],
          };

          for (const programData of oldPrograms.installed) {
            const programId = programData.uuid.split(".").pop();
            const programItem = tokenDocument.actor.getOwnedItem(programId);
            if (programItem) {
              programData.uuid = programItem.uuid;
              programData._id = programItem._id;
            }
            newPrograms.installed.push(programData);
          }

          for (const programData of oldPrograms.rezzed) {
            const programId = programData.uuid.split(".").pop();
            const programItem = tokenDocument.actor.getOwnedItem(programId);
            if (programItem) {
              programData.uuid = programItem.uuid;
              programData._id = programItem._id;
            }
            newPrograms.rezzed.push(programData);
          }
          itemUpdates.system.programs = newPrograms;
        }

        if (Object.keys(itemUpdates.system).length > 0) {
          updateList.push(itemUpdates);
        }
      }
      tokenDocument.actor.updateEmbeddedDocuments("Item", updateList, {});
    }
  });
};

export default tokenHooks;
