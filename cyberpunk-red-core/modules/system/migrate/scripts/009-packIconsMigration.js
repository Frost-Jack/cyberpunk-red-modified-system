/* eslint-disable foundry-cpr/logger-after-function-definition */
/* global game */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

/**
 * This migration updates icons on owned items to match up with what is
 * introduced in the compendia this release.
 */
export default class PackIconMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | PackIcon Migration");
    super();
    this.version = 9;
    this.name = "PackIcon Migration";
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
    const basePath = `systems/${game.system.id}/icons/compendium`;
    const itemImage = item.img;

    // Update drug images
    const drugIcons = [
      `${basePath}/gear/antibiotics.svg`,
      `${basePath}/gear/black_lace.svg`,
      `${basePath}/gear/blue_glass.svg`,
      `${basePath}/gear/boost.svg`,
      `${basePath}/gear/rapidetox.svg`,
      `${basePath}/gear/smash.svg`,
      `${basePath}/gear/speedheal.svg`,
      `${basePath}/gear/stim.svg`,
      `${basePath}/gear/surge.svg`,
      `${basePath}/gear/synthcoke.svg`,
    ];
    if (drugIcons.includes(itemImage)) {
      const newPath = itemImage.replace("gear", "drugs");
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Update Upgrade images
    if (itemImage.includes(`${basePath}/item_upgrades`)) {
      const newPath = itemImage.replace("item_upgrades", "upgrades");
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Update vehicle images
    if (itemImage.includes(`${basePath}/vehicle`)) {
      const newPath = itemImage.replace("vehicle", "vehicles");
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Migrate old unused netrunning icons on items
    const imageMap = {
      "icons/default/Black_Ice.png":
        "icons/compendium/default/default-blackice.svg",
      "icons/netrunning/Demon.png":
        "icons/compendium/default/default-demon.svg",
    };

    const itemShortPath = itemImage.split("/").slice(2).join("/");
    if (itemShortPath in imageMap) {
      updateData.img = `systems/${game.system.id}/${imageMap[itemShortPath]}`;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Update net-rolltable images
    const itemNames = [
      "All Other Floors (Advanced)",
      "All Other Floors (Basic)",
      "All Other Floors (Standard)",
      "All Other Floors (Uncommon)",
      "First Two Floors (The Lobby)",
    ];
    if (item.name in itemNames) {
      const newPath = `${basePath}/default/Default_Dice.svg`;
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Update flamethrower images
    if (itemImage.includes(`${basePath}/weapons/Flamethrower.svg`)) {
      const newPath = itemImage.replace("Flamethrower", "flamethrower");
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Update throen weapon images
    if (itemImage.includes("icons/compendium/weapons/Thrown_Weapon.svg")) {
      const newPath = itemImage.replace("Thrown_Weapon", "thrown_weapon");
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Update cyberdeck icon path
    if (itemImage.includes("icons/compendium/gear/cyberdeck.svg")) {
      const newPath = itemImage.replace("gear", "default");
      updateData.img = newPath;
      return item.isOwned ? updateData : item.update(updateData);
    }

    if (item.type === "armor") {
      const armors = {
        flakBody: {
          img: "armor/flak_body.svg",
          names: [
            "Antischegge (Corpo)",
            "Armadura (corpo)",
            "Flakanzug (Körper)",
            "Flak (Body)",
            "Flak (Corps)",
            "Flak (Cuerpo)",
            "Ubiór kuloodporny (Ciało)",
            "Костюм сапёра",
          ],
        },
        flakHead: {
          img: "armor/flak_head.svg",
          names: [
            "Antischegge (Testa)",
            "Armadura (cabeça)",
            "Flakanzug (Kopf)",
            "Flak (cabeza)",
            "Flak (Head)",
            "Flak (Tête)",
            "Ubiór kuloodporny (Głowa)",
            "Шлем сапёра",
          ],
        },
        heavyArmorjackBody: {
          img: "armor/heavy-armorjack_body.svg",
          names: [
            "Armorjack Pesado (cuerpo)",
            "Ciężka kurtka kuloodporna (Ciało)",
            "Colete Pesado",
            "Corazza Pesante (Corpo)",
            "Heavy Armorjack (Body)",
            "Schwerer Panzeranzug (Körper)",
            "Tenue pare-balles lourde (Corps)",
            "Тяжёлый бронекостюм",
          ],
        },
        heavyArmorjackHead: {
          img: "armor/heavy-armorjack_head.svg",
          names: [
            "Armorjack Pesado (cabeza)",
            "Capacete Pesado",
            "Ciężka kurtka kuloodporna (Głowa)",
            "Corazza Pesante (Testa)",
            "Heavy Armorjack (Head)",
            "Schwerer Panzeranzug (Kopf)",
            "Tenue pare-balles lourde (Tête)",
            "Тяжёлый бронешлем",
          ],
        },
        kevlarBody: {
          img: "armor/kevlar_body.svg",
          names: [
            "Kevlar (Body)",
            "Kevlar (Ciało)",
            "Kevlar (corpo)",
            "Kevlar (Corpo)",
            "Kevlar (Corps)",
            "Kevlar (Cuerpo)",
            "Kevlar (Körper)",
            "Кевларовый жилет",
          ],
        },
        kevlarHead: {
          img: "armor/kevlar_head.svg",
          names: [
            "Kevlar (cabeça)",
            "Kevlar (Cabeza)",
            "Kevlar (Głowa)",
            "Kevlar (Head)",
            "Kevlar (Kopf)",
            "Kevlar (Testa)",
            "Kevlar (Tête)",
            "Кевларовый шлем",
          ],
        },
        leathersBody: {
          img: "armor/leathers_body.svg",
          names: [
            "Couro (Corpo)",
            "Cueros (Cuerpo)",
            "Cuir (Corps)",
            "Cuoio (Corpo)",
            "Leathers (Body)",
            "Lederkluft (Körper)",
            "Skóry (Ciało)",
            "Кожанка",
          ],
        },
        leathersHead: {
          img: "armor/leathers_head.svg",
          names: [
            "Couros (Cabeça)",
            "Cueros (Cabeza)",
            "Cuir (Tête)",
            "Cuoio (Testa)",
            "Leathers (Head)",
            "Lederkluft (Kopf)",
            "Skóry (Głowa)",
            "Кожанный шлем",
          ],
        },
        lightArmorjackHead: {
          img: "armor/light-armorjack_head.svg",
          names: [
            "Armorjack Ligero (Cabeza)",
            "Capacete Leve",
            "Corazza Leggera (Testa)",
            "Leichter Panzeranzug (Kopf)",
            "Lekka kurtka kuloodporna (Głowa)",
            "Light Armorjack (Head)",
            "Tenue pare-balles légère (Tête)",
            "Лёгкий бронешлем",
          ],
        },
        lightArmorjackBody: {
          img: "armor/light-armorjack_body.svg",
          names: [
            "Armorjack Ligero (Cuerpo)",
            "Colete Leve",
            "Corazza Leggera (Corpo)",
            "Leichter Panzeranzug (Körper)",
            "Lekka kurtka kuloodporna (Ciało)",
            "Light Armorjack (Body)",
            "Tenue pare-balles légère (Corps)",
            "Лёгкий бронекостюм",
          ],
        },
        mediumArmorjackBody: {
          img: "armor/medium-armorjack_body.svg",
          names: [
            "Armorjack Medio (Cuerpo)",
            "Colete Médio",
            "Corazza Media (Corpo)",
            "Medium Armorjack (Body)",
            "Mittelschwerer Panzeranzug (Körper)",
            "Średnia kurtka kuloodporna (Ciało)",
            "Tenue pare-balles moyenne(Corps)",
            "Средний бронекостюм",
          ],
        },
        mediumArmorjackHead: {
          img: "armor/medium-armorjack_head.svg",
          names: [
            "Armorjack Medio (Cabeza)",
            "Capacete Médio (cabeça)",
            "Corazza Media (Testa)",
            "Medium Armorjack (Head)",
            "Mittelschwerer Panzeranzug (Kopf)",
            "Średnia kurtka kuloodporna (Głowa)",
            "Tenue pare-balles moyenne (Tête)",
            "Средний бронешлем",
          ],
        },
        metalgearBody: {
          img: "armor/metalgear_body.svg",
          names: [
            "Exoesqueleto (Corpo)",
            "Metalgear (Body)",
            "Metalgear (Ciało)",
            "Metalgear (Corpo)",
            "Metalgear (Corps)",
            "Metalgear (Cuerpo)",
            "Metalgear (Körper)",
            "Металлическая броня",
          ],
        },
        metalgearHead: {
          img: "armor/metalgear_head.svg",
          names: [
            "Exoesqueleto (cabeça)",
            "MetValgear (Cabeza)",
            "Metalgear (Głowa)",
            "Metalgear (Head)",
            "Metalgear (Kopf)",
            "Metalgear (Testa)",
            "Metalgear (Tête)",
            "Металлический шлем",
          ],
        },
      };
      for (const [key, value] of Object.entries(armors)) {
        const armorNames = value.names;
        if (armorNames.includes(item.name)) {
          const newPath = `${basePath}/${value.img}`;
          updateData.img = newPath;
          return item.isOwned ? updateData : item.update(updateData);
        }
      }
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
    const actorIcon = actor.img;
    const imageMap = {
      "icons/netrunning/Black_Ice.png":
        "icons/compendium/default/default-blackice.svg",
      "icons/netrunning/Demon.png":
        "icons/compendium/default/default-demon.svg",
    };
    const actorIconPath = actorIcon.split("/").slice(2).join("/");

    if (actorIconPath in imageMap) {
      await actor.update({
        img: `systems/${game.system.id}/${imageMap[actorIconPath]}`,
      });
      await actor.update({
        "prototypeToken.texture.src": `systems/${game.system.id}/${imageMap[actorIconPath]}`,
      });
    }

    const itemUpdates = [];
    for (const item of actor.items) {
      // eslint-disable-next-line no-await-in-loop
      const updateData = await PackIconMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
