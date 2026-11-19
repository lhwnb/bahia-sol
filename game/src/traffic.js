/* Bahía Sol — traffic.
   Thirty NPC cars follow the road grid on the right-hand lane, slow down for
   whatever is in front of them, lean on the horn, and scatter when shots ring
   out. Waypoints are the intersections; at each one the driver picks straight,
   left or right and never a U-turn. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;
  var STEP = CFG.world.step;

  function laneOffset(axis, dir) {
    if (axis === 'z') return dir > 0 ? -4.6 : 4.6;
    return dir > 0 ? 4.6 : -4.6;
  }

  function Traffic(scene, city, rng, opts) {
    opts = opts || {};
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.count = opts.count || CFG.traffic.count;
    this.kinds = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'sport', 'sedan'];
    this.colors = CFG.palette.cars;
    this.playerPos = new THREE.Vector3();
  }

  Traffic.prototype.spawnOne = function (avoid) {
    var rng = this.rng;
    var axis = rng.chance(0.5) ? 'x' : 'z';
    var roadIndex = rng.int(-5, 5);
    var dir = rng.chance(0.5) ? 1 : -1;
    var travel = rng.int(-5, 4);
    var kind = rng.pick(this.kinds);
    var color = rng.pick(this.colors);
    var car = BS.Vehicles.create(kind, color, { taxi: kind === 'taxi' });
    var lane = laneOffset(axis, dir);
    var x, z;
    if (axis === 'z') {
      x = roadIndex * STEP + lane;
      z = (travel + 0.5) * STEP + rng.float(-30, 30);
    } else {
      z = roadIndex * STEP + lane;
      x = (travel + 0.5) * STEP + rng.float(-30, 30);
    }
    if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 70) {
      x += 120 * (x < 0 ? 1 : -1);
    }
    car.group.position.set(x, 0, z);
    this.scene.add(car.group);
    var npc = {
      car: car,
      axis: axis,
      dir: dir,
      road: roadIndex,
      travel: travel,
      lane: lane,
      target: new THREE.Vector3(),
      speed: rng.float(8, 14),
      cruise: rng.float(11, 16),
      panic: 0,
      honk: rng.float(1, 8),
      stuck: 0,
      heading: 0
    };
    car.driver = 'npc';
    this.pickTarget(npc, true);
    car.heading = Math.atan2(npc.target.x - x, npc.target.z - z);
    car.group.rotation.y = car.heading;
    this.cars.push(npc);
    return npc;
  };

  Traffic.prototype.pickTarget = function (npc, first) {
    var rng = this.rng;
    var next;
    if (first) {
      next = npc.travel + npc.dir;
    } else {
      var options = [];
      var ahead = npc.travel + npc.dir;
      if (ahead >= -5 && ahead <= 5) options.push({ axis: npc.axis, dir: npc.dir, weight: 0.58 });
      // turns from the current intersection
      var turnAxis = npc.axis === 'z' ? 'x' : 'z';
      var turnRoad = npc.travel;
      if (turnRoad >= -5 && turnRoad <= 5) {
        options.push({ axis: turnAxis, dir: 1, weight: 0.21 });
        options.push({ axis: turnAxis, dir: -1, weight: 0.21 });
      }
      if (!options.length) options.push({ axis: npc.axis, dir: -npc.dir, weight: 1 });
      var total = 0, i;
      for (i = 0; i < options.length; i++) total += options[i].weight;
      var roll = rng.float(0, total), pick = options[0];
      for (i = 0; i < options.length; i++) {
        roll -= options[i].weight;
        if (roll <= 0) { pick = options[i]; break; }
      }
      if (pick.axis !== npc.axis) {
        var oldRoad = npc.road;
        npc.road = npc.travel;
        npc.travel = oldRoad;
      } else {
        npc.travel = Math.max(-5, Math.min(5, ahead));
      }
      npc.axis = pick.axis;
      npc.dir = pick.dir;
      npc.lane = laneOffset(npc.axis, npc.dir);
      next = npc.travel + npc.dir;
      if (next < -5) { npc.dir = 1; next = npc.travel + 1; }
      if (next > 5) { npc.dir = -1; next = npc.travel - 1; }
    }
    npc.travel = Math.max(-5, Math.min(5, next));
    var t = npc.target;
    if (npc.axis === 'z') {
      t.set(npc.road * STEP + npc.lane, 0, npc.travel * STEP);
    } else {
      t.set(npc.travel * STEP, 0, npc.road * STEP + npc.lane);
    }
    return t;
  };

  Traffic.prototype.populate = function (avoid) {
    for (var i = 0; i < this.count; i++) this.spawnOne(avoid);
  };

  Traffic.prototype.scare = function (pos, radius) {
    for (var i = 0; i < this.cars.length; i++) {
      var npc = this.cars[i];
      var d = Math.hypot(npc.car.group.position.x - pos.x, npc.car.group.position.z - pos.z);
      if (d < (radius || 90)) {
        npc.panic = this.rng.float(5, 11);
        npc.cruise = Math.min(npc.car.spec.maxSpeed * 0.85, npc.cruise + 6);
      }
    }
  };

  Traffic.prototype.update = function (dt, game) {
    var player = game.player;
    var playerCar = player && player.car ? player.car : null;
    var px = player ? player.pos.x : 0, pz = player ? player.pos.z : 0;

    for (var i = 0; i < this.cars.length; i++) {
      var npc = this.cars[i];
      var car = npc.car;
      if (car.dead) continue;
      var pos = car.group.position;
      var dx = npc.target.x - pos.x, dz = npc.target.z - pos.z;
      var dist = Math.hypot(dx, dz);
      var desiredHeading = Math.atan2(dx, dz);
      var dh = (((desiredHeading - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      car.heading += dh * Math.min(1, dt * 3.2);

      if (npc.panic > 0) npc.panic -= dt;
      var wanted = (npc.panic > 0 ? npc.cruise * 1.35 : npc.cruise);
      // near an intersection, ease off so the corner is not a drift
      if (dist < 22) wanted = Math.min(wanted, 8.5);

      // keep a gap to the player
      var toPlayerD = Math.hypot(px - pos.x, pz - pos.z);
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      var ahead = (px - pos.x) * fx + (pz - pos.z) * fz;
      if (toPlayerD < 15 && ahead > 2 && ahead < 14) {
        wanted = Math.min(wanted, playerCar ? 2.2 : 0.4);
        npc.honk -= dt;
        if (npc.honk <= 0) { npc.honk = this.rng.float(2.5, 6); if (BS.Audio) BS.Audio.honk(pos); }
      }

      // keep a gap to the car in front
      for (var j = 0; j < this.cars.length; j++) {
        if (j === i) continue;
        var other = this.cars[j];
        if (other.car.dead) continue;
        var ox = other.car.group.position.x - pos.x;
        var oz = other.car.group.position.z - pos.z;
        var fwd = ox * fx + oz * fz;
        var side = Math.abs(ox * fz - oz * fx);
        if (fwd > 0 && fwd < 13 && side < 2.6) {
          wanted = Math.min(wanted, Math.max(0, (fwd - 4) * 0.8));
          break;
        }
      }

      npc.speed += (wanted - npc.speed) * Math.min(1, dt * (wanted < npc.speed ? 4.2 : 1.6));
      pos.x += Math.sin(car.heading) * npc.speed * dt;
      pos.z += Math.cos(car.heading) * npc.speed * dt;
      car.heading = car.heading;
      car.group.rotation.y = car.heading;
      car.speed = npc.speed;
      car.wheelSpin += npc.speed * dt * 2.4;
      for (var w = 0; w < car.wheels.length; w++) car.wheels[w].rotation.x = car.wheelSpin;

      if (dist < 7) {
        this.pickTarget(npc, false);
        npc.stuck = 0;
      } else if (npc.speed < 0.5) {
        npc.stuck += dt;
        if (npc.stuck > 7) { npc.stuck = 0; this.pickTarget(npc, false); }
      }
    }
  };

  BS.Traffic = Traffic;
})(window.BS);
