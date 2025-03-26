/* global ActiveEffectConfig CONST getProperty game mergeObject */
/* eslint-env jquery */
import LOGGER from "./utils/cpr-logger.js";
import SystemUtils from "./utils/cpr-systemUtils.js";

/**
 * Extend the base ActiveEffect class to implement system-specific logic.
 * @extends {ActiveEffect}
 */
export default class CPRActiveEffectSheet extends ActiveEffectConfig {
  /**
   * We provide our own ActiveEffects sheet to improve the UX a bit. Specifically this
   * allows us to implement user-readable keys for the mods, and different "usage" types.
   * Most of that logic lives in cpr-active-effect.js.
   */
  static get defaultOptions() {
    LOGGER.trace("defaultOptions | CPRActiveEffectSheet | Called.");
    return mergeObject(super.defaultOptions, {
      template: `systems/${game.system.id}/templates/effects/cpr-active-effect-sheet.hbs`,
      width: "auto",
      height: "auto",
      // Submit on close to prevent an edge case where a user adds and active effect, but doesn't change anything.
      // If they closed the dialog (without submitting) then there was just a blank AE on their sheet. This setting prevents that.
      submitOnClose: true,
    });
  }

  /**
   * Some elements of the active effects sheet need special handling when they are changed
   * because of the flag limitation imposed by Foundry.
   *
   * @param {Object} html - the DOM object
   */
  activateListeners(html) {
    LOGGER.trace("activateListeners | CPRActiveEffectSheet | Called.");
    super.activateListeners(html);
    if (!this.options.editable) return;

    // QoL - Select all text when grabbing text input.
    $("input[type=text]").focusin(() => $(this).select());
    html.find(".force-submit").change(() => this._forceSubmit());
    html
      .find(".effect-key-category")
      .change((event) => this._changeModKeyCategory(event));
    html
      .find(".effect-change-control")
      .click((event) => this._effectChangeControl(event));
    html
      .find(".toggle-situational")
      .click((event) => this._toggleSituational(event));
    html
      .find(".toggle-on-by-default")
      .click((event) => this._toggleOnByDefault(event));
  }

  /**
   * A function we call when we want to force form submission (to make sure that a change is properly registered).
   *
   * Sometimes, if you input a change on the sheet, and then make another change somewhere else on the sheet,
   * the original change gets ovverriden, since it was not submitted. This function addresses that by
   * making sure information passed to the sheet gets stored/submitted before another change occurs.
   *
   * This function also helps achieve a secondary, more specific goal: prevent duplicate change keys on the same AE. How?
   * In the handlebars template, change keys that already exist on this AE are disabled.
   * Submitting rerenders the sheet, disabling the correct values in the drop-down so that they cannot be selected again.
   *
   * @async
   * @callback
   * @private
   */
  async _forceSubmit() {
    LOGGER.trace("_forceSubmit | CPRActiveEffectSheet | Called.");
    this.submit({
      preventClose: true,
    });
  }

  /**
   * Change the key category flag on an active effect.
   * Also submit the form to prevent duplicate change keys on the same AE. (see _forceSubmit's jsdocs)
   *
   * @async
   * @callback
   * @private
   */
  async _changeModKeyCategory(event) {
    LOGGER.trace("_changeModKeyCategory | CPRActiveEffectSheet | Called.");
    const effect = this.object;
    const modnum = event.currentTarget.dataset.index;
    const keyCategory = event.target.value;

    await effect.setModKeyCategory(modnum, keyCategory);

    // Stats cannot currently be situational. This bit of code sets situational flags to false when the
    // Stat category is selected in the active effects dialog.
    if (effect.getFlag(game.system.id, `changes.cats.${modnum}`) === "stat") {
      await effect.setFlag(
        game.system.id,
        `changes.situational.${modnum}.isSituational`,
        false
      );
      await effect.setFlag(
        game.system.id,
        `changes.situational.${modnum}.onByDefault`,
        false
      );
    }
    return this._forceSubmit();
  }

  /**
   * Dispatcher that does thing to the "changes" array of an Active Effect. That is
   * where the mods are managed.
   *
   * @callback
   * @private
   * @param {Object} event - mouse click event
   * @returns (varies by action)
   */
  _effectChangeControl(event) {
    LOGGER.trace("_effectChangeControl | CPRActiveEffectSheet | Called.");
    event.preventDefault();
    switch (event.currentTarget.dataset.action) {
      case "add":
        return this._addEffectChange();
      case "delete":
        return this._deleteEffectChange(event);
      default:
    }
    return null;
  }

