/* eslint-disable max-classes-per-file */
/* eslint-disable no-shadow */
/* global game mergeObject */
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";
import CPRDialog from "./cpr-dialog-application.js";

export default class SelectRoleBonuses extends CPRDialog {
  /**
   * dialogData.roleData will either contain roleItem.system or roleItem.system.someSubAbility.
   *
   * @param {Object} dialogData - Data for the form. Includes a skill list and information from the role.
   * @constructor
   */
  constructor(dialogData, options) {
    LOGGER.trace("constructor | CPRSelectRoleBonuses | Called.");
    super(dialogData, options);
    this.skillList = dialogData.skillList;
    this.roleData = dialogData.roleData;
    this.options.template = `systems/${game.system.id}/templates/dialog/cpr-select-role-bonuses-prompt.hbs`;
    this.options.title = SystemUtils.Localize(
      "CPR.dialog.selectRoleBonuses.title"
    );
  }

  /**
   * Prepares data for roll dialog sheet.
   *
   * @override
   */
  getData() {
    LOGGER.trace("getData | CPRSelectRoleBonuses | called.");
    const data = super.getData();
    data.skillList = this.skillList;
    data.roleData = this.roleData;
    return data;
  }

  /**
   * Processes the form's data in a way that is useful to us.
   *
   * @param {*} event - currently not used.
   * @param {Object} formData - Data from the submitted form.
   * @override
   */
  async _updateObject(event, formData) {
    LOGGER.trace("_updateObject | CPRDialog | Called.");

    // Convert selected skills into a neat list.
    const bonuses = [];
    formData.selectedSkills.forEach((s) => {
      if (s) bonuses.push(this.skillList.find((a) => a.name === s));
    });

    // Make sure that we are not dividing by 0 or null/undefined.
    const bonusRatio =
      !formData.bonusRatio || formData.bonusRatio === 0
        ? 1
        : formData.bonusRatio;

    // Collect relevant data into one object.
    const updatedData = {
      bonusRatio,
      bonuses,
      universalBonuses: formData.universalBonuses.filter((b) => b),
    };

    // Merge above object with our original data.
    // This is then used to update the role item in item-sheet.js (_selectRoleBonuses)
    mergeObject(this.object.roleData, updatedData);
    this.render(true); // rerenders the FormApp with the new data.
  }
}
