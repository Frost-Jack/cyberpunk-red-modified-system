/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global duplicate parseUuid */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

export default class v11EffectsMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | JunkData Migration");
    super();
    this.version = 21;
    this.name = "v11 Effects Migration";
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
   * In `actor.getData()` we were erroneously adding datapoints that are not in our datamodel.
   * This removes them.
   *
   * Additionally, in Foundry v11, items with AEs no longer duplicate them to the actor.
   * Thus, without migration there would be duplicate effects showing up, one from the actor,
   * and one from the item. This removes the duplicate effects from the actor.
   *
   * Finally, in v10, once an effect has been copied to an actor, any updates to that effect
   * only change the actor's effect, not the origin item's effect. For v11, we must update the
   * item's effect to match the origin actor's effect (that we will then delete).
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    const updateData = duplicate(actor.toObject().system);

    // Remove accidental junk data:
    updateData["-=fightOptions"] = null;
    updateData["-=fightState"] = null;
    updateData["-=cyberdeck"] = null;
    updateData["-=filteredEffects"] = null;

    // De-duplicate active effects:
    const deleteIds = [];
    for (const effect of actor.effects.contents) {
      if (effect.origin?.match("Item")) {
        // Log effect ID for deleting off actor.
        deleteIds.push(effect.id);

        // Update item's effect with the actor's effect information.
        // We need to get the ID from the UUID becuase the UUID may not actually
        // reference the actor it is currently on. Confusing!
        const parsedUuid = parseUuid(effect.origin);
        const index = parsedUuid.embedded.indexOf("Item") + 1;
        const id = parsedUuid.embedded[index];

        // Finally, get origin item.
        const originItem = actor.items.find((i) => i.id === id);

        if (originItem) {
          // From item, get origin effect.
          const originEffect = originItem.effects.find(
            (e) => e.name === effect.name
          );

          // Get relevant info from the actor's effect we're about to delete.
          const { disabled } = effect;
          const { system } = effect;

          // Update the item's effect with the actor's effect's info.
          originEffect.update({ disabled, system });
        }
      }
    }
    await actor.deleteEmbeddedDocuments("ActiveEffect", deleteIds);
    return actor.update({ system: updateData });
  }
}
