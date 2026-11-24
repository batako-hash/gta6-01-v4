// Porto Verde simulation: driving and walking, traffic and pedestrians, the
// police response (patrol cars, foot cops, helicopter, roadblocks, spike strips),
// combat, the wanted system, the crew, the garage and the eight story missions.

import { MISSIONS, WANTED, GARAGE, WEAPONS } from './config.js';
import { isRoad, isBlocked, isWater, nearestRoadPoint, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { clamp, dist, angleTo, angleDiff } from './random.js';
import {
  addToast, beginMission, completeMission, failMissionStage, missionTarget,
  makeCar, playerTopSpeed, playerAccel, playerMaxHp, weaponOf,
} from './state.js';

const FOOT_SPEED = 155;
const SPRINT_SPEED = 265;
const PED_FLEE_SPEED = 120;

export function stepGame(g, dt, inp) {
  if (g.screen !== 'play' || g.garageOpen) return;
  g.elapsed += dt;
  g.time += dt / 55;
  if (g.time >= 24) g.time -= 24;
  if (g.crew.cooldown > 0) g.crew.cooldown -= dt;
  for (const t of g.toasts) t.t += dt;
  g.toasts = g.toasts.filter((t) => t.t < 4.5);

  stepPlayer(g, dt, inp);
  stepTraffic(g, dt);
  stepPeds(g, dt);
  stepPolice(g, dt);
  stepCrew(g, dt);
  stepBullets(g, dt);
  stepGuards(g, dt);
  stepMission(g, dt);
  stepWanted(g, dt);
  stepCamera(g, dt);
  if (g.player.hurtFlash > 0) g.player.hurtFlash -= dt;
  if (g.elapsed - g.player.lastHurtAt > 5 && g.player.health < 100) {
    g.player.health = Math.min(100, g.player.health + 4 * dt);
  }
  // Auto-save every 20 seconds of play.
  if (Math.floor(g.elapsed / 20) !== Math.floor((g.elapsed - dt) / 20) && g.saveFn) {
    g.saveFn();
  }
}

// ---------- player ----------

function stepPlayer(g, dt, inp) {
  const p = g.player;
  if (inp.weapon !== null && inp.weapon !== undefined) {
    if (inp.weapon === 'cycle') p.weapon = (p.weapon + 1) % WEAPONS.length;
    else if (inp.weapon !== p.weapon) p.weapon = inp.weapon;
  }
  if (inp.radio) {
    g.radio = (g.radio + 1) % 3;
    addToast(g, ['Radio: Neon FM', 'Radio: Sunset Drive', 'Radio: Static Bloom'][g.radio]);
  }
  if (inp.crew) callCrew(g);
  if (inp.garage) tryGarage(g);

  if (p.car) {
    driveCar(g, dt, inp, p.car);
  } else {
    walkPlayer(g, dt, inp);
  }

  if (inp.enter) {
    if (p.car) exitCar(g);
    else tryEnterCar(g);
  }
  if (inp.shoot) shoot(g, inp);
  if (p.weaponShootCd > 0) p.weaponShootCd -= dt;
}

function walkPlayer(g, dt, inp) {
  const p = g.player;
  const speed = inp.sprint ? SPRINT_SPEED : FOOT_SPEED;
  const mx = inp.mx;
  const my = inp.my;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my) || 1;
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    if (!isBlocked(g.city, nx, p.y)) p.x = nx;
    if (!isBlocked(g.city, p.x, ny)) p.y = ny;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
}

function driveCar(g, dt, inp, car) {
  const p = g.player;
  const top = playerTopSpeed(g) * (isRoad(g.city, car.x, car.y) ? 1 : 0.55);
  const accel = playerAccel(g);
  if (inp.my < 0) car.speed = Math.min(top, car.speed + accel * dt);
  else if (inp.my > 0) car.speed = Math.max(-90, car.speed - accel * 1.4 * dt);
  else car.speed *= Math.max(0, 1 - 1.4 * dt);
  if (inp.brake) car.speed *= Math.max(0, 1 - 4 * dt);
  const steer = inp.mx * 2.4 * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideCar(g, car, nx, ny);
  if (!hit) {
    car.x = nx;
    car.y = ny;
  } else if (Math.abs(car.speed) > 140) {
    damageCar(g, car, 8);
    car.speed *= -0.3;
  } else {
    car.speed *= 0.4;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true;
    addToast(g, 'Your car is wrecked!');
    exitCar(g);
  }
}

