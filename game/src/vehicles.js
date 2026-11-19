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

  function bodyGeometry(spec, paint, kind) {
    var L = spec.length, Wd = spec.width, H = spec.height;
    var parts = [];
    // the shell rides high enough that the tyres read from any angle
    var y0 = 0.4;
    var bodyH = H * 0.44;
    var paintC = paint;

    if (kind === 'van') {
      parts.push(G.box(Wd, H * 0.78, L, 0, y0 + H * 0.39, 0, paintC));
      parts.push(G.box(Wd * 0.9, H * 0.34, L * 0.2, 0, y0 + H * 0.55, L * 0.42, GLASS));
      parts.push(G.box(Wd * 0.86, H * 0.2, L * 0.5, 0, y0 + H * 0.82, -L * 0.1, paintC));
    } else if (kind === 'pickup') {
      parts.push(G.box(Wd, bodyH, L, 0, y0 + bodyH / 2, 0, paintC));
      parts.push(G.box(Wd * 0.88, H * 0.34, L * 0.32, 0, y0 + bodyH + H * 0.17, L * 0.12, GLASS));
      parts.push(G.box(Wd * 0.9, H * 0.08, L * 0.34, 0, y0 + bodyH + H * 0.36, L * 0.1, paintC));
      parts.push(G.box(Wd * 0.94, H * 0.22, 0.16, 0, y0 + bodyH + 0.05, -L * 0.48, paintC));
      parts.push(G.box(Wd * 0.94, H * 0.18, 0.14, 0, y0 + bodyH + 0.05, L * 0.48, paintC));
    } else if (kind === 'sport') {
      parts.push(G.box(Wd, bodyH * 0.8, L, 0, y0 + bodyH * 0.4, 0, paintC));
      parts.push(G.box(Wd * 0.84, H * 0.3, L * 0.36, 0, y0 + bodyH * 0.8 + H * 0.15, -L * 0.06, GLASS));
      parts.push(G.box(Wd * 0.8, H * 0.05, L * 0.3, 0, y0 + bodyH * 0.8 + H * 0.31, -L * 0.06, paintC));
      parts.push(G.box(Wd * 0.7, 0.1, L * 0.2, 0, y0 + bodyH + 0.1, -L * 0.38, paintC));
    } else {
      // sedan / muscle / cruiser
      parts.push(G.box(Wd, bodyH, L, 0, y0 + bodyH / 2, 0, paintC));
      // hood and boot sit a touch lower than the beltline
      parts.push(G.box(Wd * 0.96, bodyH * 0.46, L * 0.3, 0, y0 + bodyH * 0.79, L * 0.34, paintC));
      parts.push(G.box(Wd * 0.96, bodyH * 0.46, L * 0.2, 0, y0 + bodyH * 0.79, -L * 0.39, paintC));
      var cabH = H * 0.36;
      var cabL = L * (kind === 'muscle' ? 0.36 : 0.42);
      var cabZ = kind === 'muscle' ? -L * 0.05 : -L * 0.02;
      parts.push(G.box(Wd * 0.88, cabH, cabL, 0, y0 + bodyH + cabH / 2, cabZ, GLASS));
      parts.push(G.box(Wd * 0.86, 0.07, cabL * 0.9, 0, y0 + bodyH + cabH, cabZ, paintC));
      // chrome beltline splits body from glass
      parts.push(G.box(Wd * 0.9, 0.035, cabL * 1.02, 0, y0 + bodyH + 0.02, cabZ, 0xcfd6da));
      // raked windshield and backlight
      parts.push(wedge(Wd * 0.82, 0.055, cabH * 1.1, cabZ + cabL * 0.46, y0 + bodyH + cabH * 0.5, -0.5, GLASS));
      parts.push(wedge(Wd * 0.82, 0.055, cabH * 1.0, cabZ - cabL * 0.46, y0 + bodyH + cabH * 0.5, 0.5, GLASS));
      if (kind === 'muscle') {
        parts.push(G.box(0.1, 0.14, 0.09, Wd * 0.3, y0 + bodyH + 0.07, -L * 0.45, BUMPER));
        parts.push(G.box(0.1, 0.14, 0.09, -Wd * 0.3, y0 + bodyH + 0.07, -L * 0.45, BUMPER));
        parts.push(G.box(Wd * 0.72, 0.055, 0.3, 0, y0 + bodyH + 0.15, -L * 0.46, paintC));
      }
    }

    // bumpers, skirts, mirrors
    parts.push(G.box(Wd * 1.01, 0.18, 0.24, 0, y0 + 0.12, L / 2 - 0.02, BUMPER));
    parts.push(G.box(Wd * 1.01, 0.18, 0.24, 0, y0 + 0.12, -L / 2 + 0.02, BUMPER));
    parts.push(G.box(0.16, 0.1, 0.3, Wd / 2 + 0.02, y0 + bodyH + 0.18, L * 0.12, paintC));
    parts.push(G.box(0.16, 0.1, 0.3, -Wd / 2 - 0.02, y0 + bodyH + 0.18, L * 0.12, paintC));
    // side skirts
    parts.push(G.box(0.1, 0.12, L * 0.62, Wd / 2, y0 - 0.02, 0, BUMPER));
    parts.push(G.box(0.1, 0.12, L * 0.62, -Wd / 2, y0 - 0.02, 0, BUMPER));
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
    var head = police ? 0xeaf6ff : 0xfff0c2;
    parts.push(G.box(0.42, 0.16, 0.08, Wd * 0.32, 0.72, L / 2 + 0.01, head));
    parts.push(G.box(0.42, 0.16, 0.08, -Wd * 0.32, 0.72, L / 2 + 0.01, head));
    parts.push(G.box(0.38, 0.13, 0.08, Wd * 0.34, 0.72, -L / 2 - 0.01, 0xff3a2e));
    parts.push(G.box(0.38, 0.13, 0.08, -Wd * 0.34, 0.72, -L / 2 - 0.01, 0xff3a2e));
    return G.merge(parts);
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
    var wx = spec.width / 2 - 0.02, wz = spec.length * 0.32;
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

    var lightBar = null;
    if (kind === 'cruiser') {
      var barGeo = new THREE.BoxGeometry(1.5, 0.16, 0.32);
      var redMat = new THREE.MeshBasicMaterial({ color: 0xff2a24, toneMapped: false });
      var blueMat = new THREE.MeshBasicMaterial({ color: 0x2e7bff, toneMapped: false });
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.3), redMat);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.3), blueMat);
      red.position.set(-0.38, 0.36 + spec.height * 0.95 + 0.1, -0.2);
      blue.position.set(0.38, 0.36 + spec.height * 0.95 + 0.1, -0.2);
      group.add(red); group.add(blue);
      lightBar = { red: redMat, blue: blueMat, redMesh: red, blueMesh: blue, phase: 0 };
    }

    // black door panels for cruisers
    if (kind === 'cruiser') {
      var decal = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.02, 0.6, spec.length * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.6 }));
      decal.position.set(0, 0.8, 0);
      group.add(decal);
    }
    if (opts.taxi) {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.36),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false }));
      sign.position.set(0, 0.36 + spec.height + 0.18, -0.1);
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
