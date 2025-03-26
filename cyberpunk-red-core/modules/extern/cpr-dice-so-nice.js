/* global game */
import LOGGER from "../utils/cpr-logger.js";

/**
 * We use custom chat cards for dice rolls, so we have to override the dice card behaviours
 * provided by DiceSoNice.
 *
 * See https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/wikis/API/Roll
 */
export default class DiceSoNice {
  static async ShowDiceSoNice(roll, rollModeOverride) {
    LOGGER.trace("ShowDiceSoNice | DiceSoNice | called.");
    if (
      game.modules.get("dice-so-nice") &&
      game.modules.get("dice-so-nice").active
    ) {
      let whisper = null;
      let blind = false;
      const rollMode =
        rollModeOverride || game.settings.get("core", "rollMode");
      switch (rollMode) {
        case "blindroll": {
          // GM only
          blind = true;
          break;
        }
        case "gmroll": {
          // GM + rolling player
          const gmList = game.users.filter((user) => user.isGM);
          const gmIDList = [];
          gmList.forEach((gm) => gmIDList.push(gm._id));
          whisper = gmIDList;
          break;
        }
        case "selfroll": {
          whisper = [game.user.id];
          break;
        }
        case "roll": {
          // everybody
          const userList = game.users.filter((user) => user.active);
          const userIDList = [];
          userList.forEach((user) => userIDList.push(user._id));
          whisper = userIDList;
          break;
        }
        default:
      }
      await game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
    }
  }
}
