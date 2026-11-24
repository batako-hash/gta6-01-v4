// Porto Verde staged screenshots: ?shot=start|chase|mission|end&seed=7 builds a
// deterministic scene of the game itself, so the four screenshots are real
// renders of the game's own code and can be re-taken exactly.

import { addToast, makeCar } from './state.js';

export const SHOT_NAMES = ['start', 'chase', 'mission', 'end'];

export function applyShot(g, name) {
  const p = g.player;
  g.toasts = [];
  if (name === 'start') {
    g.screen = 'title';
    g.time = 18.7;
    p.x = 1560;
    p.y = 1050;
    g.camera.x = p.x;
    g.camera.y = p.y;
    return;
  }
  if (name === 'chase') {
    g.screen = 'play';
    g.time = 20.4;
    // Rook in a fast car on the eastbound road, three stars, helicopter
    // overhead, two patrol cars on the tail, Marina Pier far ahead.
    g.missionIndex = 3;
    g.missionState = {
      def: { id: 4, title: 'Harbor Chase' },
      stage: 0, kind: 'chase',
      target: { x: 2920, y: 900 },
      label: 'Reach Marina Pier with the cops on your tail',
      radius: 100, seconds: 0, timeLeft: 0, progress: 0,
      wanted: 3, guards: 0, checkpoints: null, checkpointIndex: 0, done: false,
    };
    const car = makeCar(g, 1390, 1080, '#d94f3d', 'player');
    car.speed = 300;
    car.angle = 0;
    g.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    g.wanted = 3;
    g.heat = 0.6;
    for (const [cx, cy] of [[1180, 1080], [1300, 1080]]) {
      const cop = makeCar(g, cx, cy, '#1c2436', 'police');
      cop.speed = 280;
      cop.angle = 0;
      g.cars.push(cop);
    }
    g.heli = { x: car.x + 40, y: car.y - 120, angle: 0.6 };
    g.camera.x = car.x;
    g.camera.y = car.y;
    addToast(g, 'Mission 4: Harbor Chase — reach Marina Pier');
    return;
  }
  if (name === 'mission') {
    g.screen = 'play';
    g.time = 19.4;
    // On foot with the pistol at the Solara Tower vault hold, progress halfway.
    p.x = 1560;
    p.y = 1050;
    p.onFoot = true;
    p.car = null;
    p.weapon = 1;
    g.wanted = 4;
    g.heat = 0.5;
    g.missionIndex = 2;
    g.missionState = {
      def: { id: 3, title: 'The Vault Hold' },
      stage: 1, kind: 'hold',
      target: { x: 1560, y: 1050 },
      label: 'Hold the vault room — stay inside the circle',
      radius: 110, seconds: 24, timeLeft: 24, progress: 13,
      wanted: 4, guards: 0, checkpoints: null, checkpointIndex: 0, done: false,
    };
    g.guards.push({ x: 1480, y: 980, hp: 50, shootCd: 1 });
    g.guards.push({ x: 1640, y: 1120, hp: 34, shootCd: 1 });
    const cop = makeCar(g, 1420, 1180, '#1c2436', 'police');
    cop.speed = 200;
    g.cars.push(cop);
    g.camera.x = p.x;
    g.camera.y = p.y;
    addToast(g, 'Mission 3: The Vault Hold — stay inside the circle');
    return;
  }
  if (name === 'end') {
    g.screen = 'complete';
    g.storyDone = true;
    g.cash = 6450;
    g.respect = 80;
    g.stats.missionsDone = 8;
    g.stats.carsStolen = 6;
    g.stats.shotsFired = 84;
    g.stats.hits = 51;
    g.stats.racesWon = 1;
    g.time = 23.2;
    p.x = 1560;
    p.y = 1050;
    g.camera.x = p.x;
    g.camera.y = p.y;
  }
}

export function shotFromUrl(url) {
  const params = new URLSearchParams(url.split('?')[1] || '');
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  return { shot: SHOT_NAMES.includes(shot) ? shot : null, seed: Number.isFinite(seed) ? seed : 7 };
}
