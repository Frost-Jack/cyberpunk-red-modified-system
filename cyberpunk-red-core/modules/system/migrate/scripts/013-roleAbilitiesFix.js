/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * See #812 for details about this migration.
 */
export default class RoleAbilitiesFix extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | RoleAbilitiesFix Migration");
    super();
    this.version = 13;
    this.name = "Migration Fix for Role Abilities";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | ${this.version}-${this.name}`);
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
   * Simply make sure owned items are updated too.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);

    const actorRoles = actor.items.filter((i) => i.type === "role");

    const ownedItemUpdates = [];
    for (const role of actorRoles) {
      const newAbilities = [];
      const roleAbilities = role.system.abilities;
      for (const ability of roleAbilities) {
        if (typeof ability.bonuses !== "object") {
          ability.bonuses = [];
        }
        newAbilities.push(ability);
      }
      const itemData = {
        _id: role._id,
        "system.abilities": newAbilities,
      };
      ownedItemUpdates.push(itemData);
    }
    return actor.updateEmbeddedDocuments("Item", ownedItemUpdates);
  }
}
