/* Bahía Sol — procedural canvas textures.
   Nothing here is loaded from disk. Each painter draws into an offscreen canvas
   with its own seeded RNG, so the city looks the same on every load. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var cache = {};

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function seeded(name) { return BS.makeRng(BS.hashString('tex:' + name)); }

  function toTexture(canvas, opts) {
    opts = opts || {};
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = opts.anisotropy || 4;
    t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  function cached(key, build) {
    if (!cache[key]) cache[key] = build();
    return cache[key];
  }

  function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

  function noise(ctx, w, h, rng, count, colors, sizeMin, sizeMax, alpha) {
    for (var i = 0; i < count; i++) {
      ctx.globalAlpha = alpha * rng.float(0.35, 1);
      ctx.fillStyle = colors[rng.int(0, colors.length - 1)];
      var s = rng.float(sizeMin, sizeMax);
      ctx.fillRect(rng.float(0, w), rng.float(0, h), s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- ground
  function asphalt() {
    return cached('asphalt', function () {
      var rng = seeded('asphalt');
      var c = makeCanvas(256, 256), ctx = c.getContext('2d');
      ctx.fillStyle = '#3a3c41';
      ctx.fillRect(0, 0, 256, 256);
      noise(ctx, 256, 256, rng, 2600, ['#45474d', '#313338', '#4c4e55', '#2b2c31'], 1, 3, 0.75);
      // tar patches
      for (var i = 0; i < 5; i++) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = rng.chance(0.5) ? '#212226' : '#33343a';
        ctx.beginPath();
        var px = rng.float(0, 256), py = rng.float(0, 256);
        ctx.ellipse(px, py, rng.float(18, 60), rng.float(10, 34), rng.angle(), 0, Math.PI * 2);
        ctx.fill();
      }
      // hairline cracks
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#1b1c20';
      ctx.lineWidth = 1;
      for (var k = 0; k < 6; k++) {
        ctx.beginPath();
        var x = rng.float(0, 256), y = rng.float(0, 256);
        ctx.moveTo(x, y);
        for (var s = 0; s < 5; s++) { x += rng.float(-16, 16); y += rng.float(4, 20); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      var t = toTexture(c);
      t.repeat.set(1, 1);
      return t;
    });
  }

  function sidewalk() {
    return cached('sidewalk', function () {
      var rng = seeded('sidewalk');
      var c = makeCanvas(256, 256), ctx = c.getContext('2d');
      ctx.fillStyle = '#b8b1a3';
      ctx.fillRect(0, 0, 256, 256);
      noise(ctx, 256, 256, rng, 1800, ['#c4bdae', '#aaa496', '#b1aa9c', '#cdc6b7'], 1, 2.6, 0.55);
      // 64 px slabs with grout
      ctx.strokeStyle = 'rgba(90,86,78,0.55)';
      ctx.lineWidth = 2;
      for (var x = 0; x <= 256; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
      }
      for (var y = 0; y <= 256; y += 64) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      }
      // stains
      for (var i = 0; i < 10; i++) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#777264';
        ctx.beginPath();
        ctx.ellipse(rng.float(0, 256), rng.float(0, 256), rng.float(6, 26), rng.float(4, 16), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return toTexture(c);
    });
  }

  function sand() {
    return cached('sand', function () {
      var rng = seeded('sand');
      var c = makeCanvas(256, 256), ctx = c.getContext('2d');
      ctx.fillStyle = '#e7d1a2';
      ctx.fillRect(0, 0, 256, 256);
      noise(ctx, 256, 256, rng, 3600, ['#f0dcb0', '#d9c08d', '#e2c99a', '#cbb280'], 1, 2.2, 0.6);
      // wind ripples
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#b69c70';
      ctx.lineWidth = 2;
      for (var i = 0; i < 14; i++) {
        var y0 = rng.float(0, 256);
        ctx.beginPath();
        for (var x = 0; x <= 256; x += 8) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.06 + i) * 4);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return toTexture(c);
    });
  }

  function concrete() {
    return cached('concrete', function () {
      var rng = seeded('concrete');
      var c = makeCanvas(128, 128), ctx = c.getContext('2d');
      ctx.fillStyle = '#8e8a80';
      ctx.fillRect(0, 0, 128, 128);
      noise(ctx, 128, 128, rng, 900, ['#99958a', '#817d74', '#a5a094'], 1, 2, 0.55);
      return toTexture(c);
    });
  }

  // -------------------------------------------------------------- facades
  // Tile geometry: GLASS 6 windows x 8 floors per tile (18 m x 24 m)
  function facadeGlass(tintHex, style) {
    style = style || 'grid';
    return cached('glass:' + tintHex + ':' + style, function () {
      var rng = seeded('glass:' + tintHex + ':' + style);
      var W = 256, H = 256;
      var cols = style === 'fins' ? 10 : style === 'bands' ? 8 : 6;
      var rows = style === 'bands' ? 8 : style === 'fins' ? 10 : 8;
      var cw = W / cols, ch = H / rows;
      var base = makeCanvas(W, H), b = base.getContext('2d');
      var lit = makeCanvas(W, H), l = lit.getContext('2d');

      var tint = new THREE.Color(tintHex);
      var top = tint.clone().lerp(new THREE.Color(0xdfeef5), 0.4);
      var bot = tint.clone().multiplyScalar(0.72);
      var g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#' + top.getHexString());
      g.addColorStop(1, '#' + bot.getHexString());
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      l.fillStyle = '#000'; l.fillRect(0, 0, W, H);

      // spandrel colour between ribbon windows
      var spandrel = tint.clone().lerp(new THREE.Color(0x2c313a), 0.45);
      var finCol = tint.clone().lerp(new THREE.Color(0xd8d2c4), 0.55);

      for (var cy = 0; cy < rows; cy++) {
        for (var cx = 0; cx < cols; cx++) {
          var x = cx * cw, y = cy * ch;
          var w, h, px, py;
          if (style === 'bands') {
            // full-width ribbon window with a solid spandrel above
            b.fillStyle = '#' + spandrel.getHexString();
            b.fillRect(x, y, cw, ch);
            px = x + 1; py = y + ch * 0.42; w = cw - 2; h = ch * 0.54;
          } else if (style === 'fins') {
            px = x + 2; py = y + 2; w = cw * 0.52; h = ch - 4;
          } else {
            px = x + 3; py = y + 3; w = cw - 6; h = ch - 6;
          }
          var pg = b.createLinearGradient(px, py, px + w * 0.4, py + h);
          var bright = rng.float(0.72, 1.2);
          var c1 = new THREE.Color(0xbcd6e2).multiplyScalar(bright);
          var c2 = new THREE.Color(0x58748c).multiplyScalar(rng.float(0.8, 1.15));
          pg.addColorStop(0, '#' + c1.getHexString());
          pg.addColorStop(1, '#' + c2.getHexString());
          b.fillStyle = pg;
          b.fillRect(px, py, w, h);
          b.strokeStyle = 'rgba(18,28,36,0.6)';
          b.lineWidth = 1.2;
          b.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
          if (style === 'fins') {
            b.fillStyle = '#' + finCol.getHexString();
            b.fillRect(x + cw * 0.56, y, cw * 0.4, ch);
            b.fillStyle = 'rgba(30,34,38,0.35)';
            b.fillRect(x + cw * 0.92, y, cw * 0.08, ch);
          }
          // sun glint
          if (rng.chance(0.16)) {
            b.globalAlpha = 0.26;
            b.fillStyle = '#ffe9c4';
            b.fillRect(px + 2, py + 2, w * 0.18, h * 0.34);
            b.globalAlpha = 1;
          }
          // lit at night
          if (rng.chance(0.22)) {
            var warm = rng.chance(0.72);
            l.fillStyle = warm ? 'rgba(255,208,142,' + rng.float(0.32, 0.66).toFixed(2) + ')'
                               : 'rgba(160,212,255,' + rng.float(0.26, 0.55).toFixed(2) + ')';
            l.fillRect(px + w * 0.14, py + h * 0.18, w * 0.68, h * 0.58);
          }
        }
      }
      // mullion grid
      b.strokeStyle = 'rgba(30,42,52,0.7)';
      b.lineWidth = style === 'bands' ? 1.2 : 2;
      for (var i = 0; i <= cols; i++) { b.beginPath(); b.moveTo(i * cw, 0); b.lineTo(i * cw, H); b.stroke(); }
      for (var j = 0; j <= rows; j++) { b.beginPath(); b.moveTo(0, j * ch); b.lineTo(W, j * ch); b.stroke(); }

      return { map: toTexture(base), emissive: toTexture(lit) };
    });
  }

  // MARINA: 4 windows x 3 floors per tile (14 m x 10.5 m)
  function facadeStucco(tintHex) {
    return cached('stucco:' + tintHex, function () {
      var rng = seeded('stucco:' + tintHex);
      var W = 256, H = 192, cols = 4, rows = 3;
      var cw = W / cols, ch = H / rows;
      var base = makeCanvas(W, H), b = base.getContext('2d');
      var lit = makeCanvas(W, H), l = lit.getContext('2d');
      b.fillStyle = hex(tintHex); b.fillRect(0, 0, W, H);
      l.fillStyle = '#000'; l.fillRect(0, 0, W, H);

      // plaster mottling
      for (var i = 0; i < 900; i++) {
        b.globalAlpha = rng.float(0.04, 0.14);
        b.fillStyle = rng.chance(0.5) ? '#ffffff' : '#7d5a44';
        b.fillRect(rng.float(0, W), rng.float(0, H), rng.float(1, 4), rng.float(1, 4));
      }
      b.globalAlpha = 1;

      for (var cy = 0; cy < rows; cy++) {
        for (var cx = 0; cx < cols; cx++) {
          var w = 30, h = 38;
          var x = cx * cw + (cw - w) / 2, y = cy * ch + 20;
          // recess
          b.fillStyle = 'rgba(90,62,46,0.28)';
          b.fillRect(x - 3, y - 3, w + 6, h + 6);
          b.fillStyle = '#243540';
          b.fillRect(x, y, w, h);
          var pg = b.createLinearGradient(x, y, x + w, y + h);
          pg.addColorStop(0, '#7d9aa6'); pg.addColorStop(1, '#2a3b46');
          b.fillStyle = pg; b.fillRect(x, y, w, h);
          // shutter
          b.fillStyle = 'rgba(70,110,96,0.9)';
          b.fillRect(x - 9, y, 7, h);
          b.fillRect(x + w + 2, y, 7, h);
          b.strokeStyle = 'rgba(50,35,28,0.5)';
          b.lineWidth = 1;
          b.strokeRect(x, y, w, h);
          // balcony rail on middle floor
          if (cy === 1) {
            b.fillStyle = 'rgba(60,50,44,0.55)';
            b.fillRect(x - 12, y + h + 4, w + 24, 3);
            for (var r = 0; r < 7; r++) b.fillRect(x - 12 + r * ((w + 24) / 7), y + h + 4, 1.5, 8);
          }
          if (rng.chance(0.42)) {
            l.fillStyle = 'rgba(255,206,140,' + rng.float(0.5, 0.95).toFixed(2) + ')';
            l.fillRect(x, y, w, h);
          }
        }
      }
      // floor band
      b.fillStyle = 'rgba(255,255,255,0.18)';
      for (var f = 0; f <= rows; f++) b.fillRect(0, f * ch - 1, W, 3);
      return { map: toTexture(base), emissive: toTexture(lit) };
    });
  }

  // INDUSTRIAL: corrugated metal ribs, 8 m x 6 m tile
  function facadeWarehouse(tintHex) {
    return cached('warehouse:' + tintHex, function () {
      var rng = seeded('warehouse:' + tintHex);
      var W = 256, H = 192;
      var c = makeCanvas(W, H), b = c.getContext('2d');
      b.fillStyle = hex(tintHex); b.fillRect(0, 0, W, H);
      // vertical ribs
      for (var x = 0; x < W; x += 8) {
        b.fillStyle = 'rgba(255,255,255,0.10)';
        b.fillRect(x, 0, 3, H);
        b.fillStyle = 'rgba(0,0,0,0.16)';
        b.fillRect(x + 4, 0, 2, H);
      }
      // rust and streaks
      for (var i = 0; i < 26; i++) {
        b.globalAlpha = rng.float(0.08, 0.3);
        b.fillStyle = rng.chance(0.5) ? '#6a3b22' : '#3a3d3a';
        var rx = rng.float(0, W), ry = rng.float(0, H);
        b.fillRect(rx, ry, rng.float(2, 6), rng.float(6, 40));
      }
      b.globalAlpha = 0.9;
      // rivet line
      b.fillStyle = 'rgba(40,40,38,0.4)';
      for (var y = 12; y < H; y += 48) b.fillRect(0, y, W, 2);
      b.globalAlpha = 1;
      // high window strip
      b.fillStyle = '#1b242a';
      b.fillRect(20, 14, 70, 18);
      b.fillStyle = '#3c5058';
      b.fillRect(22, 16, 66, 14);
      b.globalAlpha = 1;
      return toTexture(c);
    });
  }

  // ground floor shops / awnings, 32 m x 6 m tile
  function shopStrip() {
    return cached('shops', function () {
      var rng = seeded('shops');
      var W = 512, H = 128;
      var c = makeCanvas(W, H), b = c.getContext('2d');
      b.fillStyle = '#1c2024'; b.fillRect(0, 0, W, H);
      var awnings = ['#c83f4b', '#2e7d74', '#d99a2b', '#3d5f9e', '#8e4b7a', '#c96a35'];
      for (var i = 0; i < 8; i++) {
        var x = i * 64;
        // shop window
        b.fillStyle = '#2c3c44';
        b.fillRect(x + 6, 40, 52, 76);
        var g = b.createLinearGradient(x + 6, 40, x + 58, 116);
        g.addColorStop(0, 'rgba(160,190,195,0.5)');
        g.addColorStop(1, 'rgba(20,28,32,0.9)');
        b.fillStyle = g; b.fillRect(x + 6, 40, 52, 76);
        // frame
        b.strokeStyle = '#3a3a38'; b.lineWidth = 3; b.strokeRect(x + 6, 40, 52, 76);
        // awning
        b.fillStyle = awnings[i % awnings.length];
        b.fillRect(x + 2, 26, 60, 14);
        b.fillStyle = 'rgba(255,255,255,0.25)';
        for (var s = 0; s < 60; s += 12) b.fillRect(x + 2 + s, 26, 6, 14);
        // sign block
        b.fillStyle = 'rgba(245,225,180,0.85)';
        b.fillRect(x + 10, 8, 44, 10);
        b.fillStyle = 'rgba(30,30,30,0.8)';
        for (var k = 0; k < 4; k++) b.fillRect(x + 14 + k * 10, 11, 6, 4);
      }
      return toTexture(c);
    });
  }

  // --------------------------------------------------------------- labels
  function neon(text, colorHex) {
    return cached('neon:' + text + ':' + colorHex, function () {
      var W = 512, H = 128;
      var c = makeCanvas(W, H), b = c.getContext('2d');
      b.clearRect(0, 0, W, H);
      var col = hex(colorHex);
      b.font = '700 74px "Trebuchet MS", "Segoe UI", sans-serif';
      b.textAlign = 'center';
      b.textBaseline = 'middle';
      b.shadowColor = col;
      b.shadowBlur = 26;
      b.fillStyle = col;
      b.fillText(text, W / 2, H / 2 + 4);
      b.shadowBlur = 10;
      b.fillStyle = '#ffffff';
      b.globalAlpha = 0.85;
      b.fillText(text, W / 2, H / 2 + 4);
      b.globalAlpha = 1;
      return toTexture(c);
    });
  }

  // -------------------------------------------------------------- effects
  function glow() {
    return cached('glow', function () {
      var c = makeCanvas(128, 128), b = c.getContext('2d');
      var g = b.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = g; b.fillRect(0, 0, 128, 128);
      return toTexture(c);
    });
  }

  function streak() {
    return cached('streak', function () {
      var c = makeCanvas(256, 64), b = c.getContext('2d');
      var g = b.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, 'rgba(255,220,170,0)');
      g.addColorStop(0.5, 'rgba(255,235,200,0.85)');
      g.addColorStop(1, 'rgba(255,220,170,0)');
      b.fillStyle = g; b.fillRect(0, 24, 256, 16);
      var v = b.createLinearGradient(0, 0, 0, 64);
      v.addColorStop(0, 'rgba(255,220,170,0)');
      v.addColorStop(0.5, 'rgba(255,230,190,0.35)');
      v.addColorStop(1, 'rgba(255,220,170,0)');
      b.fillStyle = v; b.fillRect(0, 0, 256, 64);
      return toTexture(c);
    });
  }

  function smoke() {
    return cached('smoke', function () {
      var c = makeCanvas(64, 64), b = c.getContext('2d');
      var g = b.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(235,232,226,0.9)');
      g.addColorStop(0.45, 'rgba(200,198,194,0.45)');
      g.addColorStop(1, 'rgba(180,178,174,0)');
      b.fillStyle = g; b.fillRect(0, 0, 64, 64);
      return toTexture(c);
    });
  }

  function frond() {
    return cached('frond', function () {
      var rng = seeded('frond');
      var c = makeCanvas(256, 128), b = c.getContext('2d');
      b.clearRect(0, 0, 256, 128);
      // stem
      b.strokeStyle = '#4f6b32';
      b.lineWidth = 4;
      b.beginPath(); b.moveTo(0, 64); b.quadraticCurveTo(128, 58, 250, 70); b.stroke();
      // leaflets
      for (var i = 8; i < 244; i += 6) {
        var t = i / 256;
        var len = Math.sin(t * Math.PI) * 44 + 8;
        var sway = rng.float(-4, 4);
        b.strokeStyle = i % 12 === 0 ? '#2f5a2a' : '#3f7034';
        b.lineWidth = 3;
        b.beginPath();
        b.moveTo(i, 64);
        b.lineTo(i + 10 + sway, 64 - len);
        b.stroke();
        b.beginPath();
        b.moveTo(i, 64);
        b.lineTo(i + 12 + sway, 64 + len * 0.9);
        b.stroke();
      }
      return toTexture(c);
    });
  }

  function leafCluster() {
    return cached('leafcluster', function () {
      var rng = seeded('leafcluster');
      var c = makeCanvas(128, 128), b = c.getContext('2d');
      b.clearRect(0, 0, 128, 128);
      for (var i = 0; i < 90; i++) {
        var a = rng.angle(), r = rng.float(0, 52);
        b.fillStyle = rng.chance(0.5) ? '#3d6a35' : '#4f7d3c';
        b.globalAlpha = rng.float(0.5, 1);
        b.beginPath();
        b.ellipse(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rng.float(3, 9), rng.float(2, 5), a, 0, Math.PI * 2);
        b.fill();
      }
      b.globalAlpha = 1;
      return toTexture(c);
    });
  }

  function wood() {
    return cached('wood', function () {
      var rng = seeded('wood');
      var c = makeCanvas(128, 128), b = c.getContext('2d');
      b.fillStyle = '#8a6a45'; b.fillRect(0, 0, 128, 128);
      for (var i = 0; i < 16; i++) {
        b.strokeStyle = i % 2 ? 'rgba(60,40,24,0.35)' : 'rgba(190,156,110,0.25)';
        b.lineWidth = rng.float(1, 3);
        b.beginPath();
        var y = i * 8 + rng.float(-2, 2);
        b.moveTo(0, y);
        b.bezierCurveTo(40, y + rng.float(-3, 3), 80, y + rng.float(-3, 3), 128, y);
        b.stroke();
      }
      return toTexture(c);
    });
  }

  function tileRoof() {
    return cached('roof', function () {
      var rng = seeded('roof');
      var c = makeCanvas(128, 128), b = c.getContext('2d');
      b.fillStyle = '#6f6a60'; b.fillRect(0, 0, 128, 128);
      for (var y = 0; y < 128; y += 16) {
        b.fillStyle = 'rgba(30,30,28,0.22)';
        b.fillRect(0, y, 128, 3);
      }
      noise(b, 128, 128, rng, 400, ['#7d786d', '#615d54', '#888378'], 1, 2, 0.5);
      return toTexture(c);
    });
  }

  BS.Tex = {
    asphalt: asphalt,
    sidewalk: sidewalk,
    sand: sand,
    concrete: concrete,
    facadeGlass: facadeGlass,
    facadeStucco: facadeStucco,
    facadeWarehouse: facadeWarehouse,
    shopStrip: shopStrip,
    neon: neon,
    glow: glow,
    streak: streak,
    smoke: smoke,
    frond: frond,
    leafCluster: leafCluster,
    wood: wood,
    roof: tileRoof,
    hex: hex
  };
})(window.BS);
