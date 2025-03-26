/* global Handlebars */
/* eslint-env jquery */

import LOGGER from "./cpr-logger.js";

/**
 * CPR-C utilities that are used for Text manipulation
 */
export default class CPRTextUtils {
  /**
   * Strip out html markup from a string. This is done with a combination of
   * jQuery to remove the html tags, and a JavaScript built-in to remove URL
   * codes like "&nbsp;".
   *
   * @static
   * @param {String} html - the html string to convert into plain text
    @returns {String}
   */
  static stripHTML(html) {
    LOGGER.trace("stripHTML | CPRTextUtils | Called.");
    return new Handlebars.SafeString($("<div>").html(html).text());
  }

  /**
   * Sanitize a string with EnrichedText and HTML.
   *
   * This static method takes a string containing enriched text and performs
   * sanitization by stripping HTML tags and replacing @UUID references with
   * their associated text.
   *
   * @param {string} str - The enriched text to be sanitized.
   * @returns {string} The sanitized text with HTML tags removed and @UUID
   *                   references replaced.
   *
   * @example
   * const enrichedText = "Some text @UUID[Actor.xjfzYCPKxygh3dSZ]{...}";
   * const sanitizedText = YourClass.sanitizeEnrichedText(enrichedText);
   * // Returns the sanitized version of the enriched text.
   */
  static sanitizeEnrichedText(str) {
    LOGGER.trace("sanitizeEnrichedText | CPRTextUtils | Called.");

    // Ensure str is not empty before proceeding
    if (typeof str !== "string") {
      // Handle cases where str is not a string
      // For example, you can return an empty string or handle it differently
      return "";
    }

    // Strip any UUID references from the string
    const uuidRegex = /@UUID\[[^\]]+\]{([^}]+)}/g;
    const strippedUuids = str.replace(
      uuidRegex,
      (match, capturedText) => capturedText
    );
    // Then strip any HTML
    const sanitizedText = this.stripHTML(strippedUuids).toString();

    return sanitizedText;
  }
}
