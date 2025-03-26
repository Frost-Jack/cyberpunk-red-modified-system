/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * See #273 and #394. This migration enable ammo items to override the damage
 * dealt by a weapon it is loaded into.
 */
export default class AmmoOverrideMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | Source Migration");
    super();
    this.version = 10;
    this.name = "Ammo Override Migration";
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
   * Here's the real work.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.trace(`migrateItem | ${this.version}-${this.name}`);
    const updateData = item.isOwned ? { _id: item._id } : {};

    // Get translation lists of ammo, group by similarity. Note, migrations will only occur if a user has not changed
    // the name of the item from the compendia.
    const translations = {
      biotoxinAmmo: [
        "Arrow (Biotoxin)",
        "Flecha (Biotoxina)",
        "Flèche (Biotoxine)",
        "Frecce (a Biotossina)",
        "Granada (Biotoxina)",
        "Granata (a Biotossina)",
        "Granate (Biotoxin)",
        "Grenade (Biotoxin)",
        "Grenade (Biotoxine)",
        "Paintball (Biotoxin)",
        "Pfeil (Biotoxin)",
      ],
      poisonAmmo: [
        "Arrow (Poison)",
        "Flecha (veneno)",
        "Flèche (Poison)",
        "Frecce (Avvelenate)",
        "Paintball (Posion)",
        "Pfeil (Gift)",
        "Poison Arrow",
      ],
      nonDamageAmmo: [
        "Arrow (Sleep)",
        "Flecha (Dormir)",
        "Flèche (Soporifique)",
        "Frecce (Soporifere)",
        "Granada (Dormir)",
        "Granada (FlashBang)",
        "Granada (Lacrimógena)",
        "Granata (Flashbang)",
        "Granata (Lacrimogena)",
        "Granata (Soporifera)",
        "Granate (Blendgranate)",
        "Granate (Schlaf)",
        "Granate (Tränengas)",
        "Grenade (Étourdissantes)",
        "Grenade (Flashbang)",
        "Grenade (Lacrymogène)",
        "Grenade (Sleep)",
        "Grenade (Soporifique)",
        "Grenade (Teargas)",
        "Pfeil (Schlaf)",
        "Bola de Pintura (Ácido)",
        "Bola de Pintura (Básica)",
        "Paintball (Acid)",
        "Paintball (Acide)",
        "Paintball (Acido)",
        "Paintball (Base)",
        "Paintball (Basic)",
        "Paintball (Basis)",
        "Paintball (Säure)",
        "Paintball (Standard)",
        "Granada (Humo)",
        "Granata (Fumogena)",
        "Granate (Rauch)",
        "Grenade (Fumigène)",
        "Grenade (Smoke)",
        "Granada (EMP por sus siglas en inglés)",
        "Granata (EMP)",
        "Granate (EMP)",
        "Grenade (EMP)",
        "Grenade (IEM)",
      ],
      shotgunShells: [
        "Cartucce a Pallini (Base)",
        "Cartuchos de Escopeta (Básicos)",
        "Chevrotine de fusil à pompe (Standard)",
        "Schrotpatrone (Basis)",
        "Shotgun Shell (Basic)",
        "Cartucce a Pallini (Incendiarie)",
        "Cartuchos de Escopeta (Incendiario)",
        "Chevrotine de fusil à pompe (Incendiaire)",
        "Schrotpatrone (Brand)",
        "Shotgun Shell (Incendiary)",
      ],
    };

    // These are the new datapoints that all ammo need.
    const overrides = {
      damage: {
        mode: "none",
        value: "3d6",
        minimum: "1d6",
      },
      autofire: {
        mode: "none",
        value: -1,
        minimum: 3,
      },
    };

    if (item.type === "ammo") {
      // For specific types of ammo, change the above overrides to fit their rules.
      if (
        translations.biotoxinAmmo.includes(item.name) ||
        translations.shotgunShells.includes(item.name)
      ) {
        overrides.damage.mode = "set";
        overrides.damage.value = "3d6";
      } else if (translations.poisonAmmo.includes(item.name)) {
        overrides.damage.mode = "set";
        overrides.damage.value = "2d6";
      } else if (translations.nonDamageAmmo.includes(item.name)) {
        overrides.damage.mode = "set";
        overrides.damage.value = "0";
      }
      updateData["system.overrides"] = overrides;
      return item.isOwned ? updateData : item.update(updateData);
    }

    return null;
  }

  /**
   * Simply make sure owned items are updated too.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    const itemUpdates = [];
    for (const item of actor.items) {
      // eslint-disable-next-line no-await-in-loop
      const updateData = await AmmoOverrideMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
