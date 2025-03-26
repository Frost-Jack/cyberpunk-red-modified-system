import CPRItem from "../cpr-item.js";
import LOGGER from "../../utils/cpr-logger.js";

/**
 * Extend the base CPRItem object with things specific to cyberware.
 * @extends {CPRItem}
 */
export default class CPRCyberwareItem extends CPRItem {
  /**
   * Perform a cyberware-specific action. Most of these map to attackable (mixin) calls
   * for cyberware that is an embedded weapon. This assumes the Item is also attackable.
   *
   * @param {CPRActor} actor - who is doing the action?
   * @param {*} actionAttributes - data from the event indicating the type of action
   * @returns null for invalid actions
   */
  _cyberwareAction(actor, actionAttributes) {
    LOGGER.trace("_cyberwareAction | CPRCyberwareItem | Called.");
    const actionData = actionAttributes["data-action"].nodeValue;
    switch (actionData) {
      case "select-ammo":
      case "unload":
      case "load":
      case "reload-ammo":
      case "measure-dv": {
        return this._weaponAction(actor, actionAttributes);
      }
      default:
    }
    return null;
  }

  /**
   * This overrides the uninstallItems function, forcing a
   * recursive uninstall
   * @param {Array} itemList - Array of objects to uninstall
   * @param {Boolean} recursive  - Boolean stating if the uninstallation should be recursive
   *                               in that each item uninstalled should also have it's own
   *                               installed items removed.  This is needed for Cyberware uninstallations.
   * @returns {Promise} - Promise containing an updated list of objects from updateEmbeddedDocuments()
   */
  // eslint-disable-next-line no-unused-vars
  async uninstallItems(itemList) {
    LOGGER.trace("uninstallItems | CPRCyberwareItem | Called.");
    let recursive = false;
    for (const item of itemList) {
      if (item.type === "cyberware") {
        recursive = true;
      }
    }
    return super.uninstallItems(itemList, recursive);
  }
}
