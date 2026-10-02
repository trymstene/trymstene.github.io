// 🚶 WHERE AN ECHO WALKS in the park and the bay (29 Sep 2026; design library §42). Trym: "Echoes can move around in those
// areas too" — they stood at four spots each. Now they stroll between places on open ground and stand a while at each:
// `pts` are the places (world px, where the feet go), `links` the straight walks between two of them. The park's is a loop
// round the fountain on the plaza's paving, clear of the basin and Old Peel's bench, with a step out along three paths; the
// bay's follows the sand paths and never crosses the court, the hut, the bar, the stalls' deck or the water.
// ⚠️ tools/echo-routes-check.mjs (in check-design) walks every point and link against the area's colliders and those places.
export const ECHO_ROUTES = {
  park: {
    pts: [[1235, 455], [1575, 480], [1610, 590], [1460, 695], [1330, 715], [1215, 672], [1150, 580], [1010, 595], [1360, 820], [1740, 610]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [6, 7], [4, 8], [2, 9]],
  },
  beach: {
    pts: [[560, 560], [640, 490], [900, 480], [1010, 485], [1290, 545], [1505, 600], [1515, 772], [1580, 910], [1790, 910], [1880, 800], [430, 700], [300, 820], [1215, 490]],
    links: [[11, 10], [10, 0], [0, 1], [1, 2], [2, 3], [3, 12], [12, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
  },
};
