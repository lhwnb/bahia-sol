// Environment reflections.
//
// The city is lit by one directional sun, so without an environment map every
// metal and glass surface only sees the lamps. This file paints a small
// equirectangular sky (gradient, sun disc, skyline band) on a canvas, turns it
// into a prefiltered cube map once per look, and hands it to the scene. Fixed
// values only, so two runs produce the same reflections.
(function (BS) {
  'use strict';

  var cache = {};
  var renderer = null;

  var LOOKS = {
    day: {
      top: '#2b6fb2', mid: '#8fb8db', horizon: '#e2e8ea', ground: '#5b5d5c',
      sun: '#fffaf0', sunX: 0.63, sunY: 0.28, sunR: 22, blocks: '#7f9db4', blockA: 0.5
    },
    golden: {
      top: '#4a7cae', mid: '#e3a377', horizon: '#ffd9a2', ground: '#4d4136',
      sun: '#fff3cf', sunX: 0.16, sunY: 0.46, sunR: 30, blocks: '#6d6a72', blockA: 0.42
    },
    dusk: {
      top: '#1d3155', mid: '#8b5a7c', horizon: '#ffa267', ground: '#241f22',
      sun: '#ffd3a4', sunX: 0.26, sunY: 0.5, sunR: 26, blocks: '#3a3340', blockA: 0.55
    },
    night: {
      top: '#050a15', mid: '#0d1730', horizon: '#243456', ground: '#080a10',
      sun: '#000000', sunX: 0.5, sunY: 0.5, sunR: 1, blocks: '#101a2c', blockA: 0.8
    }
  };

  function paint(kind) {
    var k = LOOKS[kind] || LOOKS.day;
    var W = 512;
    var H = 256;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var g = c.getContext('2d');

    var sky = g.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, k.top);
    sky.addColorStop(0.62, k.mid);
    sky.addColorStop(1, k.horizon);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H * 0.5 + 1);

    // horizon haze, then the ground hemisphere fading to dark under the city
    var gnd = g.createLinearGradient(0, H * 0.5, 0, H);
    gnd.addColorStop(0, k.horizon);
    gnd.addColorStop(0.16, k.ground);
    gnd.addColorStop(1, '#1a1a1c');
    g.fillStyle = gnd;
    g.fillRect(0, H * 0.5, W, H * 0.5);

    // a coarse skyline so glass reflects towers, not a clean gradient
    g.globalAlpha = k.blockA;
    g.fillStyle = k.blocks;
    var step = 11;
    for (var i = 0; i < W / step; i++) {
      var hh = 6 + ((i * 37) % 23) + ((i * 13) % 9);
      g.fillRect(i * step, H * 0.5 - hh, step - 2, hh + 2);
    }
    g.globalAlpha = 1;

    if (k.sunR > 2) {
      var sx = W * k.sunX;
      var sy = H * k.sunY;
      var halo = g.createRadialGradient(sx, sy, 0, sx, sy, k.sunR * 3.4);
      halo.addColorStop(0, k.sun);
      halo.addColorStop(0.22, 'rgba(255,226,182,0.55)');
      halo.addColorStop(1, 'rgba(255,198,146,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, W, H * 0.5 + 1);
    }
    return c;
  }

  function texture(kind) {
    if (cache[kind]) return cache[kind];
    var src = new THREE.CanvasTexture(paint(kind));
    src.mapping = THREE.EquirectangularReflectionMapping;
    src.colorSpace = THREE.SRGBColorSpace;
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var target = pmrem.fromEquirectangular(src);
    pmrem.dispose();
    src.dispose();
    cache[kind] = target.texture;
    return cache[kind];
  }

  BS.Env = {
    init: function (r) { renderer = r; },
    apply: function (scene, kind) {
      if (!scene || !renderer) return null;
      var tex = texture(kind || 'day');
      scene.environment = tex;
      return tex;
    },
    look: function (kind) { return LOOKS[kind] ? kind : 'day'; }
  };
})(window.BS);
