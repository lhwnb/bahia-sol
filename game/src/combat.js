/* Bahía Sol — combat and effects.
   Raycast pistol and SMG fire with tracers, muzzle flash, blood, sparks and
   smoke; punches for when the guns run dry; ammo crates that respawn. Every
   effect is a pooled-ish sprite or line, disposed of when it fades. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;
  var rng = BS.makeRng(0x5eed77);

  // ----------------------------------------------------------------- effects
  var Fx = (function () {
    var scene = null;
    var live = [];
    var tracers = [];
    var tmpVec = new THREE.Vector3();

    function init(s) {
      scene = s;
    }

    function spawn(texture, pos, color, size, life, opts) {
      if (!scene) return null;
      opts = opts || {};
      var mat = new THREE.SpriteMaterial({
        map: texture, color: color, transparent: true, opacity: opts.opacity === undefined ? 1 : opts.opacity,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false, fog: opts.fog !== false
      });
      var sp = new THREE.Sprite(mat);
      sp.position.copy(pos);
      sp.scale.set(size, size, 1);
      scene.add(sp);
      live.push({
        sp: sp, life: life, maxLife: life,
        vel: opts.vel || null, grow: opts.grow || 0, fade: opts.fade !== false
      });
      return sp;
    }

    function muzzle(from, to) {
      var p = from.clone();
      p.y += 0.05;
      var flash = spawn(BS.Tex.glow(), p, 0xffe2a0, 0.9, 0.06, { additive: true, fog: false });
      
      if (to) {
        spawn(BS.Tex.glow(), p, 0xffb45a, 1.6, 0.045, { additive: true, fog: false });
      }
    }

    function tracer(from, to, color) {
      if (!scene) return;
      var geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
      var mat = new THREE.LineBasicMaterial({
        color: color || 0xffe0a0, transparent: true, opacity: 0.9, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false
      });
      var line = new THREE.Line(geo, mat);
      scene.add(line);
      tracers.push({ line: line, life: 0.09, maxLife: 0.09 });
    }

    function blood(x, y, z) {
      for (var i = 0; i < 7; i++) {
        var p = new THREE.Vector3(x, y, z);
        var a = rng() * Math.PI * 2, r = 0.6 + rng() * 1.2;
        spawn(BS.Tex.smoke(), p, 0x8e1a1a, 0.35 + rng() * 0.3, 0.5 + rng() * 0.3, {
          additive: false, opacity: 0.85, vel: new THREE.Vector3(Math.cos(a) * r, 1.4 + rng(), Math.sin(a) * r)
        });
      }
    }

    function spark(x, y, z) {
      spawn(BS.Tex.glow(), new THREE.Vector3(x, y, z), 0xffd28a, 0.5, 0.16, { additive: true, fog: false });
    }

    function dust(x, y, z) {
      spawn(BS.Tex.smoke(), new THREE.Vector3(x, y, z), 0xb9b2a4, 0.7, 0.5, { opacity: 0.5 });
    }

    function smoke(pos, size, color) {
      var p = new THREE.Vector3(pos.x + (rng() - 0.5), (pos.y || 0) + 0.8, pos.z + (rng() - 0.5));
      spawn(BS.Tex.smoke(), p, color || 0x8f8c86, size || 1.2, 1.4, {
        opacity: 0.5, vel: new THREE.Vector3(0, 1.6, 0), grow: 1.6
      });
    }

    function explosion(pos) {
      spawn(BS.Tex.glow(), new THREE.Vector3(pos.x, pos.y + 1.1, pos.z), 0xffb04a, 14, 0.7, {
        additive: true, grow: 18, fog: false
      });
      for (var i = 0; i < 12; i++) {
        var a = rng() * Math.PI * 2;
        spawn(BS.Tex.smoke(), new THREE.Vector3(pos.x, pos.y + 1.2, pos.z), 0x2c2a28, 2.4, 1.8, {
          opacity: 0.7, vel: new THREE.Vector3(Math.cos(a) * 4, 4 + rng() * 4, Math.sin(a) * 4), grow: 5
        });
      }
    }

    function update(dt) {
      var i;
      for (i = live.length - 1; i >= 0; i--) {
        var e = live[i];
        e.life -= dt;
        if (e.life <= 0) {
          scene.remove(e.sp);
          e.sp.material.dispose();
          live.splice(i, 1);
          continue;
        }
        if (e.vel) {
          e.sp.position.addScaledVector(e.vel, dt);
          e.vel.y -= dt * 1.2;
          e.vel.multiplyScalar(1 - dt * 1.8);
        }
        if (e.grow) {
          var s = e.sp.scale.x + e.grow * dt;
          e.sp.scale.set(s, s, 1);
        }
        if (e.fade) e.sp.material.opacity = Math.max(0, e.life / e.maxLife) * 0.9;
      }
      for (i = tracers.length - 1; i >= 0; i--) {
        var t = tracers[i];
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / t.maxLife);
        if (t.life <= 0) {
          scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          tracers.splice(i, 1);
        }
      }
    }

    return {
      init: init, muzzle: muzzle, tracer: tracer, blood: blood, spark: spark,
      dust: dust, smoke: smoke, explosion: explosion, update: update,
      get count() { return live.length; }
    };
  })();

  // ------------------------------------------------------------------ combat
  function Combat(scene, camera, player, city, game) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.city = city;
    this.game = game;
    this.weapon = 'pistol';
    this.owned = { fists: true, pistol: true, smg: true };
    this.ammo = { pistol: 72, smg: 90 };
    this.cooldown = 0;
    this.recoil = 0;
    this.ray = new THREE.Raycaster();
    this.pickups = [];
    this.lastShot = -10;
    this.clock = 0;
    this.buildPickups();
  }

  Combat.prototype.buildPickups = function () {
    var spots = [
      [-300, 356], [96, 12], [-180, 240], [300, -228], [420, -330], [-60, -240]
    ];
    var geo = new THREE.BoxGeometry(0.75, 0.45, 0.5);
    for (var i = 0; i < spots.length; i++) {
      var mat = new THREE.MeshStandardMaterial({
        color: 0x2f6b4a, emissive: 0x2f6b4a, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.4
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spots[i][0], 0.7, spots[i][1]);
      mesh.castShadow = true;
      this.scene.add(mesh);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: BS.Tex.glow(), color: 0x7dffb0, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(2.4, 2.4, 1);
      glow.position.copy(mesh.position);
      this.scene.add(glow);
      this.pickups.push({ mesh: mesh, glow: glow, spot: spots[i], respawn: 0, active: true, phase: i });
    }
  };

  Combat.prototype.select = function (name) {
    if (!this.owned[name]) return;
    this.weapon = name;
    this.player.weaponDrawn = name !== 'fists';
    if (BS.Audio) BS.Audio.ui('switch');
    if (BS.HUD) BS.HUD.weaponChanged();
  };

  Combat.prototype.update = function (dt, input, game) {
    this.clock += dt;
    this.cooldown -= dt;
    this.recoil *= Math.pow(0.001, dt);
    if (input.pressed.KeyQ) this.select('fists');
    if (input.pressed.Digit1) this.select('pistol');
    if (input.pressed.Digit2) this.select('smg');

    if (input.mouseDown[0] && this.cooldown <= 0 && !this.player.dead && !this.player.inCar) {
      this.fire(game);
    }
    if (input.mouseDown[0] && this.cooldown <= 0 && this.player.inCar) {
      // drive-by: no aim from the seat in this build
    }

    // crates
    for (var i = 0; i < this.pickups.length; i++) {
      var p = this.pickups[i];
      if (p.active) {
        p.mesh.rotation.y += dt * 1.6;
        p.mesh.position.y = 0.7 + Math.sin((p.phase + this.clock) * 2) * 0.08;
        if (Math.hypot(this.player.pos.x - p.spot[0], this.player.pos.z - p.spot[1]) < 2.0) {
          p.active = false;
          p.mesh.visible = false;
          p.glow.visible = false;
          p.respawn = 30;
          this.ammo.pistol += 24;
          this.ammo.smg += 30;
          if (BS.HUD) BS.HUD.ticker('Munición recogida: +24 pistola, +30 subfusil');
          if (BS.Audio) BS.Audio.ui('pickup');
        }
      } else {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.active = true;
          p.mesh.visible = true;
          p.glow.visible = true;
        }
      }
      if (p.glow) p.glow.position.copy(p.mesh.position);
    }
  };

  Combat.prototype.aimRay = function () {
    var dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    var origin = this.camera.position.clone();
    return { origin: origin, dir: dir };
  };

  Combat.prototype.fire = function (game) {
    var spec = CFG.weapons[this.weapon];
    if (!spec) return;
    this.cooldown = spec.rate;
    var self = this;
    var player = this.player;

    if (this.weapon === 'fists') {
      var fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      var hitPed = this.game.peds.hitTest(
        new THREE.Vector3(player.pos.x, 1.2, player.pos.z), fwd, 2.4
      );
      if (BS.Audio) BS.Audio.punch();
      if (hitPed) this.game.peds.damage(hitPed.ped, spec.damage, game);
      this.cooldown = spec.rate;
      return;
    }

    if (this.ammo[this.weapon] <= 0) {
      if (BS.Audio) BS.Audio.ui('empty');
      this.cooldown = 0.35;
      if (BS.HUD) BS.HUD.ticker('Sin munición para ' + spec.name);
      return;
    }
    this.ammo[this.weapon] -= 1;
    this.lastShot = this.game.time;

    var aim = this.aimRay();
    // spread
    var s = spec.spread;
    aim.dir.x += (rng() - 0.5) * s;
    aim.dir.y += (rng() - 0.5) * s;
    aim.dir.z += (rng() - 0.5) * s;
    aim.dir.normalize();

    var targets = this.city.buildingMeshes.slice();
    var cars = (game.cars || []);
    for (var i = 0; i < cars.length; i++) {
      if (cars[i].dead) continue;
      targets.push(cars[i].body);
    }
    this.ray.set(aim.origin, aim.dir);
    this.ray.far = spec.range;
    var walls = this.ray.intersectObjects(targets, false);
    var wallDist = walls.length ? walls[0].distance : spec.range;
    var wallPoint = walls.length ? walls[0].point : null;
    var wallCar = null;
    if (walls.length) {
      var obj = walls[0].object;
      wallCar = obj.userData.car || (obj.parent && obj.parent.userData ? obj.parent.userData.car : null);
    }

    var pedHit = this.game.peds.hitTest(aim.origin, aim.dir, Math.min(spec.range, wallDist));
    var hitPoint = wallPoint || aim.origin.clone().addScaledVector(aim.dir, spec.range);

    var muzzle = new THREE.Vector3(
      player.pos.x + Math.sin(player.yaw) * 0.55 + Math.cos(player.yaw) * 0.28,
      1.38,
      player.pos.z + Math.cos(player.yaw) * 0.55 - Math.sin(player.yaw) * 0.28
    );

    if (pedHit) {
      hitPoint = pedHit.point;
      this.game.peds.damage(pedHit.ped, spec.damage, game);
      BS.Fx.blood(hitPoint.x, hitPoint.y, hitPoint.z);
    } else if (wallCar && wallDist < spec.range) {
      BS.Vehicles.damage(wallCar, spec.damage * 0.9);
      BS.Fx.spark(hitPoint.x, hitPoint.y, hitPoint.z);
      if (wallCar.isPolice && this.game.police) this.game.police.onAttacked();
      if (wallCar.driver === 'npc' && this.game.traffic) this.game.traffic.scare(hitPoint, 40);
    } else if (wallPoint) {
      BS.Fx.dust(hitPoint.x, hitPoint.y, hitPoint.z);
    }

    BS.Fx.muzzle(muzzle, hitPoint);
    BS.Fx.tracer(muzzle, hitPoint, spec.tracer);
    if (BS.Audio) BS.Audio.gunshot(this.weapon, muzzle);

    player.heading = player.yaw;
    player.mesh.rotation.y = player.heading;
    player.weaponFlash = 0.08;
    this.recoil = 0.012;

    // city reacts
    if (this.game.peds) this.game.peds.scare(player.pos, 85);
    if (this.game.traffic) this.game.traffic.scare(player.pos, 100);
    if (this.game.police) this.game.police.onGunshot(player.pos);
    if (BS.HUD) BS.HUD.weaponChanged();
  };

  BS.Fx = Fx;
  BS.Combat = Combat;
})(window.BS);