function collideCar(g, car, nx, ny) {
  if (isBlocked(g.city, nx, ny)) return true;
  for (const other of g.cars) {
    if (other === car || other.wrecked) continue;
    if (dist(nx, ny, other.x, other.y) < 30) {
      other.speed = car.speed * 0.4;
      return Math.abs(car.speed) > 60;
    }
  }
  return false;
}

function tryEnterCar(g) {
  const p = g.player;
  let best = null;
  let bestD = 52;
  for (const car of g.cars) {
    if (car.wrecked) continue;
    if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  if (best.kind === 'traffic') {
    // The driver bails out and runs.
    g.peds.push({ x: best.x + 20, y: best.y + 10, angle: 0, speed: PED_FLEE_SPEED, color: '#e8e0d0', flee: 3, panic: 3 });
    best.driver = null;
    g.stats.carsStolen += 1;
    addCrime(g, 0.34, true);
    addToast(g, 'Car stolen — the cops noticed');
  }
  best.kind = 'player';
  best.hp = best.hp <= 0 ? 60 : best.hp;
  best.maxHp = playerMaxHp(g);
  p.car = best;
  p.onFoot = false;
  p.x = best.x;
  p.y = best.y;
}

function exitCar(g) {
  const p = g.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  p.onFoot = true;
  p.x = car.x - Math.sin(car.angle) * 26;
  p.y = car.y + Math.cos(car.angle) * 26;
  if (isBlocked(g.city, p.x, p.y)) {
    p.x = car.x + 30;
    p.y = car.y;
  }
  car.kind = 'parked';
  car.speed = 0;
}

function damageCar(g, car, amount) {
  car.hp -= amount;
  if (car.kind === 'player') {
    g.player.lastHurtAt = g.elapsed;
    g.player.hurtFlash = 0.25;
  }
}

export function damagePlayer(g, amount) {
  const p = g.player;
  if (g.screen !== 'play') return;
  p.health -= amount;
  p.lastHurtAt = g.elapsed;
  p.hurtFlash = 0.3;
  if (p.health <= 0) {
    p.health = 0;
    wasted(g);
  }
}

function busted(g) {
  g.screen = 'busted';
  const loss = Math.floor(g.cash * 0.1);
  g.cash -= loss;
  g.wanted = 0;
  g.heat = 0;
  g.toasts = [];
  addToast(g, `BUSTED — the cops took $${loss}`);
  clearPolice(g);
}

function wasted(g) {
  g.screen = 'wasted';
  const loss = Math.floor(g.cash * 0.1);
  g.cash -= loss;
  g.wanted = 0;
  g.heat = 0;
  g.toasts = [];
  addToast(g, `WASTED — the hospital took $${loss}`);
  clearPolice(g);
}

export function respawn(g) {
  if (g.player.car) {
    g.player.car.kind = 'parked';
    g.player.car.speed = 0;
  }
  g.player.health = 100;
  g.player.x = 1300;
  g.player.y = 1080;
  g.player.angle = -Math.PI / 2;
  g.player.onFoot = true;
  g.player.car = null;
  g.camera.x = g.player.x;
  g.camera.y = g.player.y;
  g.screen = 'play';
}

function clearPolice(g) {
  g.cars = g.cars.filter((c) => c.kind !== 'police' && c.kind !== 'roadblock');
  g.footCops = [];
  g.heli = null;
  g.roadblocks = [];
  g.spikes = [];
}

// ---------- crime & wanted ----------

export function addCrime(g, amount, forceStar) {
  g.heat += amount;
  g.lastCrimeAt = g.elapsed;
  if (forceStar && g.wanted === 0) {
    g.wanted = 1;
    g.heat = 0.3;
    return;
  }
  while (g.heat >= 1 && g.wanted < 5) {
    g.wanted += 1;
    g.heat -= 1;
  }
  if (g.wanted >= 5) g.heat = Math.min(1, g.heat);
}

function stepWanted(g, dt) {
  if (g.wanted === 0) {
    g.heat = Math.max(0, g.heat - dt * 0.2);
    return;
  }
  const quiet = g.elapsed - g.lastCrimeAt > WANTED.drainDelaySec;
  const nearestCop = nearestCopDist(g);
  if (quiet && nearestCop > 300) {
    // Laying low works even with the helicopter up — it just takes longer.
    g.heat -= WANTED.drainPerSec * (g.heli ? 0.5 : 1) * dt;
    if (g.heat <= 0) {
      g.wanted -= 1;
      g.heat = g.wanted > 0 ? 0.6 : 0;
      if (g.wanted === 0) addToast(g, 'You lost the cops');
    }
  }
}

function nearestCopDist(g) {
  let best = Infinity;
  for (const c of g.cars) {
    if (c.kind === 'police' || c.kind === 'roadblock') {
      best = Math.min(best, dist(g.player.x, g.player.y, c.x, c.y));
    }
  }
  for (const f of g.footCops) best = Math.min(best, dist(g.player.x, g.player.y, f.x, f.y));
  return best;
}

// ---------- traffic & pedestrians ----------

function stepTraffic(g, dt) {
  for (const car of g.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    const ahead = car.speed > 0;
    if (ahead && nearIntersection(g, car.x, car.y) && g.rng.chance(0.02)) {
      car.angle += g.rng.pick([-Math.PI / 2, Math.PI / 2]);
    }
    if (isWater(g.city, car.x + Math.cos(car.angle) * 40, car.y + Math.sin(car.angle) * 40)) {
      car.angle += Math.PI;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 60 || car.y < 60 || car.x > g.city.w - 700 || car.y > g.city.h - 60) {
      car.angle += Math.PI;
    }
    // Slow down for the car ahead.
    for (const other of g.cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 55 && Math.abs(angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y))) < 0.6) {
        car.speed = Math.max(0, car.speed - 120 * dt);
      }
    }
    car.speed = Math.min(car.speed + 12 * dt, 140);
  }
}

