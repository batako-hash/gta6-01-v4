// Porto Verde renderer: a top-down canvas view of the city — golden-hour light
// fading into neon night, the HUD with its minimap, and every screen of the game
// (title, pause, garage, busted, wasted, story complete).

import { WEAPONS, GARAGE, INTRO_LINES, CONTROLS_TEXT, GAME_TITLE, GAME_SUBTITLE } from './config.js';
import { clamp, dist, lerp } from './random.js';
import { currentObjective } from './world.js';

export function drawGame(g, ctx, view) {
  const w = view.w;
  const h = view.h;
  ctx.clearRect(0, 0, w, h);
  const camX = g.camera.x - w / 2;
  const camY = g.camera.y - h / 2;
  drawCityBase(g, ctx, camX, camY, w, h);
  drawBuildings(g, ctx, camX, camY);
  drawMissionMarker(g, ctx, camX, camY, w, h);
  drawSpikes(g, ctx, camX, camY);
  drawCars(g, ctx, camX, camY);
  drawPeds(g, ctx, camX, camY);
  drawGuards(g, ctx, camX, camY);
  drawPlayer(g, ctx, camX, camY);
  drawBullets(g, ctx, camX, camY);
  drawHelicopter(g, ctx, camX, camY);
  drawNightOverlay(g, ctx, w, h, camX, camY);
  if (g.screen === 'play') {
    drawHud(g, ctx, w, h);
    drawMinimap(g, ctx, w, h);
    if (g.garageOpen) drawGarageMenu(g, ctx, w, h);
  } else if (g.screen === 'title') {
    drawTitleScreen(g, ctx, w, h);
  } else if (g.screen === 'pause') {
    drawPauseScreen(g, ctx, w, h);
  } else if (g.screen === 'busted') {
    drawEndScreen(g, ctx, w, h, 'BUSTED', 'The Porto Verde police took their cut. Press ENTER to walk out of the station.');
  } else if (g.screen === 'wasted') {
    drawEndScreen(g, ctx, w, h, 'WASTED', 'The hospital patched you up — and billed you. Press ENTER to get back on the street.');
  } else if (g.screen === 'complete') {
    drawCompleteScreen(g, ctx, w, h);
  }
  if (g.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,30,40,${g.player.hurtFlash * 0.9})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// Daylight factor 1 = golden hour, 0 = deep night. The story opens at 18:36.
export function daylightFactor(g) {
  const t = g.time;
  if (t < 18.6) return 1;
  if (t < 19.6) return lerp(1, 0.55, (t - 18.6) / 1.0);
  if (t < 21) return lerp(0.55, 0.12, (t - 19.6) / 1.4);
  if (t < 23.5) return 0.12;
  if (t < 5.5) return 0.1;
  if (t < 7) return lerp(0.1, 0.9, (t - 5.5) / 1.5);
  return 1;
}

function drawCityBase(g, ctx, camX, camY, w, h) {
  const city = g.city;
  const day = daylightFactor(g);
  // Ground: warm dry grass between the blocks.
  ctx.fillStyle = day > 0.5 ? '#7a8a4d' : '#3d4a2a';
  ctx.fillRect(0, 0, w, h);
  // Beach and bay on the east edge.
  ctx.fillStyle = '#d9c184';
  ctx.fillRect(city.beach.x - camX, -camY, city.beach.w, city.h);
  ctx.fillStyle = day > 0.5 ? '#2e7fa8' : '#123a55';
  ctx.fillRect(city.water.x - camX, -camY, city.water.w, city.h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 120; y < city.h; y += 260) {
    ctx.fillRect(city.water.x - camX + 18, y - camY, 60, 4);
  }
  // Park.
  ctx.fillStyle = day > 0.5 ? '#4d8a4a' : '#244a28';
  ctx.fillRect(city.park.x - camX, city.park.y - camY, city.park.w, city.park.h);
  for (const tree of city.trees) {
    ctx.fillStyle = day > 0.5 ? '#2e6b34' : '#173d20';
    ctx.beginPath();
    ctx.arc(tree.x - camX, tree.y - camY, tree.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads: asphalt with centre dashes.
  ctx.fillStyle = '#2c2f36';
  for (const rx of city.roadsV) ctx.fillRect(rx - camX, -camY, city.roadW, city.h);
  for (const ry of city.roadsH) ctx.fillRect(-camX, ry - camY, city.w, city.roadW);
  ctx.fillStyle = 'rgba(255,220,120,0.75)';
  for (const rx of city.roadsV) {
    for (let y = 60; y < city.h; y += 64) ctx.fillRect(rx + city.roadW / 2 - 2 - camX, y - camY, 4, 26);
  }
  for (const ry of city.roadsH) {
    for (let x = 60; x < city.w; x += 64) ctx.fillRect(x - camX, ry + city.roadW / 2 - 2 - camY, 26, 4);
  }
  // Sidewalk blocks.
  for (const block of city.blocks) {
    ctx.fillStyle = block.district === 'Downtown' ? '#565b66' : '#6b6258';
    ctx.fillRect(block.x - camX, block.y - camY, block.w, block.h);
  }
  // Landmark labels.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const mark of city.landmarks) {
    ctx.fillStyle = 'rgba(10,12,20,0.65)';
    const label = mark.name;
    const tw = ctx.measureText(label).width + 12;
    ctx.fillRect(mark.x - tw / 2 - camX, mark.y - 34 - camY, tw, 18);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(label, mark.x - camX, mark.y - 21 - camY);
  }
}

function drawBuildings(g, ctx, camX, camY) {
  const day = daylightFactor(g);
  for (const b of g.city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
    // Rooftop: a lighter slab and a neon edge that glows after dark.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x - camX + 4, b.y - camY + 4, b.w - 8, b.h - 8);
    if (day < 0.6) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(g.elapsed * 2 + b.x);
      ctx.fillRect(b.x - camX, b.y - camY, b.w, 3);
      ctx.globalAlpha = 1;
    }
    if (day < 0.7) {
      ctx.fillStyle = 'rgba(255,214,110,0.85)';
      const cols = Math.floor(b.w / 16);
      const rows = Math.floor(b.h / 16);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.height) % 3 === 0) {
            ctx.fillRect(b.x - camX + 6 + i * 16, b.y - camY + 6 + j * 16, 7, 9);
          }
        }
      }
    }
  }
}

