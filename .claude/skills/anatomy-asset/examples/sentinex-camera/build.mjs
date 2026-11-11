// SENTINEX login hero: a bullet CCTV camera on a wall bracket. Safety-yellow sun shield,
// dark lens, red REC LED that blinks. Writes D:/Coding/WEB/FYP/src/assets/camera.svg
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as a from "../../kit/asset.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = "D:/Coding/WEB/FYP/src/assets";
const PAPER = "#1e2524";
const W = 640, H = 480;

const PLATE = { x: -112, y: -30, w: 7, d: 60, r: 3 };
const ARM = { x: -105, y: -8, w: 70, d: 16, r: 3 };
const BODY = { x: -70, y: -17, w: 150, d: 34, r: 7 };
const SHIELD = { x: -48, y: -19, w: 140, d: 38, r: 5 };
const Z = { plate0: 70, plate1: 150, arm0: 104, arm1: 116, body0: 150, body1: 180, sh: 183 };

const P = a.fitInto(
  [...k.boxCorners(PLATE, Z.plate0, Z.plate1), ...k.boxCorners(SHIELD, Z.body0, Z.sh + 3), [-40, 0, 80]],
  { x: 24, y: 24, w: W - 48, h: H - 48 },
  { pad: 10, azimuth: 34 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const brand = (svg) => `<g class="ac-brand">${svg}</g>`;
const rec = (svg) => `<g class="ac-rec">${svg}</g>`;

const out = [];

// ---------- wall plate with four screws ----------
out.push(S(k.slabOf(PLATE, Z.plate0, Z.plate1 - Z.plate0, P, 3, 0.6), { tone: "lo" }));
const fx = PLATE.x + PLATE.w;
for (const [y, z] of [[-20, 80], [20, 80], [-20, 140], [20, 140]]) {
  out.push(L(k.sideRing([fx, y, z], 2.2, "x", P, 16), { tone: "faint" }));
  out.push(D([at([fx, y, z])], { size: 0.55, tone: "hi" }));
}

// ---------- gusset + arm ----------
const GF = G.frameOf([0, -6, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
out.push(S(G.prismOf(GF, [[-105, 82], [-105, Z.arm0], [-62, Z.arm0]], 0, 12, P), { tone: "mid" }));
out.push(S(k.slabOf(ARM, Z.arm0, Z.arm1 - Z.arm0, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(ARM, Z.arm0 + 4, P, 3), { tone: "faint" }) }));
out.push(L(k.planOutline(k.insetPlan(ARM, 3), Z.arm1, P, 3), { tone: "faint" }));

// ---------- cable from housing back down into the plate ----------
const route = G.fillet([[-74, 6, 160], [-92, 6, 160], [-92, 6, 132], [-105, 6, 132]], 7, 7, { P, tube: 2.2 });
for (const piece of tubePieces(route, 2.2, P, { maxLength: 400 })) out.push(tubeSvg(piece, { tone: "mid" }));
out.push(S(k.cylinder(-104, 6, 3.6, 128, 8, P, 16), { tone: "lo" })); // gland on plate

// ---------- swivel joint ----------
const JX = -42;
out.push(S(k.cylinder(JX, 0, 11, Z.arm1, 4, P, 40, 0.5), { tone: "lo" }));
out.push(brand(S(k.cylinder(JX, 0, 8.5, Z.arm1 + 4, 8, P, 40, 0.5), { tone: "hi" }) + L(k.knurl(JX, 0, 8.5, Z.arm1 + 4.6, Z.arm1 + 11.4, 30, P), { tone: "lo" })));
out.push(S(k.cylinder(JX, 0, 4, Z.arm1 + 12, 10, P, 24), { tone: "mid" }));

// ---------- tilt yoke ----------
const cheek = (y) => ({ x: JX - 9, y, w: 18, d: 4, r: 1.4 });
out.push(S(k.slabOf(cheek(-12), 136, 12, P, 2, 0.4), { tone: "mid" }));
out.push(S(k.slabOf({ x: JX - 9, y: -12, w: 18, d: 24, r: 2 }, 134, 3, P, 2, 0.4), { tone: "mid" }));
out.push(S(k.slabOf(cheek(8), 136, 12, P, 2, 0.4), { tone: "mid" }));
out.push(L(k.sideRing([JX, 12, 142], 2.6, "y", P, 18), { tone: "lo" }));
out.push(D([at([JX, 12, 142])], { size: 0.6, tone: "hi" }));
out.push(S(k.slabOf({ x: JX - 14, y: -11, w: 28, d: 22, r: 2 }, 148, 2, P, 2), { tone: "lo" }));

// ---------- housing ----------
out.push(S(k.slabOf({ x: -77, y: -15, w: 8, d: 30, r: 5 }, 152, 26, P, 6, 0.5), { tone: "lo" })); // rear cap
const seams = L(k.sideSeam(BODY, 155, P, 8), { tone: "faint" }) + L(k.sideSeam(BODY, 175, P, 8), { tone: "faint" });
out.push(S(k.slabOf(BODY, Z.body0, Z.body1 - Z.body0, P, 8, 1.2), { tone: "hi", inner: seams }));
// band where the front barrel joins
out.push(S(k.slabOf({ x: 56, y: -17.6, w: 5, d: 35.2, r: 7.2 }, 149.4, 31.2, P, 8), { tone: "mid" }));
// label plate on the near side with two rule lines
const lp = { x: -36, y: 17, w: 46, d: 0.8, r: 0.3 };
out.push(S(k.slabOf(lp, 159, 12, P, 2), { tone: "mid", crease: "none" }));
out.push(L(k.segment([-32, 17.8, 167.5], [-6, 17.8, 167.5], P) + k.segment([-32, 17.8, 163], [-14, 17.8, 163], P), { tone: "lo", free: true }));
out.push(D([at([-33.6, 17.8, 165]), at([7.6, 17.8, 165])], { size: 0.45 }));
// REC LED on the near side, blinking
out.push(S(k.slabOf({ x: 40, y: 17, w: 5, d: 0.8, r: 0.4 }, 162, 5, P, 2), { tone: "lo", crease: "none" }));
out.push(a.amBlink(rec(D([at([42.5, 17.9, 164.5])], { size: 1.3, tone: "lit" })), { period: 2400, min: 0.2 }));

// ---------- lens ----------
const LF = G.frameAlong([80, 0, 165], [1, 0, 0]);
out.push(S(G.disc(0, 4, 14, LF, P), { tone: "mid" }));
out.push(S(G.disc(4, 7, 11.5, LF, P), { tone: "lo" }));
out.push(L(G.circleOf(LF, 7, 8.5, P), { tone: "faint" }));
out.push(D(G.dotsOf(LF, 4, 12.8, 10, P, { all: true }), { size: 0.5, tone: "lo" })); // IR ring
out.push(rec(D([at([87, -3, 168])], { size: 0.9, tone: "lit" })));                     // glint

// ---------- sun shield ----------
for (const x of [-30, 50]) out.push(S(k.cylinder(x, 0, 2.6, Z.body1, Z.sh - Z.body1, P, 16), { tone: "lo" }));
out.push(brand(S(k.slabOf(SHIELD, Z.sh, 3, P, 6, 0.8), { tone: "hi", lit: true }) + L(k.planOutline(k.insetPlan(SHIELD, 5), Z.sh + 3, P, 6), { tone: "lo" })));
out.push(D([at([-30, 0, Z.sh + 3]), at([50, 0, Z.sh + 3])], { size: 0.55, tone: "lo" }));

const svg = a.assetSvg({
  width: W,
  height: H,
  label: "An isometric CCTV camera on a wall bracket with a yellow sun shield and a blinking red recording light.",
  body: out.join(""),
  paper: PAPER,
  accents: { brand: "#f2b200", rec: { hex: "#e0442a", mode: "ink" } },
  weight: 0.7,
  id: "sentinex-camera",
});
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "camera.svg"), svg);
writeFileSync(join(HERE, "camera.html"), a.previewHtml({ title: "camera", svg, paper: PAPER, width: W }));
console.log(`wrote camera.svg (${(svg.length / 1024).toFixed(0)} KB)`);
