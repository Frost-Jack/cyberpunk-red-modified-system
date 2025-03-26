/* global game */

import CPRItem from "../cpr-item.js";
import LOGGER from "../../utils/cpr-logger.js";

/**
 * Extend the base CPRItem object with things specific to Programs.
 * @extends {CPRItem}
 */
export default class CPRProgramItem extends CPRItem {
  /**
   * Program Code
   *
   * The methods below apply to the CPRItem.type = "program"
   */

  /**
   * Sets a program to uninstalled.
   *
   * @public
   */
  setInstalled() {
    LOGGER.trace("setInstalled | CPRProgramItem | Called.");
    this.system.isInstalled = true;
  }

  /**
   * Sets a program to uninstalled.
   *
   * @public
   */
  unsetInstalled() {
    LOGGER.trace("unsetInstalled | CPRProgramItem | Called.");
    this.system.isInstalled = false;
  }

  /**
   * Returns a boolean if the program is installed.
   *
   * @public
   */
  getInstalled() {
    LOGGER.trace("getInstalled | CPRProgramItem | Called.");
    return this.system.isInstalled;
  }

  /**
   * Sets a program to uninstalled.
   *
   * @public
   */
  setRezzed(instanceId = null) {
    LOGGER.trace("setRezzed | CPRProgramItem | Called.");
    if (instanceId) {
      this.setFlag(game.system.id, "rezInstanceId", instanceId);
    }
    this.system.isRezzed = true;
  }

  /**
   * Sets a program to uninstalled.
   *
   * @public
   */
  unsetRezzed() {
    LOGGER.trace("unsetRezzed | CPRProgramItem | Called.");
    this.system.isRezzed = false;
  }

  /**
   * Returns a boolean if the program is installed.
   *
   * @public
   */
  getRezzed() {
    LOGGER.trace("getRezzed | CPRProgramItem | Called.");
    return this.system.isRezzed;
  }
}
