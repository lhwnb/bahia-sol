/* Bahía Sol — vehicles.
   Low-poly cars merged into three meshes each (painted shell, wheels, lamps),
   an arcade driving model, damage, and the little details that sell a car:
   spinning wheels, brake lights, police light bars, taxi roof signs. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG, G = BS.Geo;
  var nextId = 1;

  var WHEEL_COLOR = 0x14161a;
  var GLASS = 0x2b3d49;
  var BUMPER = 0x22262b;

  function wedge(w, h, d, zPos, yPos, tilt, color) {
    var g = new THREE.BoxGeometry(w, h, d);
    g.rotateX(tilt);
    g.translate(0, yPos, zPos);
    return G.paint(g, color);
  }

  function shade(hex, k) {
    return new THREE.Color(hex).multiplyScalar(k).getHex();
  }

  // Cubic tube along Z — used for exhaust tips.
  function pipe(x, y, z, r, len, color) {
    var g = new THREE.CylinderGeometry(r, r, len, 8);
    g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    return G.paint(g, color);
  }

  // Roof height per body style, so light bars and taxi signs sit on the roof
  // instead of floating above it.
  function roofY(spec, kind) {
    var H = spec.height;
    var bodyH = kind === 'van' ? H * 0.72 : H * 0.42;
    var belt = 0.4 + bodyH;
    if (kind === 'van') return belt + H * 0.3;
    if (kind === 'pickup') return belt + H * 0.33;
    if (kind === 'sport') return belt + H * 0.30;
    if (kind === 'muscle') return belt + H * 0.31;
    return belt + H * 0.34;
  }

  function bodyGeometry(spec, paint, kind) {
    var L = spec.length, Wd = spec.width, H = spec.height;
    var parts = [];
    // the shell rides high enough that the tyres read from any angle
    var y0 = 0.4;
    var bodyH = H * 0.42;
    var beltY = y0 + bodyH;
    var paintC = paint;
    var GLASS_LO = 0x6d8b9c;   // shadowed lower glass
    var GLASS_HI = 0x9dbecd;   // sky-facing upper glass
    var TRIM = 0x181b1f;
    var CHROME = 0xb9c2c8;

    // ---- flat plates with automatic outward winding ----------------------
    function quad(list, a, b, c, d, color, hint, off) {
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      var wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
        var t = b; b = d; d = t;
        nx = -nx; ny = -ny; nz = -nz;
      }
      var o = off || 0;
      var pts = [a, b, c, a, c, d];
      var pos = [], nor = [];
      for (var i = 0; i < 6; i++) {
        pos.push(pts[i][0] + nx * o, pts[i][1] + ny * o, pts[i][2] + nz * o);
        nor.push(nx, ny, nz);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
      list.push(G.paint(g, color));
    }

    function shrinkQuad(a, b, c, d, f) {
      var cx = (a[0] + b[0] + c[0] + d[0]) * 0.25;
      var cy = (a[1] + b[1] + c[1] + d[1]) * 0.25;
      var cz = (a[2] + b[2] + c[2] + d[2]) * 0.25;
      function s(p) {
        return [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f, cz + (p[2] - cz) * f];
      }
      return [s(a), s(b), s(c), s(d)];
    }

    // dark arch recess behind the wheel, plus a flare swept over the tyre
    function archRecess(zPos, flareColor) {
      for (var s = -1; s <= 1; s += 2) {
        // shadowed wheel well: an arc, not a slab, so the flank stays intact
        var well = new THREE.RingGeometry(0.33, 0.50, 10, 1, -0.32, Math.PI + 0.64);
        well.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
        well.translate(s * (Wd / 2 - 0.004), y0, zPos);
        parts.push(G.paint(well, 0x0b0d10));
        var flare = new THREE.TorusGeometry(0.47, 0.058, 5, 9, Math.PI);
        flare.rotateY(Math.PI / 2);
        flare.translate(s * (Wd / 2 - 0.004), y0, zPos);
        parts.push(G.paint(flare, flareColor || paintC));
      }
    }

    // Greenhouse: roof narrower than the waist, screens raked back, glass set
    // into a painted shell so the pillars read as body colour.
    function greenhouse(cabH, cabL, cabZ, rakeF, rakeR) {
      var hw0 = Wd * 0.462;      // waist
      var hw1 = Wd * 0.352;      // roof
      var zF0 = cabZ + cabL * 0.5, zB0 = cabZ - cabL * 0.5;
      var zF1 = zF0 - rakeF, zB1 = zB0 + rakeR;
      var yB = beltY, yT = beltY + cabH;

      var front = [[-hw0, yB, zF0], [hw0, yB, zF0], [hw1, yT, zF1], [-hw1, yT, zF1]];
      var back = [[-hw0, yB, zB0], [hw0, yB, zB0], [hw1, yT, zB1], [-hw1, yT, zB1]];
      var sideL = [[-hw0, yB, zB0], [-hw0, yB, zF0], [-hw1, yT, zF1], [-hw1, yT, zB1]];
      var sideR = [[hw0, yB, zB0], [hw0, yB, zF0], [hw1, yT, zF1], [hw1, yT, zB1]];
      var roof = [[-hw1, yT, zB1], [hw1, yT, zB1], [hw1, yT, zF1], [-hw1, yT, zF1]];
      var faces = [
        [front, [0, 0.35, 1], GLASS_HI],
        [back, [0, 0.35, -1], GLASS_LO],
        [sideL, [-1, 0, 0], GLASS_HI],
        [sideR, [1, 0, 0], GLASS_HI],
        [roof, [0, 1, 0], 0]
      ];
      for (var f = 0; f < faces.length; f++) {
        var q = faces[f][0];
        quad(parts, q[0], q[1], q[2], q[3], paintC, faces[f][1]);
      }
      // glazing sits a hair proud of the shell, inset on every edge
      for (var g2 = 0; g2 < 4; g2++) {
        var qq = faces[g2][0];
        var sg = shrinkQuad(qq[0], qq[1], qq[2], qq[3], g2 === 3 ? 0.86 : 0.9);
        quad(parts, sg[0], sg[1], sg[2], sg[3], faces[g2][2], faces[g2][1], 0.012);
      }
      // cabin interior: one low block of seats, kept short and low so the raked
      // screens and the tapered roof can never be pierced by it
      parts.push(G.box(Wd * 0.58, cabH * 0.46, cabL * 0.5, 0, yB + cabH * 0.24, cabZ, 0x2b3138));
      // chrome sill along the base of the glass
      parts.push(G.box(Wd * 0.94, 0.022, cabL * 0.9, 0, yB + 0.012, cabZ, CHROME));
      return yT;
    }

    var cabH, cabL, cabZ;

    if (kind === 'van') {
      parts.push(G.box(Wd, H * 0.72, L, 0, y0 + H * 0.36, 0, paintC));
      parts.push(G.box(Wd * 0.9, H * 0.3, L * 0.2, 0, y0 + H * 0.62, L * 0.4, GLASS_LO));
      parts.push(G.box(Wd * 0.88, H * 0.44, L * 0.6, 0, y0 + H * 0.8, -L * 0.16, paintC));
      for (var vs = -1; vs <= 1; vs += 2) {
        parts.push(G.box(0.02, 0.4, L * 0.46, vs * Wd * 0.442, y0 + H * 0.64, -L * 0.06, GLASS_HI));
        parts.push(G.box(0.05, 0.06, L * 0.5, vs * Wd * 0.45, y0 + H * 0.5, -L * 0.06, paintC));
      }
      parts.push(wedge(Wd * 0.82, 0.05, H * 0.4, L * 0.5, y0 + H * 0.66, -0.3, GLASS_HI));
      parts.push(G.box(Wd * 0.9, 0.05, L * 0.62, 0, y0 + H * 1.02, -L * 0.16, 0xd8dcde));
      archRecess(L * 0.32); archRecess(-L * 0.32);
    } else if (kind === 'pickup') {
      parts.push(G.box(Wd, bodyH, L, 0, y0 + bodyH / 2, 0, paintC));
      // raised hood step in front of the screen
      parts.push(G.box(Wd * 0.97, bodyH * 0.42, L * 0.34, 0, y0 + bodyH * 0.8, L * 0.31, paintC));
      parts.push(G.box(Wd * 0.99, 0.03, L * 0.3, 0, y0 + bodyH * 0.99, L * 0.31, paintC));
      cabH = H * 0.33; cabL = L * 0.3; cabZ = -L * 0.02;
      greenhouse(cabH, cabL, cabZ, 0.30, 0.14);
      // open bed with side walls and a tailgate
      parts.push(G.box(Wd * 0.98, 0.06, L * 0.42, 0, y0 + bodyH * 0.98, -L * 0.32, 0x2a2e33));
      for (var bs = -1; bs <= 1; bs += 2) {
        parts.push(G.box(0.09, 0.34, L * 0.42, bs * Wd * 0.455, y0 + bodyH + 0.16, -L * 0.32, paintC));
      }
      parts.push(G.box(Wd * 0.98, 0.36, 0.09, 0, y0 + bodyH + 0.17, -L * 0.53, paintC));
      archRecess(L * 0.32); archRecess(-L * 0.32);
    } else if (kind === 'sport') {
      parts.push(G.box(Wd, bodyH * 0.78, L, 0, y0 + bodyH * 0.39, 0, paintC));
      parts.push(G.box(Wd * 0.94, bodyH * 0.36, L * 0.36, 0, y0 + bodyH * 0.72, L * 0.3, paintC));
      cabH = H * 0.30; cabL = L * 0.38; cabZ = -L * 0.08;
      greenhouse(cabH, cabL, cabZ, 0.44, 0.40);
      parts.push(G.box(Wd * 0.72, 0.05, L * 0.16, 0, y0 + bodyH * 0.86, -L * 0.4, TRIM));
      archRecess(L * 0.32); archRecess(-L * 0.32);
    } else {
      // sedan / muscle / cruiser
      parts.push(G.box(Wd, bodyH, L, 0, y0 + bodyH / 2, 0, paintC));
      if (kind === 'muscle') {
        // long bonnet, short deck, ducktail
        parts.push(G.box(Wd * 0.985, bodyH * 0.42, L * 0.4, 0, y0 + bodyH * 0.8, L * 0.29, paintC));
        parts.push(G.box(Wd * 0.995, 0.03, L * 0.36, 0, y0 + bodyH * 1.0, L * 0.29, paintC));
        parts.push(G.box(Wd * 0.4, 0.05, L * 0.3, 0, y0 + bodyH * 1.02, L * 0.3, shade(paintC, 0.82)));
        parts.push(G.box(Wd * 0.97, bodyH * 0.36, L * 0.18, 0, y0 + bodyH * 0.82, -L * 0.4, paintC));
        parts.push(G.box(Wd * 0.76, 0.06, 0.34, 0, y0 + bodyH * 0.99, -L * 0.45, paintC));
        cabH = H * 0.31; cabL = L * 0.34; cabZ = -L * 0.06;
        greenhouse(cabH, cabL, cabZ, 0.44, 0.42);
      } else {
        parts.push(G.box(Wd * 0.97, bodyH * 0.4, L * 0.32, 0, y0 + bodyH * 0.8, L * 0.33, paintC));
        parts.push(G.box(Wd * 0.99, 0.028, L * 0.28, 0, y0 + bodyH * 1.0, L * 0.33, paintC));
        parts.push(G.box(Wd * 0.97, bodyH * 0.4, L * 0.22, 0, y0 + bodyH * 0.8, -L * 0.38, paintC));
        parts.push(G.box(Wd * 0.99, 0.028, L * 0.19, 0, y0 + bodyH * 1.0, -L * 0.38, paintC));
        cabH = H * 0.34; cabL = L * 0.40; cabZ = -L * 0.03;
        greenhouse(cabH, cabL, cabZ, 0.42, 0.34);
      }
      // shut line under the screen
      parts.push(G.box(Wd * 0.9, 0.02, 0.05, 0, y0 + bodyH * 1.005, L * 0.16, TRIM));
      archRecess(L * 0.32); archRecess(-L * 0.32);
    }

    // ---- beltline crease: one thin, slightly proud line down each flank ----
    for (var cs = -1; cs <= 1; cs += 2) {
      parts.push(G.box(0.035, 0.032, L * 0.58, cs * (Wd / 2 - 0.002), beltY - 0.055, 0, shade(paintC, 0.62)));
      parts.push(G.box(0.028, 0.028, L * 0.5, cs * (Wd / 2 - 0.004), y0 + bodyH * 0.22, 0, shade(paintC, 0.7)));
    }

    // ---- face: grille, bumpers, valance, exhaust tips ---------------------
    var nosY = y0 + bodyH * 0.34;
    parts.push(G.box(Wd * 0.58, 0.21, 0.05, 0, nosY, L / 2 - 0.005, 0x22262b));   // surround
    parts.push(G.box(Wd * 0.52, 0.15, 0.06, 0, nosY, L / 2 + 0.012, TRIM));       // mesh
    parts.push(G.box(Wd * 0.5, 0.022, 0.07, 0, nosY + 0.05, L / 2 + 0.02, CHROME));
    parts.push(G.box(Wd * 0.5, 0.022, 0.07, 0, nosY - 0.05, L / 2 + 0.02, CHROME));
    parts.push(G.box(Wd * 0.18, 0.1, 0.05, 0, nosY - 0.02, L / 2 + 0.03, 0xc9a227));  // badge

    parts.push(G.box(Wd * 1.01, 0.18, 0.24, 0, y0 + 0.12, L / 2 - 0.02, BUMPER));
    parts.push(G.box(Wd * 1.01, 0.18, 0.24, 0, y0 + 0.12, -L / 2 + 0.02, BUMPER));
    parts.push(G.box(Wd * 0.96, 0.05, 0.3, 0, y0 - 0.02, L / 2 - 0.08, TRIM));   // front valance
    // rear valance the exhaust tips actually emerge from
    parts.push(G.box(Wd * 0.95, 0.17, 0.28, 0, y0 - 0.10, -L / 2 + 0.11, TRIM));
    parts.push(G.box(Wd * 1.02, 0.042, 0.05, 0, y0 + 0.21, L / 2 + 0.03, CHROME));
    parts.push(G.box(Wd * 1.02, 0.042, 0.05, 0, y0 + 0.21, -L / 2 - 0.03, CHROME));

    if (kind === 'muscle') {
      parts.push(pipe(Wd * 0.34, y0 - 0.06, -L / 2 - 0.08, 0.062, 0.2, CHROME));
      parts.push(pipe(-Wd * 0.34, y0 - 0.06, -L / 2 - 0.08, 0.062, 0.2, CHROME));
      parts.push(pipe(Wd * 0.22, y0 - 0.06, -L / 2 - 0.08, 0.062, 0.2, CHROME));
      parts.push(pipe(-Wd * 0.22, y0 - 0.06, -L / 2 - 0.08, 0.062, 0.2, CHROME));
    } else if (kind !== 'van') {
      parts.push(pipe(Wd * 0.28, y0 - 0.06, -L / 2 - 0.08, 0.062, 0.2, CHROME));
      parts.push(pipe(-Wd * 0.28, y0 - 0.06, -L / 2 - 0.08, 0.062, 0.2, CHROME));
    }

    // mirrors and side skirts
    parts.push(G.box(0.16, 0.1, 0.3, Wd / 2 + 0.02, beltY + 0.02, L * 0.1, paintC));
    parts.push(G.box(0.16, 0.1, 0.3, -Wd / 2 - 0.02, beltY + 0.02, L * 0.1, paintC));
    parts.push(G.box(0.1, 0.12, L * 0.5, Wd / 2, y0 - 0.02, 0, BUMPER));
    parts.push(G.box(0.1, 0.12, L * 0.5, -Wd / 2, y0 - 0.02, 0, BUMPER));

    return G.merge(parts);
  }


  var WHEEL_RADIUS = 0.4;

  function wheelGeometry() {
    // thick tyre plus a lighter rim disc poking out of both faces
    var tyre = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 12);
    tyre.rotateZ(Math.PI / 2);
    var rim = new THREE.CylinderGeometry(0.18, 0.18, 0.345, 10);
    rim.rotateZ(Math.PI / 2);
    return G.merge([G.paint(tyre, WHEEL_COLOR), G.paint(rim, 0xc2c8ce)]);
  }

  function lampGeometry(spec, police) {
    var L = spec.length, Wd = spec.width;
    var parts = [];
    var head = police ? 0xeaf6ff : 0xfff4d2;
    var hy = 0.72, hx = Wd * 0.33;
    for (var s = -1; s <= 1; s += 2) {
      // front: dark housing with twin lenses and an amber indicator
      parts.push(G.box(0.58, 0.25, 0.1, s * hx, hy, L / 2 - 0.01, 0x14171a));
      parts.push(G.box(0.24, 0.17, 0.06, s * (hx - 0.13), hy + 0.005, L / 2 + 0.048, head));
      parts.push(G.box(0.2, 0.15, 0.06, s * (hx + 0.14), hy + 0.005, L / 2 + 0.048, head));
      parts.push(G.box(0.09, 0.1, 0.05, s * (Wd * 0.44), hy - 0.02, L / 2 + 0.04, 0xffb15a));
      // rear: housing with a red run lens, brake lens and a small reverse lamp
      parts.push(G.box(0.62, 0.22, 0.1, s * hx, hy, -L / 2 + 0.01, 0x14171a));
      parts.push(G.box(0.3, 0.16, 0.06, s * (hx - 0.12), hy, -L / 2 - 0.048, 0xff2f24));
      parts.push(G.box(0.18, 0.13, 0.06, s * (hx + 0.16), hy, -L / 2 - 0.048, 0xff5f38));
      parts.push(G.box(0.09, 0.08, 0.05, s * (hx + 0.16), hy - 0.085, -L / 2 - 0.05, 0xf3e6c8));
    }
    parts.push(G.box(Wd * 0.34, 0.09, 0.05, 0, hy - 0.04, -L / 2 - 0.042, 0xc4201c));
    return G.merge(parts);
  }

  // soft additive bloom on the lenses, switched on with the night scene
  function lampGlow(color, sx, sy, sz, opacity) {
    var mat = new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(sx, sy, 1);
    sp.position.set(0, 0.72, sz);
    return sp;
  }

  function buildCar(specId, colorHex, opts) {
    opts = opts || {};
    var spec = CFG.cars[specId] || CFG.cars.sedan;
    var kind = opts.kind || spec.kind;
    var paint = colorHex === undefined ? 0xc8232c : colorHex;
    var group = new THREE.Group();

    var body = new THREE.Mesh(bodyGeometry(spec, paint, kind), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0.35
    }));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    var wg = wheelGeometry();
    var wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.25 });
    var wheels = [];
    var wx = spec.width / 2 - 0.11, wz = spec.length * 0.32;
    var spots = [[wx, wz], [-wx, wz], [wx, -wz], [-wx, -wz]];
    for (var i = 0; i < 4; i++) {
      var wheel = new THREE.Mesh(wg, wheelMat);
      wheel.position.set(spots[i][0], WHEEL_RADIUS, spots[i][1]);
      // yaw (steering) must be applied before the roll about the axle
      wheel.rotation.order = 'YXZ';
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }

    var lamps = new THREE.Mesh(lampGeometry(spec, kind === 'cruiser'), new THREE.MeshBasicMaterial({
      vertexColors: true, toneMapped: false
    }));
    group.add(lamps);

    // lens bloom, only lit in the night scene
    var night = !!(BS.game && BS.game.city && BS.game.city.night);
    var glows = [];
    if (night) {
      var gRear = lampGlow(0xff2f24, 2.1, 0.9, -spec.length / 2 - 0.1, 0.3);
      var gFront = lampGlow(0xfff0cc, 1.9, 0.8, spec.length / 2 + 0.1, 0.2);
      group.add(gRear); group.add(gFront);
      glows.push(gRear, gFront);
    }

    var lightBar = null;
    if (kind === 'cruiser') {
      // sits on the flat part of the roof, not over the raked rear screen
      var barY = roofY(spec, kind) + 0.09;
      var barZ = -spec.length * 0.03 + spec.length * 0.40 * 0.12;
      var redMat = new THREE.MeshBasicMaterial({ color: 0xff2a24, toneMapped: false });
      var blueMat = new THREE.MeshBasicMaterial({ color: 0x2e7bff, toneMapped: false });
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.3), redMat);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.3), blueMat);
      red.position.set(-0.38, barY, barZ);
      blue.position.set(0.38, barY, barZ);
      group.add(red); group.add(blue);
      lightBar = { red: redMat, blue: blueMat, redMesh: red, blueMesh: blue, phase: 0 };
    }

    // black door panels for cruisers
    if (kind === 'cruiser') {
      var decalH = spec.height * 0.42 * 0.82;
      var decal = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.02, decalH, spec.length * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.6 }));
      decal.position.set(0, 0.4 + spec.height * 0.42 * 0.55, 0);
      group.add(decal);
    }
    if (opts.taxi) {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 0.36),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false }));
      sign.position.set(0, roofY(spec, kind) + 0.19, -0.1);
      group.add(sign);
    }

    var car = {
      id: nextId++,
      spec: spec,
      specId: specId,
      kind: kind,
      group: group,
      body: body,
      wheels: wheels,
      lamps: lamps,
      lightBar: lightBar,
      color: paint,
      health: 100,
      maxHealth: 100,
      speed: 0,
      lateral: 0,
      heading: 0,
      driver: null,
      isPolice: kind === 'cruiser',
      sirenOn: false,
      braking: false,
      wheelSpin: 0,
      steerVis: 0,
      smokeTimer: 0,
      explodeTimer: 0
    };
    group.userData.car = car;
    return car;
  }

  function placeCar(car, x, z, heading) {
    car.group.position.set(x, 0, z);
    car.heading = heading || 0;
    car.group.rotation.y = car.heading;
    return car;
  }

  function damageCar(car, amount) {
    car.health = Math.max(0, car.health - Math.abs(amount));
    if (car.health <= 0) car.explodeTimer = 2.2;
    return car.health;
  }

  // Arcade physics. controls: { throttle, steer, handbrake, brake }
  function driveCar(car, dt, controls, city, cars, opts) {
    opts = opts || {};
    var spec = car.spec;
    var throttle = controls.throttle || 0;
    var steer = controls.steer || 0;
    var maxSpeed = spec.maxSpeed * (opts.speedScale || 1);

    if (throttle > 0) {
      var accel = spec.accel * (1 - Math.min(1, Math.abs(car.speed) / maxSpeed) * 0.82);
      car.speed += accel * throttle * dt;
    } else if (throttle < 0) {
      if (car.speed > 0.6) car.speed += throttle * spec.brake * dt;
      else car.speed += throttle * spec.accel * 0.45 * dt;
    }
    // drag and rolling resistance
    car.speed -= car.speed * 0.6 * dt;
    if (controls.handbrake) car.speed -= car.speed * 2.4 * dt;
    if (controls.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), spec.brake * dt);
    car.speed = Math.max(-maxSpeed * 0.34, Math.min(maxSpeed, car.speed));
    car.braking = controls.brake || (throttle < 0 && car.speed > 1);

    var speedAbs = Math.abs(car.speed);
    var steerFrac = Math.min(1, speedAbs / 9);
    var turn = steer * 1.75 * steerFrac * Math.sign(car.speed || 1);
    if (opts.noSteer) turn = 0;
    car.heading += turn * dt;

    // drift: lateral slip grows with hard steering, shrinks with grip
    var slip = -steer * speedAbs * 0.11;
    car.lateral += (slip - car.lateral) * Math.min(1, spec.grip * dt);
    if (controls.handbrake) car.lateral += -steer * speedAbs * 1.1 * dt;

    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    var nx = car.group.position.x + (fx * car.speed + rx * car.lateral) * dt;
    var nz = car.group.position.z + (fz * car.speed + rz * car.lateral) * dt;

    // building collisions: push out along the shallow axis and scrub speed
    var hit = null;
    for (var i = 0; i < city.colliders.length; i++) {
      var c = city.colliders[i];
      if (c.height !== undefined && c.height < 0.6) continue;
      var pad = Math.max(spec.width, 1.6) * 0.55;
      if (nx > c.minX - pad && nx < c.maxX + pad && nz > c.minZ - pad && nz < c.maxZ + pad) {
        hit = c; break;
      }
    }
    if (hit) {
      var dl = Math.abs(nx - (hit.minX - spec.width * 0.5)), dr = Math.abs(nx - (hit.maxX + spec.width * 0.5));
      var dn = Math.abs(nz - (hit.minZ - spec.length * 0.4)), ds = Math.abs(nz - (hit.maxZ + spec.length * 0.4));
      var m = Math.min(dl, dr, dn, ds);
      if (m === dl) nx = hit.minX - spec.width * 0.5;
      else if (m === dr) nx = hit.maxX + spec.width * 0.5;
      else if (m === dn) nz = hit.minZ - spec.length * 0.4;
      else nz = hit.maxZ + spec.length * 0.4;
      if (speedAbs > 8) damageCar(car, (speedAbs - 6) * 0.8);
      car.speed *= -0.22;
      car.lateral *= 0.4;
    }

    // car-vs-car: a soft circle test, both cars take a knock
    if (cars) {
      for (var j = 0; j < cars.length; j++) {
        var other = cars[j];
        if (other === car || other.dead) continue;
        var dx = nx - other.group.position.x;
        var dz = nz - other.group.position.z;
        var rr = (spec.length + other.spec.length) * 0.32;
        var d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          nx = other.group.position.x + (dx / d) * rr;
          nz = other.group.position.z + (dz / d) * rr;
          if (speedAbs > 6) {
            damageCar(car, (speedAbs - 4) * 0.35);
            if (other.driver === 'npc') damageCar(other, (speedAbs - 4) * 0.35);
            car.speed *= 0.55;
          }
        }
      }
    }

    car.group.position.x = nx;
    car.group.position.z = nz;
    car.group.rotation.y = car.heading;
    car.group.position.y = 0;

    // wheel animation: roll with speed, front pair steers into the corner
    car.wheelSpin += car.speed * dt * 2.2;
    car.steerVis += (steer * 0.62 - car.steerVis) * Math.min(1, dt * 12);
    for (var w = 0; w < car.wheels.length; w++) {
      car.wheels[w].rotation.x = car.wheelSpin;
      if (w < 2) car.wheels[w].rotation.y = car.steerVis;
    }

    // police lights
    if (car.lightBar) {
      car.lightBar.phase += dt * 7.5;
      var on = Math.sin(car.lightBar.phase) > 0;
      car.lightBar.red.color.setHex(on && car.sirenOn ? 0xff3b2e : 0x5a1512);
      car.lightBar.blue.color.setHex(!on && car.sirenOn ? 0x3b86ff : 0x101a3a);
      car.lightBar.blueMesh.visible = true;
    }

    // smoke when wrecked
    if (car.health < 35) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.12;
        if (BS.Fx) BS.Fx.smoke(car.group.position, 0.8, car.health < 12 ? 0x2b2b2b : 0xbfbcb4);
      }
    }
    if (car.explodeTimer > 0) {
      car.explodeTimer -= dt;
      if (car.explodeTimer <= 0) {
        if (BS.Fx) BS.Fx.explosion(car.group.position);
        car.dead = true;
        car.group.visible = false;
      }
    }
    return car;
  }

  function spawnParked(scene, city, rng) {
    var cars = [];
    var spots = [
      [-282, 356, 0.02, 'falcon', 0xc8232c],
      [96, 6.6, 0.02, 'sedan', 0xd9d2c4],
      [156, -6.6, Math.PI, 'sedan', 0x2f5f9e],
      [-96, 6.6, 0.02, 'sport', 0xe0b23c],
      [62, 466, 0.02, 'van', 0xf2f2ef],
      [-60, 474, Math.PI, 'sedan', 0x2f8f7a],
      [306, -354, 0.02, 'pickup', 0x37506b],
      [294, 354, Math.PI, 'sedan', 0x8d8f95],
      [-174, -246, 0.02, 'taxi', 0xe0b23c],
      [420, 6.6, 0.02, 'sport', 0xa8432f]
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var car = buildCar(s[3], s[4], { taxi: s[3] === 'taxi' });
      placeCar(car, s[0], s[1], s[2]);
      car.parked = true;
      scene.add(car.group);
      cars.push(car);
    }
    return cars;
  }

  BS.Vehicles = {
    create: buildCar,
    place: placeCar,
    drive: driveCar,
    damage: damageCar,
    spawnParked: spawnParked,
    wheelGeometry: wheelGeometry
  };
})(window.BS);