function nearIntersection(g, x, y) {
  let onV = false;
  let onH = false;
  for (const rx of g.city.roadsV) {
    if (Math.abs(x - (rx + g.city.roadW / 2)) < 24) onV = true;
  }
  for (const ry of g.city.roadsH) {
    if (Math.abs(y - (ry + g.city.roadW / 2)) < 24) onH = true;
  }
  return onV && onH;
}

function stepPeds(g, dt) {
  for (const ped of g.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = angleTo(g.player.x, g.player.y, ped.x, ped.y);
      ped.x += Math.cos(a) * PED_FLEE_SPEED * dt;
      ped.y += Math.sin(a) * PED_FLEE_SPEED * dt;
      continue;
    }
    if (g.rng.chance(0.005)) ped.angle += g.rng.range(-1.2, 1.2);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!isBlocked(g.city, nx, ny) && !isWater(g.city, nx, ny)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.angle += Math.PI / 2;
    }
    // Run over by the player's car: a crime, and the pedestrian falls.
    if (g.player.car && dist(ped.x, ped.y, g.player.x, g.player.y) < 26 && Math.abs(g.player.car.speed) > 60) {
      ped.flee = 99;
      addCrime(g, 0.5, true);
      addToast(g, 'Pedestrian down — the cops are coming');
    }
  }
  g.peds = g.peds.filter((ped) => ped.flee < 90);
}

// ---------- police ----------