function drawMissionMarker(g, ctx, camX, camY, w, h) {
  const ms = g.missionState;
  if (!ms || g.screen !== 'play') return;
  const t = ms.target;
  const pulse = 1 + 0.25 * Math.sin(g.elapsed * 5);
  const sx = t.x - camX;
  const sy = t.y - camY;
  if (sx > -40 && sx < w + 40 && sy > -40 && sy < h + 40) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    const r = 13 * pulse;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    if (ms.kind === 'hold') {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, ms.radius, 0, Math.PI * 2);
      ctx.stroke();
      if (ms.seconds > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(sx - 60, sy + 26, 120, 14);
        ctx.fillStyle = '#7cff6b';
        ctx.fillRect(sx - 58, sy + 28, 116 * clamp(ms.progress / ms.seconds, 0, 1), 10);
      }
    }
  } else {
    // Off-screen: an arrow at the screen edge points the way.
    const cx = w / 2;
    const cy = h / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const a = Math.atan2(dy, dx);
    const ax = cx + Math.cos(a) * (Math.min(w, h) / 2 - 46);
    const ay = cy + Math.sin(a) * (Math.min(w, h) / 2 - 46);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(Math.hypot(dx, dy))}m`, ax, ay + 30);
  }
}

function drawCarShape(ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-19, -9, 40, 20);
  ctx.fillStyle = color;
  roundRect(ctx, -18, -10, 36, 20, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(2, -8, 9, 16);
  ctx.fillStyle = 'rgba(20,20,28,0.9)';
  ctx.fillRect(-14, -8, 8, 15);
  if (opts.night) {
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.fillRect(17, -8, 3, 4);
    ctx.fillRect(17, 4, 3, 4);
  }
  if (opts.police) {
    const flash = Math.floor(opts.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e4d' : '#2e7bff';
    ctx.fillRect(-4, -10, 9, 4);
    ctx.fillStyle = flash ? '#2e7bff' : '#ff2e4d';
    ctx.fillRect(-4, 6, 9, 4);
  }
  if (opts.wrecked) {
    ctx.fillStyle = 'rgba(40,40,40,0.7)';
    ctx.fillRect(-18, -10, 36, 20);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(g, ctx, camX, camY) {
  const night = daylightFactor(g) < 0.6;
  for (const car of g.cars) {
    if (car.kind === 'rival') {
      drawCarShape(ctx, car.x - camX, car.y - camY, car.angle, car.color, { night });
      continue;
    }
    drawCarShape(ctx, car.x - camX, car.y - camY, car.angle, car.color, {
      night,
      police: car.kind === 'police' || car.kind === 'roadblock',
      wrecked: car.wrecked,
      time: g.elapsed,
    });
    if (car.hp < car.maxHp && car.kind !== 'wreck') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(car.x - camX - 18, car.y - camY - 22, 36, 5);
      ctx.fillStyle = car.hp > 50 ? '#7cff6b' : '#ff5a4d';
      ctx.fillRect(car.x - camX - 17, car.y - camY - 21, 34 * clamp(car.hp / car.maxHp, 0, 1), 3);
    }
  }
}

function drawPeds(g, ctx, camX, camY) {
  for (const ped of g.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x - camX, ped.y - camY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(ped.x - camX, ped.y - camY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const fc of g.footCops) {
    ctx.fillStyle = '#1c2436';
    ctx.beginPath();
    ctx.arc(fc.x - camX, fc.y - camY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7db4ff';
    ctx.beginPath();
    ctx.arc(fc.x - camX, fc.y - camY, 4, 0, Math.PI * 2);
    ctx.fill();
    if (fc.hold > 0) {
      ctx.strokeStyle = '#ff2e4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fc.x - camX, fc.y - camY, 13, -Math.PI / 2, -Math.PI / 2 + (fc.hold / 1.6) * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawGuards(g, ctx, camX, camY) {
  for (const guard of g.guards) {
    ctx.fillStyle = '#5e1f1f';
    ctx.beginPath();
    ctx.arc(guard.x - camX, guard.y - camY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(guard.x - camX - 8, guard.y - camY - 16, 16 * clamp(guard.hp / 50, 0, 1), 3);
  }
}

function drawPlayer(g, ctx, camX, camY) {
  const p = g.player;
  const x = p.x - camX;
  const y = p.y - camY;
  if (p.car) return; // the car shape is the player while driving
  ctx.fillStyle = '#ffcf5e';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4a00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(p.angle) * 14, y + Math.sin(p.angle) * 14);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullets(g, ctx, camX, camY) {
  ctx.fillStyle = '#ffe066';
  for (const b of g.bullets) {
    ctx.beginPath();
    ctx.arc(b.x - camX, b.y - camY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpikes(g, ctx, camX, camY) {
  for (const s of g.spikes) {
    ctx.fillStyle = '#888';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * 12 - camX, s.y - 8 - camY);
      ctx.lineTo(s.x + i * 12 + 6 - camX, s.y + 8 - camY);
      ctx.lineTo(s.x + i * 12 - 6 - camX, s.y + 8 - camY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawHelicopter(g, ctx, camX, camY) {
  if (!g.heli) return;
  const h = g.heli;
  const x = h.x - camX;
  const y = h.y - camY;
  // Searchlight cone down to the player.
  const px = g.player.x - camX;
  const py = g.player.y - camY;
  const grad = ctx.createRadialGradient(px, py, 10, px, py, 150);
  grad.addColorStop(0, 'rgba(255,244,180,0.35)');
  grad.addColorStop(1, 'rgba(255,244,180,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c3550';
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9d4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#c9d4ff';
  ctx.lineWidth = 3;
  const ra = h.angle;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(ra) * 26, y - Math.sin(ra) * 26);
  ctx.lineTo(x + Math.cos(ra) * 26, y + Math.sin(ra) * 26);
  ctx.stroke();
  ctx.fillStyle = '#ff2e4d';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawNightOverlay(g, ctx, w, h, camX, camY) {
  const day = daylightFactor(g);
  if (day >= 0.95) return;
  const dark = (0.95 - day) * 0.55;
  ctx.fillStyle = `rgba(8,12,38,${dark.toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  if (day < 0.6) {
    // Streetlight pools along the roads.
    ctx.fillStyle = 'rgba(255,214,120,0.06)';
    for (const rx of g.city.roadsV) {
      for (let y = 200; y < g.city.h; y += 420) {
        ctx.beginPath();
        ctx.arc(rx + g.city.roadW / 2 - camX, y - camY, 36, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------- HUD ----------

function drawHud(g, ctx, w, h) {
  const p = g.player;
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#7cff6b';
  ctx.fillText(`$${g.cash.toLocaleString('en-US')}`, 18, 34);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Respect ${g.respect}   ${clockText(g)}   ${['Neon FM', 'Sunset Drive', 'Static Bloom'][g.radio]}${g.muted ? ' (muted)' : ''}`, 18, 56);
  // Wanted stars, top centre.
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < g.wanted ? '#ffcf3d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w / 2 - 52 + i * 26, 36);
  }
  // Mission objective bar.
  const ms = g.missionState;
  if (ms) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const label = `${ms.def.title}: ${ms.label}`;
    const tw = ctx.measureText(label).width + 24;
    ctx.fillRect(w / 2 - tw / 2, 48, tw, 26);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(label, w / 2, 66);
    if (ms.kind === 'timed') {
      ctx.fillStyle = ms.timeLeft < 15 ? '#ff5a4d' : '#7cff6b';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${Math.ceil(ms.timeLeft)}s`, w / 2, 92);
    }
  }
  // Health and weapon, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(16, h - 64, 210, 48);
  ctx.fillStyle = p.health > 40 ? '#7cff6b' : '#ff5a4d';
  ctx.fillRect(24, h - 52, 194 * clamp(p.health / 100, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  const weapon = WEAPONS[p.weapon];
  const ammo = p.ammo[p.weapon];
  ctx.fillText(`${weapon.name}  ${ammo === Infinity ? '∞' : ammo}   [1-4]`, 24, h - 24);
  if (p.car) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${Math.abs(Math.round(p.car.speed * 0.36))} km/h`, 24, h - 76);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(16, h - 96, 120, 8);
    ctx.fillStyle = p.car.hp > 40 ? '#7cff6b' : '#ff5a4d';
    ctx.fillRect(18, h - 95, 116 * clamp(p.car.hp / p.car.maxHp, 0, 1), 6);
  }
  // Toasts.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  let ty = h - 110;
  for (const toast of g.toasts) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const tw = ctx.measureText(toast.text).width + 24;
    ctx.fillRect(w / 2 - tw / 2, ty - 18, tw, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(toast.text, w / 2, ty);
    ty -= 30;
  }
  if (g.saveMessage) {
    ctx.fillStyle = '#9fe8ff';
    ctx.font = '13px sans-serif';
    ctx.fillText(g.saveMessage, w - 130, h - 16);
  }
}

function clockText(g) {
  const hh = Math.floor(g.time) % 24;
  const mm = Math.floor((g.time % 1) * 60);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function drawMinimap(g, ctx, w, h) {
  const size = 168;
  const x0 = w - size - 16;
  const y0 = 16;
  const sx = size / g.city.w;
  const sy = size / g.city.h;
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#1d3a55';
  ctx.fillRect(x0 + 3020 * sx, y0, (g.city.w - 3020) * sx, size);
  ctx.fillStyle = '#3d4a2a';
  ctx.fillRect(x0, y0, 3020 * sx, size);
  ctx.strokeStyle = 'rgba(220,220,220,0.28)';
  ctx.lineWidth = 1;
  for (const rx of g.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + (rx + 20) * sx, y0);
    ctx.lineTo(x0 + (rx + 20) * sx, y0 + size);
    ctx.stroke();
  }
  for (const ry of g.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + (ry + 20) * sy);
    ctx.lineTo(x0 + size, y0 + (ry + 20) * sy);
    ctx.stroke();
  }
  const ms = g.missionState;
  if (ms) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x0 + ms.target.x * sx, y0 + ms.target.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of g.cars) {
    if (car.kind === 'police' || car.kind === 'roadblock') {
      ctx.fillStyle = '#ff2e4d';
      ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
    }
  }
  if (g.heli) {
    ctx.fillStyle = '#ff2e4d';
    ctx.beginPath();
    ctx.arc(x0 + g.heli.x * sx, y0 + g.heli.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#7cff6b';
  ctx.beginPath();
  ctx.arc(x0 + g.player.x * sx, y0 + g.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + g.player.x * sx, y0 + g.player.y * sy, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
}

// ---------- screens ----------

function drawTitleScreen(g, ctx, w, h) {
  ctx.fillStyle = 'rgba(6,8,18,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(GAME_TITLE, w / 2, h / 2 - 130);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(GAME_SUBTITLE, w / 2, h / 2 - 96);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  let y = h / 2 - 56;
  for (const line of INTRO_LINES) {
    ctx.fillText(line, w / 2, y);
    y += 24;
  }
  y += 12;
  ctx.fillStyle = '#9fe8ff';
  ctx.font = '14px sans-serif';
  for (const line of CONTROLS_TEXT) {
    ctx.fillText(line, w / 2, y);
    y += 20;
  }
  ctx.fillStyle = '#7cff6b';
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.floor(g.elapsed * 2) % 2 === 0;
  if (blink) ctx.fillText('Press ENTER to start  •  Press L to continue your save', w / 2, y + 34);
}

function drawPauseScreen(g, ctx, w, h) {
  ctx.fillStyle = 'rgba(6,8,18,0.7)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 40);
  ctx.font = '16px sans-serif';
  ctx.fillText('Esc — resume    S — save game    Enter — resume', w / 2, h / 2);
  ctx.fillText(`Cash $${g.cash}  •  Missions done ${g.stats.missionsDone}  •  Cars stolen ${g.stats.carsStolen}`, w / 2, h / 2 + 30);
}

function drawEndScreen(g, ctx, w, h, title, line) {
  ctx.fillStyle = 'rgba(20,4,8,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e4d';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, w / 2, h / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText(line, w / 2, h / 2 + 20);
}

function drawCompleteScreen(g, ctx, w, h) {
  ctx.fillStyle = 'rgba(6,16,10,0.82)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7cff6b';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('THE SOLARA JOB IS DONE', w / 2, h / 2 - 90);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Rook is free. Porto Verde is yours.', w / 2, h / 2 - 52);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  const s = g.stats;
  ctx.fillText(`Final cash $${g.cash}  •  Respect ${g.respect}  •  Missions ${s.missionsDone}/8`, w / 2, h / 2 - 8);
  ctx.fillText(`Cars stolen ${s.carsStolen}  •  Shots fired ${s.shotsFired}  •  Hits ${s.hits}  •  Races won ${s.racesWon}`, w / 2, h / 2 + 22);
  ctx.fillStyle = '#7cff6b';
  ctx.font = 'bold 20px sans-serif';
  if (Math.floor(g.elapsed * 2) % 2 === 0) ctx.fillText('Press ENTER to keep playing the city', w / 2, h / 2 + 64);
}

function drawGarageMenu(g, ctx, w, h) {
  ctx.fillStyle = 'rgba(6,8,18,0.8)';
  ctx.fillRect(w / 2 - 260, h / 2 - 150, 520, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('EDDIE\u2019S GARAGE', w / 2, h / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Cash $${g.cash}`, w / 2, h / 2 - 78);
  const lines = [
    `1 — Engine: ${GARAGE.engine[g.upgrades.engine].name}  (next: ${GARAGE.engine[g.upgrades.engine + 1] ? GARAGE.engine[g.upgrades.engine + 1].name + ' $' + GARAGE.engine[g.upgrades.engine + 1].cost : 'MAX'})`,
    `2 — Armor: ${GARAGE.armor[g.upgrades.armor].name}  (next: ${GARAGE.armor[g.upgrades.armor + 1] ? GARAGE.armor[g.upgrades.armor + 1].name + ' $' + GARAGE.armor[g.upgrades.armor + 1].cost : 'MAX'})`,
    `3 — Repair car + heal: $${GARAGE.repairCost}`,
  ];
  let y = h / 2 - 40;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += 28;
  }
  ctx.fillStyle = '#9fe8ff';
  ctx.fillText('G or Esc — close', w / 2, y + 24);
}
