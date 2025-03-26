import * as actorHooks from "../hooks/actor.js";
import * as tokenHooks from "../hooks/token.js";
import * as actorSheetHooks from "../hooks/actor-sheet.js";
import * as chatHooks from "../hooks/chat.js";
import * as itemHooks from "../hooks/item.js";
import * as tokenHudHooks from "../hooks/tokenhud.js";
import * as uiHooks from "../hooks/ui.js";
import * as hotbarHooks from "../hooks/hotbar.js";
import * as externalHooks from "../hooks/external-modules.js";

export default function registerHooks() {
  actorHooks.default();
  actorSheetHooks.default();
  chatHooks.default();
  itemHooks.default();
  tokenHudHooks.default();
  uiHooks.default();
  hotbarHooks.default();
  tokenHooks.default();
  externalHooks.default();
}