function stepPolice(g, dt) {
  const p = g.player;
  if (g.wanted > 0) {
    const wantCars = Math.min(g.wanted, 4);
    const have = g.cars.filter((c) => c.kind === 'police').length;
    if (have < wantCars && g.elapsed - (g.lastCopSpawn || 0) > 2.5) {
      spawnCopCar(g);
      g.lastCopSpawn = g.elapsed;
    }
    if (g.wanted >= 2 && g.footCops.length < 2 && g.elapsed - (g.lastFootSpawn || 0) > 6) {
      spawnFootCop(g);
      g.lastFootSpawn = g.elapsed;
    }
    if (g.wanted >= 3 && !g.heli) {
      g.heli = { x: p.x, y: p.y - 200, angle: 0 };
      addToast(g, 'Police helicopter overhead!');
    }
    if (g.wanted >= 4 && g.roadblocks.length === 0) spawnRoadblocks(g);
    if (g.wanted >= 5 && g.spikes.length === 0) spawnSpikes(g);
  } else if (g.heli) {
    g.heli = null;
  }

  for (const cop of g.cars) {
    if (cop.kind !== 'police') continue;
    cop.siren += dt;
    const target = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle += clamp(angleDiff(cop.angle, target), -2.6 * dt, 2.6 * dt);
    const wantSpeed = g.wanted >= 4 ? 380 : 320;
    cop.speed = Math.min(wantSpeed, cop.speed + 240 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!isBlocked(g.city, nx, ny)) {
      cop.x = nx;
      cop.y = ny;
    } else {
      cop.angle += Math.PI / 2;
      cop.speed *= 0.5;
    }
    // Ram the player's car.
    if (p.car && dist(cop.x, cop.y, p.x, p.y) < 34) {
      damageCar(g, p.car, WANTED.copRamDamage * dt * 3);
      cop.speed *= 0.6;
      p.car.speed *= 0.94;
    }
    if (cop.hp <= 0) {
      cop.wrecked = true;
      cop.kind = 'wreck';
      addCrime(g, 0.2, false);
    }
  }

  // Foot cops chase on foot; they bust a slow, cornered player, not a moving one.
  for (const fc of g.footCops) {
    const d = dist(fc.x, fc.y, p.x, p.y);
    const a = angleTo(fc.x, fc.y, p.x, p.y);
    fc.angle = a;
    const speed = 150;
    const nx = fc.x + Math.cos(a) * speed * dt;
    const ny = fc.y + Math.sin(a) * speed * dt;
    if (!isBlocked(g.city, nx, ny)) {
      fc.x = nx;
      fc.y = ny;
    }
    // A player barricaded inside a hold circle cannot be busted — the cops
    // mill around the vault instead of dragging Rook out of it.
    const ms = g.missionState;
    const barricaded = ms && ms.kind === 'hold' && dist(p.x, p.y, ms.target.x, ms.target.y) < ms.radius;
    if (p.onFoot && d < WANTED.bustRadius && p.speed < 60 && !barricaded) {
      fc.hold = (fc.hold || 0) + dt;
      if (fc.hold >= WANTED.bustHoldSec) busted(g);
    } else {
      fc.hold = 0;
    }
  }
  g.footCops = g.footCops.filter((fc) => dist(fc.x, fc.y, p.x, p.y) < 1400);

  if (g.heli) {
    const h = g.heli;
    const tx = p.x + 40;
    const ty = p.y - 120;
    h.angle += dt * 0.7;
    h.x += (tx - h.x) * Math.min(1, 0.8 * dt);
    h.y += (ty - h.y) * Math.min(1, 0.8 * dt);
  }

  // Spike strips: driving over them shreds tires.
  for (const s of g.spikes) {
    if (p.car && dist(p.x, p.y, s.x, s.y) < 30 && Math.abs(p.car.speed) > 40) {
      damageCar(g, p.car, 30);
      p.car.speed *= 0.35;
      s.used = true;
      addToast(g, 'Spike strip! Tires shredded');
    }
  }
  g.spikes = g.spikes.filter((s) => !s.used);
}

function spawnCopCar(g) {
  const p = g.player;
  const spot = nearestRoadPoint(g.city, g.rng, p.x + g.rng.range(-650, 650), p.y + g.rng.range(-650, 650));
  const car = makeCar(g, spot.x, spot.y, '#1c2436', 'police');
  car.hp = 120;
  car.maxHp = 120;
  car.speed = 200;
  g.cars.push(car);
}

function spawnFootCop(g) {
  const p = g.player;
  const a = g.rng.range(0, Math.PI * 2);
  g.footCops.push({
    x: p.x + Math.cos(a) * 320, y: p.y + Math.sin(a) * 320,
    angle: 0, hold: 0,
  });
}

