/* Bahía Sol — pedestrians.
   Fifty walkers share six instanced meshes (torso, head, two legs, two arms) so
   the crowd costs a handful of draw calls. They loop their block, run from
   gunfire, and six of them can be hired as warehouse rivals. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;
  var STEP = CFG.world.step;

  var SHIRTS = [0xd9d2c0, 0x35506b, 0xc0503f, 0x2f7d6d, 0xe0b23c, 0x8a5a86, 0x3b3f45, 0xd8e0e2];
  var PANTS = [0x2b3038, 0x3f4a5a, 0x5a4a38, 0x1f242a, 0x6b6f74];
  var SKIN = [0xd8a878, 0xb87c4e, 0x8a5a36, 0xe8c39a, 0x6b4326];

  var wallMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

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

    var box = new THREE.BoxGeometry(1, 1, 1);
    var head = new THREE.SphereGeometry(0.5, 8, 6);
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
    this.torsoMesh = new THREE.InstancedMesh(box, mat, this.total);
    this.headMesh = new THREE.InstancedMesh(head, mat, this.total);
    this.legLMesh = new THREE.InstancedMesh(box, mat, this.total);
    this.legRMesh = new THREE.InstancedMesh(box, mat, this.total);
    this.armLMesh = new THREE.InstancedMesh(box, mat, this.total);
    this.armRMesh = new THREE.InstancedMesh(box, mat, this.total);
    var meshes = [this.torsoMesh, this.headMesh, this.legLMesh, this.legRMesh, this.armLMesh, this.armRMesh];
    for (var m = 0; m < meshes.length; m++) {
      meshes[m].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      meshes[m].castShadow = true;
      meshes[m].receiveShadow = false;
      meshes[m].frustumCulled = false;
      scene.add(meshes[m]);
    }
    this.meshes = meshes;

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
        hurt: 0
      };
      this.peds.push(ped);
      // colour the six parts for this slot
      this.torsoMesh.setColorAt(i, new THREE.Color(rng.pick(SHIRTS)));
      this.headMesh.setColorAt(i, new THREE.Color(rng.pick(SKIN)));
      this.legLMesh.setColorAt(i, new THREE.Color(rng.pick(PANTS)));
      this.legRMesh.setColorAt(i, new THREE.Color(rng.pick(PANTS)));
      this.armLMesh.setColorAt(i, new THREE.Color(rng.pick(SKIN)));
      this.armRMesh.setColorAt(i, new THREE.Color(rng.pick(SKIN)));
      this.writeMatrices(ped, wallMatrix);
    }
    if (this.torsoMesh.instanceColor) {
      this.torsoMesh.instanceColor.needsUpdate = true;
      this.headMesh.instanceColor.needsUpdate = true;
      this.legLMesh.instanceColor.needsUpdate = true;
      this.legRMesh.instanceColor.needsUpdate = true;
      this.armLMesh.instanceColor.needsUpdate = true;
      this.armRMesh.instanceColor.needsUpdate = true;
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

  Pedestrians.prototype.writeMatrices = function (ped, blank) {
    var i = ped.index;
    var tmp = new THREE.Matrix4();
    var base = new THREE.Matrix4();
    if (blank) {
      for (var k = 0; k < 6; k++) this.meshes[k].setMatrixAt(i, blank);
      return;
    }
    base.makeRotationY(ped.heading);
    base.setPosition(ped.x, 0, ped.z);

    function limb(mesh, px, py, pz, rx, sx, sy, sz, pivot) {
      var m = new THREE.Matrix4().makeTranslation(px, py, pz);
      m.multiply(new THREE.Matrix4().makeRotationX(rx));
      m.multiply(new THREE.Matrix4().makeTranslation(0, -pivot, 0));
      m.multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
      m.premultiply(base);
      mesh.setMatrixAt(i, m);
    }

    var sw = ped.speed > 3 ? 0.85 : 0.55;
    var swing = Math.sin(ped.phase) * sw;
    var swing2 = Math.sin(ped.phase + Math.PI) * sw;

    tmp.makeTranslation(0, 1.18 - Math.abs(Math.sin(ped.phase)) * 0.02, 0);
    tmp.multiply(new THREE.Matrix4().makeScale(0.52, 0.62, 0.3));
    tmp.premultiply(base);
    this.torsoMesh.setMatrixAt(i, tmp);

    var headM = new THREE.Matrix4().makeTranslation(0, 1.66, 0)
      .multiply(new THREE.Matrix4().makeScale(0.27, 0.3, 0.27));
    headM.premultiply(base);
    this.headMesh.setMatrixAt(i, headM);

    limb(this.legLMesh, -0.14, 0.92, 0, swing, 0.17, 0.82, 0.2, 0.41);
    limb(this.legRMesh, 0.14, 0.92, 0, swing2, 0.17, 0.82, 0.2, 0.41);
    limb(this.armLMesh, -0.34, 1.46, 0, swing2 * 0.9, 0.12, 0.58, 0.14, 0.29);
    limb(this.armRMesh, 0.34, 1.46, 0, swing * 0.9, 0.12, 0.58, 0.14, 0.29);

    for (var q = 0; q < 6; q++) this.meshes[q].instanceMatrix.needsUpdate = true;
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
