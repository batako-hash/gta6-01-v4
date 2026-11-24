// Porto Verde game state: everything the simulation and the renderer share.
// createGame builds a fresh run from a seed; saveGame/loadGame persist a run
// (cash, respect, mission, upgrades, crew, position) so a save resumes the
// current mission at its current stage instead of restarting it.

import { OPEN_HOUR, SAVE_KEY, WEAPONS, GARAGE, MISSIONS } from './config.js';
import { buildCity, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { makeRng, clamp } from './random.js';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93e', '#7dd069', '#c9c9c9', '#8e6fd8', '#e07b39', '#39c2d8'];

export function createGame(seed, opts = {}) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const start = { x: 1300, y: 1080 };
  const g = {
    seed,
    rng,
    city,
    screen: 'title',
    titleChoice: 0,
    time: OPEN_HOUR,
    elapsed: 0,
    cash: 250,
    respect: 0,
    wanted: 0,
    heat: 0,
    lastCrimeAt: -999,
    player: {
      x: start.x, y: start.y, angle: -Math.PI / 2, speed: 0,
      onFoot: true, health: 100, car: null, weapon: 1,
      ammo: { 0: Infinity, 1: 48, 2: 150, 3: 24 },
      lastHurtAt: -999, hurtFlash: 0,
    },
    cars: [],
    peds: [],
    footCops: [],
    guards: [],
    bullets: [],
    heli: null,
    roadblocks: [],
    spikes: [],
    missionIndex: 0,
    missionStage: 0,
    missionState: null,
    missionDone: false,
    storyDone: false,
    upgrades: { engine: 0, armor: 0 },
    crew: { juno: false, cooldown: 0, active: null },
    radio: 0,
    muted: false,
    camera: { x: start.x, y: start.y },
    toasts: [],
    stats: { shotsFired: 0, hits: 0, carsStolen: 0, missionsDone: 0, copsDodged: 0, racesWon: 0 },
    garageOpen: false,
    saveMessage: '',
    debug: !!opts.debug,
  };
  spawnWorld(g);
  beginMission(g, 0, 0);
  return g;
}

export function spawnWorld(g) {
  const { rng, city } = g;
  // Parked cars the player can steal, spread across the roads.
  for (let i = 0; i < 16; i++) {
    const p = randomRoadPoint(city, rng);
    g.cars.push(makeCar(g, p.x, p.y, rng.pick(CAR_COLORS), 'parked'));
  }
  // Traffic cars driving the roads.
  for (let i = 0; i < 22; i++) {
    const p = randomRoadPoint(city, rng);
    const car = makeCar(g, p.x, p.y, rng.pick(CAR_COLORS), 'traffic');
    car.speed = rng.range(90, 150);
    car.angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    g.cars.push(car);
  }
  for (let i = 0; i < 30; i++) {
    const p = randomSidewalkPoint(city, rng);
    g.peds.push({
      x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(22, 42), color: rng.pick(['#e8e0d0', '#d9a0a0', '#a0c4d9', '#c9d9a0', '#d9c9a0']),
      flee: 0, panic: 0,
    });
  }
}

let carId = 1;
export function makeCar(g, x, y, color, kind) {
  return {
    id: carId++,
    x, y, angle: 0, speed: 0,
    color, kind,
    hp: 100, maxHp: 100,
    driver: kind === 'traffic' ? 'traffic' : null,
    target: null, stuck: 0, siren: 0,
    wrecked: false, honk: 0,
  };
}

export function addToast(g, text) {
  g.toasts.push({ text, t: 0 });
  if (g.toasts.length > 4) g.toasts.shift();
}

export function beginMission(g, index, stage) {
  g.missionIndex = index;
  g.missionStage = stage;
  // A fresh stage starts clean: rivals and guards belong to the old one.
  g.cars = g.cars.filter((c) => c.kind !== 'rival');
  g.guards = [];
  const def = MISSIONS[index];
  if (!def) {
    g.missionState = null;
    return;
  }
  const st = def.stages[stage];
  g.missionState = {
    def, stage, kind: st.kind,
    target: missionTarget(g, st),
    label: st.label,
    radius: st.radius || 90,
    seconds: st.seconds || 0,
    timeLeft: st.seconds || 0,
    progress: 0,
    wanted: st.wanted || 0,
    guards: st.guards || 0,
    checkpoints: st.checkpoints ? [...st.checkpoints] : null,
    checkpointIndex: 0,
    done: false,
  };
  if (st.kind === 'race') {
    g.missionState.target = missionTarget(g, { landmark: st.checkpoints[0] });
  }
  addToast(g, `Mission ${def.id}: ${def.title} — ${st.label}`);
}

export function missionTarget(g, st) {
  const city = g.city;
  if (st.checkpoints) return landmarkPoint(city, st.checkpoints[0]);
  if (typeof st.landmark === 'number') return landmarkPoint(city, st.landmark);
  return { x: 1300, y: 1080 };
}

export function landmarkPoint(city, index) {
  const mark = city.landmarks[index % city.landmarks.length];
  return { x: mark.x, y: mark.y };
}

export function missionReward(g) {
  const def = MISSIONS[g.missionIndex];
  return def ? def.reward : 0;
}

export function completeMission(g) {
  const reward = missionReward(g);
  g.cash += reward;
  g.respect += 10;
  g.stats.missionsDone += 1;
  addToast(g, `Mission complete — +$${reward}`);
  const next = g.missionIndex + 1;
  if (next >= MISSIONS.length) {
    g.storyDone = true;
    g.screen = 'complete';
    return;
  }
  beginMission(g, next, 0);
}

export function failMissionStage(g, reason) {
  addToast(g, `Failed: ${reason} — mission restarts`);
  beginMission(g, g.missionIndex, 0);
}

export function saveGame(g, storage) {
  if (!storage) return false;
  try {
    const data = {
      v: 1,
      cash: g.cash,
      respect: g.respect,
      missionIndex: g.missionIndex,
      missionStage: g.missionStage,
      upgrades: g.upgrades,
      crew: { juno: g.crew.juno },
      time: g.time,
      player: { x: g.player.x, y: g.player.y, health: g.player.health },
      stats: g.stats,
    };
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    g.saveMessage = 'Saved';
    return true;
  } catch (e) {
    g.saveMessage = 'Save failed';
    return false;
  }
}

export function loadSave(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function applySave(g, data) {
  g.cash = data.cash;
  g.respect = data.respect;
  g.upgrades = { engine: data.upgrades.engine, armor: data.upgrades.armor };
  g.crew.juno = !!data.crew.juno;
  g.time = data.time;
  g.player.x = data.player.x;
  g.player.y = data.player.y;
  g.player.health = data.player.health;
  g.stats = { ...g.stats, ...data.stats };
  g.wanted = 0;
  g.heat = 0;
  beginMission(g, data.missionIndex, data.missionStage);
}

export function playerTopSpeed(g) {
  const level = g.upgrades.engine;
  return GARAGE.engine[level].topSpeed;
}

export function playerAccel(g) {
  const level = g.upgrades.engine;
  return GARAGE.engine[level].accel;
}

export function playerMaxHp(g) {
  return GARAGE.armor[g.upgrades.armor].hp;
}

export function weaponOf(g) {
  return WEAPONS[g.player.weapon];
}

export function hasSave(storage) {
  return !!loadSave(storage);
}

export { clamp };