function spawnRoadblocks(g) {
  const p = g.player;
  const ahead = { x: p.x + Math.cos(p.angle) * 420, y: p.y + Math.sin(p.angle) * 420 };
  const spot = nearestRoadPoint(g.city, g.rng, ahead.x, ahead.y);
  for (const off of [-46, 46]) {
    const car = makeCar(g, spot.x + off, spot.y, '#1c2436', 'roadblock');
    car.angle = Math.PI / 2;
    car.hp = 200;
    car.maxHp = 200;
    g.cars.push(car);
    g.roadblocks.push(car);
  }
  addToast(g, 'Roadblock ahead!');
}

function spawnSpikes(g) {
  const p = g.player;
  const ahead = { x: p.x + Math.cos(p.angle) * 300, y: p.y + Math.sin(p.angle) * 300 };
  const spot = nearestRoadPoint(g.city, g.rng, ahead.x, ahead.y);
  g.spikes.push({ x: spot.x, y: spot.y });
  addToast(g, 'Spike strips on the road!');
}

// ---------- combat ----------

function shoot(g, inp) {
  const p = g.player;
  const w = weaponOf(g);
  if (p.weaponShootCd > 0) return;
  if (!w.auto && !inp.shootEdge) return;
  if (w.ammo !== Infinity) {
    if (p.ammo[w.id] <= 0) {
      if (p.weapon !== 0) addToast(g, 'Out of ammo — press 1 for fists');
      p.weaponShootCd = 0.3;
      return;
    }
    p.ammo[w.id] -= 1;
  }
  p.weaponShootCd = w.rate;
  g.stats.shotsFired += 1;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const base = angleTo(p.x, p.y, inp.aimX, inp.aimY);
    const a = base + (g.rng.next() - 0.5) * w.spread * 2;
    g.bullets.push({
      x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24,
      vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
      life: w.range / 900, damage: w.damage, fromPlayer: true,
    });
  }
  if (g.audio) g.audio.shot(w.id);
  if (p.onFoot) addCrime(g, 0.12, false);
}

