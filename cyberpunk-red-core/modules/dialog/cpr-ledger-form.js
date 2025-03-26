/* globals mergeObject duplicate game setProperty getProperty */
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";
import CPRDialog from "./cpr-dialog-application.js";

/**
 * Dialog which extends CPRDialog to display and modify the ledger property.
 */
export default class CPRLedger extends CPRDialog {
  constructor(actor, propName, options) {
    LOGGER.trace("constructor | CPRDialog | Called.");
    super(actor.system[propName], options);
    this.actor = actor;
    this.total = actor.system[propName].value;

    // Generates the localization strings for:
    //   "CPR.ledger.wealth"
    //   "CPR.ledger.improvementpoints"
    //    "CPR.ledger.reputation"
    // This comment has been added to allow for automated checks
    // of localization strings in the code.
    this.propName = propName;
    this.ledgername = "CPR.ledger.".concat(propName.toLowerCase());
    // Set title.
    this.options.title = SystemUtils.Format("CPR.ledger.title", {
      property: SystemUtils.Localize(this.ledgername),
    });
    this.contents = actor.listRecords(propName);
    this._makeLedgerReadable(propName);
  }

  /**
   * Set default options for the ledger.
   * See https://foundryvtt.com/api/Application.html for the complete list of options available.
   *
   * @static
   * @override
   */
  static get defaultOptions() {
    LOGGER.trace("defaultOptions | CPRLedger | called.");
    return mergeObject(super.defaultOptions, {
      // The title is set in the constructor above.
      template: `systems/${game.system.id}/templates/dialog/cpr-ledger-form.hbs`,
      width: 600,
      height: 340,
      submitOnChange: false,
      closeOnSubmit: false,
    });
  }

  /**
   * Set the data used for the ledger template.
   *
   * @return {Object} - a structured object representing ledger data.
   */
  getData() {
    LOGGER.trace("getData | CPRLedger | called.");
    super.getData();
    const data = {
      total: this.total,
      ledgername: this.ledgername,
      contents: this.contents,
      isGM: game.user.isGM,
    };
    return data;
  }

  /**
   * Add listeners specific to the Ledger.
   *
   * @param {*} html - the DOM object
   */
  activateListeners(html) {
    LOGGER.trace("activateListeners | CPRLedger | called.");

    html
      .find(".delete-ledger-line")
      .click((event) => this._deleteLedgerLine(event));

    html
      .find(".ledger-edit-button")
      .click((event) => this._updateLedger(this.propName, event));

    super.activateListeners(html);
  }

  /**
   * Called when any of the 3 glyphs to change the ledger is clicked. This saves the change and a reason
   * if provided to the actor in the form of a ledger-line.
   *
   * @callback
   * @private
   * @param {string} ledgerProp - currently can be "wealth", "reputation", or "improvementPoints"
   * @param {*} event - object with details of the event
   */
  _updateLedger(ledgerProp, event) {
    LOGGER.trace("_updateLedger | CPRCharacterActorSheet | Called.");
    let { value } = this.form[0];
    const reason = this.form[1].value;
    let action = SystemUtils.GetEventDatum(event, "data-action");
    if (value !== "") {
      value = parseInt(value, 10);
      if (Number.isNaN(value)) {
        action = "error";
      }
      switch (action) {
        case "add": {
          // Update actor's ledger.
          this.actor.sheet._gainLedger(
            ledgerProp,
            value,
            `${reason} - ${game.user.name}`
          );
          // Update the ledger application's total.
          this.total += value;
          break;
        }
        case "subtract": {
          // Update actor's ledger.
          this.actor.sheet._loseLedger(
            ledgerProp,
            value,
            `${reason} - ${game.user.name}`
          );
          // Update ledger application total.
          // If a user puts in a negative number and then hits the Subtract action, the system assumes the user intended to subtract.
          // This is true in cpr-actor-sheet.js --> _loseLedger() and was mimicked from there for consistency;
          if (value <= 0) {
            this.total += value;
          } else {
            this.total -= value;
          }
          break;
        }
        case "set": {
          // Update actor's ledger.
          this.actor.sheet._setLedger(
            ledgerProp,
            value,
            `${reason} - ${game.user.name}`
          );
          // Update ledger applciation total.
          this.total = value;
          break;
        }
        default: {
          SystemUtils.DisplayMessage(
            "error",
            SystemUtils.Localize("CPR.messages.eurobucksModifyInvalidAction")
          );
          break;
        }
      }
      // Update ledger application contents.
      this.contents = duplicate(this.actor.listRecords(this.propName));
      this._makeLedgerReadable(this.propName);
      this.render();
    } else {
      SystemUtils.DisplayMessage(
        "warn",
        SystemUtils.Localize("CPR.messages.eurobucksModifyWarn")
      );
    }
  }

