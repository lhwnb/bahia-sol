/* Bahía Sol — seeded randomness.
   The city, the traffic, the pedestrians and the four screenshot stages all draw
   from generators made here, so two loads of the same build look the same. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  // mulberry32: 32 bits of state, fast, good enough for layout and panic rolls.
  function makeRng(seed) {
    var state = (seed >>> 0) || 0x9e3779b9;
    function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    var rng = function () { return next(); };
    rng.float = function (a, b) { return a + next() * (b - a); };
    rng.int = function (a, b) { return Math.floor(a + next() * (b - a + 1)); };
    rng.pick = function (list) { return list[Math.floor(next() * list.length) % list.length]; };
    rng.chance = function (p) { return next() < p; };
    rng.sign = function () { return next() < 0.5 ? -1 : 1; };
    rng.angle = function () { return next() * Math.PI * 2; };
    rng.shuffle = function (list) {
      for (var i = list.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1));
        var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      }
      return list;
    };
    rng.state = function () { return state; };
    return rng;
  }

  function hashString(text) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  BS.makeRng = makeRng;
  BS.hashString = hashString;
})(window.BS);
