/* Bahía Sol — pedestrians.
   Fifty walkers plus six hireable rivals. Every body is built from one shared
   primitive kit (tapered torso prism, pelvis, head + hair cap, neck, thigh/shin/
   foot, upper arm/forearm+hand) so a figure still reads as a human at 8–20 m:
   shoulders wider than the waist, arms counter-swinging against the legs, knees
   folding on the swing-through. Parts are instanced, per-instance colour only,
   and every matrix is written into scratch objects — no per-frame allocation. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;
  var STEP = CFG.world.step;

  // 8 clothing colours, 6 trousers, plus per-person shoes, hair and skin.
  var SHIRTS = [0xd9d2c0, 0x35506b, 0xc0503f, 0x2f7d6d, 0xe0b23c, 0x8a5a86, 0x3b3f45, 0xd8e0e2];
  var PANTS = [0x2b3038, 0x3f4a5a, 0x5a4a38, 0x1f242a, 0x6b6f74, 0x46504a];
  var SHOES = [0x17191c, 0x2c2622, 0x4a3b2a, 0x6d6f72, 0x101215];
  var HAIR = [0x1a1512, 0x2e2118, 0x4b3322, 0x6b5033, 0x231f1d, 0x8a8078];
  var SKIN = [0xd8a878, 0xb87c4e, 0x8a5a36, 0xe8c39a, 0x6b4326];

  // height scale, width scale — five distinct builds, none of them a box stack
  var BUILDS = [
    [1.06, 0.93],   // tall and slim
    [0.94, 1.11],   // short and broad
    [1.00, 1.00],   // average
    [1.03, 1.09],   // tall and broad
    [0.95, 0.91]    // short and slim
  ];

  // ---- skeleton reference points (metres, unscaled) ------------------------
  var HIP_Y = 0.90;      // hip joint
  var THIGH = 0.42;      // hip → knee
  var SHIN = 0.40;       // knee → ankle
  var SHOULDER_Y = 1.42;
  var UPPER_ARM = 0.30;
  var FORE_ARM = 0.26;
  var TORSO_Y = 1.22;    // centre of the torso prism (waist 1.00 → shoulders 1.44)
  var PELVIS_Y = 0.95;
  var NECK_Y = 1.492;
  var HEAD_Y = 1.632;

  var wallMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  var geoKit = null;

  // A tapered rectangular prism: different width/depth at the top and bottom,
  // flat shaded. Winding is resolved against the outward direction so no face
  // can end up inside out.
  function prism(wt, dt, wb, db, h) {
    var hy = h * 0.5;
    var v = [
      [-wb / 2, -hy, -db / 2], [wb / 2, -hy, -db / 2], [wb / 2, -hy, db / 2], [-wb / 2, -hy, db / 2],
      [-wt / 2, hy, -dt / 2], [wt / 2, hy, -dt / 2], [wt / 2, hy, dt / 2], [-wt / 2, hy, dt / 2]
    ];
    var faces = [[4, 5, 6, 7], [3, 2, 1, 0], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]];
    var pos = [], nor = [], uv = [];
    for (var f = 0; f < faces.length; f++) {
      var q = faces[f];
      var a = v[q[0]], b = v[q[1]], c = v[q[2]], d = v[q[3]];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      var wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      // face centroid points away from the prism centre; flip if it disagrees
      var cx = (a[0] + b[0] + c[0] + d[0]) * 0.25;
      var cy = (a[1] + b[1] + c[1] + d[1]) * 0.25;
      var cz = (a[2] + b[2] + c[2] + d[2]) * 0.25;
      if (nx * cx + ny * cy + nz * cz < 0) {
        var t = b; b = d; d = t;
        nx = -nx; ny = -ny; nz = -nz;
      }
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      var tri = [a, b, c, a, c, d];
      for (var k = 0; k < 6; k++) {
        pos.push(tri[k][0], tri[k][1], tri[k][2]);
        nor.push(nx, ny, nz);
      }
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }

  // Built once, shared by every pedestrian.
  function buildKit() {
    if (geoKit) return geoKit;

    // torso: shoulders clearly wider than the waist
    var torso = prism(0.47, 0.225, 0.315, 0.180, 0.44);
    // pelvis / hips
    var pelvis = prism(0.335, 0.215, 0.300, 0.198, 0.20);
    // head: low-segment sphere, slightly taller than wide
    var head = new THREE.SphereGeometry(0.118, 8, 6);
    head.scale(1, 1.12, 0.98);
    // hair: a cap over the crown and the back of the skull
    var hair = new THREE.SphereGeometry(0.127, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.56);
    hair.translate(0, 0.004, -0.008);
    var neck = new THREE.CylinderGeometry(0.050, 0.057, 0.10, 7);
    // arms: joint at the top, hand merged into the forearm
    var upperArm = prism(0.098, 0.098, 0.079, 0.083, UPPER_ARM);
    upperArm.translate(0, -UPPER_ARM * 0.5, 0);
    var foreArm = prism(0.079, 0.083, 0.058, 0.062, FORE_ARM);
    foreArm.translate(0, -FORE_ARM * 0.5, 0);
    var hand = new THREE.BoxGeometry(0.063, 0.098, 0.050);
    hand.translate(0, -FORE_ARM - 0.035, 0.004);
    var foreArmPlus = BS.Geo.merge([foreArm, hand]);
    // legs: joint at the top, foot block pivoting at the ankle
    var thigh = prism(0.147, 0.157, 0.109, 0.117, THIGH);
    thigh.translate(0, -THIGH * 0.5, 0);
    var shin = prism(0.109, 0.117, 0.079, 0.089, SHIN);
    shin.translate(0, -SHIN * 0.5, 0);
    var foot = new THREE.BoxGeometry(0.101, 0.075, 0.240);
    foot.translate(0, -0.0375, 0.055);

    geoKit = {
      torso: torso, pelvis: pelvis, head: head, hair: hair, neck: neck,
      upperArm: upperArm, foreArm: foreArmPlus,
      thigh: thigh, shin: shin, foot: foot
    };
    return geoKit;
  }

  // scratch matrices, allocated once
  var _base = new THREE.Matrix4(), _m = new THREE.Matrix4(), _t = new THREE.Matrix4();
  var _v3 = new THREE.Vector3();
  var _chain = [];
  for (var ci = 0; ci < 12; ci++) _chain.push(new THREE.Matrix4());

  function joint(out, parent, x, y, z, rx) {
    out.makeRotationX(rx);
    out.setPosition(x, y, z);
    out.premultiply(parent);
    return out;
  }

  function offset(out, chain, y) {
    _t.makeTranslation(0, y, 0);
    out.multiplyMatrices(chain, _t);
    return out;
  }

  function Pedestrians(scene, city, rng, opts) {
    opts = opts || {};
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.walkers = opts.walkers || CFG.peds.count;
    this.rivalSlots = 6;
    this.total = this.walkers + this.rivalSlots;
    this.peds = [];
    this.phase = 0;

    var kit = buildKit();
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
    var defs = [
      ['torso', 'torso'], ['pelvis', 'pelvis'], ['head', 'head'], ['hair', 'hair'],
      ['neck', 'neck'],
      ['thighL', 'thigh'], ['thighR', 'thigh'],
      ['shinL', 'shin'], ['shinR', 'shin'],
      ['footL', 'foot'], ['footR', 'foot'],
      ['uarmL', 'upperArm'], ['uarmR', 'upperArm'],
      ['farmL', 'foreArm'], ['farmR', 'foreArm']
    ];
    var meshes = [];
    for (var d = 0; d < defs.length; d++) {
      var im = new THREE.InstancedMesh(kit[defs[d][1]], mat, this.total);
      im.name = defs[d][0];
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.receiveShadow = false;
      im.frustumCulled = false;
      scene.add(im);
      meshes.push(im);
      this[defs[d][0] + 'Mesh'] = im;
    }
    this.meshes = meshes;
    // legacy aliases used by older call sites
    this.legLMesh = this.thighLMesh;
    this.legRMesh = this.thighRMesh;
    this.armLMesh = this.uarmLMesh;
    this.armRMesh = this.uarmRMesh;

    for (var i = 0; i < this.total; i++) {
      var isRival = i >= this.walkers;
      var ped = {
        index: i,
        alive: false,
        rival: isRival,
        x: 0, y: 0, z: 0,
        heading: rng.angle(),
        speed: 0,
        hp: isRival ? 100 : 70,
        phase: rng.angle(),
        panic: 0,
        panicHeading: rng.angle(),
        mode: isRival ? 'rival' : 'block',
        blockX: 0, blockZ: 0, t: 0, dir: rng.chance(0.5) ? 1 : -1,
        lineZ: 0,
        shootTimer: rng.float(0.8, 2.4),
        deadTimer: 0,
        hurt: 0,
        lift: 0,
        hScale: 1, wScale: 1
      };
      var build = BUILDS[i % BUILDS.length];
      ped.hScale = build[0];
      ped.wScale = build[1];
      ped.shirt = rng.pick(SHIRTS);
      ped.pants = rng.pick(PANTS);
      ped.shoes = rng.pick(SHOES);
      ped.hair = rng.pick(HAIR);
      ped.skin = rng.pick(SKIN);
      this.peds.push(ped);

      this.torsoMesh.setColorAt(i, new THREE.Color(ped.shirt));
      this.pelvisMesh.setColorAt(i, new THREE.Color(ped.pants));
      this.headMesh.setColorAt(i, new THREE.Color(ped.skin));
      this.hairMesh.setColorAt(i, new THREE.Color(ped.hair));
      this.neckMesh.setColorAt(i, new THREE.Color(ped.skin));
      this.thighLMesh.setColorAt(i, new THREE.Color(ped.pants));
      this.thighRMesh.setColorAt(i, new THREE.Color(ped.pants));
      this.shinLMesh.setColorAt(i, new THREE.Color(ped.pants));
      this.shinRMesh.setColorAt(i, new THREE.Color(ped.pants));
      this.footLMesh.setColorAt(i, new THREE.Color(ped.shoes));
      this.footRMesh.setColorAt(i, new THREE.Color(ped.shoes));
      this.uarmLMesh.setColorAt(i, new THREE.Color(ped.shirt));
      this.uarmRMesh.setColorAt(i, new THREE.Color(ped.shirt));
      this.farmLMesh.setColorAt(i, new THREE.Color(ped.skin));
      this.farmRMesh.setColorAt(i, new THREE.Color(ped.skin));
      this.writeMatrices(ped, wallMatrix);
    }
    for (var q = 0; q < meshes.length; q++) {
      if (meshes[q].instanceColor) meshes[q].instanceColor.needsUpdate = true;
    }

    this.spawnWalkers();
  }

  Pedestrians.prototype.spawnWalkers = function () {
    var rng = this.rng;
    var centers = [];
    for (var bi = -5; bi < 5; bi++) {
      for (var bj = -5; bj < 5; bj++) {
        var cx = bi * STEP + 60, cz = bj * STEP + 60;
        var d = BS.City.districtAt(cx, cz);
        if (BS.City.inBay(cx, cz) || d.id === 'beach') continue;
        centers.push([cx, cz]);
      }
    }
    for (var i = 0; i < this.walkers; i++) {
      var ped = this.peds[i];
      ped.alive = true;
      if (i < 8) {
        // a few strollers on the beach promenade
        ped.mode = 'line';
        ped.lineZ = 500 + rng.float(0, 50);
        ped.x = -280 + rng.float(0, 780);
        ped.z = ped.lineZ;
        ped.heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        ped.speed = rng.float(0.8, 1.5);
      } else {
        var c = rng.pick(centers);
        ped.mode = 'block';
        ped.blockX = c[0];
        ped.blockZ = c[1];
        ped.t = rng.float(0, 328);
        ped.dir = rng.chance(0.5) ? 1 : -1;
        ped.speed = rng.float(0.9, 1.6);
        this.pathPos(ped);
      }
    }
  };

  Pedestrians.prototype.pathPos = function (ped) {
    var half = 41;
    var total = half * 8;
    var t = ((ped.t % total) + total) % total;
    if (t < 2 * half) {
      ped.x = ped.blockX - half + t;
      ped.z = ped.blockZ - half;
      ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (t < 4 * half) {
      ped.x = ped.blockX + half;
      ped.z = ped.blockZ - half + (t - 2 * half);
      ped.heading = ped.dir > 0 ? 0 : Math.PI;
    } else if (t < 6 * half) {
      ped.x = ped.blockX + half - (t - 4 * half);
      ped.z = ped.blockZ + half;
      ped.heading = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      ped.x = ped.blockX - half;
      ped.z = ped.blockZ + half - (t - 6 * half);
      ped.heading = ped.dir > 0 ? Math.PI : 0;
    }
  };

  Pedestrians.prototype.scare = function (pos, radius) {
    var r = radius || 70;
    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if (!p.alive || p.rival) continue;
      var d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < r) {
        p.panic = this.rng.float(6, 13);
        p.panicHeading = Math.atan2(p.x - pos.x, p.z - pos.z) + this.rng.float(-0.5, 0.5);
      }
    }
  };

  Pedestrians.prototype.spawnRivals = function (center, count) {
    var rng = this.rng;
    var made = [];
    for (var i = 0; i < this.rivalSlots && made.length < (count || 6); i++) {
      var ped = this.peds[this.walkers + i];
      ped.alive = true;
      ped.rival = true;
      ped.hp = 100;
      ped.mode = 'rival';
      var ang = (made.length / 6) * Math.PI * 2;
      ped.x = center.x + Math.cos(ang) * rng.float(8, 18);
      ped.z = center.z + Math.sin(ang) * rng.float(6, 16);
      ped.heading = Math.atan2(center.x - ped.x, center.z - ped.z);
      ped.speed = 0;
      ped.shootTimer = rng.float(0.5, 2.2);
      made.push(ped);
    }
    return made;
  };

  Pedestrians.prototype.killAllRivals = function () {
    for (var i = 0; i < this.rivalSlots; i++) {
      var p = this.peds[this.walkers + i];
      p.alive = false;
      p.deadTimer = 999;
      this.writeMatrices(p, null);
    }
  };

  Pedestrians.prototype.rivalsAlive = function () {
    var n = 0;
    for (var i = 0; i < this.rivalSlots; i++) if (this.peds[this.walkers + i].alive) n++;
    return n;
  };

  // ray vs a chest-height sphere; used by combat
  Pedestrians.prototype.hitTest = function (origin, dir, maxDist) {
    var best = null;
    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if (!p.alive) continue;
      var cx = p.x, cy = 1.05, cz = p.z;
      var ox = origin.x - cx, oy = origin.y - cy, oz = origin.z - cz;
      var b = ox * dir.x + oy * dir.y + oz * dir.z;
      var c = ox * ox + oy * oy + oz * oz - 0.42;
      var disc = b * b - c;
      if (disc < 0) continue;
      var t = -b - Math.sqrt(disc);
      if (t < 0) t = -b + Math.sqrt(disc);
      if (t < 0 || t > maxDist) continue;
      if (!best || t < best.t) {
        best = {
          ped: p,
          t: t,
          point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t)
        };
      }
    }
    return best;
  };

  Pedestrians.prototype.damage = function (ped, amount, game) {
    if (!ped.alive) return false;
    ped.hp -= amount;
    ped.hurt = 0.25;
    if (ped.hp <= 0) {
      ped.alive = false;
      ped.deadTimer = 0;
      this.writeMatrices(ped, wallMatrix);
      if (BS.Fx) BS.Fx.blood(ped.x, 1.1, ped.z);
      if (game && game.onPedKilled) game.onPedKilled(ped);
      return true;
    }
    if (!ped.rival) {
      ped.panic = 10;
      ped.panicHeading = this.rng.angle();
    }
    return false;
  };

  // Full body pose: one base matrix per person, then a joint chain down each
  // limb. Arms counter-swing the legs, knees fold on the swing-through and the
  // foot lifts, which is what drives the shadow dimming.
  Pedestrians.prototype.writeMatrices = function (ped, blank) {
    var i = ped.index;
    var m = this.meshes;
    var k;

    if (blank) {
      for (k = 0; k < m.length; k++) m[k].setMatrixAt(i, blank);
      ped.lift = 0;
      return;
    }

    var amp = ped.speed > 3 ? 0.80 : (ped.speed > 0.55 ? 0.52 : 0.06);
    var ph = ped.phase;
    var s = Math.sin(ph);
    var bob = -Math.abs(Math.cos(ph)) * 0.014 * (amp / 0.52);

    _v3.set(ped.wScale, ped.hScale, ped.wScale);
    _base.makeRotationY(ped.heading);
    _base.scale(_v3);
    _base.setPosition(ped.x, bob, ped.z);

    // torso / pelvis / head
    _m.makeTranslation(0, TORSO_Y, 0); _m.premultiply(_base);
    this.torsoMesh.setMatrixAt(i, _m);

    _m.makeTranslation(0, PELVIS_Y, 0); _m.premultiply(_base);
    this.pelvisMesh.setMatrixAt(i, _m);

    _m.makeTranslation(0, NECK_Y, 0); _m.premultiply(_base);
    this.neckMesh.setMatrixAt(i, _m);

    _m.makeTranslation(0, HEAD_Y, 0); _m.premultiply(_base);
    this.headMesh.setMatrixAt(i, _m);

    _m.makeTranslation(0, HEAD_Y, 0); _m.premultiply(_base);
    this.hairMesh.setMatrixAt(i, _m);

    // ---- legs -------------------------------------------------------------
    var hipL = Math.sin(ph) * amp;
    var hipR = Math.sin(ph + Math.PI) * amp;
    var kneeL = 0.10 + 1.02 * Math.max(0, Math.cos(ph)) * (amp / 0.52);
    var kneeR = 0.10 + 1.02 * Math.max(0, Math.cos(ph + Math.PI)) * (amp / 0.52);
    // keep the foot near level, toes dipping only slightly
    var ankL = -(hipL + kneeL) * 0.55 + 0.06;
    var ankR = -(hipR + kneeR) * 0.55 + 0.06;

    joint(_chain[0], _base, -0.098, HIP_Y, 0, hipL);
    offset(_m, _chain[0], -THIGH * 0.5); this.thighLMesh.setMatrixAt(i, _m);
    joint(_chain[1], _chain[0], 0, -THIGH, 0, kneeL);
    offset(_m, _chain[1], -SHIN * 0.5); this.shinLMesh.setMatrixAt(i, _m);
    joint(_chain[2], _chain[1], 0, -SHIN, 0, ankL);
    this.footLMesh.setMatrixAt(i, _chain[2]);

    joint(_chain[3], _base, 0.098, HIP_Y, 0, hipR);
    offset(_m, _chain[3], -THIGH * 0.5); this.thighRMesh.setMatrixAt(i, _m);
    joint(_chain[4], _chain[3], 0, -THIGH, 0, kneeR);
    offset(_m, _chain[4], -SHIN * 0.5); this.shinRMesh.setMatrixAt(i, _m);
    joint(_chain[5], _chain[4], 0, -SHIN, 0, ankR);
    this.footRMesh.setMatrixAt(i, _chain[5]);

    // ---- arms: opposite phase to the same-side leg ------------------------
    var armL = -hipL * 0.66;
    var armR = -hipR * 0.66;
    var elbL = 0.20 + 0.34 * Math.max(0, Math.sin(ph + 1.4)) * (amp / 0.52);
    var elbR = 0.20 + 0.34 * Math.max(0, Math.sin(ph + Math.PI + 1.4)) * (amp / 0.52);

    joint(_chain[6], _base, -0.238, SHOULDER_Y, 0, armL);
    offset(_m, _chain[6], -UPPER_ARM * 0.5); this.uarmLMesh.setMatrixAt(i, _m);
    joint(_chain[7], _chain[6], 0, -UPPER_ARM, 0, elbL);
    this.farmLMesh.setMatrixAt(i, _chain[7]);

    joint(_chain[8], _base, 0.238, SHOULDER_Y, 0, armR);
    offset(_m, _chain[8], -UPPER_ARM * 0.5); this.uarmRMesh.setMatrixAt(i, _m);
    joint(_chain[9], _chain[8], 0, -UPPER_ARM, 0, elbR);
    this.farmRMesh.setMatrixAt(i, _chain[9]);

    // 0…1 weight for the ground blob: both feet planted → 1
    ped.lift = Math.max(0, Math.min(1, Math.max(kneeL, kneeR) - 0.10));

    for (k = 0; k < m.length; k++) m[k].instanceMatrix.needsUpdate = true;
  };

  Pedestrians.prototype.update = function (dt, game) {
    var player = game.player;
    var px = player ? player.pos.x : 0;
    var pz = player ? player.pos.z : 0;

    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if (!p.alive) {
        if (!p.rival && p.deadTimer < 26) {
          p.deadTimer += dt;
          if (p.deadTimer >= 26) {
            // quietly recycle the slot somewhere far from the player
            p.alive = true;
            p.hp = 70;
            p.mode = 'block';
            p.blockX = Math.round((px + this.rng.float(-500, 500)) / 120) * 120 + 60;
            p.blockZ = Math.round((pz + this.rng.float(-500, 500)) / 120) * 120 + 60;
            p.blockX = Math.max(-540, Math.min(540, p.blockX));
            p.blockZ = Math.max(-540, Math.min(540, p.blockZ));
            p.t = this.rng.float(0, 328);
            this.pathPos(p);
          }
        }
        continue;
      }

      if (p.rival) {
        this.updateRival(p, dt, player);
        this.writeMatrices(p, null);
        continue;
      }

      if (p.panic > 0) {
        p.panic -= dt;
        p.x += Math.sin(p.panicHeading) * CFG.peds.runSpeed * dt;
        p.z += Math.cos(p.panicHeading) * CFG.peds.runSpeed * dt;
        p.heading = p.panicHeading;
        p.speed = CFG.peds.runSpeed;
        p.phase += dt * 11;
        this.pushOut(p);
        if (p.panic <= 0) {
          // rejoin the nearest pavement
          p.blockX = Math.max(-540, Math.min(540, Math.round((p.x - 60) / 120) * 120 + 60));
          p.blockZ = Math.max(-540, Math.min(540, Math.round((p.z - 60) / 120) * 120 + 60));
          p.t = (p.blockX - 41 < p.x ? 0 : 0);
          p.t = 164;
          this.pathPos(p);
        }
      } else if (p.mode === 'line') {
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        if (p.x > 560 || p.x < -300) p.heading = -p.heading;
        p.phase += dt * p.speed * 4.6;
        if (p.z < 495) p.z = 495;
        if (p.z > 585) p.z = 585;
      } else {
        p.t += p.dir * p.speed * dt;
        this.pathPos(p);
        p.phase += dt * p.speed * 4.6;
        // idle turn at corners: keep to the pavement
      }

      if (p.hurt > 0) p.hurt -= dt;
      this.writeMatrices(p, null);
    }
  };

  Pedestrians.prototype.pushOut = function (p) {
    var cols = this.city.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (p.x > c.minX - 0.4 && p.x < c.maxX + 0.4 && p.z > c.minZ - 0.4 && p.z < c.maxZ + 0.4) {
        var dxl = p.x - (c.minX - 0.4), dxr = (c.maxX + 0.4) - p.x;
        var dzl = p.z - (c.minZ - 0.4), dzr = (c.maxZ + 0.4) - p.z;
        var m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) p.x = c.minX - 0.4;
        else if (m === dxr) p.x = c.maxX + 0.4;
        else if (m === dzl) p.z = c.minZ - 0.4;
        else p.z = c.maxZ + 0.4;
      }
    }
  };

  Pedestrians.prototype.updateRival = function (p, dt, player) {
    if (!player) return;
    var dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    var dist = Math.hypot(dx, dz);
    p.heading = Math.atan2(dx, dz);
    p.speed = 0;
    p.phase = 0;
    p.shootTimer -= dt;
    if (p.shootTimer <= 0 && dist < 44 && dist > 2) {
      p.shootTimer = this.rng.float(1.1, 2.2);
      if (BS.Fx) {
        var from = new THREE.Vector3(p.x, 1.35, p.z);
        var to = new THREE.Vector3(player.pos.x, 1.1, player.pos.z);
        BS.Fx.muzzle(from, to);
      }
      if (BS.Audio) BS.Audio.gunshot('pistol', new THREE.Vector3(p.x, 1.4, p.z));
      if (this.rng.chance(0.62)) player.damage(this.rng.float(4, 9), 'rival');
    }
  };

  BS.Pedestrians = Pedestrians;
})(window.BS);