  /**
   * Toggles the change as situational or not.
   *
   * @callback
   * @private
   * @param {Object} event - mouse click event
   */
  async _toggleSituational(event) {
    LOGGER.trace("_toggleSituational | CPRActiveEffectSheet | Called.");
    const effect = this.object;
    const modnum = SystemUtils.GetEventDatum(event, "data-index");
    const isSituational = event.target.checked;

    await effect.setFlag(
      `${game.system.id}`,
      `changes.situational.${modnum}.isSituational`,
      isSituational
    );

    this._forceSubmit();
  }

  /**
   * If the change is situational, toggle whether it should be on by default.
   *
   * @callback
   * @private
   * @param {Object} event - mouse click event
   */
  async _toggleOnByDefault(event) {
    LOGGER.trace("_toggleOnByDefault | CPRActiveEffectSheet | Called.");
    const effect = this.object;
    const modnum = SystemUtils.GetEventDatum(event, "data-index");
    const onByDefault = event.target.checked;

    await effect.setFlag(
      `${game.system.id}`,
      `changes.situational.${modnum}.onByDefault`,
      onByDefault
    );

    this._forceSubmit();
  }

  /**
   * Handle adding a new change (read: mod) to the changes array. A new
   * changes is always added to the end of the array, never in the middle.
   *
   * @async
   * @private
   */
  async _addEffectChange() {
    LOGGER.trace("_addEffectChange | CPRActiveEffectSheet | Called.");
    const idx = this.document.changes.length;
    LOGGER.debug(`adding change defaults for changes.${idx}`);
    return this.submit({
      preventClose: true,
      updateData: {
        [`changes.${idx}`]: {
          key: "",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: "0",
        },
        // we set the default "key category" here.
        // we also give it a "situational" flag.
        [`flags.${game.system.id}.changes.cats.${idx}`]: "skill",
        [`flags.${game.system.id}.changes.situational.${idx}`]: {
          isSituational: false,
          onByDefault: false,
        },
      },
    });
  }

  /**
   * Delete a change (read: mod) provided by an active effect. If the deleted change is in the
   * middle of the list, we need to collapse all of the flags beyond it down one "element".
   * (regenerating from scratch is actually hard because you cannot reverse look up what the
   * values should be due to AEs and custom skills)
   *
   * We play a few games with casting between Number and String to avoid writing migration code.
   *
   * @param {*} event - Mouse click event (someone clicked a trashcan)
   * @returns - whether re-rendering the sheet was successful
   */
  async _deleteEffectChange(event) {
    LOGGER.trace("_deleteEffectChange | CPRActiveEffectSheet | Called.");
    const modnum = parseInt(event.currentTarget.dataset.index, 10);
    // First, delete the change itself in the AE
    const { changes } = this.object;
    changes.splice(modnum, 1);
    // Second, remove the corresponding flag for the deleted change
    const changeFlags = getProperty(
      this.object,
      `flags.${game.system.id}.changes`
    );
    const newFlags = { cats: {}, situational: {} };
    const flagArrayCats = Object.entries(changeFlags.cats);
    const flagArraySituational = Object.entries(changeFlags.situational);

    // First, sort and reorder the flags for the effect's category.
    flagArrayCats.sort(); // explicitly sort to guarantee we iterate in numerical order
    flagArrayCats.forEach((chg) => {
      const index = Number(chg[0]);
      const category = chg[1];
      if (index < modnum) {
        newFlags.cats[String(index)] = category;
        // we deliberately skip idx === modnum, that's the deleted change
      } else if (index > modnum) {
        newFlags.cats[String(index - 1)] = category;
      }
    });

    // Then, sort and reorder the flags for the effect's situational settings.
    flagArraySituational.sort(); // explicitly sort to guarantee we iterate in numerical order
    flagArraySituational.forEach((chg) => {
      const index = Number(chg[0]);
      const situationalSettings = chg[1];
      if (index < modnum) {
        newFlags.situational[String(index)] = situationalSettings;
        // we deliberately skip idx === modnum, that's the deleted change
      } else if (index > modnum) {
        newFlags.situational[String(index - 1)] = situationalSettings;
      }
    });

    // Finally, update the underlying AE
    await this.object.unsetFlag(game.system.id, "changes");

    const prop = `flags.${game.system.id}.changes`;
    await this.object.update({
      changes,
      [prop]: newFlags,
    });
    return this.submit({ preventClose: true }).then(() => this.render());
  }

  getData() {
    LOGGER.trace("getData | CPRActiveEffectSheet | Called.");
    const data = super.getData();
    return data;
  }
}
