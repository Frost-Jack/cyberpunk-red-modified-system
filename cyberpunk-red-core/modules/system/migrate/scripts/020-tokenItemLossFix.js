/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global duplicate */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * See `migrateToken()` below.
 */
export default class TokenItemLossMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | Black Ice Notes - Migration");
    super();
    this.version = 20;
    this.name = "Token Item Loss - Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | ${this.version}-${this.name}`);
    CPRSystemUtils.DisplayMessage(
      "notify",
      CPRSystemUtils.Localize("CPR.migration.effects.beginMigration")
    );
    LOGGER.log(`Starting migration: ${this.name}`);
  }

  /**
   * Takes place after the data migration completes.
   */
  async postMigrate() {
    LOGGER.trace(`postMigrate | ${this.version}-${this.name}`);
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * We thought we had fixed Issue #890 (Changed unlinked token actor data not retained after migration to Foundry v11)
   * in 0.88.0 with the null `_stats` migration but I guess we had not. The official fix for the issue is that we should
   * make an update that hits *every* token. (See https://github.com/foundryvtt/foundryvtt/issues/9939#issuecomment-1688775290
   * from Foundry staff.) Since we don't want to actually change anything, we will just set the token's name to itself with
   * an update operation where `diff: false` which will force the update regardless of whether there is a difference
   * or not.
   *
   * @param {CPRActor} token - an unlinked token
   */
  async migrateToken(token) {
    LOGGER.trace(`migrateToken | ${this.version}-${this.name}`);
    const deltaName = duplicate(token.delta.name);
    return token.update({ delta: { name: deltaName } }, { diff: false });
  }
}
