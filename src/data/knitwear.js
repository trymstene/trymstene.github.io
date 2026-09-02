// 🧶 KNITWEAR — what the homestead's tailor makes from a sheep's wool. Drawn
// in the banana's own hat grammar (10px cells, #111 outline, hats 12×9 on a
// 120×90 box with seat -1, neckwear on the red scarf's 110×90 box). One
// source for the engine's SVG map AND the tailor card's thumbnails.
const B = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
const K = '#111111', CREAM = '#f3e9d2', STITCH = '#e4d5b4', BRIM = '#d9c39c', PINK = '#f06a8a', PINK2 = '#f9a1b5', TAN = '#c98f5a', BROWN = '#a5713d';

// a cream beanie with a folded brim and a pink bobble
const woolbeanie = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" width="120" height="90" shape-rendering="crispEdges">'
  + B(40, 0, 40, 10, K)
  + B(30, 10, 10, 10, K) + B(40, 10, 20, 10, PINK2) + B(60, 10, 20, 10, PINK) + B(80, 10, 10, 10, K)
  + B(30, 20, 10, 10, K) + B(40, 20, 40, 10, PINK) + B(80, 20, 10, 10, K)
  + B(20, 30, 20, 10, K) + B(40, 30, 40, 10, CREAM) + B(80, 30, 20, 10, K)
  + B(10, 40, 10, 10, K) + B(20, 40, 80, 10, CREAM) + B(100, 40, 10, 10, K)
  + B(0, 50, 10, 10, K) + B(10, 50, 100, 10, CREAM) + B(110, 50, 10, 10, K)
  + B(30, 40, 10, 10, STITCH) + B(60, 40, 10, 10, STITCH) + B(90, 40, 10, 10, STITCH)
  + B(20, 50, 10, 10, STITCH) + B(50, 50, 10, 10, STITCH) + B(80, 50, 10, 10, STITCH)
  + B(0, 60, 10, 20, K) + B(10, 60, 100, 20, BRIM) + B(110, 60, 10, 20, K)
  + B(20, 60, 10, 20, CREAM) + B(50, 60, 10, 20, CREAM) + B(80, 60, 10, 20, CREAM)
  + B(0, 80, 120, 10, K)
  + '</svg>';

// the red scarf's shape in undyed wool: cream, tan edges, two brown stripes down the tail
const woolscarf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 90" width="110" height="90" shape-rendering="crispEdges">'
  + B(10, 0, 90, 10, TAN)
  + B(0, 10, 10, 10, TAN) + B(10, 10, 90, 10, CREAM) + B(100, 10, 10, 10, TAN)
  + B(0, 20, 10, 10, TAN) + B(10, 20, 90, 10, CREAM) + B(100, 20, 10, 10, TAN)
  + B(10, 30, 30, 10, TAN) + B(40, 30, 20, 10, CREAM) + B(60, 30, 40, 10, TAN)
  + B(30, 40, 10, 10, TAN) + B(40, 40, 20, 10, CREAM) + B(60, 40, 10, 10, TAN)
  + B(30, 50, 10, 10, TAN) + B(40, 50, 20, 10, BROWN) + B(60, 50, 10, 10, TAN)
  + B(30, 60, 10, 10, TAN) + B(40, 60, 20, 10, CREAM) + B(60, 60, 10, 10, TAN)
  + B(30, 70, 10, 10, TAN) + B(40, 70, 10, 10, BROWN) + B(50, 70, 20, 10, TAN)
  + B(30, 80, 10, 10, TAN) + B(50, 80, 10, 10, TAN)
  + '</svg>';

export const KNIT_SVG = { woolbeanie, woolscarf };
