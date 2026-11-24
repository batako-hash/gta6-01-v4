// Porto Verde keyboard and mouse input. poll() returns one frame of intent:
// movement, edge-triggered actions (enter, shoot edge, radio, crew, garage,
// pause, mute, start, save, load) and the mouse aim in screen coordinates.
// Edges are consumed by poll(), so a held key never double-fires an action.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;
    this.onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    };
    this.onMouseDown = (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this.onMouseMove(e);
    };
    this.onMouseUp = () => {
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  down(code) {
    return this.keys.has(code);
  }

  poll() {
    const p = this.pressed;
    const has = (code) => p.has(code);
    const moveX = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const moveY = (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) - (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
    let weapon = null;
    if (has('Digit1')) weapon = 0;
    else if (has('Digit2')) weapon = 1;
    else if (has('Digit3')) weapon = 2;
    else if (has('Digit4')) weapon = 3;
    else if (has('KeyQ')) weapon = 'cycle';
    const frame = {
      mx: moveX,
      my: moveY,
      sprint: this.down('ShiftLeft') || this.down('ShiftRight'),
      brake: this.down('Space'),
      enter: has('KeyE'),
      shoot: this.mouseDown,
      shootEdge: this.mouseClicked,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      weapon,
      radio: has('KeyR'),
      crew: has('KeyC'),
      garage: has('KeyG'),
      pause: has('Escape'),
      mute: has('KeyM'),
      start: has('Enter'),
      save: has('KeyS'),
      load: has('KeyL'),
      garageBuy: has('Digit1') ? 1 : has('Digit2') ? 2 : has('Digit3') ? 3 : 0,
    };
    this.pressed.clear();
    this.mouseClicked = false;
    return frame;
  }
}
