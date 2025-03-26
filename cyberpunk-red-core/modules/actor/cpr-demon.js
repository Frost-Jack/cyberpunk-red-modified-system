/* globals Actor */
import * as CPRRolls from "../rolls/cpr-rolls.js";
import CPR from "../system/config.js";
import CPRChat from "../chat/cpr-chat.js";
import LOGGER from "../utils/cpr-logger.js";
import SystemUtils from "../utils/cpr-systemUtils.js";

/**
 * Demons are very simple stand-alone actors right now.
 *
 * @extends {Actor}
 */
export default class CPRDemonActor extends Actor {
  /**
   * create() is called when the actor is... being created. All we do in here
   * is set "rez" to a resource bar.
   *
   * @static
   * @async
   * @param {Object} data - a complex structure of data used in creating the actor
   * @param {Object} options - unused here but passed up to the parent
   */
  static async create(data, options) {
    LOGGER.trace("create | CPRDemonActor | called.");
    const createData = data;
    if (typeof data.system === "undefined") {
      LOGGER.trace("create | New Actor | CPRDemonActor | called.");
      createData.token = {
        bar1: { attribute: "rez" },
      };
    }
    super.create(createData, options);
  }

  /**
   * Very simple code to roll a stat
   *
   * @param {String} statName - the name of the stat being rolled
   * @returns {CPRProgramStatRoll}
   */
  createStatRoll(statName) {
    LOGGER.trace("createStatRoll | CPRDemonActor | called.");
    const niceStatName = SystemUtils.Localize(CPR.demonStatList[statName]);
    const statValue = parseInt(this.system.stats[statName], 10);
    const cprRoll = new CPRRolls.CPRProgramStatRoll(niceStatName, statValue);

    if (cprRoll.rollCardExtraArgs.length === 0) {
      cprRoll.rollCardExtraArgs.program = {
        class: "demon",
      };
    }

    return cprRoll;
  }

  /**
   * Apply damage to the rez of the deamon.
   * @param {int} damage - direct damage dealt
   * @param {int} bonusDamage - bonus damage dealt
   */
  async _applyDamage(damage, bonusDamage) {
    LOGGER.trace("_applyDamage | CPRDemonActor | Called.");
    // As a Demon does not have any armor, the damage will be simply subtracted from the REZ.
    const currentRez = this.system.stats.rez.value;
    await this.update({
      "system.stats.rez.value": currentRez - damage - bonusDamage,
    });
    CPRChat.RenderDamageApplicationCard({
      actor: this,
      hpReduction: damage + bonusDamage,
      rezReduction: true,
    });
  }

  /**
   * Reverse rez damage to the actor, in case someone made a mistake applying it.
   *
   * @param {int} rezReduction - value of the damage taken
   */
  async _reverseDamage(rezReduction) {
    LOGGER.trace("_reverseDamage | CPRDemonActor | Called.");
    const currentRez = this.system.stats.rez.value;
    const updatedRez = Math.min(
      currentRez + rezReduction,
      this.system.stats.rez.max
    );
    await this.update({ "system.stats.rez.value": updatedRez });
  }

  /**
   * Given a stat name, return the value of it off the actor
   *
   * @param {String} statName - name (from CPR.statList) of the stat to retrieve
   * @returns {Number}
   */
  getStat(statName) {
    LOGGER.trace("getStat | CPRDemonActor | Called.");
    const statValue =
      statName === "rez"
        ? this.system.stats[statName].value
        : this.system.stats[statName];
    return parseInt(statValue, 10);
  }
}
