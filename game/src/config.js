// PORTO VERDE — tuning, names and story data. All numbers are game balance, not code.
// The city is Porto Verde, a sun-soaked harbour city that turns neon after dark.
// The player is Rae "Rook" Calloway, fresh out of prison, working off a debt to the
// fixer Mara Voss. Contacts: Mara Voss (fixer), Eddie Kwan (garage), Sister Luz (broker).

export const GAME_TITLE = 'PORTO VERDE';
export const GAME_SUBTITLE = 'Sunset Run — an open-world crime story';
export const SAVE_KEY = 'portoverde-save-v1';
export const WORLD_W = 3200;
export const WORLD_H = 2400;

// One game hour lasts this many real seconds; the story opens at golden hour.
export const HOUR_SECONDS = 55;
export const OPEN_HOUR = 18.6;

export const WEAPONS = [
  { id: 0, name: 'Fists', key: '1', damage: 12, rate: 0.32, range: 46, ammo: Infinity, auto: false, spread: 0.05 },
  { id: 1, name: 'Pistol', key: '2', damage: 26, rate: 0.26, range: 420, ammo: 48, auto: false, spread: 0.03 },
  { id: 2, name: 'SMG', key: '3', damage: 16, rate: 0.085, range: 380, ammo: 150, auto: true, spread: 0.09 },
  { id: 3, name: 'Shotgun', key: '4', damage: 15, rate: 0.8, range: 260, ammo: 24, auto: false, spread: 0.22, pellets: 6 },
];

export const WANTED = {
  // Heat 0..1 fills toward the next star while crimes keep happening; it drains
  // when the player lays low out of sight of the police.
  drainDelaySec: 9,
  drainPerSec: 0.12,
  fillPerCrime: 0.34,
  maxCops: 5,
  copRamDamage: 6,
  bustHoldSec: 1.6,
  bustRadius: 30,
};

export const GARAGE = {
  engine: [
    { name: 'Stock engine', cost: 0, topSpeed: 330, accel: 210 },
    { name: 'Tuned engine', cost: 400, topSpeed: 400, accel: 260 },
    { name: 'Race engine', cost: 900, topSpeed: 470, accel: 320 },
  ],
  armor: [
    { name: 'Stock body', cost: 0, hp: 100 },
    { name: 'Plated body', cost: 500, hp: 170 },
    { name: 'Armored body', cost: 1000, hp: 250 },
  ],
  repairCost: 150,
};

export const DISTRICTS = [
  { name: 'Downtown', x: 1150, y: 750, w: 1100, h: 800, tint: '#2b3350', tall: true },
  { name: 'Old Town', x: 150, y: 1450, w: 900, h: 800, tint: '#4a3a2c', tall: false },
  { name: 'Industrial', x: 1250, y: 120, w: 1000, h: 520, tint: '#33302e', tall: false },
  { name: 'Palm Court', x: 2350, y: 900, w: 620, h: 900, tint: '#274a33', tall: false },
  { name: 'Marina', x: 2650, y: 300, w: 500, h: 1400, tint: '#1d3a4a', tall: false },
];

export const LANDMARKS = [
  { name: 'Solara Tower', x: 1560, y: 1050 },
  { name: 'City Hall', x: 1300, y: 900 },
  { name: 'The Palms Casino', x: 1850, y: 1250 },
  { name: 'Old Cathedral', x: 520, y: 1750 },
  { name: 'Freight Yards', x: 1650, y: 380 },
  { name: 'Marina Pier', x: 2920, y: 900 },
  { name: 'Sunset Overlook', x: 700, y: 1250 },
  { name: 'Harbor Bridge', x: 2700, y: 1500 },
];

