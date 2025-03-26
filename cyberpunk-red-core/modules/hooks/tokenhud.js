/* global game Hooks renderTemplate */
import LOGGER from "../utils/cpr-logger.js";
import HudInterface from "../hud/interface.js";

/**
 * Hooks have a set of args that are passed to them from Foundry. Even if we do not use them here,
 * we document them all for clarity's sake and to make future development/debugging easier.
 */
const tokenHudHooks = () => {
  /**
   * The renderTokenHUD Hook is provided by Foundry and triggered here. When a token is clicked and the HUD is drawn
   * around it, this hook fires. We use this hook to present the DV icon for showing a ranged attack DV with a ruler.
   *
   * @public
   * @memberof hookEvents
   * @param {Document} hud       Instance of the token HUD provided by Foundry
   * @param {object} html        HTML DOM object
   * @param {string} token       token data
   */
  Hooks.on("renderTokenHUD", async (hud, html, token) => {
    LOGGER.trace("renderTokenHUD | tokenHudHooks | Called.");
    // Configure DV Ruler
    const dvHudTemplate = `systems/${game.system.id}/templates/hud/dv.hbs`;
    const dvDisplay = await renderTemplate(dvHudTemplate, token.flags);
    html.find("div.left").append(dvDisplay);
    html.find(".dv-table-selector").click(() => {
      HudInterface.SetDvTable(token);
      hud.clear();
    });
    // Any other HUD code
  });
};

export default tokenHudHooks;
