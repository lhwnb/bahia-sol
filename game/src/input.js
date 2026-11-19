/* Bahía Sol — input.
   Keyboard state, edge-triggered presses, pointer-lock mouse deltas. The game
   reads this once per frame and main clears the edges at the end of the step. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  function Input(canvas) {
    var self = this;
    this.keys = {};
    this.pressed = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = [false, false, false];
    this.locked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      var code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(code) >= 0) e.preventDefault();
      self.keys[code] = true;
      self.pressed[code] = true;
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
    });
    window.addEventListener('blur', function () {
      self.keys = {};
      self.mouseDown = [false, false, false];
    });

    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', function (e) {
      if (!self.locked) return;
      self.mouseDX += e.movementX || 0;
      self.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button < 3) self.mouseDown[e.button] = true;
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button < 3) self.mouseDown[e.button] = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  Input.prototype.lock = function () {
    if (!this.canvas.requestPointerLock) return;
    try {
      var pending = this.canvas.requestPointerLock();
      // Chrome returns a promise when the gesture is not good enough; a refused
      // lock is harmless, the player can still steer with the keyboard.
      if (pending && typeof pending.catch === 'function') pending.catch(function () {});
    } catch (err) {
      // pointer lock unavailable (headless, iframe); ignore
    }
  };

  Input.prototype.axes = function () {
    var k = this.keys;
    return {
      forward: (k.KeyW || k.ArrowUp ? 1 : 0) + (k.KeyS || k.ArrowDown ? -1 : 0),
      strafe: (k.KeyD || k.ArrowRight ? 1 : 0) + (k.KeyA || k.ArrowLeft ? -1 : 0)
    };
  };

  Input.prototype.endFrame = function () {
    this.pressed = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
  };

  BS.Input = Input;
})(window.BS);