function stepBullets(g, dt) {
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (isBlocked(g.city, b.x, b.y) || isWater(g.city, b.x, b.y)) {
      b.life = 0;
      continue;
    }
    if (b.fromPlayer) {
      for (const guard of g.guards) {
        if (dist(b.x, b.y, guard.x, guard.y) < 20) {
          guard.hp -= b.damage;
          b.life = 0;
          g.stats.hits += 1;
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of g.cars) {
        if (car.kind === 'player' || car.wrecked) continue;
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          car.hp -= b.damage;
          b.life = 0;
          g.stats.hits += 1;
          if (car.kind === 'police' || car.kind === 'roadblock') addCrime(g, 0.3, false);
          if (car.hp <= 0) {
            car.wrecked = true;
            if (car.kind === 'police') {
              car.kind = 'wreck';
              addCrime(g, 0.2, false);
            }
          }
          break;
        }
      }
    } else {
      if (dist(b.x, b.y, g.player.x, g.player.y) < 18) {
        damagePlayer(g, b.damage);
        b.life = 0;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
}

function stepGuards(g, dt) {
  for (const guard of g.guards) {
    if (guard.hp <= 0) continue;
    const p = g.player;
    const d = dist(guard.x, guard.y, p.x, p.y);
    guard.shootCd -= dt;
    if (d < 420 && guard.shootCd <= 0) {
      guard.shootCd = 1.6;
      const a = angleTo(guard.x, guard.y, p.x, p.y) + (g.rng.next() - 0.5) * 0.25;
      g.bullets.push({
        x: guard.x + Math.cos(a) * 20, y: guard.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        life: 0.7, damage: 6, fromPlayer: false,
      });
      if (g.audio) g.audio.shot(1);
    }
    if (d > 60) {
      const a = angleTo(guard.x, guard.y, p.x, p.y);
      const nx = guard.x + Math.cos(a) * 70 * dt;
      const ny = guard.y + Math.sin(a) * 70 * dt;
      if (!isBlocked(g.city, nx, ny)) {
        guard.x = nx;
        guard.y = ny;
      }
    }
  }
  g.guards = g.guards.filter((guard) => guard.hp > 0);
}

// Juno's crew car hunts the nearest police car and rams it until her run ends.
function stepCrew(g, dt) {
  for (const car of g.cars) {
    if (car.kind !== 'crew' || !car.hunt) continue;
    if (g.elapsed > (car.ramUntil || 0)) {
      car.hunt = false;
      car.kind = 'traffic';
      car.driver = 'traffic';
      continue;
    }
    let target = null;
    let bestD = Infinity;
    for (const cop of g.cars) {
      if (cop.kind !== 'police' && cop.kind !== 'roadblock') continue;
      const d = dist(car.x, car.y, cop.x, cop.y);
      if (d < bestD) {
        bestD = d;
        target = cop;
      }
    }
    if (!target) continue;
    const a = angleTo(car.x, car.y, target.x, target.y);
    car.angle += clamp(angleDiff(car.angle, a), -2.8 * dt, 2.8 * dt);
    car.speed = Math.min(360, car.speed + 260 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!isBlocked(g.city, nx, ny)) {
      car.x = nx;
      car.y = ny;
    }
    if (bestD < 34) {
      target.hp -= 45;
      car.speed *= 0.4;
      if (target.hp <= 0) {
        target.wrecked = true;
        target.kind = 'wreck';
        addToast(g, 'Juno took a cop car out!');
      }
    }
  }
}

// ---------- crew & garage ----------

function callCrew(g) {
  if (!g.crew.juno) {
    addToast(g, 'No crew yet — win the Street Kings race to recruit Juno');
    return;
  }
  if (g.crew.cooldown > 0) {
    addToast(g, `Juno is regrouping (${Math.ceil(g.crew.cooldown)}s)`);
    return;
  }
  if (g.wanted === 0) {
    addToast(g, 'No heat — Juno stays low');
    return;
  }
  g.crew.cooldown = 45;
  const p = g.player;
  const car = makeCar(g, p.x - 160, p.y - 120, '#e07b39', 'crew');
  car.speed = 320;
  car.ramUntil = g.elapsed + 20;
  g.cars.push(car);
  g.crew.active = car;
  addToast(g, 'Juno is inbound!');
  // Juno's car hunts the nearest cop.
  car.hunt = true;
}

function tryGarage(g) {
  const garage = { x: 1300, y: 900 };
  if (dist(g.player.x, g.player.y, garage.x, garage.y) > 150) {
    addToast(g, 'Garage is at City Hall — drive there and press G');
    return;
  }
  g.garageOpen = !g.garageOpen;
}

export function garageBuy(g, what) {
  if (!g.garageOpen) return;
  if (what === 'repair') {
    if (g.cash < GARAGE.repairCost) {
      addToast(g, 'Not enough cash to repair');
      return;
    }
    g.cash -= GARAGE.repairCost;
    if (g.player.car) g.player.car.hp = g.player.car.maxHp;
    g.player.health = 100;
    addToast(g, 'Car repaired, Rook patched up');
    return;
  }
  const table = GARAGE[what];
  const next = g.upgrades[what] + 1;
  if (next >= table.length) {
    addToast(g, 'Already maxed out');
    return;
  }
  if (g.cash < table[next].cost) {
    addToast(g, `Need $${table[next].cost} for ${table[next].name}`);
    return;
  }
  g.cash -= table[next].cost;
  g.upgrades[what] = next;
  addToast(g, `Installed: ${table[next].name}`);
}

// ---------- missions ----------

function stepMission(g, dt) {
  const ms = g.missionState;
  if (!ms || g.storyDone) return;
  const p = g.player;
  // Forced heat for loud stages.
  if (ms.wanted > 0 && g.wanted < ms.wanted) {
    g.wanted = ms.wanted;
    g.heat = 0.5;
    g.lastCrimeAt = g.elapsed;
  }
  const target = ms.target;
  switch (ms.kind) {
    case 'goto':
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) advanceStage(g);
      break;
    case 'steal':
      if (p.car) advanceStage(g);
      break;
    case 'timed': {
      ms.timeLeft -= dt;
      if (ms.timeLeft <= 0) {
        failMissionStage(g, 'out of time');
        return;
      }
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) advanceStage(g);
      break;
    }
    case 'hold': {
      if (ms.guards > 0 && !ms.guardsSpawned) {
        ms.guardsSpawned = true;
        for (let i = 0; i < ms.guards; i++) {
          g.guards.push({
            x: target.x + g.rng.range(-120, 120), y: target.y + g.rng.range(-120, 120),
            hp: 50, shootCd: 2,
          });
        }
      }
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) {
        ms.progress += dt;
        if (ms.progress >= ms.seconds) advanceStage(g);
      }
      break;
    }
    case 'chase':
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) advanceStage(g);
      break;
    case 'race': {
      const cp = ms.checkpoints[ms.checkpointIndex];
      const point = { x: g.city.landmarks[cp].x, y: g.city.landmarks[cp].y };
      ms.target = point;
      if (dist(p.x, p.y, point.x, point.y) < ms.radius) {
        ms.checkpointIndex += 1;
        if (ms.checkpointIndex >= ms.checkpoints.length) {
          g.stats.racesWon += 1;
          g.crew.juno = true;
          addToast(g, 'Juno joins your crew! Press C to call her during a chase');
          advanceStage(g);
        } else {
          addToast(g, `Checkpoint ${ms.checkpointIndex + 1}/${ms.checkpoints.length}`);
        }
      }
      if (g.missionState !== ms) return; // race already finished this frame
      stepRivals(g, dt);
      break;
    }
    case 'pickup': {
      if (ms.guards > 0 && !ms.guardsSpawned) {
        ms.guardsSpawned = true;
        for (let i = 0; i < ms.guards; i++) {
          g.guards.push({
            x: target.x + g.rng.range(-140, 140), y: target.y + g.rng.range(-140, 140),
            hp: 50, shootCd: 2,
          });
        }
      }
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) {
        g.crew.active = 'juno-on-foot';
        addToast(g, 'Juno is with you — get her to the safehouse!');
        advanceStage(g);
      }
      break;
    }
    case 'escort':
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) advanceStage(g);
      break;
    case 'escape':
      if (dist(p.x, p.y, target.x, target.y) < ms.radius) {
        g.wanted = 0;
        g.heat = 0;
        clearPolice(g);
        addToast(g, 'Clean getaway!');
        advanceStage(g);
      }
      break;
    default:
      break;
  }
}

