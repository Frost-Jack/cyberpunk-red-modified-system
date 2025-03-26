import * as Migrations from "./scripts/index.js";
import LOGGER from "../../utils/cpr-logger.js";
import CPRSystemUtils from "../../utils/cpr-systemUtils.js";

/**
 * This class provides a method to find and execute all migrations that are needed
 * to get the data to the latest data model.
 */
export default class MigrationRunner {
  /**
   * This is the top level entry point for executing migrations. This code assumes the user is a GM. It will
   * figure out what migrations to run, and dispatch them for execution.
   *
   * @param {Number} currDataModelVersion - the current data model version
   * @param {Number} newDataModelVersion - the data model version we want to get to, may be multiple versions ahead
   * @returns {Boolean} - True if all migrations completed successfully or no migrations are needed
   */
  async migrateWorld(currDataModelVersion, newDataModelVersion) {
    LOGGER.trace("migrateWorld | MigrationRunner");
    this.allMigrations = Migrations;
    this.migrationsToDo = MigrationRunner._getMigrations(
      currDataModelVersion,
      newDataModelVersion
    );

    // No migration needed, return true
    if (this.migrationsToDo.length === 0) {
      return true;
    }

    CPRSystemUtils.DisplayMessage(
      "notify",
      `Beginning Migrations of Cyberpunk Red Core from Data Model ${currDataModelVersion} to ${newDataModelVersion}.`
    );
    CPRSystemUtils.DisplayMessage(
      "warn",
      CPRSystemUtils.Localize("CPR.migration.status.waitForEnd")
    );
    if (await MigrationRunner.runMigrations(this.migrationsToDo)) {
      CPRSystemUtils.DisplayMessage(
        "notify",
        CPRSystemUtils.Localize("CPR.migration.status.migrationsComplete")
      );
      return true;
    }

    return false;
  }

  /**
   * Run all of the migrations in the right order, waiting for them to complete before proceeding to the next.
   * There's a lot of async/await wrangling going on here; still an amateur on JS asynchronicity.
   *
   * @param {Array[CPRMigration]} migrationsToDo
   * @returns {Boolean} - True if all migrations completed successfully
   */
  static async runMigrations(migrationsToDo) {
    LOGGER.trace("runMigrations | MigrationRunner");
    for (const migration of migrationsToDo) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await migration.run();
        if (!result) return false;
      } catch (err) {
        CPRSystemUtils.DisplayMessage(
          "error",
          `Fatal error while migrating to ${migration.version}: ${err.message}`
        );
        return false;
      }
      if (migration.flush) {
        CPRSystemUtils.DisplayMessage(
          "notify",
          `Migration to data model ${migration.version} complete, please refresh your browser tab to continue.`
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Knowing the data models, figure out which migration scripts (as objects) to run.
   *
   * @param {Number} currDataModelVersion - the current data model version
   * @param {Number} newDataModelVersion - the data model version we want to get to, may be multiple versions ahead
   * @return {Array} - an ordered list of objects from each relevant migration script
   */
  static _getMigrations(currDataModelVersion, newDataModelVersion) {
    LOGGER.trace("_getMigrations | MigrationRunner");
    const migrations = Object.values(Migrations).map((M) => new M());
    return migrations
      .filter(
        (m) =>
          m.version > currDataModelVersion && m.version <= newDataModelVersion
      )
      .sort((a, b) => (a.version > b.version ? 1 : -1));
  }
}
