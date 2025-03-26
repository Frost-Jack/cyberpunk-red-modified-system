/* global Ruler canvas duplicate game */

export default function overrideRulerFunctions() {
  const foundryPrototype = Ruler.prototype._getSegmentLabel;
  Ruler.prototype._getSegmentLabel = function _getSegmentLabel(
    segment,
    totalDistance
  ) {
    const { distance } = segment;
    let returnLabel = foundryPrototype.call(
      "_getSegmentLabel",
      segment,
      totalDistance
    );
    if (this.user.isSelf) {
      let token = canvas.tokens.controlled["0"];
      if (!token) {
        const ownedTokens = canvas.tokens.ownedTokens.filter(
          (t) =>
            t.actor.constructor.name === "CPRCharacterActor" ||
            t.actor.constructor.name === "CPRMookActor"
        );
        token = ownedTokens.length === 1 ? ownedTokens[0] : false;
      }
      if (token) {
        const DvTable = token.document.getFlag(game.system.id, "cprDvTable");
        if (DvTable && typeof DvTable === "object") {
          const displayTable = DvTable.name.replace(/^DV /, "");
          const table = duplicate(DvTable.table);
          if (typeof table === "object" && Object.keys(table).length > 0) {
            let DV = 0;
            for (const range of Object.keys(table)) {
              const [start, end] = range.split("_");
              if (
                parseInt(distance, 10) >= parseInt(start, 10) &&
                parseInt(distance, 10) <= parseInt(end, 10)
              ) {
                DV = table[range];
              }
            }
            if (DV > 0) {
              returnLabel = `${returnLabel}\nDV: ${DV} ${displayTable}`;
            }
          }
        }
      } else {
        const noToken = game.i18n.localize("CPR.messages.warningRulerNoToken");
        returnLabel = `${returnLabel}\nDV: ${noToken}`;
      }
    }
    return returnLabel;
  };
}
