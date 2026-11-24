// Porto Verde city generation: a seeded grid of roads and blocks, five districts,
// a bay and beach on the east edge, a park, and eight named landmarks. The layout
// is fixed by the seed, so mission targets and screenshots are reproducible.

import { WORLD_W, WORLD_H, DISTRICTS, LANDMARKS } from './config.js';
import { makeRng, clamp } from './random.js';

const ROAD_W = 40;
const BLOCK_W = 210;
const BLOCK_H = 150;

const BUILDING_COLORS = ['#3a4a6b', '#4a3a5e', '#5e4632', '#2e4a44', '#54423a', '#414e6e', '#6b4a3a'];
const NEON_COLORS = ['#ff2e88', '#00e5ff', '#ffd166', '#7cff6b', '#b388ff'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const roadsV = [];
  const roadsH = [];
  for (let x = 120; x < WORLD_W - 560; x += BLOCK_W + ROAD_W) roadsV.push(x);
  for (let y = 110; y < WORLD_H - 60; y += BLOCK_H + ROAD_W) roadsH.push(y);

  const blocks = [];
  const buildings = [];
  for (let i = 0; i < roadsV.length - 1; i++) {
    for (let j = 0; j < roadsH.length - 1; j++) {
      const bx = roadsV[i] + ROAD_W;
      const by = roadsH[j] + ROAD_W;
      const bw = roadsV[i + 1] - bx;
      const bh = roadsH[j + 1] - by;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const district = districtAt(cx, cy);
      blocks.push({ x: bx, y: by, w: bw, h: bh, district: district ? district.name : 'Streets' });
      // The park block stays green; the beach strip stays sand.
      if (cx > 2380 && cx < 2900 && cy > 950 && cy < 1750) continue;
      if (cx > 2920) continue;
      const count = district && district.tall ? 2 : rng.chance(0.6) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = rng.range(52, Math.min(96, bw - 16));
        const h = rng.range(46, Math.min(88, bh - 16));
        const ox = count === 1 ? cx - w / 2 : bx + 12 + k * (bw / 2 - 6) - w / 2 + 20;
        const oy = count === 1 ? cy - h / 2 : by + bh / 2 - h / 2;
        buildings.push({
          x: clamp(ox, bx + 4, bx + bw - w - 4),
          y: clamp(oy, by + 4, by + bh - h - 4),
          w, h,
          height: district && district.tall ? rng.int(3, 9) : rng.int(1, 3),
          color: rng.pick(BUILDING_COLORS),
          neon: rng.pick(NEON_COLORS),
          district: district ? district.name : 'Streets',
        });
      }
    }
  }

  // Palm Court park: trees are circles, not buildings.
  const trees = [];
  for (let i = 0; i < 46; i++) {
    trees.push({
      x: rng.range(2400, 2880),
      y: rng.range(970, 1730),
      r: rng.range(9, 18),
    });
  }

  return {
    w: WORLD_W,
    h: WORLD_H,
    seed,
    roadsV,
    roadsH,
    roadW: ROAD_W,
    blocks,
    buildings,
    trees,
    districts: DISTRICTS,
    landmarks: LANDMARKS.map((mark) => ({ ...mark })),
    // The bay is the water strip on the east edge; the beach hugs it.
    water: { x: 3020, y: 0, w: WORLD_W - 3020, h: WORLD_H },
    beach: { x: 2920, y: 0, w: 100, h: WORLD_H },
    park: { x: 2380, y: 950, w: 520, h: 800 },
    neonColors: NEON_COLORS,
  };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d;
  }
  return null;
}

export function isRoad(city, x, y) {
  if (x < 0 || y < 0 || x > city.w || y > city.h) return false;
  if (x > city.beach.x) return false;
  for (const rx of city.roadsV) {
    if (x >= rx && x <= rx + city.roadW) return true;
  }
  for (const ry of city.roadsH) {
    if (y >= ry && y <= ry + city.roadW) return true;
  }
  return false;
}

export function isWater(city, x, y) {
  return x >= city.water.x;
}

export function isBlocked(city, x, y) {
  if (x < 8 || y < 8 || x > city.w - 8 || y > city.h - 8) return true;
  if (isWater(city, x, y)) return true;
  for (const b of city.buildings) {
    if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return true;
  }
  return false;
}

// Nearest point on a road centreline, used to drop traffic and parked cars.
export function nearestRoadPoint(city, rng, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    const cx = rx + city.roadW / 2;
    for (const ry of city.roadsH) {
      const cy = ry + city.roadW / 2;
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}

export function randomRoadPoint(city, rng) {
  const rx = rng.pick(city.roadsV) + city.roadW / 2;
  const ry = rng.pick(city.roadsH) + city.roadW / 2;
  // Half the time sit on a vertical road, half on a horizontal one, anywhere along it.
  if (rng.chance(0.5)) return { x: rx, y: rng.range(140, city.h - 140) };
  return { x: rng.range(140, city.w - 700), y: ry };
}

export function randomSidewalkPoint(city, rng) {
  const p = randomRoadPoint(city, rng);
  return { x: p.x + rng.range(-70, 70), y: p.y + rng.range(-70, 70) };
}