  /**
   * Strip the first word of the string (wealth, reputation, or improvementPoints)
   * to make the ledger more human readable.
   *
   * @param {String} name - Name of the ledger
   */
  _makeLedgerReadable() {
    LOGGER.trace("_makeLedgerReadable | CPRLedger | called.");
    this.contents.forEach((element, index) => {
      const tmp = element[0].replace(this.propName, "").trim();
      this.contents[index][0] = tmp[0].toUpperCase() + tmp.slice(1);
    });
  }

  /**
   * Delete a single line from the ledger of the actor and re-render the ledger afterwards.
   * This should only be available to the GM, as the button is hidden in the hbs file.
   *
   * @param {Object} event - Event Data contianing the line to delete
   */
  async _deleteLedgerLine(event) {
    LOGGER.trace("_deleteLedgerLine | CPRLedger | called.");
    const lineId = SystemUtils.GetEventDatum(event, "data-line");
    this.contents = duplicate(this.actor.listRecords(this.propName));
    let numbers = this.contents[lineId][0].match(/\d+/g);
    if (numbers === null) {
      numbers = ["NaN"];
    }
    const promptContent = {
      transaction: this.contents[lineId][0],
      reason: this.contents[lineId][1],
      value: numbers[0],
    };
    // Check if value should also be changed. Show "Ledger Deletion" prompt.
    const confirmDelete = await CPRDialog.showDialog(promptContent, {
      // Set options for dialog.
      title: SystemUtils.Localize("CPR.dialog.ledgerDeletion.title"),
      template: `systems/${game.system.id}/templates/dialog/cpr-ledger-deletion-prompt.hbs`,
      // Define custom buttons for this dialog.
      buttons: {
        yesAdd: {
          icon: "fas fa-check",
          label: SystemUtils.Localize("CPR.dialog.ledgerDeletion.yesAdd"),
          callback: (dialog) => {
            mergeObject(dialog.object, { action: true, sign: 1 });
            dialog.confirmDialog();
          },
        },
        yesSubtract: {
          icon: "fas fa-check",
          label: SystemUtils.Localize("CPR.dialog.ledgerDeletion.yesSubtract"),
          callback: (dialog) => {
            mergeObject(dialog.object, { action: true, sign: -1 });
            dialog.confirmDialog();
          },
        },
        no: {
          icon: "fas fa-times",
          label: SystemUtils.Localize("CPR.dialog.common.no"),
          callback: (dialog) => {
            mergeObject(dialog.object, { action: false });
            dialog.confirmDialog();
          },
        },
        cancel: {
          icon: "fas fa-times",
          label: SystemUtils.Localize("CPR.dialog.common.cancel"),
          callback: (dialog) => dialog.closeDialog(),
        },
      },
      buttonDefault: "cancel",
      overwriteButtons: true,
    }).catch((err) => LOGGER.debug(err));
    if (confirmDelete === undefined) {
      return;
    }
    this.contents.splice(lineId, 1);
    const dataPointTransactions = `system.${this.propName}.transactions`;
    const cprActorData = duplicate(this.actor);
    setProperty(cprActorData, dataPointTransactions, this.contents);
    // Change the value if desired.
    if (confirmDelete.action && numbers[0] !== "NaN") {
      const dataPointValue = `system.${this.propName}.value`;
      const value = getProperty(cprActorData, dataPointValue);
      setProperty(
        cprActorData,
        dataPointValue,
        value + confirmDelete.sign * numbers[0]
      );
      // Update ledger application total.
      this.total = value + confirmDelete.sign * numbers[0];
    }
    // Update actor's ledger.
    await this.actor.update(cprActorData);
    this._makeLedgerReadable(this.propName);
    this.render();
  }
}
