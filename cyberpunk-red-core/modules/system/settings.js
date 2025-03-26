/* global game */
import CPR from "./config.js";
import CPRCompendiaSettings from "../apps/cpr-compendia-settings.js";
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

/**
 * This file defines user settings for the system module.
 */
const registerSystemSettings = () => {
  /*
   *  Display / User Settings
   */
  game.settings.register(game.system.id, "theme", {
    name: "CPR.settings.theme.title",
    hint: "CPR.settings.theme.hint",
    scope: "client",
    config: true,
    type: String,
    default: "default",
    choices: () => SystemUtils.GetThemes(CPR.themes),
    onChange: (value) => {
      LOGGER.log(`Changed theme to ${value}`);
      SystemUtils.SetTheme();
    },
  });

  game.settings.register(game.system.id, "enablePauseAnimation", {
    name: "CPR.settings.enablePauseAnimation.name",
    hint: "CPR.settings.enablePauseAnimation.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      LOGGER.log(`Changed enablePauseAnimation to ${value}`);
    },
  });

  // Invert CTRL+Click behaviour
  // Default:
  //   Click to roll:      Brings up roll dialogue
  //   Ctrl+Click to roll: Skips roll dialogue
  game.settings.register(game.system.id, "invertRollCtrlFunction", {
    name: "CPR.settings.invertRollCtrlFunction.name",
    hint: "CPR.settings.invertRollCtrlFunction.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      LOGGER.log(`Changed invertRollCtrlFunction to ${value}`);
    },
  });

  /*
   *  Game Settings
   */

  // Select Compendia to use for Criticals/DV/Netarch rolltables
  game.settings.registerMenu(game.system.id, "compendiumSettingsMenu", {
    name: "CPR.settings.compendiumMenu.name",
    label: "CPR.settings.compendiumMenu.button",
    hint: "CPR.settings.compendiumMenu.hint",
    icon: "fa-solid fa-book",
    type: CPRCompendiaSettings,
  });

  // Should Initiative Explode?
  game.settings.register(game.system.id, "criticalInitiative", {
    name: "CPR.settings.criticalInitiative.name",
    hint: "CPR.settings.criticalInitiative.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      LOGGER.log(`Changed criticalInitiative to ${value}`);
    },
  });

  // Prevent Duplicate Critical Injuries
  game.settings.register(game.system.id, "preventDuplicateCriticalInjuries", {
    name: "CPR.settings.preventDuplicateCriticalInjuries.name",
    hint: "CPR.settings.preventDuplicateCriticalInjuries.hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      off: "CPR.settings.preventDuplicateCriticalInjuries.off",
      warn: "CPR.settings.preventDuplicateCriticalInjuries.warn",
      reroll: "CPR.settings.preventDuplicateCriticalInjuries.reroll",
    },
    default: "off",
    onChange: (value) => {
      LOGGER.log(`Changed preventDuplicateCriticalInjuries to ${value}`);
    },
  });

  /*
   *  System settings
   */

  // Can players create their own items?
  game.settings.register(game.system.id, "playersCreateInventory", {
    name: "CPR.settings.playersCreateInventory.name",
    hint: "CPR.settings.playersCreateInventory.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      LOGGER.log(`Changed playersCreateInventory to ${value}`);
    },
  });

  // Show a confirmation prompt before deleting an item from a sheet
  game.settings.register(game.system.id, "deleteItemConfirmation", {
    name: "CPR.settings.deleteConfirmation.name",
    hint: "CPR.settings.deleteConfirmation.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      LOGGER.log(`Changed deleteItemConfirmation to ${value}`);
    },
  });

  // Mook Sheet Skill display method
  // Options:
  //   Level: Points
  //   Base:  Points + STAT
  //   Total: Points + STAT + Mods
  game.settings.register(game.system.id, "mookSheetSkillDisplay", {
    name: "CPR.settings.mookSheetSkillDisplay.name",
    hint: "CPR.settings.mookSheetSkillDisplay.hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      level: "CPR.settings.mookSheetSkillDisplay.level",
      base: "CPR.settings.mookSheetSkillDisplay.base",
      total: "CPR.settings.mookSheetSkillDisplay.total",
    },
    default: "base",
    onChange: (value) => {
      LOGGER.log(`Changed mookSheetSkillDisplay to ${value}`);
    },
  });

  // Display AE icons on Token
  game.settings.register(game.system.id, "displayStatusAsActiveEffects", {
    name: "CPR.settings.displayStatusAsActiveEffects.name",
    hint: "CPR.settings.displayStatusAsActiveEffects.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      LOGGER.log(`Changed displayStatusAsActiveEffects to ${value}`);
    },
  });

  game.settings.register(game.system.id, "userSettings", {
    name: "User Settings",
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  /*
   * Migration Settings
   */

  game.settings.register(game.system.id, "migrateLockedCompendia", {
    name: "CPR.settings.migrateLockedCompendia.name",
    hint: "CPR.settings.migrateLockedCompendia.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      LOGGER.log(`Changed migrateLockedCompendia to ${value}`);
    },
  });

  game.settings.register(game.system.id, "migrateModuleCompendia", {
    name: "CPR.settings.migrateModuleCompendia.name",
    hint: "CPR.settings.migrateModuleCompendia.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      LOGGER.log(`Changed migrateModuleCompendia to ${value}`);
    },
  });

  /*
   *  Dev settings
   */

  game.settings.register(game.system.id, "debugLogs", {
    name: "CPR.settings.debugLogs.name",
    hint: "CPR.settings.debugLogs.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      LOGGER.log(`Changed debugLogs to ${value}`);
    },
  });

  game.settings.register(game.system.id, "debugElements", {
    name: "CPR.settings.debugElements.name",
    hint: "CPR.settings.debugElements.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      LOGGER.log(`Changed debugElements to ${value}`);
    },
  });

  game.settings.register(game.system.id, "traceLogs", {
    name: "CPR.settings.traceLogs.name",
    hint: "CPR.settings.traceLogs.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      LOGGER.log(`Changed traceLogs to ${value}`);
    },
  });

  // Saves the last time a migration to a data model took place
  game.settings.register(game.system.id, "dataModelVersion", {
    name: "CPR.settings.systemDataModelVersion.name",
    hint: "CPR.settings.systemDataModelVersion.hint",
    scope: "world",
    config: true,
    type: String,
    default: "newCprWorld",
    onChange: (value) => {
      LOGGER.log(`Changed dataModelVersion to ${value}`);
    },
  });

  // These 3 settings are in a seperate app called by compendiumSettingsMenu
  // Placed at the bottom as they don't effect the display order
  game.settings.register(game.system.id, "criticalInjuryRollTableCompendium", {
    name: "CPR.settings.criticalInjuryRollTableCompendium.name",
    hint: "CPR.settings.criticalInjuryRollTableCompendium.hint",
    scope: "world",
    config: false,
    type: String,
    default: CPR.defaultCriticalInjuryTable,
    onChange: (value) => {
      LOGGER.log(`Changed criticalInjuryRollTableCompendium to ${value}`);
    },
  });

  game.settings.register(game.system.id, "netArchRollTableCompendium", {
    name: "CPR.settings.netArchRollTableCompendium.name",
    hint: "CPR.settings.netArchRollTableCompendium.hint",
    scope: "world",
    config: false,
    type: String,
    default: CPR.defaultNetArchTable,
    onChange: (value) => {
      LOGGER.log(`Changed netArchRollTableCompendium to ${value}`);
    },
  });

  game.settings.register(game.system.id, "dvRollTableCompendium", {
    name: "CPR.settings.dvRollTableCompendium.name",
    hint: "CPR.settings.dvRollTableCompendium.hint",
    scope: "world",
    config: false,
    type: String,
    default: CPR.defaultDvTable,
    onChange: (value) => {
      LOGGER.log(`Changed dvRollTableCompendium to ${value}`);
    },
  });

  // This is not displayed at all
  // Saves the previous game.system.version so we can check if we were recently updated
  game.settings.register(game.system.id, "systemVersion", {
    name: "System Version",
    scope: "world",
    config: false,
    type: String,
    default: "newCprWorld",
    onChange: (value) => {
      LOGGER.log(`System Version persisted to ${value}`);
    },
  });
};

export default registerSystemSettings;
