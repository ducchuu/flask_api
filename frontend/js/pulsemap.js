/**
 * Animated "pulse" world map for the onboarding hero.
 *
 * The continents are drawn as a grid of dots (a low-res equirectangular land
 * mask). A wave of light ripples out from the centre on a loop: each dot's
 * animation is delayed by its distance from the centre, so the bright
 * wavefront sweeps outward and traces the landmasses as it passes. Concentric
 * ring lines expand from the same origin for the literal "pulse".
 *
 * Pure SVG + CSS, no dependencies.
 */

// Land cells as inclusive column ranges per grid row (60 cols x 30 rows,
// equirectangular: Americas left, Africa/Europe centre, Asia right, Australia
// lower-right, Antarctica along the bottom). Stylised but recognisable.
const LAND = {
  1: [[21, 25]],
  2: [[5, 19], [22, 27], [42, 57]],
  3: [[3, 20], [23, 27], [29, 33], [36, 58]],
  4: [[2, 19], [28, 35], [37, 58]],
  5: [[3, 18], [28, 34], [37, 58]],
  6: [[4, 17], [29, 34], [38, 57]],
  7: [[6, 16], [29, 33], [39, 56]],
  8: [[9, 16], [27, 37], [38, 55]],
  9: [[12, 17], [27, 38], [40, 45], [47, 53]],
  10: [[14, 18], [28, 38], [41, 45], [48, 54]],
  11: [[16, 23], [29, 39], [42, 45], [49, 54]],
  12: [[16, 24], [30, 38], [49, 54]],
  13: [[17, 24], [30, 37], [50, 53]],
  14: [[18, 23], [31, 36]],
  15: [[18, 22], [31, 35]],
  16: [[18, 21], [32, 34], [50, 55]],
  17: [[18, 21], [32, 34], [49, 56]],
  18: [[18, 20], [49, 56]],
  19: [[18, 20], [50, 55]],
  20: [[18, 19], [51, 54]],
  21: [[17, 19]],
  22: [[17, 18]],
  23: [[16, 17]],
  27: [[5, 55]],
  28: [[3, 57]],
};

const CELL = 10;
const CX = 300;
const CY = 150;
const DURATION = 2.6; // seconds per pulse loop

/** Build the animated pulse-map SVG markup. */
export function pulseMapHtml() {
  const dots = [];
  let maxD = 1;
  for (const [rowStr, ranges] of Object.entries(LAND)) {
    const row = Number(rowStr);
    for (const [a, b] of ranges) {
      for (let c = a; c <= b; c++) {
        // checkerboard sample: ~half the dots, keeps the shape, far smoother
        if ((c + row) % 2 !== 0) continue;
        const x = c * CELL + 5;
        const y = row * CELL + 5;
        const d = Math.hypot(x - CX, y - CY);
        if (d > maxD) maxD = d;
        dots.push({ x, y, d });
      }
    }
  }

  const circles = dots
    .map((p) => {
      // delay grows with distance so the bright wavefront travels OUTWARD;
      // the -DURATION offset keeps it negative so the loop is seamless from
      // the first frame (no blank initial sweep).
      const delay = ((p.d / maxD - 1) * DURATION).toFixed(2);
      return `<circle class="pm-dot" cx="${p.x}" cy="${p.y}" r="2.6" style="animation-delay:${delay}s"/>`;
    })
    .join("");

  const rings = [0, 1, 2]
    .map((i) => {
      const delay = (-(i / 3) * DURATION).toFixed(2);
      return `<circle class="pm-ring" cx="${CX}" cy="${CY}" r="6" vector-effect="non-scaling-stroke" style="animation-delay:${delay}s"/>`;
    })
    .join("");

  return `
    <svg class="pulse-map" viewBox="0 0 600 300" role="img"
         aria-label="Animated world map with a pulse radiating from the centre">
      <g class="pm-rings">${rings}</g>
      <g class="pm-dots">${circles}</g>
      <circle class="pm-core" cx="${CX}" cy="${CY}" r="4.5"/>
    </svg>`;
}
