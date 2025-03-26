/* eslint-disable max-len */
/* global Actors ActorSheet CONFIG Hooks Items ItemSheet game isNewerVersion DocumentSheetConfig */
// Object imports
import CPRActiveEffect from "./modules/cpr-active-effect.js";
import CPRActiveEffectSheet from "./modules/cpr-active-effect-sheet.js";
import { actorConstructor, itemConstructor } from "./modules/entity-factory.js";
import CPRBlackIceActorSheet from "./modules/actor/sheet/cpr-black-ice-sheet.js";
import CPRCharacterActorSheet from "./modules/actor/sheet/cpr-character-sheet.js";
import CPRContainerActorSheet from "./modules/actor/sheet/cpr-container-sheet.js";
import CPRDemonActorSheet from "./modules/actor/sheet/cpr-demon-sheet.js";
import CPRMookActorSheet from "./modules/actor/sheet/cpr-mook-sheet.js";
import CPRCombat from "./modules/combat/cpr-combat.js";
import CPRCombatant from "./modules/combat/cpr-combatant.js";

import CPRItemSheet from "./modules/item/sheet/cpr-item-sheet.js";
import LOGGER from "./modules/utils/cpr-logger.js";
import CPRMacro from "./modules/utils/cpr-macros.js";
import SystemUtils from "./modules/utils/cpr-systemUtils.js";
import MigrationRunner from "./modules/system/migrate/migration.js";
import CPR from "./modules/system/config.js";

// Function imports
import registerHooks from "./modules/system/hooks.js";
import preloadHandlebarsTemplates from "./modules/system/preload-templates.js";
import registerHandlebarsHelpers from "./modules/system/register-helpers.js";
import overrideRulerFunctions from "./modules/system/overrides.js";

// System settings
import registerSystemSettings from "./modules/system/settings.js";

// This defines the version of the Data Model for this release.  We should
// only update this when the Data Model Changes.
const DATA_MODEL_VERSION = 24;
export default DATA_MODEL_VERSION;

