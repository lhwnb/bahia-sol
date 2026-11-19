/* Bahía Sol — the policía.
   Wanted stars, cruisers that spawn out of sight and come for you, roadblocks at
   three stars, sidearms at four, and a heat meter that cools only when they lose
   sight of you for twenty seconds. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;

  function Police(scene, city, player, game) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.game = game;
    this.wanted = 0;
    this.cruisers = [];
    this.blockTimer = 0;
    this.hiddenTimer = 0;
    this.bustTimer = 0;
    this.rng = BS.makeRng(0xc0ffee);
    this.spawnTimer = 0;
    this.lastKnown = new THREE.Vector3();
    this.alert = 0;
  }

  Police.prototype.setWanted = function (n) {
    n = Math.max(0, Math.min(5, Math.round(n)));
    if (n === this.wanted) return;
    var prev = this.wanted;
    this.wanted = n;
    if (n === 0) this.clear();
    if (BS.HUD) BS.HUD.wantedChanged();
    if (BS.Audio) BS.Audio.ui(n > prev ? 'up' : 'down');
  };

  Police.prototype.addWanted = function (n) {
    this.setWanted(this.wanted + n);
  };

  Police.prototype.onGunshot = function (pos) {
    this.lastKnown.copy(pos);
    this.alert = 12;
    if (this.wanted === 0) this.setWanted(1);
  };

  Police.prototype.onAttacked = function () {
    this.addWanted(1);
    this.alert = 20;
  };

  Police.prototype.clear = function () {
    for (var i = 0; i < this.cruisers.length; i++) {
      var c = this.cruisers[i].car;
      this.scene.remove(c.group);
      var idx = this.game.cars.indexOf(c);
      if (idx >= 0) this.game.cars.splice(idx, 1);
    }
    this.cruisers = [];
    this.bustTimer = 0;
    this.hiddenTimer = 0;
  };

  Police.prototype.spawnCruiser = function (mode, pos, heading) {
    var car = BS.Vehicles.create('cruiser', 0xf2f2ef);
    car.isPolice = true;
    car.sirenOn = true;
    var x = pos.x, z = pos.z;
    if (heading === undefined) heading = 0;
    BS.Vehicles.place(car, x, z, heading);
    car.driver = 'police';
    this.scene.add(car.group);
    this.game.cars.push(car);
    var cop = {
      car: car, mode: mode || 'chase', stuck: 0, shootTimer: this.rng.float(1, 2.5),
      life: 0, phase: this.rng.angle()
    };
    this.cruisers.push(cop);
    return cop;
  };

  Police.prototype.spawnOffscreen = function () {
    var p = this.player.pos;
    var rng = this.rng;
    var vertical = rng.chance(0.5);
    var roadX = Math.max(-540, Math.min(540, Math.round(p.x / 120) * 120));
    var roadZ = Math.max(-540, Math.min(540, Math.round(p.z / 120) * 120));
    var dist = rng.float(160, 240);
    var side = rng.chance(0.5) ? 1 : -1;
    var x, z;
    if (vertical) {
      x = roadX + 4.6 * side;
      z = Math.max(-580, Math.min(580, p.z + dist * side));
    } else {
      z = roadZ + 4.6 * side;
      x = Math.max(-580, Math.min(580, p.x + dist * side));
    }
    var heading = Math.atan2(p.x - x, p.z - z);
    return this.spawnCruiser('chase', new THREE.Vector3(x, 0, z), heading);
  };

  Police.prototype.roadblock = function () {
    var p = this.player.pos;
    var heading = this.player.inCar ? this.player.car.heading : this.player.yaw;
    var fx = Math.sin(heading), fz = Math.cos(heading);
    var ahead = 78;
    var x = p.x + fx * ahead, z = p.z + fz * ahead;
    // snap onto the nearest road if one is close
    var rx = Math.round(x / 120) * 120, rz = Math.round(z / 120) * 120;
    if (Math.abs(x - rx) < 26) x = rx; else if (Math.abs(z - rz) < 26) z = rz;
    x = Math.max(-560, Math.min(560, x));
    z = Math.max(-560, Math.min(560, z));
    var across = heading + Math.PI / 2;
    var ox = Math.cos(heading) * 7.2, oz = -Math.sin(heading) * 7.2;
    this.spawnCruiser('block', new THREE.Vector3(x + ox, 0, z + oz), across);
    this.spawnCruiser('block', new THREE.Vector3(x - ox, 0, z - oz), across);
    if (BS.HUD) BS.HUD.ticker('Policía: control de carretera adelante');
  };

  Police.prototype.segmentBlocked = function (x1, z1, x2, z2) {
    var dx = x2 - x1, dz = z2 - z1;
    var cols = this.city.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (c.height !== undefined && c.height < 3) continue;
      var tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-6) {
        if (x1 < c.minX || x1 > c.maxX) continue;
      } else {
        var tx1 = (c.minX - x1) / dx, tx2 = (c.maxX - x1) / dx;
        tmin = Math.max(tmin, Math.min(tx1, tx2));
        tmax = Math.min(tmax, Math.max(tx1, tx2));
      }
      if (Math.abs(dz) < 1e-6) {
        if (z1 < c.minZ || z1 > c.maxZ) continue;
      } else {
        var tz1 = (c.minZ - z1) / dz, tz2 = (c.maxZ - z1) / dz;
        tmin = Math.max(tmin, Math.min(tz1, tz2));
        tmax = Math.min(tmax, Math.max(tz1, tz2));
      }
      if (tmin <= tmax && tmax > 0.04 && tmin < 0.96) return true;
    }
    return false;
  };

  Police.prototype.update = function (dt, game) {
    var player = this.player;
    var i;

    if (this.alert > 0) this.alert -= dt;

    // spawn up to the answer the stars ask for
    var targetCount = this.wanted === 0 ? 0 : Math.min(CFG.police.maxCruisers, 1 + this.wanted);
    var active = 0;
    for (i = 0; i < this.cruisers.length; i++) if (this.cruisers[i].mode === 'chase') active++;
    this.spawnTimer -= dt;
    if (this.wanted > 0 && active < targetCount && this.spawnTimer <= 0) {
      this.spawnOffscreen();
      this.spawnTimer = 2.2;
    }
    if (this.wanted >= 3) {
      this.blockTimer -= dt;
      if (this.blockTimer <= 0) {
        this.roadblock();
        this.blockTimer = 26;
      }
    }

    var nearest = null, nearestD = 1e9;
    var visible = false;

    for (i = this.cruisers.length - 1; i >= 0; i--) {
      var cop = this.cruisers[i];
      var car = cop.car;
      if (car.dead) {
        this.scene.remove(car.group);
        var ci = game.cars.indexOf(car);
        if (ci >= 0) game.cars.splice(ci, 1);
        this.cruisers.splice(i, 1);
        continue;
      }
      var d = Math.hypot(car.group.position.x - player.pos.x, car.group.position.z - player.pos.z);
      if (d < nearestD) { nearestD = d; nearest = cop; }
      cop.life += dt;

      if (cop.mode === 'chase') {
        var dx = player.pos.x - car.group.position.x;
        var dz = player.pos.z - car.group.position.z;
        var want = Math.atan2(dx, dz);
        var diff = ((want - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        var steer = Math.max(-1, Math.min(1, diff * 2.2));
        var throttle = d > 14 ? 1 : (d > 8 ? 0.2 : -0.4);
        BS.Vehicles.drive(car, dt, { throttle: throttle, steer: steer, handbrake: false, brake: false },
          this.city, game.cars, { speedScale: 1.08 });
        if (d > 420) {
          this.scene.remove(car.group);
          var ci2 = game.cars.indexOf(car);
          if (ci2 >= 0) game.cars.splice(ci2, 1);
          this.cruisers.splice(i, 1);
          continue;
        }
        // ramming bumps the player's car
        if (player.inCar && d < 5.5) {
          player.car.health = Math.max(0, player.car.health - 0.35);
          if (BS.Audio && this.rng.chance(0.02)) BS.Audio.crash();
        }
        // get unstuck
        if (Math.abs(car.speed) < 0.6) cop.stuck += dt;
        else cop.stuck = 0;
        if (cop.stuck > 6) {
          var old = car.group.position.clone();
          this.scene.remove(car.group);
          var ci3 = game.cars.indexOf(car);
          if (ci3 >= 0) game.cars.splice(ci3, 1);
          this.cruisers.splice(i, 1);
          if (this.wanted > 0) {
            var fresh = this.spawnOffscreen();
            if (fresh) fresh.stuck = 0;
          }
          this.spawnTimer = 1.5;
          continue;
        }
      } else {
        // roadblock: parked, but the light bar keeps rolling
        car.speed = 0;
        car.group.rotation.y = car.heading;
      }

      // lights
      if (car.lightBar) {
        car.lightBar.phase += dt * 8.5;
        var on = Math.sin(car.lightBar.phase) > 0;
        car.lightBar.red.color.setHex(on ? 0xff3b2e : 0x4a100e);
        car.lightBar.blue.color.setHex(!on ? 0x3b86ff : 0x0d1730);
      }

      if (d < 170 && !this.segmentBlocked(car.group.position.x, car.group.position.z, player.pos.x, player.pos.z)) {
        visible = true;
      }

      // sidearms at four stars, only against a player on foot
      if (this.wanted >= 4 && !player.inCar && d < CFG.police.shootRange && !player.dead) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = this.rng.float(1.0, 2.1);
          if (!this.segmentBlocked(car.group.position.x, car.group.position.z, player.pos.x, player.pos.z)) {
            var from = new THREE.Vector3(car.group.position.x, 1.4, car.group.position.z);
            var to = new THREE.Vector3(player.pos.x, 1.25, player.pos.z);
            BS.Fx.muzzle(from, to);
            BS.Fx.tracer(from, to, 0xffe6b0);
            if (BS.Audio) BS.Audio.gunshot('pistol', from);
            if (this.rng.chance(0.55)) player.damage(this.rng.float(6, 11), 'police');
          }
        }
      }
    }

    // heat cools when nobody has eyes on you
    if (this.wanted > 0) {
      if (visible || this.wanted >= 5) this.hiddenTimer = 0;
      else this.hiddenTimer += dt;
      if (this.hiddenTimer > CFG.police.decaySeconds) {
        this.hiddenTimer = 0;
        this.setWanted(this.wanted - 1);
        if (BS.HUD) BS.HUD.ticker('La policía pierde el rastro');
      }
    } else {
      this.hiddenTimer = 0;
    }

    // busted: stand still next to a cruiser for three seconds
    if (this.wanted > 0 && !player.inCar && !player.dead && nearest && nearestD < 7.5) {
      this.bustTimer += dt;
      if (this.bustTimer > CFG.police.bustSeconds) {
        this.bustTimer = 0;
        if (game.onBusted) game.onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    if (BS.Audio) BS.Audio.setSiren(this.wanted > 0 ? Math.min(3, this.wanted) : 0, nearest ? nearest.car.group.position : null);
  };

  BS.Police = Police;
})(window.BS);
