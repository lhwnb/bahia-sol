/* Bahía Sol — the player.
   On foot: camera-relative movement, a shoulder camera that pulls in when a wall
   is behind it, collision against the city, health and armour. In a car: the
   camera sits behind the roof and the mouse only glances around. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;

  function makeLimb(w, h, d, color) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.85 }));
    m.castShadow = true;
    return m;
  }

  function buildAvatar() {
    var g = new THREE.Group();
    var jacket = 0xd8cdb4, jeans = 0x3c4c66, skin = 0xc98f63, cap = 0xb03a30;

    var torso = makeLimb(0.54, 0.64, 0.32, jacket);
    torso.position.y = 1.2;
    g.add(torso);
    var shirt = makeLimb(0.3, 0.34, 0.34, 0xe6e0d2);
    shirt.position.set(0, 1.24, 0.02);
    g.add(shirt);

    var head = makeLimb(0.27, 0.3, 0.27, skin);
    head.position.y = 1.68;
    g.add(head);
    var brim = makeLimb(0.31, 0.07, 0.31, cap);
    brim.position.y = 1.85;
    g.add(brim);

    var legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.14, 0.94, 0);
    legR.position.set(0.14, 0.94, 0);
    var legLMesh = makeLimb(0.18, 0.84, 0.2, jeans); legLMesh.position.y = -0.42;
    var legRMesh = makeLimb(0.18, 0.84, 0.2, jeans); legRMesh.position.y = -0.42;
    legL.add(legLMesh); legR.add(legRMesh);
    g.add(legL); g.add(legR);

    var armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.35, 1.46, 0);
    armR.position.set(0.35, 1.46, 0);
    var armLMesh = makeLimb(0.13, 0.58, 0.15, jacket); armLMesh.position.y = -0.29;
    var armRMesh = makeLimb(0.13, 0.58, 0.15, jacket); armRMesh.position.y = -0.29;
    armL.add(armLMesh); armR.add(armRMesh);
    g.add(armL); g.add(armR);

    var gun = new THREE.Group();
    var barrel = makeLimb(0.06, 0.09, 0.42, 0x1a1d20);
    barrel.position.set(0, -0.55, 0.22);
    gun.add(barrel);
    var grip = makeLimb(0.07, 0.18, 0.09, 0x2a2d30);
    grip.position.set(0, -0.66, 0.06);
    gun.add(grip);
    armR.add(gun);
    gun.visible = false;

    g.userData.legL = legL;
    g.userData.legR = legR;
    g.userData.armL = armL;
    g.userData.armR = armR;
    g.userData.gun = gun;
    return g;
  }

  function Player(scene, camera, city, opts) {
    opts = opts || {};
    this.scene = scene;
    this.camera = camera;
    this.city = city;
    this.pos = new THREE.Vector3(CFG.spawn.x, 0, CFG.spawn.z);
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.yaw = Math.PI;
    this.pitch = 0.13;
    this.health = CFG.player.health;
    this.armour = CFG.player.armour;
    this.maxHealth = CFG.player.health;
    this.maxArmour = 100;
    this.car = null;
    this.inCar = false;
    this.moving = false;
    this.sprinting = false;
    this.stepTimer = 0;
    this.walkPhase = 0;
    this.camPos = new THREE.Vector3(0, 3, -6);
    this.camLook = new THREE.Vector3();
    this.lastDamage = 0;
    this.dead = false;
    this.aiming = false;
    this.guard = 0;

    this.mesh = buildAvatar();
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  Player.prototype.setPosition = function (x, z, heading) {
    this.pos.set(x, 0, z);
    if (heading !== undefined) { this.heading = heading; this.yaw = heading; }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  };

  Player.prototype.enterCar = function (car) {
    if (!car || car.dead) return false;
    if (this.inCar && this.car) this.exitCar();
    this.car = car;
    this.inCar = true;
    car.driver = 'player';
    car.speed = car.speed || 0;
    this.mesh.visible = false;
    if (car.npc) car.npc.stolen = true;
    this.yaw = car.heading;
    if (BS.Audio) BS.Audio.ui('enter');
    return true;
  };

  Player.prototype.exitCar = function () {
    if (!this.inCar || !this.car) return;
    var car = this.car;
    var side = car.heading + Math.PI / 2;
    var x = car.group.position.x + Math.sin(side) * (car.spec.width / 2 + 0.9);
    var z = car.group.position.z + Math.cos(side) * (car.spec.width / 2 + 0.9);
    if (this.blockedAt(x, z)) {
      x = car.group.position.x - Math.sin(side) * (car.spec.width / 2 + 0.9);
      z = car.group.position.z - Math.cos(side) * (car.spec.width / 2 + 0.9);
    }
    this.pos.set(x, 0, z);
    this.mesh.position.copy(this.pos);
    this.mesh.visible = true;
    this.heading = car.heading;
    this.yaw = car.heading;
    car.driver = null;
    car.speed *= 0.4;
    this.car = null;
    this.inCar = false;
    if (BS.Audio) BS.Audio.ui('exit');
  };

  Player.prototype.blockedAt = function (x, z) {
    var r = CFG.player.radius;
    for (var i = 0; i < this.city.colliders.length; i++) {
      var c = this.city.colliders[i];
      if (c.height !== undefined && c.height < 0.8) continue;
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return c;
    }
    return null;
  };

  Player.prototype.damage = function (amount, source) {
    if (this.dead || amount <= 0) return;
    this.lastDamage = 0.5;
    var absorb = Math.min(this.armour, amount * 0.62);
    this.armour -= absorb;
    this.health -= (amount - absorb);
    if (BS.HUD) BS.HUD.flashDamage();
    if (BS.Audio) BS.Audio.ui('hurt');
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  };

  Player.prototype.heal = function (amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  };

  Player.prototype.update = function (dt, input, game) {
    if (this.dead) {
      if (this.car) this.exitCar();
      return;
    }

    // mouse look
    this.yaw -= input.mouseDX * 0.0023;
    this.pitch += input.mouseDY * 0.0019;
    this.pitch = Math.max(-0.55, Math.min(0.8, this.pitch));

    if (!this.inCar) {
      this.updateFoot(dt, input, game);
    } else {
      this.updateDrive(dt, input, game);
    }
    this.updateCamera(dt);

    if (this.lastDamage > 0) this.lastDamage -= dt;
  };

  Player.prototype.updateFoot = function (dt, input, game) {
    var f = input.axes();
    var speed = input.keys.ShiftLeft || input.keys.ShiftRight ? CFG.player.sprint : CFG.player.walk;
    this.sprinting = speed > CFG.player.walk + 0.1;

    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    var rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    var mx = fx * f.forward + rx * f.strafe;
    var mz = fz * f.forward + rz * f.strafe;
    var len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    this.moving = len > 0.05;

    if (this.moving) {
      this.heading = Math.atan2(mx, mz);
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.3 : 0.46;
        if (BS.Audio) BS.Audio.footstep(this.sprinting, this.onSand());
      }
      this.walkPhase += dt * (this.sprinting ? 12 : 7.5);
    } else {
      this.walkPhase += dt * 2;
    }

    // building collision, axis by axis for smooth sliding
    var r = CFG.player.radius;
    var c = this.blockedAt(this.pos.x, this.pos.z);
    if (c) {
      var dl = this.pos.x - (c.minX - r), dr = (c.maxX + r) - this.pos.x;
      var dn = this.pos.z - (c.minZ - r), ds = (c.maxZ + r) - this.pos.z;
      var m = Math.min(dl, dr, dn, ds);
      if (m === dl) this.pos.x = c.minX - r;
      else if (m === dr) this.pos.x = c.maxX + r;
      else if (m === dn) this.pos.z = c.minZ - r;
      else this.pos.z = c.maxZ + r;
    }
    // car collision
    if (game && game.cars) {
      for (var i = 0; i < game.cars.length; i++) {
        var car = game.cars[i];
        if (car.dead) continue;
        var dx = this.pos.x - car.group.position.x;
        var dz = this.pos.z - car.group.position.z;
        var minD = 1.15;
        var d = Math.hypot(dx, dz);
        if (d < minD && d > 0.001) {
          this.pos.x = car.group.position.x + (dx / d) * minD;
          this.pos.z = car.group.position.z + (dz / d) * minD;
        }
      }
    }
    this.pos.x = Math.max(-590, Math.min(590, this.pos.x));
    this.pos.z = Math.max(-592, Math.min(600, this.pos.z));
    this.pos.y = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;

    // limb swing
    var swing = this.moving ? Math.sin(this.walkPhase) * (this.sprinting ? 0.85 : 0.55) : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.8;
    this.mesh.userData.armR.rotation.x = swing * 0.8;
    this.mesh.userData.gun.visible = this.weaponDrawn;
    if (BS.Audio) BS.Audio.setEngine(0, false);
  };

  Player.prototype.updateDrive = function (dt, input, game) {
    var car = this.car;
    if (!car || car.dead) {
      if (car && car.dead) this.exitCar();
      return;
    }
    var throttle = (input.keys.KeyW ? 1 : 0) + (input.keys.KeyS ? -1 : 0);
    var steer = (input.keys.KeyA ? 1 : 0) + (input.keys.KeyD ? -1 : 0);
    var controls = {
      throttle: throttle,
      steer: steer,
      handbrake: !!input.keys.Space,
      brake: !!input.keys.ShiftLeft
    };
    BS.Vehicles.drive(car, dt, controls, this.city, game.cars, {});
    this.pos.set(car.group.position.x, 0, car.group.position.z);
    this.heading = car.heading;
    // glance with the mouse, then recentre
    if (Math.abs(input.mouseDX) > 0.1) this.carYaw = (this.carYaw || 0) - input.mouseDX * 0.0018;
    this.carYaw = (this.carYaw || 0) * Math.pow(0.25, dt);
    this.carYaw = Math.max(-1.4, Math.min(1.4, this.carYaw));
    this.yaw = car.heading + (this.carYaw || 0);
    this.pitch = 0.12;
    if (BS.Audio) {
      BS.Audio.setEngine(Math.abs(car.speed), true, car);
      if (Math.abs(car.speed) > 3) this.stepTimer -= dt;
    }
  };

  Player.prototype.updateCamera = function (dt) {
    var target = new THREE.Vector3();
    var want = new THREE.Vector3();
    var dist, shoulder;
    if (this.inCar && this.car) {
      target.set(this.car.group.position.x, 1.35, this.car.group.position.z);
      var yaw = this.car.heading + (this.carYaw || 0);
      var fx = Math.sin(yaw), fz = Math.cos(yaw);
      dist = 8.6;
      var lookAhead = 6;
      target.x += fx * lookAhead;
      target.z += fz * lookAhead;
      want.set(
        this.car.group.position.x - fx * dist + Math.cos(yaw) * 0.4,
        3.9,
        this.car.group.position.z - fz * dist - Math.sin(yaw) * 0.4
      );
    } else {
      target.set(this.pos.x, 1.6, this.pos.z);
      var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      var fx2 = Math.sin(this.yaw), fz2 = Math.cos(this.yaw);
      var rx2 = -Math.cos(this.yaw), rz2 = Math.sin(this.yaw);
      dist = 4.6;
      shoulder = 0.72;
      want.set(
        target.x - fx2 * cp * dist + rx2 * shoulder,
        target.y + sp * dist + 0.35,
        target.z - fz2 * cp * dist + rz2 * shoulder
      );
      target.x += fx2 * 1.6;
      target.z += fz2 * 1.6;
    }

    // keep the camera out of buildings
    var t = this.cameraClip(target, want);
    if (t < 1) {
      want.x = target.x + (want.x - target.x) * t;
      want.y = target.y + (want.y - target.y) * t;
      want.z = target.z + (want.z - target.z) * t;
    }
    want.y = Math.max(0.7, want.y);

    var k = 1 - Math.pow(0.0009, dt);
    this.camPos.lerp(want, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target.x, target.y + (this.inCar ? 0.4 : 0), target.z);
  };

  Player.prototype.cameraClip = function (from, to) {
    var best = 1;
    var dx = to.x - from.x, dz = to.z - from.z;
    var cols = this.city.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (c.height !== undefined && c.height < 2.0) continue;
      // expand the box slightly so the camera never touches the facade
      var minX = c.minX - 0.35, maxX = c.maxX + 0.35;
      var minZ = c.minZ - 0.35, maxZ = c.maxZ + 0.35;
      var tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-6) {
        if (from.x < minX || from.x > maxX) continue;
      } else {
        var tx1 = (minX - from.x) / dx, tx2 = (maxX - from.x) / dx;
        tmin = Math.max(tmin, Math.min(tx1, tx2));
        tmax = Math.min(tmax, Math.max(tx1, tx2));
      }
      if (Math.abs(dz) < 1e-6) {
        if (from.z < minZ || from.z > maxZ) continue;
      } else {
        var tz1 = (minZ - from.z) / dz, tz2 = (maxZ - from.z) / dz;
        tmin = Math.max(tmin, Math.min(tz1, tz2));
        tmax = Math.min(tmax, Math.max(tz1, tz2));
      }
      if (tmin <= tmax && tmax > 0 && tmin < best) best = Math.max(0, tmin - 0.03);
    }
    return best;
  };

  Player.prototype.onSand = function () {
    return this.pos.z > 488 && this.pos.x > -330;
  };

  Player.prototype.reset = function (x, z) {
    this.dead = false;
    this.health = this.maxHealth;
    this.armour = Math.max(25, this.armour);
    if (this.inCar) this.exitCar();
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    if (BS.Audio) BS.Audio.setEngine(0, false);
  };

  BS.Player = Player;
})(window.BS);
