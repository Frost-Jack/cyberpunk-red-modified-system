/* global Handlebars game getProperty */
/* eslint-env jquery */
import LOGGER from "../utils/cpr-logger.js";
import CPR from "./config.js";
import SystemUtils from "../utils/cpr-systemUtils.js";
import TextUtils from "../utils/TextUtils.js";
import CPRActiveEffect from "../cpr-active-effect.js";
import CPRMod from "../rolls/cpr-modifiers.js";

export default function registerHandlebarsHelpers() {
  LOGGER.log("Calling Register Handlebars Helpers");

  /**
   * Run a comparison given a stringified operator and 2 operands. Returns true or false.
   */
  Handlebars.registerHelper("cprCompare", (v1, operator, v2) => {
    LOGGER.trace("cprCompare | handlebarsHelper | Called.");

    switch (operator) {
      case "==":
        return v1 == v2; // eslint-disable-line eqeqeq
      case "===":
        return v1 === v2;
      case "!==":
        return v1 !== v2;
      case "<":
        return v1 < v2;
      case "<=":
        return v1 <= v2;
      case ">":
        return v1 > v2;
      case ">=":
        return v1 >= v2;
      case "&&":
        return v1 && v2;
      case "||":
        return v1 || v2;
      default:
        return false;
    }
  });

  /**
   * Get the value of a property on a given object
   */
  Handlebars.registerHelper("cprGetProp", (object, property) => {
    LOGGER.trace("cprGetProp | handlebarsHelper | Called.");
    if (typeof object !== "undefined") {
      if (typeof object.length === "undefined") {
        return getProperty(object, property);
      }
      if (object.length > 0) {
        const returnValues = [];
        object.forEach((obj) => {
          returnValues.push(getProperty(obj, property));
        });
        return returnValues;
      }
    }
    return "";
  });

  /**
   * Return an owned item on an actor given the ID
   */
  Handlebars.registerHelper("cprGetOwnedItem", (actor, itemId) => {
    if (actor === null) {
      return (
        game.items.get(itemId) || game.items.find((i) => i.uuid === itemId)
      );
    }
    return (
      actor.items.find((i) => i.id === itemId) ||
      actor.items.find((i) => i.uuid === itemId)
    );
  });

  /**
   * Return true if an object is defined or not
   */
  Handlebars.registerHelper("cprIsDefined", (object) => {
    LOGGER.trace("cprIsDefined | handlebarsHelper | Called.");
    if (typeof object === "undefined") {
      return false;
    }
    return true;
  });

  /**
   * Check if the passed object is "empty", meaning has no elements or properties
   */
  Handlebars.registerHelper("cprIsEmpty", (object) => {
    LOGGER.trace("cprIsEmpty | handlebarsHelper | Called.");
    if (typeof object === "object") {
      if (Array.isArray(object)) {
        if (object.length === 0) {
          return true;
        }
      } else if (Object.keys(object).length === 0) {
        return true;
      }
    }
    return false;
  });

  /**
   * Return the size of an object.
   */
  Handlebars.registerHelper("cprSizeOf", (object) => {
    LOGGER.trace("cprSizeOf | handlebarsHelper | Called.");
    let size = 0;
    switch (typeof object) {
      case "object": {
        if (Array.isArray(object)) {
          size = object.length;
        } else {
          size = object.size;
        }
        break;
      }
      case "string": {
        size = object.length;
        break;
      }
      case "number": {
        size = object;
        break;
      }
      default:
        size = 0;
    }
    return size;
  });

  /**
   * Return true if a literal is a number
   * For whatever reason, if value is the string "NaN", Javascript thinks
   * it is a number?
   */
  Handlebars.registerHelper("cprIsNumber", (value) => {
    LOGGER.trace("cprIsNumber | handlebarsHelper | Called.");
    if (typeof value === "string" && value === "NaN") {
      return false;
    }
    return !Number.isNaN(value);
  });

  /**
   * Formats thousands with a comma, optionally set decimal length
   *
   * Options:
   *
   *  @var decimalLength int The length of the decimals
   *  @var thousandsSep char The thousands separator
   *  @var decimalSep char The decimals separator
   *
   */
  Handlebars.registerHelper("cprNumberFormat", (value, options) => {
    LOGGER.trace("cprNumberFormat | handlebarsHelper | Called.");
    const dl = options.hash.decimalLength || 0;
    const ts = options.hash.thousandsSep || ",";
    const ds = options.hash.decimalSep || ".";
    const val = parseFloat(value);
    const re = `\\d(?=(\\d{3})+${dl > 0 ? "\\D" : "$"})`;
    const num = val.toFixed(Math.max(0, Math.floor(dl)));
    return (ds ? num.replace(".", ds) : num).replace(
      new RegExp(re, "g"),
      `$&${ts}`
    );
  });

  /**
   * Given an Array of strings, create an object with those strings as properties. They are the assigned
   * in order to the remaining arguments passed to this helper.
   */
  Handlebars.registerHelper("cprMergeForPartialArg", (...args) => {
    LOGGER.trace("cprMergeForPartialArg | handlebarsHelper | Called.");
    const partialArgs = [...args];
    const partialKeys = partialArgs[0].replace(/\s/g, "").split(",");
    partialArgs.shift();
    const mergedObject = {};
    let index = 0;
    partialKeys.forEach((objectName) => {
      mergedObject[objectName] = partialArgs[index];
      index += 1;
    });
    return mergedObject;
  });

  /**
   * Given a list of objects, return the subset that a property with the desired value
   */
  Handlebars.registerHelper("cprFilter", (objList, key, value) => {
    LOGGER.trace("cprFilter | handlebarsHelper | Called.");
    if (objList === undefined) {
      const warnText =
        "Improper use of the filter helper. This should not occur. Always provide an object list and not an undefined value.";
      LOGGER.warn(
        `${warnText} The following arguments were passed: objList = ${objList}, key = ${key}, value = ${value}`
      );
      return [];
    }
    const filteredList = objList.filter((obj) => {
      let objProp = obj;
      const propDepth = key.split(".");
      // eslint-disable-next-line consistent-return
      propDepth.forEach((propName) => {
        if (typeof objProp[propName] !== "undefined") {
          objProp = objProp[propName];
        } else {
          return false;
        }
      });
      if (objProp === value) {
        return true;
      }
      return false;
    });
    return filteredList;
  });

  /**
   * Get a config mapping from config.js by name and key
   */
  Handlebars.registerHelper("cprFindConfigValue", (obj, key) => {
    LOGGER.trace("cprFindConfigValue | handlebarsHelper | Called.");
    if (obj in CPR) {
      return CPR[obj][key];
    }
    return "INVALID_KEY";
  });

  /**
   * Get a config mapping from config.js by name
   */
  Handlebars.registerHelper("cprFindConfigObj", (obj) => {
    LOGGER.trace("cprFindConfigObj | handlebarsHelper | Called.");
    if (obj in CPR) {
      return CPR[obj];
    }
    return "INVALID_LIST";
  });

  /**
   * This helper accepts a string and an array and returns true if any string in the
   * array is contained within the string
   */
  Handlebars.registerHelper(
    "cprStringContainsSubstringList",
    (string, list) => {
      LOGGER.trace("stringContainsSubstringList | handlebarsHelper | Called.");
      const lowerCaseStr = string.toLowerCase();
      return list.some((substring) =>
        lowerCaseStr.includes(substring.toLowerCase())
      );
    }
  );

  /**
   * This helper accepts a string that is a list of words separated by strings. It returns true if
   * any of them match a given value.
   */
  Handlebars.registerHelper("cprListContains", (list, val) => {
    LOGGER.trace("cprListContains | handlebarsHelper | Called.");
    let array = list;
    if (array) {
      switch (typeof array) {
        case "string": {
          array = array.split(",");
          break;
        }
        case "object": {
          if (!Array.isArray(array)) {
            array = Object.keys(array);
          }
          break;
        }
        default:
      }
      return array.includes(val);
    }
    return false;
  });

  /**
   * Returns true if an array contains a desired element
   */
  Handlebars.registerHelper(
    "cprObjectListContains",
    (objectList, data, val) => {
      LOGGER.trace("cprObjectListContains | handlebarsHelper | Called.");
      const array = objectList;
      if (array) {
        return array.some((o) => o[data] === val);
      }
      return false;
    }
  );

  /**
   * Returns true if an array contains a desired element
   */
  Handlebars.registerHelper(
    "cprArrayLikeObjectByIndex",
    (arrayLikeObject, index, val) => {
      LOGGER.trace("cprArrayLikeObjectByIndex | handlebarsHelper | Called.");
      // Return false if arrayLikeObject is not an object, so that we avoid sheet-breaking errors.
      if (!(typeof arrayLikeObject === "object")) return false;

      const array = Object.values(arrayLikeObject);
      if (array) {
        return array[index][val];
      }

      return false;
    }
  );

  /**
   * Accepts a string and replaces VAR with the desired value. Usually used to dynamically
   * produce file names for partial templates.
   */
  Handlebars.registerHelper("cprGeneratePartial", (arg1, arg2) => {
    LOGGER.trace("cprGeneratePartial | handlebarsHelper | Called.");
    return arg1.replace("VAR", arg2);
  });

  /**
   * Calculate the size (in pixels) of images for dice given the number of sides they have
   * and how many need to be displayed in a chat card.
   */
  Handlebars.registerHelper("cprDiceSizeImageClass", (formula) => {
    LOGGER.trace("cprDiceSizeImageClass | handlebarsHelper | Called.");
    let diceSize = "";
    let className = "d10";
    const formulaParts = formula.split("d");
    if (formulaParts.length === 2) {
      const diceCount = parseInt(formulaParts[0], 10);
      const diceSides = parseInt(formulaParts[1], 10);
      className = `d${diceSides}`;

      if (diceSides === 6) {
        diceSize = 60;
        if (diceCount > 2) {
          diceSize = 40;
        }
        if (diceCount > 4) {
          diceSize = 30;
        }
        if (diceCount > 10) {
          diceSize = 20;
        }
      }

      if (diceSides === 10) {
        diceSize = 60;
        if (diceCount > 2) {
          diceSize = 40;
        }
        if (diceCount > 4) {
          diceSize = 30;
        }
        if (diceCount > 10) {
          diceSize = 20;
        }
      }
      if (diceSize) {
        className = `${className} ${className}-${diceSize}`;
      }
    }
    return className;
  });

  /**
   * Sort an array of objects by the values in a specific property
   */
  Handlebars.registerHelper("cprSort", (arr, property) => {
    LOGGER.trace("cprSort | handlebarsHelper | Called.");
    let array = arr;
    // If the first argument passed is an Object made of `key: Object` pairs,
    // turn it into an array of the Object's values, then sort by `property`.
    if (!Array.isArray(arr)) {
      array = Object.values(arr);
    }

    array.sort((a, b) => {
      let comparator = 0;
      if (a[property] > b[property]) {
        comparator = 1;
      } else if (b[property] > a[property]) {
        comparator = -1;
      }
      return comparator;
    });
    return array;
  });

  /**
   * Return an array in reverse order
   */
  Handlebars.registerHelper("cprReverse", (arr) => {
    LOGGER.trace("cprReverse | handlebarsHelper | Called.");
    // reverse() mutates the original array, so first we create a shallow copy using the spread operator.
    const reversed = [...arr].reverse();
    return reversed;
  });

  /**
   * Perform a basic mathematical statement starting with a stringified
   * operator and an array of operands
   */
  Handlebars.registerHelper("cprMath", (...args) => {
    LOGGER.trace("cprMath | handlebarsHelper | Called.");
    let mathArgs = [...args];
    let mathFunction = mathArgs[0];
    mathArgs.shift();
    mathArgs.pop();
    if (Array.isArray(mathArgs[0])) {
      [mathArgs] = mathArgs;
    }
    mathArgs = mathArgs.map(Number);
    if (typeof Math[mathFunction] === "function") {
      return Math[mathFunction].apply(null, mathArgs);
    }
    // Math doesn't have basic functions, we can account
    // for those here as needed:
    if (typeof mathArgs === "undefined") {
      mathFunction = `${mathFunction} bad args: ${mathArgs}`;
    }
    switch (mathFunction) {
      case "sum":
        return mathArgs.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10), 0);
      case "subtract": {
        const minutend = mathArgs.shift();
        const subtrahend = mathArgs.reduce((a, b) => a + b, 0);
        return minutend - subtrahend;
      }
      case "product": {
        return mathArgs.reduce((a, b) => a * b, 1);
      }
      default:
        LOGGER.error(`!ERR: Not a Math function: ${mathFunction}`);
        return "null";
    }
  });

  /**
   * Given a skill (item), return the stat associated with it, which is a property buried therein
   */
  Handlebars.registerHelper("cprGetSkillStat", (skill, actor) => {
    LOGGER.trace("cprGetSkillStat | handlebarsHelper | Called.");
    const skillStat = skill.system.stat;
    return actor.system.stats[skillStat].value;
  });

  /**
   * Return true if any installed cyberware is a weapon
   */
  Handlebars.registerHelper("cprHasCyberneticWeapons", (actor) => {
    LOGGER.trace("cprHasCyberneticWeapons | handlebarsHelper | Called.");
    const cyberneticWeapons = actor.itemTypes.cyberware.filter(
      (cw) => cw.system.isInstalled && cw.system.isWeapon
    );
    return cyberneticWeapons.length > 0;
  });

  /**
   * Return true if an embedded flag on an actor matches the firemode currently set.
   * Used to figure out if a weapon was just used with an alternative fire mode set.
   */
  Handlebars.registerHelper("cprFireMode", (actor, firemode, weaponID) => {
    LOGGER.trace("cprFireMode | handlebarsHelper | Called.");
    const flag = getProperty(
      actor,
      `flags.${game.system.id}.firetype-${weaponID}`
    );
    if (flag === firemode) {
      return true;
    }
    return false;
  });

  /**
   * Get the fire type selected for an owned weapon. This is stored as a flag on an actor.
   */
  Handlebars.registerHelper("cprFireFlag", (actor, firetype, weaponID) => {
    LOGGER.trace("cprFireFlag | handlebarsHelper | Called.");
    const flag = getProperty(
      actor,
      `flags.${game.system.id}.firetype-${weaponID}`
    );
    if (flag === firetype) {
      return "checked";
    }
    return "";
  });

  /**
   * Return a system setting value given the name
   */
  Handlebars.registerHelper("cprSystemConfig", (settingName) =>
    game.settings.get(game.system.id, settingName)
  );

  /**
   * Some skills and roles have spaces and/or parantheses in their name. When substituting in translated strings,
   * this can be a problem to find the key they're listed under.
   *
   * Example: Resist Torture/Drugs -> Resist Torture Or Drugs
   */
  Handlebars.registerHelper(
    "cprGetLocalizedlNameKey",
    (object, type = false) => {
      LOGGER.trace("cprGetLocalizedlNameKey | handlebarsHelper | Called.");
      const objectType = typeof object === "string" ? type : object.type;
      const name = typeof object === "string" ? object : object.name;
      let localizedKey = "";
      switch (objectType) {
        case "skill": {
          // "CPR.global.itemType.skill.cybertech"
          localizedKey = `CPR.global.itemType.skill.${SystemUtils.slugify(
            name
          )}`;
          break;
        }
        case "role": {
          // "CPR.global.role.tech.name"
          localizedKey = `CPR.global.role.${SystemUtils.slugify(name)}.name`;
          break;
        }
        case "roleAbility": {
          // "CPR.global.role.tech.ability.fabricationExpertise":
          for (const role of Object.keys(CPR.roleList)) {
            const localizedRoleKey = `CPR.global.role.${role}.ability.${SystemUtils.slugify(
              name
            )}`;
            if (SystemUtils.Localize(localizedRoleKey) !== localizedRoleKey) {
              localizedKey = localizedRoleKey;
            }
          }
          break;
        }
        case "programClass": {
          // "CPR.global.programClass.defender":
          localizedKey = `CPR.global.programClass.${SystemUtils.slugify(name)}`;
          break;
        }
        default:
      }
      return SystemUtils.Localize(localizedKey) === localizedKey
        ? name
        : localizedKey;
    }
  );

  /**
   * Sort core skills, returning a new array. This goes a step further and considers unicode normalization form for
   * specific characters like slashes and parantheses.
   */
  Handlebars.registerHelper("cprSortCoreSkills", (skillObjArray) => {
    LOGGER.trace("cprSortCoreSkills | handlebarsHelper | Called.");
    return SystemUtils.SortItemListByName(skillObjArray);
  });

  /**
   * Get an Item ID from the catalog by name and type. Does not consider owned items.
   */
  Handlebars.registerHelper("cprItemIdFromName", (itemName, itemType) => {
    LOGGER.trace("cprItemIdFromName | handlebarsHelper | Called.");
    const item = game.items.find(
      (i) => i.name === itemName && i.type === itemType
    );
    if (item !== undefined) {
      return item._id;
    }
    return "DOES NOT EXIST";
  });

  /**
   * Convert any number of strings into an array
   */
  Handlebars.registerHelper("cprListConcat", (...args) => {
    LOGGER.trace("cprConcat | handlebarsHelper | Called.");
    // Remove the last argument which is a Handlebars-specific object
    args.pop();
    return args;
  });

  /**
   * Convert a string with a delimiter (such as a comma or space) to an Array of elements
   */
  Handlebars.registerHelper("cprToArray", (string, delimiter) =>
    string.split(delimiter)
  );

  /**
   * Concatenate 1 object to another with the concat method.
   */
  Handlebars.registerHelper("cprObjConcat", (obj1, obj2) => {
    LOGGER.trace("cprObjConcat | handlebarsHelper | Called.");
    const obj = obj1.concat(obj2);
    return obj;
  });

  /**
   * Get all skills on a mook that have a level above 0. This is used to present
   * specialized skills a mook may have.
   */
  Handlebars.registerHelper("cprGetMookSkills", (array) => {
    LOGGER.trace("cprGetMookSkills | handlebarsHelper | Called.");
    const skillList = [];
    const sortedArray = SystemUtils.SortItemListByName(array);
    sortedArray.forEach((skill) => {
      if (skill.system.level !== 0 || skill.system.skillmod > 0) {
        skillList.push(skill);
      }
    });
    return skillList;
  });

  /**
   * Get all installed cyberware and options and return it as an array. This is
   * used in the mook sheet.
   */
  Handlebars.registerHelper("cprGetMookCyberware", (mook) => {
    LOGGER.trace("cprGetMookCyberware | handlebarsHelper | Called.");
    const installedCyberwareList = [];
    for (const installedUUID of mook.system.installedItems.list) {
      const item = mook.getOwnedItem(installedUUID);
      if (item.type === "cyberware") {
        const optionals = [];
        if (item.system.installedItems.list.length > 0) {
          for (const optionalid of item.system.installedItems.list) {
            const optionalItem = mook.getOwnedItem(optionalid);
            optionals.push(optionalItem);
          }
        }
        installedCyberwareList.push({ foundation: item, optionals });
      }
    }
    return installedCyberwareList;
  });

  /**
   * Return how many installed cyberware items an actor has
   */
  Handlebars.registerHelper("cprGetMookCyberwareLength", (mook) => {
    LOGGER.trace("cprGetMookCyberwareLength | handlebarsHelper | Called.");
    const installedCyberwareList = [];
    const exclusionList = [
      "cyberwareInternal",
      "cyberwareExternal",
      "fashionware",
    ];
    for (const installedUUID of mook.system.installedItems.list) {
      const item = mook.getOwnedItem(installedUUID);
      if (
        item.type === "cyberware" &&
        !exclusionList.includes(item.system.type)
      ) {
        installedCyberwareList.push(item);
        if (item.system.installedItems.list.length > 0) {
          for (const optionalid of item.system.installedItems.list) {
            const optionalItem = mook.getOwnedItem(optionalid);
            installedCyberwareList.push(optionalItem);
          }
        }
      }
    }
    return installedCyberwareList.length;
  });

  /**
   * Get details about an entity type that the game system is aware of
   */
  Handlebars.registerHelper("cprEntityTypes", (entityType) => {
    LOGGER.trace("cprEntityTypes | handlebarsHelper | Called.");
    return typeof game.system.documentTypes[entityType] === "object"
      ? game.system.documentTypes[entityType].filter((type) => type !== "base")
      : {};
  });

  /**
   * Returns true if an item type can be upgraded. This means it has the upgradable property in the data model.
   */
  Handlebars.registerHelper("cprIsUpgradable", (item) => {
    LOGGER.trace("cprIsUpgradable | handlebarsHelper | Called.");
    const itemEntities = game.system.template.Item;
    let isUpgradable = false;
    if (
      itemEntities[item.type].templates.includes("upgradable") &&
      item.system.installedItems.allowed &&
      item.system.installedItems.allowedTypes.includes("itemUpgrade")
    ) {
      isUpgradable = true;
    }
    return isUpgradable;
  });

  /**
   * Returns true if an item has installed items.
   */
  Handlebars.registerHelper("cprHasInstalledItems", (item) => {
    LOGGER.trace("cprHasInstalledItems | handlebarsHelper | Called.");
    const itemList =
      typeof item.system.installedItems === "object"
        ? item.system.installedItems.list
        : [];
    return itemList.length > 0;
  });

  /**
   * List installed items.
   */
  Handlebars.registerHelper(
    "cprListInstalledItems",
    (item, delimiter = " ") => {
      LOGGER.trace("cprListInstalledItems | handlebarsHelper | Called.");
      const { actor } = item;
      const itemList =
        typeof item.system.installedItems === "object"
          ? item.system.installedItems.list
          : [];
      let returnString = "";
      if (actor) {
        for (const itemId of itemList) {
          const installedItem = item.actor.getOwnedItem(itemId);
          if (installedItem) {
            const itemType = SystemUtils.Localize(
              CPR.objectTypes[installedItem.type]
            );
            returnString = returnString.concat(
              `${installedItem.name} (${itemType})`,
              delimiter
            );
          }
        }
      }
      return returnString;
    }
  );

  Handlebars.registerHelper("cprGetItemValue", (item) => {
    LOGGER.trace("cprGetItemValue | handlebarsHelper | Called.");
    const valuableTypes = SystemUtils.GetTemplateItemTypes("valuable");
    const containerTypes = SystemUtils.GetTemplateItemTypes("container");
    let totalValue = valuableTypes.includes(item.type)
      ? item.system.price.market
      : 0;
    if (containerTypes.includes(item.type)) {
      const installedItems = item.recursiveGetAllInstalledItems();
      installedItems.forEach((installedItem) => {
        totalValue += valuableTypes.includes(installedItem.type)
          ? installedItem.system.price.market
          : 0;
      });
    }
    return totalValue;
  });

  /**
   * Returns true if an item type has a particular template applied in the data model
   * To Do: isUpgradeable should use this instead
   */
  Handlebars.registerHelper("cprHasTemplate", (itemType, templateName) => {
    LOGGER.trace("cprHasTemplate | handlebarsHelper | Called.");
    const itemEntities = game.system.template.Item;
    return itemEntities[itemType].templates.includes(templateName);
  });

  /**
   * Look at the data model for a type of item, and return the list of templates it comes with
   */
  Handlebars.registerHelper("cprGetTemplates", (itemType) => {
    LOGGER.trace("cprGetTemplates | handlebarsHelper | Called.");
    return SystemUtils.getDataModelTemplates(itemType);
  });

  /**
   * Return the stat-changing details as text if an object has an upgrade
   */
  Handlebars.registerHelper("cprShowUpgrade", (obj, dataPoint) => {
    LOGGER.trace("cprShowUpgrade | handlebarsHelper | Called.");
    const itemEntities = game.system.template.Item;
    const itemType = obj.type;
    let upgradeText = "";
    if (
      itemEntities[itemType].templates.includes("upgradable") &&
      obj.system.isUpgraded
    ) {
      const upgradeData = obj.getTotalUpgradeValues(dataPoint);
      if (upgradeData.value !== 0 && upgradeData.value !== "") {
        const modSource =
          itemType === "weapon"
            ? SystemUtils.Localize("CPR.itemSheet.weapon.attachments")
            : SystemUtils.Localize("CPR.itemSheet.common.upgrades");
        upgradeText = `(${SystemUtils.Format(
          "CPR.itemSheet.common.modifierChange",
          { modSource, modType: upgradeData.type, value: upgradeData.value }
        )})`;
      }
    }
    return upgradeText;
  });

  /**
   * If an upgrade exists that applies changes to a stat or skill, calculate and return the
   * result.
   */
  Handlebars.registerHelper("cprApplyUpgrade", (obj, baseValue, dataPoint) => {
    LOGGER.trace("cprApplyUpgrade | handlebarsHelper | Called.");
    const itemEntities = game.system.template.Item;
    const itemType = obj.type;
    let upgradeResult = Number(baseValue);
    if (Number.isNaN(upgradeResult)) {
      upgradeResult = baseValue;
    }
    if (
      itemEntities[itemType].templates.includes("upgradable") &&
      obj.system.isUpgraded
    ) {
      const upgradeData = obj.getTotalUpgradeValues(dataPoint);
      if (upgradeData.value !== "" && upgradeData.value !== 0) {
        if (upgradeData.type === "override") {
          upgradeResult = upgradeData.value;
        } else if (
          typeof upgradeResult !== "number" ||
          typeof upgradeData.value !== "number"
        ) {
          if (upgradeData.value !== 0 && upgradeData.value !== "") {
            upgradeResult = `${upgradeResult} + ${upgradeData.value}`;
          }
        } else {
          upgradeResult += upgradeData.value;
        }
      }
    }
    return upgradeResult;
  });

  /**
   * Return true if a bit of text matches a filter value. If the filter is not set, everything matches.
   */
  Handlebars.registerHelper(
    "cprSheetContentFilter",
    (filterValue, applyToText) => {
      LOGGER.trace("cprSheetContentFilter | handlebarsHelper | Called.");
      if (typeof filterValue === "undefined" || filterValue === "") {
        return true;
      }
      return (
        applyToText.toLowerCase().indexOf(filterValue.toLowerCase()) !== -1
      );
    }
  );

  /**
   * For readability's sake return (a translated) "Yes" or "No" based on whether something is true or false
   */
  Handlebars.registerHelper("cprYesNo", (bool) => {
    LOGGER.trace("cprYesNo | handlebarsHelper | Called.");
    if (bool) return SystemUtils.Localize("CPR.global.generic.yes");
    return SystemUtils.Localize("CPR.global.generic.no");
  });

  /**
   * For readability's sake, translate the "mode" of an active effect mod into an intuitive mathematical operator.
   * For unknown modes, just return a question mark, which shouldn't happen. Modes are constants provided by Foundry:
   *    0 (CUSTOM) - calls the "applyActiveEffect" hook with the value to figure out what to do with it (not used)
   *    1 (MULTIPLY) - multiply this value with the current one
   *    2 (ADD) - add this value to the current value (as an Integer) or set it if currently null
   *    3 (DOWNGRADE) - like OVERRIDE but only replace if the value is lower (worse)
   *    4 (UPGRADE) - like OVERRIDE but only replace if the value is higher (better)
   *    5 (OVERRIDE) - replace the current value with this one
   */
  Handlebars.registerHelper("cprEffectModMode", (mode, value) => {
    LOGGER.trace("cprEffectModMode | handlebarsHelper | Called.");
    switch (mode) {
      case 1:
        return `*${value}`;
      case 2:
        return value > 0 ? `+${value}` : value; // account for minus already being there for negative numbers
      case 3:
        return `<=${value}`;
      case 4:
        return `>=${value}`;
      case 5:
        return `=${value}`;
      default:
        return `?${value}`;
    }
  });

  /**
   * Figure out if an effect row should have a toggle glyph displayed or not.
   * Only show the toggle if 1 of these conditions is true:
   *    1. the effect is on the actor itself, not from an item
   *    2. the item usage is set to "toggled"
   *    3. the item is not suppressed and usage is not set to "always"
   *
   * @param {CPRActiveEffect} effect - active effect data object
   * @param {String} name - the name of the actor
   * @returns {Bool} true or false if the toggle glyph should be displayed
   */
  Handlebars.registerHelper("cprShowEffectToggle", (effect, name) => {
    LOGGER.trace("cprShowEffectToggle | handlebarsHelper | Called.");
    if (effect.sourceName === name) return true;
    if (!effect.system.isSuppressed && effect.usage !== "always") return true;
    if (effect.system.isSuppressed && effect.usage === "toggled") return true;
    return false;
  });

  /**
   * Generate a mapping of skill names and bonus object references for the AE sheet. If the AE
   * comes from an Item, we look up all non-core skill items in the world, and use that list.
   * If it comes from an actor, we loop over the skills it owns and generate a mapping with that.
   *
   * @param {Object} effectData - Sheet object that contains the AE in question
   * @return {Object} - sorted object of skill keys to names
   */
  Handlebars.registerHelper("cprGetSkillsForEffects", (effectData) => {
    LOGGER.trace("cprGetSkillsForEffects | handlebarsHelper | Called.");
    const skillMap = CPR.activeEffectKeys.skill;
    let skillList = [];
    if (effectData.isItemEffect) {
      skillList = game.items.filter((i) => i.type === "skill");
    } else if (effectData.isActorEffect) {
      const actor = effectData.effect.parent;
      skillList = actor.items.filter((i) => i.type === "skill");
    }

    for (const skill of skillList) {
      const localizedKey = `CPR.global.itemType.skill.${SystemUtils.slugify(
        skill.name
      )}`;
      skillMap["bonuses.".concat(SystemUtils.slugify(skill.name))] =
        localizedKey;
    }
    // "sort" the skillMap properties before passing it back (sorting by localized value)
    return Object.keys(skillMap)
      .sort((a, b) =>
        game.i18n
          .localize(skillMap[a])
          .localeCompare(game.i18n.localize(skillMap[b]))
      )
      .reduce((result, key) => {
        // eslint-disable-next-line no-param-reassign
        result[key] = skillMap[key];
        return result;
      }, {});
  });

  /**
   * Return the name of a skill or stat being changed by an effect. Used in a
   * few active effect UIs.
   *
   * @param {Document} doc - the item providing an effect
   * @param {String} cat - category of change mods
   * @param {String} key - key for the stat or skill that is being changed by an effect
   * @return {String} - the name of the skill or stat being changed
   */
  Handlebars.registerHelper("cprGetChangeNameByKey", (doc, cat, key) => {
    LOGGER.trace("cprGetChangeNameByKey | handlebarsHelper | Called");
    LOGGER.trace(
      `cprGetChangeNameByKey | handlebarsHelper | doc: ${JSON.stringify(
        doc,
        null,
        2
      )}`
    );
    LOGGER.trace(`cprGetChangeNameByKey | handlebarsHelper | cat: ${cat}`);
    LOGGER.trace(`cprGetChangeNameByKey | handlebarsHelper | key: ${key}`);
    if (!cat) {
      // There's a split second when this is updating that the sheet may
      // refresh showing ??? and throwing a console error when these are
      // being updated with the delete method.
      let returnString = "(updating)";
      const flag = doc.getFlag(game.system.id, "changes")
        ? doc.getFlag(game.system.id, "changes")
        : [];
      if (doc.changes.length === flag.length) {
        returnString = "???";
        LOGGER.error(
          "Undefined change category! No idea what this effect changes!"
        );
      }
      return returnString;
    }
    if (cat === "custom") return key;

    if (!doc) {
      return SystemUtils.Localize(CPR.activeEffectKeys[cat][key]);
    }

    const sourceDoc = doc instanceof CPRActiveEffect ? doc.parent : doc;
    if (!sourceDoc) return "???"; // a recently deleted item will sometimes do this
    if (cat === "skill") {
      const skillMap = CPR.activeEffectKeys.skill;
      let skillList = [];
      if (sourceDoc.isOwned) {
        skillList = sourceDoc.parent.items.filter((i) => i.type === "skill");
      } else {
        skillList = game.items.filter((i) => i.type === "skill");
      }
      for (const skill of skillList) {
        skillMap["bonuses.".concat(SystemUtils.slugify(skill.name))] =
          skill.name;
      }
      return SystemUtils.Localize(skillMap[key]);
    }
    return SystemUtils.Localize(CPR.activeEffectKeys[cat][key]);
  });

  /**
   * Returns requested information about a skill mod: Either an array of all CPRMods,
   * the total value of all the mods, or a boolean whether the mod has situational bonuses or not.
   *
   * @param {String} skillName - the skill name (e.g. from CPR.skillList) to look up
   * @param {Object} actor - the actor whom the skill belongs to.
   * @param {String} infoType - type of info being requested ("modTotal", "modList", or "hasSituational")
   * @param {Object} options - Contains Hash Argument from Handlebars. In this case, the only option is
   *                           keepSituational, which is a Boolean to filter out situational mods or not.
   *                           See: https://handlebarsjs.com/guide/block-helpers.html#hash-arguments
   * @returns {Number|Array<object>|Boolean} - see above description.
   */
  Handlebars.registerHelper(
    "cprGetSkillModInfo",
    (skillName, actor, infoType, options) => {
      LOGGER.trace("cprGetSkillModInfo | handlebarsHelper | Called.");
      const skillSlug = SystemUtils.slugify(skillName);
      const effects = Array.from(actor.allApplicableEffects()); // Active effects on the actor.
      const allMods = CPRMod.getAllModifiers(effects); // Effects list converted into CPRMods.
      let relevantMods = CPRMod.getRelevantMods(allMods, [
        skillSlug,
        `${skillSlug}Hearing`,
        `${skillSlug}Sight`,
      ]);
      const hasSituational = relevantMods.some((m) => m.isSituational);
      if (!options.hash.keepSituational) {
        relevantMods = relevantMods.filter((m) => !m.isSituational);
      }

      let modTotal = 0;
      relevantMods.forEach((m) => {
        modTotal += parseInt(m.value, 10);
      });

      switch (infoType) {
        case "modTotal":
          return modTotal;
        case "modList":
          return relevantMods;
        case "hasSituational":
          return hasSituational;
        default:
          return LOGGER.error("Did not pass valid string to infoType");
      }
    }
  );

  /**
   * Return true if a literal is a number
   * For whatever reason, if value is the string "NaN", Javascript thinks
   * it is a number?
   */
  Handlebars.registerHelper("cprGetPriceCategory", (price) => {
    LOGGER.trace("cprGetPriceCategory | handlebarsHelper | Called.");
    let priceCategory = "free";
    const PRICE_CATEGORY_MAPPINGS = {};
    let priceTiers = [];
    for (const key of Object.keys(CPR.itemPriceCategoryMap)) {
      const integerValue = parseInt(CPR.itemPriceCategoryMap[key], 10);
      PRICE_CATEGORY_MAPPINGS[integerValue] = key;
      priceTiers.push(integerValue);
    }
    priceTiers = priceTiers.sort((a, b) => a - b);
    for (const priceTier of priceTiers) {
      priceCategory =
        priceTier <= price ? PRICE_CATEGORY_MAPPINGS[priceTier] : priceCategory;
      priceCategory =
        priceCategory === "free" && price > 0
          ? PRICE_CATEGORY_MAPPINGS[priceTier]
          : priceCategory;
    }
    return priceCategory;
  });

  /**
   * Return true if the program has damage defined for either standard or blackIce
   */
  Handlebars.registerHelper("cprProgramHasDamageRoll", (program) => {
    LOGGER.trace("cprProgramHasDamageRoll | handlebarsHelper | Called.");
    let returnCode = false;
    if (typeof program === "object") {
      if (program?.damage.standard !== "" || program?.damage.blackIce !== "") {
        returnCode = true;
      }
    }
    return returnCode;
  });

  /**
   * Returns specific property for ammo's damage override. "Override" is a boolean,
   * whether or not to apply the override. "Value" is the damage value, e.g. "3d6".
   *
   * @param {String} actor - The actor who is the owner of this weapon/ammo.
   * @param {String} uuid - The Uuid of the ammo item.
   * @param {String} override - The override we want, 'damage' or 'autofire'.
   * @param {String} property - Should be 'mode', 'value', or 'minimum'.
   */
  Handlebars.registerHelper(
    "cprGetAmmoOverrideProp",
    (actor, uuid, override, property) => {
      LOGGER.trace("cprGetAmmoOverrideProp | handlebarsHelper | Called.");
      const ammoItem = actor.getOwnedItem(uuid);

      if (
        !(property === "mode" || property === "value" || property === "minimum")
      ) {
        return LOGGER.debug(
          `The only currently valid property parameters are 'mode', 'value', or 'minimum'. '${property}' is not valid.`
        );
      }

      if (!(override === "damage" || override === "autofire")) {
        return LOGGER.debug(
          `The only currently valid override keys are 'damage' and 'autofire'. '${override}' is not valid.`
        );
      }

      // If no ammo item, return "none". This is a hack to not add extra logic to the handlebars.
      // Prevents melee and unloaded weapons from displaying italicized/tool-tipped damage text-pills.
      if (ammoItem) {
        return ammoItem.system.overrides[override][property];
      }
      return "none";
    }
  );

  /**
   * Returns damage for a particular weapon, taking into account loaded ammo which may
   * modify the base damage.
   *
   * @param {CPRWeapon} weapon - weapon item whose damage we are interested in returning

   */
  Handlebars.registerHelper("cprGetWeaponDamage", (weapon) => {
    LOGGER.trace("cprGetWeaponDamage | handlebarsHelper | Called.");
    return weapon.getWeaponDamage();
  });

  /**
   * Returns the autofire maximum for a particular weapon, taking into account loaded ammo,
   * which may modify the base autofire maximum.
   *
   * @param {CPRWeapon} weapon - weapon item whose autofire Maximum we are interested in returning

   */
  Handlebars.registerHelper("cprGetWeaponAutofireMax", (weapon) => {
    LOGGER.trace("cprGetWeaponDamage | handlebarsHelper | Called.");
    const weaponAutofireMax = weapon.system.fireModes.autoFire;
    const ammoItem = weapon.actor.getOwnedItem(
      weapon.system.magazine.ammoData.uuid
    );
    let trueMax = 0;
    if (ammoItem && ammoItem.system.overrides.autofire.mode === "set") {
      trueMax = ammoItem.system.overrides.autofire.value;
    } else if (
      ammoItem &&
      ammoItem.system.overrides.autofire.mode === "modify"
    ) {
      const ammoAutofireModifier = ammoItem.system.overrides.autofire.value;
      const ammoAutofireMin = ammoItem.system.overrides.autofire.minimum;
      trueMax = Math.max(
        weaponAutofireMax + ammoAutofireModifier,
        ammoAutofireMin
      );
    } else {
      trueMax = weaponAutofireMax;
    }

    return trueMax;
  });

  /**
   * Return true/false depending on whether debugElements setting in the game is enabled
   */
  Handlebars.registerHelper("cprIsDebug", () => {
    LOGGER.trace("cprIsDebug | handlebarsHelper | Called.");
    return game.settings.get(game.system.id, "debugElements");
  });

  /* Emit a debug message to the dev log
   */
  Handlebars.registerHelper("cprDebug", (msg) => {
    LOGGER.debug(msg);
  });

  /**
   * Emit a trace message to the dev log
   */
  Handlebars.registerHelper("cprTrace", (msg) => {
    LOGGER.trace(msg);
  });

  /**
   * Sanitize a string to remove Foundry @UUID references and sanitize HTML
   */
  Handlebars.registerHelper("cprSanitizeText", (string) => {
    LOGGER.trace("cprStripHtml | handlebarsHelper | Called.");
    return TextUtils.sanitizeEnrichedText(string);
  });

  /**
   * Transform a string to upper/lowercase
   */
  Handlebars.registerHelper("cprTextTransform", (string, transform) => {
    LOGGER.trace("cprTextTransform | handlebarsHelper | Called.");
    switch (transform) {
      case "upper":
        return string.toUpperCase();
      case "lower":
        return string.toLowerCase();
      default:
        return string;
    }
  });

  Handlebars.registerHelper("cprHighlightDVRuler", (item) => {
    LOGGER.trace("cprHighlightDVRuler | handlebarsHelper | Called.");
    const token = item.actor.sheet?.token;
    let itemDvTable = item.system?.dvTable;
    if (token !== null && itemDvTable !== null && itemDvTable !== "") {
      const tokenDv = token.object.document.getFlag(
        game.system.id,
        "cprDvTable"
      );
      const firetype = token.actor.getFlag(
        game.system.id,
        `firetype-${item.id}`
      );
      if (firetype === "autofire") {
        itemDvTable = `${itemDvTable} (Autofire)`;
      }
      if (tokenDv?.name === itemDvTable) {
        return true;
      }
    }
    return false;
  });

  /**
   * Map items to wiki links
   * Some items are pluralised, some are not, map these
   */
  Handlebars.registerHelper("cprWikiLink", (string) => {
    LOGGER.trace("cprTextTransform | handlebarsHelper | Called.");
    const gitlabUrl = `https://gitlab.com/cyberpunk-red-team/fvtt-${game.system.id}`;
    const wikiUrl = `${gitlabUrl}/-/wikis/`;
    const itemPath = "System-Documentation/Items";
    switch (string) {
      case "ammo":
        return `${wikiUrl}/${itemPath}/Ammo`;
      case "armor":
        return `${wikiUrl}/${itemPath}/Armor`;
      case "clothing":
        return `${wikiUrl}/${itemPath}/Clothing`;
      case "criticalInjury":
        return `${wikiUrl}/${itemPath}/Critical-Injuries`;
      case "cyberdeck":
        return `${wikiUrl}/${itemPath}/Cyberdecks`;
      case "cyberware":
        return `${wikiUrl}/${itemPath}/Cyberware`;
      case "drug":
        return `${wikiUrl}/${itemPath}/Drugs`;
      case "gear":
        return `${wikiUrl}/${itemPath}/Gear`;
      case "itemUpgrade":
        return `${wikiUrl}/${itemPath}/Upgrades`;
      case "netarch":
        return `${wikiUrl}/${itemPath}/NET-Architecture`;
      case "program":
        return `${wikiUrl}/${itemPath}/Programs`;
      case "role":
        return `${wikiUrl}/${itemPath}/Roles`;
      case "skill":
        return `${wikiUrl}/${itemPath}/Skills`;
      case "vehicle":
        return `${wikiUrl}/${itemPath}/Vehicles`;
      case "weapon":
        return `${wikiUrl}/${itemPath}/Weapons`;
      default:
        return string;
    }
  });

  /**
   * Work out how to display branded items
   */
  Handlebars.registerHelper("cprBrandedName", (item) => {
    LOGGER.trace("cprTextTransform | handlebarsHelper | Called.");
    const brandName = item.system?.brand;
    const itemName = item.name;

    if (brandName === undefined || brandName === "") {
      return itemName;
    }
    if (itemName.includes(brandName)) {
      return itemName;
    }
    return `${brandName} ${itemName}`;
  });
}
