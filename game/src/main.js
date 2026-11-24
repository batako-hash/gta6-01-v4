// Porto Verde entry point: boots the canvas, runs the frame loop, wires the
// menus (title, pause, garage, busted, wasted, story complete) to the simulation
// and saves the run to localStorage so a save resumes the current mission stage.

import { createGame, saveGame, loadSave, applySave } from './state.js';
import { stepGame, respawn, garageBuy } from './world.js';
import { drawGame } from './render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { applyShot, shotFromUrl } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = new Input(canvas);
const audio = new AudioSys();

let g = createGame(7);
g.audio = audio;
g.view = { w: window.innerWidth, h: window.innerHeight };
g.saveFn = () => saveGame(g, safeStorage());

function safeStorage() {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  g.view = { w: canvas.width, h: canvas.height };
}
window.addEventListener('resize', resize);
resize();

// A staged screenshot (?shot=chase&seed=7) renders one frozen scene of the game.
const shot = shotFromUrl(window.location.href);
if (shot.shot) {
  g = createGame(shot.seed);
  g.audio = audio;
  g.view = { w: canvas.width, h: canvas.height };
  applyShot(g, shot.shot);
  g.frozen = true;
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const f = input.poll();
  audio.ensure();

  if (f.mute) {
    g.muted = !g.muted;
    audio.setMuted(g.muted);
  }

  if (g.frozen) {
    drawGame(g, ctx, g.view);
    requestAnimationFrame(frame);
    return;
  }

  if (g.screen === 'title') {
    g.elapsed += dt;
    if (f.start) {
      g.screen = 'play';
      announce('Porto Verde: mission 1, First Wheels. Steal a car.');
      audio.chime();
    } else if (f.load) {
      const data = loadSave(safeStorage());
      if (data) {
        applySave(g, data);
        g.screen = 'play';
        announce('Save loaded. Mission resumes where you left it.');
      }
    }
  } else if (g.screen === 'pause') {
    if (f.pause || f.start) g.screen = 'play';
    else if (f.save) {
      saveGame(g, safeStorage());
      announce('Game saved.');
    }
  } else if (g.screen === 'busted' || g.screen === 'wasted') {
    if (f.start) respawn(g);
  } else if (g.screen === 'complete') {
    g.elapsed += dt;
    if (f.start) {
      g.screen = 'play';
      g.storyDone = false;
    }
  } else if (g.screen === 'play') {
    if (f.pause) {
      g.screen = 'pause';
    } else if (g.garageOpen) {
      if (f.garage || f.pause) g.garageOpen = false;
      else if (f.garageBuy === 1) garageBuy(g, 'engine');
      else if (f.garageBuy === 2) garageBuy(g, 'armor');
      else if (f.garageBuy === 3) garageBuy(g, 'repair');
    } else {
      const aim = screenToWorld(g, f.mouseX, f.mouseY);
      stepGame(g, dt, {
        mx: f.mx,
        my: f.my,
        sprint: f.sprint,
        brake: f.brake,
        enter: f.enter,
        shoot: f.shoot,
        shootEdge: f.shootEdge,
        aimX: aim.x,
        aimY: aim.y,
        weapon: f.weapon,
        radio: f.radio,
        crew: f.crew,
        garage: f.garage,
      });
    }
  }

  audio.update(g.player.car ? g.player.car.speed : g.player.speed, g.wanted, g.radio, g.screen === 'play');
  drawGame(g, ctx, g.view);
  requestAnimationFrame(frame);
}

function screenToWorld(g, sx, sy) {
  return {
    x: g.camera.x - g.view.w / 2 + sx,
    y: g.camera.y - g.view.h / 2 + sy,
  };
}

requestAnimationFrame(frame);