Hooks.once("init", async () => {
  LOGGER.log("THANK YOU TO EVERYONE WHO HELPED!!!!");
  LOGGER.credits();
  // Register Actor Sheet Application Classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(game.system.id, CPRCharacterActorSheet, {
    label: SystemUtils.Localize("CPR.sheets.characterSheet"),
    types: ["character", "mook"],
    makeDefault: true,
  });
  Actors.registerSheet(game.system.id, CPRBlackIceActorSheet, {
    label: SystemUtils.Localize("CPR.sheets.blackiceSheet"),
    types: ["blackIce"],
    makeDefault: true,
  });
  Actors.registerSheet(game.system.id, CPRContainerActorSheet, {
    label: SystemUtils.Localize("CPR.sheets.containerSheet"),
    types: ["container"],
    makeDefault: true,
  });
  Actors.registerSheet(game.system.id, CPRDemonActorSheet, {
    label: SystemUtils.Localize("CPR.sheets.demonSheet"),
    types: ["demon"],
    makeDefault: true,
  });
  Actors.registerSheet(game.system.id, CPRMookActorSheet, {
    label: SystemUtils.Localize("CPR.sheets.mookSheet"),
    types: ["character", "mook"],
  });

  // Register Item Sheet Application Classes
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(game.system.id, CPRItemSheet, {
    types: [
      "ammo",
      "armor",
      "clothing",
      "criticalInjury",
      "cyberdeck",
      "cyberware",
      "drug",
      "gear",
      "itemUpgrade",
      "netarch",
      "program",
      "role",
      "skill",
      "vehicle",
      "weapon",
    ],
    makeDefault: true,
  });

  game.cpr = {
    apps: {
      CPRActiveEffectSheet,
      CPRBlackIceActorSheet,
      CPRCharacterActorSheet,
      CPRContainerActorSheet,
      CPRDemonActorSheet,
      CPRMookActorSheet,
      CPRItemSheet,
    },
    macro: CPRMacro,
  };

  // Assign the actor class to the CONFIG
  CONFIG.ActiveEffect.documentClass = CPRActiveEffect;
  DocumentSheetConfig.registerSheet(
    CPRActiveEffect,
    game.system.id,
    CPRActiveEffectSheet,
    { makeDefault: true }
  );
  CONFIG.Actor.documentClass = actorConstructor;
  CONFIG.Combat.documentClass = CPRCombat;
  CONFIG.Item.documentClass = itemConstructor;
  CONFIG.Combatant.documentClass = CPRCombatant;

  // Turn legacy tranferral for active effects off. Necessary for v11.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Make System fonts available to Foundry
  CONFIG.fontDefinitions.Jost = {
    editor: true,
    fonts: [
      {
        urls: [`systems/${game.system.id}/fonts/Jost-100.ttf`],
        weight: 100,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-200.ttf`],
        weight: 200,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-300.ttf`],
        weight: 300,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-400.ttf`],
        weight: 400,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-500.ttf`],
        weight: 500,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-600.ttf`],
        weight: 600,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-700.ttf`],
        weight: 700,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-800.ttf`],
        weight: 800,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-900.ttf`],
        weight: 900,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-100-italic.ttf`],
        weight: 100,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-200-italic.ttf`],
        weight: 200,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-300-italic.ttf`],
        weight: 300,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-400-italic.ttf`],
        weight: 400,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-500-italic.ttf`],
        weight: 500,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-600-italic.ttf`],
        weight: 600,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-700-italic.ttf`],
        weight: 700,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-800-italic.ttf`],
        weight: 800,
        style: `italic`,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Jost-900-italic.ttf`],
        weight: 900,
        style: `italic`,
      },
    ],
  };

  CONFIG.fontDefinitions.Orbitron = {
    editor: true,
    fonts: [
      {
        urls: [`systems/${game.system.id}/fonts/Orbitron-400.ttf`],
        weight: 400,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Orbitron-500.ttf`],
        weight: 500,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Orbitron-600.ttf`],
        weight: 600,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Orbitron-700.ttf`],
        weight: 700,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Orbitron-800.ttf`],
        weight: 800,
      },
      {
        urls: [`systems/${game.system.id}/fonts/Orbitron-900.ttf`],
        weight: 900,
      },
    ],
  };

  preloadHandlebarsTemplates();
  registerHandlebarsHelpers();
  registerSystemSettings();
  overrideRulerFunctions();
});

/**
 * Perform a system migration if we are using a newer data model.
 * We allow a hidden system setting to be set so that developers can pick any data model
 * version number to migrate from. This is for migration testing purposes.
 *
 * Our data model version scheme used to follow the system module version scheme (x.y.z),
 * but then we moved to integers for maintainability's sake.
 */
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  // Retrofit the old version scheme into the new one. The active effects migration assumes
  // the legacy migration scripts have been run before (i.e. they're on 0.80.0). If that is
  // not the case, we force them to migrate to 0.80.0 before moving to "1".
  let dataModelVersion = game.settings.get(game.system.id, "dataModelVersion")
    ? game.settings.get(game.system.id, "dataModelVersion")
    : "0.0";

  let migrationSuccess = true;
  if (dataModelVersion !== "newCprWorld") {
    LOGGER.debug(`Data model before comparison: ${dataModelVersion}`);
    if (dataModelVersion.toString().indexOf(".") > -1)
      dataModelVersion = isNewerVersion("0.80.0", dataModelVersion) ? -1 : 0;
    LOGGER.debug(`New data model version is: ${dataModelVersion}`);
    const MR = new MigrationRunner();
    // migrateWorld expects to be passed two integer values, returns true on successful migration
    migrationSuccess = await MR.migrateWorld(
      parseInt(dataModelVersion, 10),
      DATA_MODEL_VERSION
    );
    // Ensure load bar is gone
    SystemUtils.fadeMigrationBar();
  }
  if (migrationSuccess) {
    await game.settings.set(
      game.system.id,
      "dataModelVersion",
      DATA_MODEL_VERSION
    );
  } else {
    SystemUtils.DisplayMessage(
      "error",
      SystemUtils.Localize("CPR.migration.status.migrationsFailed")
    );
  }
  if (
    game.system.version !== game.settings.get(game.system.id, "systemVersion")
  ) {
    await game.settings.set(
      game.system.id,
      "systemVersion",
      game.system.version
    );
    // Pop Up the relevant Changelog Journal from
    const changelog = await SystemUtils.GetCompendiumDoc(
      CPR.changelogCompendium,
      `Changelog ${CONFIG.supportedLanguages[game.i18n.lang]}`
    );
    changelog.sheet.render(true);
  }
});

registerHooks();