function stepRivals(g, dt) {
  const ms = g.missionState;
  if (!ms || ms.kind !== 'race') return;
  if (!ms.rivals) {
    ms.rivals = [];
    for (let i = 0; i < 3; i++) {
      const car = makeCar(g, g.player.x - 60 - i * 40, g.player.y + 60, ['#d94f3d', '#3d7bd9', '#e8b93e'][i], 'rival');
      car.speed = 200;
      g.cars.push(car);
      ms.rivals.push(car);
    }
  }
  const target = ms.target;
  for (const car of ms.rivals) {
    if (car.wrecked) continue;
    const a = angleTo(car.x, car.y, target.x, target.y);
    car.angle += clamp(angleDiff(car.angle, a), -2.2 * dt, 2.2 * dt);
    car.speed = Math.min(300, car.speed + 160 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!isBlocked(g.city, nx, ny)) {
      car.x = nx;
      car.y = ny;
    }
    if (dist(car.x, car.y, target.x, target.y) < ms.radius) {
      // A rival reached a checkpoint: only the final one ends the race.
      if (ms.checkpointIndex >= ms.checkpoints.length - 1) {
        failMissionStage(g, 'a rival beat you to the finish');
        return;
      }
    }
  }
}

function advanceStage(g) {
  const def = MISSIONS[g.missionIndex];
  const next = g.missionStage + 1;
  if (next >= def.stages.length) {
    completeMission(g);
  } else {
    beginMission(g, g.missionIndex, next);
  }
}

function stepCamera(g, dt) {
  const view = g.view || { w: 1280, h: 800 };
  const tx = clamp(g.player.x, view.w / 2 - 200, g.city.w - view.w / 2 + 200);
  const ty = clamp(g.player.y, view.h / 2 - 200, g.city.h - view.h / 2 + 200);
  g.camera.x += (tx - g.camera.x) * Math.min(1, 5 * dt);
  g.camera.y += (ty - g.camera.y) * Math.min(1, 5 * dt);
}

export function currentObjective(g) {
  const ms = g.missionState;
  if (!ms) return '';
  return ms.label;
}