// Mission script. Each mission is a list of stages; a stage kind is one of:
// goto, steal, timed, hold, chase, race, pickup, escort, escape, finale.
// Targets are landmark indexes or district corners resolved at runtime, so the
// same script plays on any seeded city of the same layout.
export const MISSIONS = [
  {
    id: 1, title: 'First Wheels', from: 'Mara Voss',
    brief: 'You are out, Rook. You owe me. First: get wheels. Any car on the street will do — then bring it to my garage.',
    reward: 250,
    stages: [
      { kind: 'steal', label: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', landmark: 1, label: 'Drive to Mara\u2019s garage at City Hall', radius: 90 },
    ],
  },
  {
    id: 2, title: 'Sunset Courier', from: 'Mara Voss',
    brief: 'A package for the casino. Fast, quiet, no cops. The sun is going down and so is my patience.',
    reward: 400,
    stages: [
      { kind: 'timed', landmark: 2, label: 'Deliver the package to The Palms Casino', radius: 90, seconds: 75 },
    ],
  },
  {
    id: 3, title: 'The Vault Hold', from: 'Sister Luz',
    brief: 'The old bank on the square keeps its vault open for seven minutes at dusk. Stand in the vault room and keep the door shut until the timer runs out. It will get loud.',
    reward: 600,
    stages: [
      { kind: 'goto', landmark: 0, label: 'Reach Solara Tower bank', radius: 90 },
      { kind: 'hold', landmark: 0, label: 'Hold the vault room — stay inside the circle', radius: 110, seconds: 24, wanted: 4 },
    ],
  },
  {
    id: 4, title: 'Harbor Chase', from: 'Mara Voss',
    brief: 'The harbour cops have your plate. Lose the tail and get to the pier. Do not stop to chat.',
    reward: 500,
    stages: [
      { kind: 'chase', landmark: 5, label: 'Reach Marina Pier with the cops on your tail', radius: 100, wanted: 3 },
    ],
  },
  {
    id: 5, title: 'Street Kings', from: 'Eddie Kwan',
    brief: 'Three punks think they own the boulevard. Beat them through the checkpoints and the street is yours. Juno owes you one after this.',
    reward: 700,
    stages: [
      { kind: 'race', checkpoints: [6, 4, 7, 5], label: 'Race the checkpoints — Sunset Overlook, Freight Yards, Harbor Bridge, Marina Pier', radius: 90 },
    ],
  },
  {
    id: 6, title: 'Rescue at the Pier', from: 'Sister Luz',
    brief: 'Juno is pinned down at the freight yards by Marlow\u2019s guards. Go get her, and bring her home alive. She can shoot, too.',
    reward: 900,
    stages: [
      { kind: 'goto', landmark: 4, label: 'Reach the Freight Yards', radius: 100 },
      { kind: 'pickup', landmark: 4, label: 'Reach Juno — guards are shooting', radius: 70, guards: 4 },
      { kind: 'escort', landmark: 3, label: 'Drive Juno to the Old Cathedral safehouse', radius: 100 },
    ],
  },
  {
    id: 7, title: 'Midnight Getaway', from: 'Mara Voss',
    brief: 'Five stars, Rook. Helicopter, roadblocks, the works. Get to the overlook and vanish. This is the one they will tell stories about.',
    reward: 1200,
    stages: [
      { kind: 'escape', landmark: 6, label: 'Escape the 5-star manhunt — reach Sunset Overlook', radius: 110, wanted: 5 },
    ],
  },
  {
    id: 8, title: 'The Solara Job', from: 'Mara Voss',
    brief: 'The big one. Marlow\u2019s case sits in the tower vault. Take it, and the debt is gone — all of it. Then run, and do not look back.',
    reward: 2000,
    stages: [
      { kind: 'goto', landmark: 0, label: 'Infiltrate Solara Tower', radius: 90 },
      { kind: 'hold', landmark: 0, label: 'Crack the vault — hold the circle', radius: 110, seconds: 18, wanted: 4, guards: 3 },
      { kind: 'escape', landmark: 6, label: 'Escape with the case — reach Sunset Overlook', radius: 110, wanted: 5 },
    ],
  },
];

export const INTRO_LINES = [
  'PORTO VERDE — 6:36 PM. The sun is going down over the bay, and the city is waking up.',
  'Rae "Rook" Calloway walks out of prison with $250, a borrowed pistol, and a debt to Mara Voss.',
  'Eight jobs stand between Rook and freedom. The streets, the cops, and the night are all in the way.',
];

export const CONTROLS_TEXT = [
  'WASD / Arrows — walk and drive    E — steal / enter / exit car',
  'Mouse — aim    Click — shoot    1-4 — weapons    Q — cycle weapon',
  'Space — brake    R — radio    C — call Juno (crew)    G — garage menu',
  'M — mute    Esc — pause    Enter — start / continue',
];
