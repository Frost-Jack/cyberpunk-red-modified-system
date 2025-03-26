/* global Hooks game */
import LOGGER from "../utils/cpr-logger.js";
import CPRChat from "../chat/cpr-chat.js";

/**
 * Hooks have a set of args that are passed to them from Foundry. Even if we do not use them here,
 * we document them all for clarity's sake and to make future development/debugging easier.
 */
const chatHooks = () => {
  /**
   * The renderChatMessage Hook is provided by Foundry and triggered here. When a chat message is rendered, this hook is called.
   * In this hook we inject a few UI "tags" for rolls and whispers make it more clear that private messages are being sent
   * or received. This also enables listeners so that clickable damage glyphs work.
   *
   * @public
   * @memberof hookEvents
   * @param {ChatMessageData} (unused) - an instance of the ChatMessageData object provided by Foundry
   * @param {object} html              - the HTML DOM of the chat card
   * @param {string} msg               - our simulation of the ChatData object that provides options and flags about the chat message
   */
  Hooks.on("renderChatMessage", async (_, html, msg) => {
    LOGGER.trace("renderChatMessage | chatHooks | Called.");
    // Do not display "Blind" chat cards to non-gm
    // Foundry doesn't support blind chat messages so this is how we get around that.
    if (html.hasClass("blind") && !game.user.isGM) {
      html.find(".message-header").remove(); // Remove header so Foundry does not attempt to update its timestamp
      html.html("").css("display", "none");
    }
    CPRChat.chatListeners(html);
    CPRChat.addMessageTags(html, msg);
  });

  /**
   * The chatMessage Hook is provided by Foundry and triggered here. When a chat message is sent, this hook is called.
   * For this one we intercept the chat message text and check if the /red command was invoked. If it was, handle it.
   *
   * @public
   * @memberof hookEvents
   * @param {ChatLog} (unused)     - an instance of the ChatLog object provided by Foundry
   * @param {object} message       - the text of the message sent
   * @param {string} (unused)      - our simulation of the ChatData object that provides options and flags for the message
   * @return {boolean|void}         Explicitly return false to prevent creation of this Document
   */
  // for now, we intentionally do not use log (ChatLog) or data (ChatData)
  Hooks.on("chatMessage", (_, message) => {
    LOGGER.trace("chatMessage | chatHooks | Called.");
    if (message !== undefined && message.startsWith("/red")) {
      const fragment = message.slice(4);
      CPRChat.HandleCPRCommand(fragment);
      // do not continue further processing of the ChatMessage
      return false;
    }
    // permit Foundry to display the chat message we caught as-is
    return true;
  });
};

export default chatHooks;
