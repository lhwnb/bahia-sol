/* Bahía Sol — screenshot stages.
   ?shot=cover|foot|mission|night builds a deterministic tableau with the real
   HUD, sets the camera, and lets main.js report __ready after eight frames.
   No clock is read here; motion is driven by main's fixed shot clock. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;

  function stageCar(game, specId, color, x, z, heading, opts) {
    opts = opts || {};
    var car = BS.Vehicles.create(specId, color, opts);
    BS.Vehicles.place(car, x, z, heading);
    car.speed = opts.speed || 0;
    game.scene.add(car.group);
    game.cars.push(car);
    return car;
  }

  function stageCop(game, x, z, heading) {
    var car = stageCar(game, 'cruiser', 0xf2f2ef, x, z, heading, { speed: 0 });
    car.isPolice = true;
    car.sirenOn = true;
    car.driver = 'police';
    var cop = { car: car, mode: 'block', phase: game.police.rng.angle(), shootTimer: 9, stuck: 0, life: 0 };
    game.police.cruisers.push(cop);
    return car;
  }

  function clearDynamic(game) {
    var i;
    if (game.player.inCar || game.player.car) {
      game.player.car = null;
      game.player.inCar = false;
    }
    game.player.mesh.visible = true;
    for (i = 0; i < game.cars.length; i++) game.scene.remove(game.cars[i].group);
    game.cars.length = 0;
    game.traffic.cars.length = 0;
    game.police.cruisers.length = 0;
    game.police.wanted = 0;
    game.peds.killAllRivals();
    for (i = 0; i < game.peds.peds.length; i++) {
      game.peds.peds[i].alive = false;
      game.peds.peds[i].rival = i >= game.peds.walkers;
      game.peds.writeMatrices(game.peds.peds[i], new THREE.Matrix4().makeScale(0, 0, 0));
    }
    game.missions.setMarker(null);
    game.player.health = 100;
    game.player.armour = 50;
    game.player.dead = false;
    game.player.heading = 0;
    game.player.yaw = 0;
    game.player.pitch = 0.12;
    game.cash = Math.max(game.cash, CFG.startCash);
    game.time = 0;
  }

  function placeWalker(game, index, x, z, heading, speed, phase) {
    var p = game.peds.peds[index];
    p.alive = true;
    p.rival = false;
    p.mode = 'line';
    p.x = x; p.z = z;
    p.heading = heading;
    p.speed = speed || 1.3;
    p.phase = phase || 0;
    p.panic = 0;
    p.hp = 70;
    game.peds.writeMatrices(p, null);
    return p;
  }

  function addNeonPlane(game, x, y, z, text, color, width, rotY) {
    var tex = BS.Tex.neon(text, color);
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY || 0;
    game.scene.add(mesh);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: color, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    glow.scale.set(width * 1.9, width * 0.8, 1);
    glow.position.copy(mesh.position);
    game.scene.add(glow);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(mesh, glow);
    return mesh;
  }

  function addLightPool(game, x, z, color, size, opacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: color, transparent: true, opacity: opacity || 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.06, z);
    game.scene.add(mesh);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(mesh);
    return mesh;
  }

  // ---------------------------------------------------------- dock dressing
  function addProp(game, geo, mat, x, y, z, ry) {
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    game.scene.add(mesh);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(mesh);
    return mesh;
  }

  function stageContainer(game, x, z, color, ry, stack) {
    var skin = new THREE.MeshStandardMaterial({ color: color, roughness: 0.66, metalness: 0.3 });
    var trim = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.8 });
    var h = 2.55, n = stack || 1, a = ry || 0;
    var ex = Math.cos(a) * 3.0, ez = -Math.sin(a) * 3.0;
    for (var i = 0; i < n; i++) {
      var y = 1.32 + i * (h + 0.04);
      addProp(game, new THREE.BoxGeometry(6.05, h, 2.43), skin, x, y, z, a);
      addProp(game, new THREE.BoxGeometry(0.16, h, 2.5), trim, x + ex, y, z + ez, a);
      addProp(game, new THREE.BoxGeometry(0.16, h, 2.5), trim, x - ex, y, z - ez, a);
      addProp(game, new THREE.BoxGeometry(6.0, 0.12, 2.47), trim, x, y + h / 2 - 0.07, z, a);
      for (var k = 0; k < 7; k++) {
        var lx = -2.6 + k * 0.87;
        addProp(game, new THREE.BoxGeometry(0.1, h - 0.16, 0.07), trim,
          x + lx * Math.cos(a) + Math.sin(a) * 1.23, y, z - lx * Math.sin(a) + Math.cos(a) * 1.23, a);
      }
    }
  }

  function stageCrane(game, x, z, ry) {
    var steel = new THREE.MeshStandardMaterial({ color: 0xc79a3a, roughness: 0.58, metalness: 0.45 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.7, metalness: 0.4 });
    var a = ry || 0;
    for (var i = 0; i < 2; i++) {
      var lx = x + Math.cos(a) * (i ? 5.2 : -5.2);
      var lz = z - Math.sin(a) * (i ? 5.2 : -5.2);
      addProp(game, new THREE.BoxGeometry(0.75, 16, 0.75), steel, lx, 8, lz, a);
      addProp(game, new THREE.BoxGeometry(1.5, 0.5, 1.5), dark, lx, 0.25, lz, a);
    }
    addProp(game, new THREE.BoxGeometry(11.6, 1.1, 1.1), steel, x, 16, z, a);
    addProp(game, new THREE.BoxGeometry(2.2, 2.2, 2.0), dark, x + Math.cos(a) * 4.4, 14.6, z - Math.sin(a) * 4.4, a);
    addProp(game, new THREE.BoxGeometry(0.22, 5.4, 0.22), dark, x + Math.cos(a) * 2.2, 13, z - Math.sin(a) * 2.2, a);
  }

  function stageShed(game, x, z, w, d, h, ry) {
    var mat = new THREE.MeshStandardMaterial({
      map: BS.Tex.facadeWarehouse(0x8d8f8a), color: 0xd8d6cf, roughness: 0.84, metalness: 0.16
    });
    addProp(game, new THREE.BoxGeometry(w, h, d), mat, x, h / 2, z, ry);
    addProp(game, new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2), new THREE.MeshStandardMaterial({
      color: 0x4d5257, roughness: 0.8, metalness: 0.3
    }), x, h + 0.3, z, ry);
  }

  function stageBoat(game, x, z, ry, color) {
    var hull = new THREE.MeshStandardMaterial({ color: color || 0xe9e4d6, roughness: 0.5, metalness: 0.1 });
    var cab = new THREE.MeshStandardMaterial({ color: 0xdfe6e8, roughness: 0.42 });
    addProp(game, new THREE.BoxGeometry(9.5, 1.25, 3.0), hull, x, 0.95, z, ry);
    addProp(game, new THREE.BoxGeometry(3.4, 1.35, 2.3), cab, x - 1.6, 2.1, z, ry);
  }

  function stageBin(game, x, z) {
    var mat = new THREE.MeshStandardMaterial({ color: 0x3f4a44, roughness: 0.85 });
    addProp(game, new THREE.CylinderGeometry(0.34, 0.3, 0.95, 8), mat, x, 0.48, z);
    addProp(game, new THREE.CylinderGeometry(0.36, 0.36, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x252a28, roughness: 0.8 }), x, 0.95, z);
  }

  function stageHydrant(game, x, z) {
    var mat = new THREE.MeshStandardMaterial({ color: 0xb63a2c, roughness: 0.6, metalness: 0.2 });
    addProp(game, new THREE.CylinderGeometry(0.15, 0.18, 0.72, 8), mat, x, 0.36, z);
    addProp(game, new THREE.CylinderGeometry(0.09, 0.09, 0.34, 6), mat, x, 0.66, z);
    addProp(game, new THREE.BoxGeometry(0.46, 0.12, 0.14), mat, x, 0.52, z);
  }

  function setPose(game, px, py, pz, lx, ly, lz, fov) {
    game.shotPose = {
      pos: new THREE.Vector3(px, py, pz),
      look: new THREE.Vector3(lx, ly, lz),
      fov: fov || 56
    };
    game.camera.position.copy(game.shotPose.pos);
    game.camera.lookAt(game.shotPose.look);
    game.camera.fov = game.shotPose.fov;
    game.camera.updateProjectionMatrix();
  }

  function resetExtras(game) {
    if (game.shotExtra) {
      for (var i = 0; i < game.shotExtra.length; i++) {
        game.scene.remove(game.shotExtra[i]);
        if (game.shotExtra[i].material) game.shotExtra[i].material.dispose();
      }
    }
    game.shotExtra = [];
    if (game.shotHeadlight) {
      game.scene.remove(game.shotHeadlight);
      game.shotHeadlight = null;
    }
    if (game.shotHaze) {
      game.shotHaze.visible = true;
    }
  }

  function cover(game) {
    game.city.setNight(false);
    var car = stageCar(game, 'falcon', 0xb51f2a, 46, -2.3, -Math.PI / 2, { speed: 31 });
    car.mission = true;
    car.name = 'La Roja';
    car.wheelSpin = 4.2;
    for (var w = 0; w < car.wheels.length; w++) car.wheels[w].rotation.x = 4.2;
    game.player.enterCar(car);
    game.player.pos.set(46, 0, -2.3);
    game.player.health = 82;
    game.player.armour = 44;
    game.cash = 12450;

    game.police.wanted = 0;
    stageCop(game, 37.2, -5.3, -Math.PI / 2 + 0.13);
    stageCop(game, 31.5, 4.7, -Math.PI / 2 - 0.16);
    stageCop(game, 22.5, -1.6, -Math.PI / 2 + 0.06);
    game.police.setWanted(4);

    // oncoming traffic for depth
    stageCar(game, 'taxi', 0xe0b23c, -24, 5.4, Math.PI / 2, { speed: 9 });
    stageCar(game, 'sedan', 0x2f5f9e, -96, -5.4, Math.PI / 2, { speed: 8 });
    stageCar(game, 'van', 0xdad6cc, 86, -10.8, -Math.PI / 2, { speed: 0 });
    stageCar(game, 'pickup', 0x4a5b46, 20, 10.9, Math.PI / 2, { speed: 0 });
    // a parked car and a bin give the near corner its scale
    stageCar(game, 'sedan', 0x6f7a80, 50.5, -10.6, -Math.PI / 2, { speed: 0 });
    stageBin(game, 38.6, -11.4);

    game.missions.objective = 'Lleva La Roja a los muelles · 2:14';
    game.missions.setMarker(CFG.missions[0].dropoff, 0xffc46b);

    // sidewalk life, three colourways
    placeWalker(game, 0, 52, 13.5, Math.PI, 1.25, 0.4);
    placeWalker(game, 1, 60.5, -13.7, 0, 1.35, 1.7);
    placeWalker(game, 2, 66, 14.1, Math.PI, 1.1, 2.6);
    placeWalker(game, 3, 38, -14.3, 0, 1.45, 3.4);
    placeWalker(game, 4, 29.5, 13.9, Math.PI, 1.2, 4.8);
    placeWalker(game, 5, 78, -13.5, 0, 1.3, 5.5);

    // red and blue wash on the asphalt behind the pursuit
    addLightPool(game, 44.0, -7.4, 0xff2438, 16, 0.26);
    addLightPool(game, 43.5, 3.8, 0x2f5bff, 14, 0.22);

    setPose(game, 52.4, 2.1, -6.9, 45.6, 1.05, -1.9, 47);
  }

  function foot(game) {
    game.city.setNight(false);
    // on the seaward shoulder of the coast road, looking east along the shore
    game.player.setPosition(28, 606.4, 1.5);
    game.player.yaw = 1.5;
    game.player.heading = 1.5;
    game.player.pitch = 0.02;
    game.player.health = 92;
    game.player.armour = 55;
    game.player.mesh.visible = true;
    game.player.mesh.rotation.y = game.player.heading;
    game.player.mesh.userData.legL.rotation.x = 0.55;
    game.player.mesh.userData.legR.rotation.x = -0.55;
    game.player.mesh.userData.armL.rotation.x = -0.45;
    game.player.mesh.userData.armR.rotation.x = 0.45;
    game.cash = 8200;

    // walkers along the promenade and the sand
    placeWalker(game, 0, 46, 598, Math.PI + 0.3, 1.3, 0.2);
    placeWalker(game, 1, 58, 604, 0.1, 1.1, 1.4);
    placeWalker(game, 2, 72, 594, Math.PI - 0.2, 1.4, 2.2);
    placeWalker(game, 3, 86, 605, 0.2, 1.2, 0.9);
    placeWalker(game, 4, 100, 597, Math.PI, 1.3, 3.1);
    placeWalker(game, 5, 116, 604, 0, 1.2, 1.1);
    placeWalker(game, 6, 54, 586, Math.PI + 0.6, 1.1, 2.6);
    placeWalker(game, 7, 132, 596, 0, 1.3, 0.6);
    placeWalker(game, 8, 38, 590, Math.PI - 0.4, 1.2, 2.0);
    placeWalker(game, 9, 150, 603, 0.1, 1.2, 1.8);

    // traffic on the coast road
    stageCar(game, 'sedan', 0xd9d2c4, 40, 596.4, Math.PI / 2, { speed: 11 });
    stageCar(game, 'taxi', 0xe0b23c, -46, 605.6, -Math.PI / 2, { speed: 10 });
    stageCar(game, 'sport', 0x2f6f9e, 78, 596.4, Math.PI / 2, { speed: 14 });
    stageCar(game, 'van', 0xdad6cc, 120, 605.6, -Math.PI / 2, { speed: 9 });
    stageCar(game, 'pickup', 0x4a5b46, 14, 596.4, Math.PI / 2, { speed: 12 });
    stageCar(game, 'sedan', 0x8d6f4a, 56, 595.2, Math.PI / 2, { speed: 0 });

    // near-field furniture, 3-6 m from the lens
    stageHydrant(game, 23.6, 603.4);
    stageBin(game, 24.6, 609.0);

    game.missions.objective = 'Trabajo disponible: La Roja';
    game.missions.setMarker(new THREE.Vector3(112, 0, 601), 0xffc46b);

    setPose(game, 20, 2.6, 607.6, 108, 0.8, 628, 58);
  }

  function stageDockLamp(game, x, z, height) {
    var h = height || 6.2;
    var pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.7, metalness: 0.4 }));
    pole.position.set(x, h / 2, z);
    pole.castShadow = false;
    game.scene.add(pole);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }));
    head.position.set(x, h + 0.1, z);
    game.scene.add(head);
    var light = new THREE.PointLight(0xffc98a, 2.4, 34, 1.5);
    light.position.set(x, h - 0.3, z);
    game.scene.add(light);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(pole, head, light);
  }

  function mission(game) {
    game.city.setNight(false);
    // Puerto Norte at dusk: player peeks around a container, the crew holds the quay
    game.player.setPosition(-335.4, 490.4, Math.PI - 0.22);
    game.player.yaw = Math.PI - 0.16;
    game.player.heading = Math.PI - 0.16;
    game.player.mesh.visible = true;
    game.player.mesh.rotation.y = game.player.heading;
    game.player.weaponDrawn = true;
    game.player.mesh.userData.gun.visible = true;
    game.player.mesh.userData.armR.rotation.x = -1.5;
    game.player.mesh.userData.armL.rotation.x = -1.12;
    game.player.mesh.userData.legL.rotation.x = -0.24;
    game.player.mesh.userData.legR.rotation.x = 0.2;
    game.player.health = 47;
    game.player.armour = 18;
    game.player.dead = false;
    game.cash = 6720;

    game.combat.weapon = 'pistol';
    game.combat.ammo.pistol = 7;

    // containers: cover on the left, a wall of colour down the quay
    stageContainer(game, -339.4, 492.6, 0x9c4632, 0.12, 2);
    stageContainer(game, -345.6, 485.0, 0x2f6f73, 0.02, 1);
    stageContainer(game, -330.4, 478.4, 0xa8823a, -0.06, 1);
    stageContainer(game, -348.8, 478.2, 0x4d5f52, 0.1, 2);

    // six rivals spread across the quay ahead
    var rivals = game.peds.spawnRivals({ x: -336, z: 478 }, 6);
    var spots = [
      [-338.0, 484.2], [-333.2, 482.0], [-342.2, 480.8],
      [-328.4, 483.4], [-336.4, 476.6], [-343.4, 475.4]
    ];
    for (var i = 0; i < rivals.length; i++) {
      var p = rivals[i];
      p.x = spots[i][0];
      p.z = spots[i][1];
      p.heading = Math.atan2(-336.2 - p.x, 491.6 - p.z);
      p.shootTimer = 99;
      p.phase = i * 1.1;
      game.peds.writeMatrices(p, null);
    }

    // cruisers roll in from the east with the bars going
    stageCop(game, -328.6, 480.8, -Math.PI / 2 + 0.62);
    stageCop(game, -320.6, 486.4, -Math.PI / 2 - 0.05);
    game.police.setWanted(3);

    // dock dressing
    stageCrane(game, -353.0, 479.0, 0.06);
    stageShed(game, -330.0, 467.5, 27, 9, 8.5, 0);
    stageBoat(game, -371.0, 493.0, 0.08, 0xe9e4d6);
    stageBoat(game, -381.0, 472.0, -0.04, 0xcfd8d4);
    stageHydrant(game, -333.4, 497.6);
    stageBin(game, -329.8, 496.4);
    var crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6b44, roughness: 0.85 });
    addProp(game, new THREE.BoxGeometry(1.25, 1.1, 1.05), crateMat, -330.6, 0.58, 496.2, 0.42);
    addProp(game, new THREE.BoxGeometry(0.95, 0.8, 0.9), crateMat, -329.4, 0.44, 497.4, -0.2);
    addProp(game, new THREE.BoxGeometry(1.1, 0.95, 0.95), crateMat, -331.6, 0.5, 497.1, 0.15);
    stageDockLamp(game, -334.6, 488.4, 6.4);
    stageDockLamp(game, -343.2, 481.6, 6.0);
    stageDockLamp(game, -327.6, 476.0, 5.6);

    game.missions.objective = 'Limpia el muelle · 3 rivales';
    game.missions.setMarker(new THREE.Vector3(-336, 0, 471), 0xffc46b);

    if (BS.HUD) {
      BS.HUD.ticker('El Ruso: <b>+$500</b> por cada contenedor asegurado');
      BS.HUD.showCard('El Ruso', 'Muelle Norte',
        'Los muchachos del contenedor no van a soltarlo. Entra y limpia el muelle.');
    }

    setPose(game, -329.6, 3.45, 501.4, -335.6, 1.32, 484.4, 46);
  }

  function night(game) {
    game.city.setNight(true);
    var car = stageCar(game, 'sport', 0xc2ccd2, 45, -2.6, -Math.PI / 2, { speed: 22 });
    car.wheelSpin = 2.4;
    car.steerVis = 0.08;
    for (var w = 0; w < car.wheels.length; w++) {
      car.wheels[w].rotation.x = 2.4;
      car.wheels[w].rotation.y = 0.08;
    }
    game.player.enterCar(car);
    game.player.pos.set(45, 0, -2.6);
    game.player.health = 74;
    game.player.armour = 30;
    game.cash = 9830;

    stageCop(game, 68, 4.6, -Math.PI / 2);
    stageCop(game, 84, -5.2, -Math.PI / 2);
    game.police.setWanted(2);

    // the street keeps moving: two coming at us, two running away
    stageCar(game, 'taxi', 0xe0b23c, -16, 4.6, Math.PI / 2, { speed: 10 });
    stageCar(game, 'sedan', 0x2f5f9e, -54, 4.6, Math.PI / 2, { speed: 12 });
    stageCar(game, 'sport', 0xa8432f, -32, -4.6, -Math.PI / 2, { speed: 15 });
    stageCar(game, 'van', 0xdad6cc, -86, -4.6, -Math.PI / 2, { speed: 9 });

    // neon facing the camera, plus shop glow
    addNeonPlane(game, -8, 17, -24, 'HOTEL', 0xff3fa4, 17, Math.PI / 2);
    addNeonPlane(game, -2, 8.5, 23, 'CLUB', 0x35e6ff, 12, Math.PI / 2);
    addNeonPlane(game, -66, 24, -25, 'SOL', 0xffb347, 15, Math.PI / 2);
    addNeonPlane(game, -58, 10, 22, '24H', 0xb6ff5a, 9, Math.PI / 2);
    addNeonPlane(game, -124, 19, -24, 'RADIO', 0x8f7dff, 16, Math.PI / 2);
    addNeonPlane(game, -118, 9, 21, 'MAR', 0x35e6ff, 10, Math.PI / 2);

    addLightPool(game, -6, -6, 0xff3fa4, 26, 0.3);
    addLightPool(game, -60, 6, 0xffb347, 22, 0.24);
    addLightPool(game, 40, 2, 0xffc46b, 30, 0.35);
    addLightPool(game, 46, -2.6, 0xffd9a0, 17, 0.42);
    var carLamp = new THREE.PointLight(0xffd2a0, 2.2, 22, 1.5);
    carLamp.position.set(47, 5.2, -2.2);
    game.scene.add(carLamp);
    game.shotExtra.push(carLamp);
    // headlight wash in front of the oncoming pair
    addLightPool(game, -8, 4.6, 0xffe0b0, 16, 0.22);
    addLightPool(game, -44, 4.6, 0xffe0b0, 14, 0.18);

    // headlight cones on the wet road
    var beamMat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: 0xffe3b0, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    var beam = new THREE.Mesh(new THREE.PlaneGeometry(9, 32), beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(26, 0.08, -1.2);
    game.scene.add(beam);
    game.shotExtra.push(beam);

    var spot = new THREE.SpotLight(0xffe0b0, 2.4, 60, 0.62, 0.7, 1.4);
    spot.position.set(40, 1.1, -1.2);
    spot.target.position.set(-10, 0, -1.2);
    game.scene.add(spot);
    game.scene.add(spot.target);
    game.shotHeadlight = spot;

    game.missions.objective = 'Sin trabajo activo — la ciudad respira';
    game.missions.setMarker(new THREE.Vector3(-120, 0, 60), 0xffc46b);

    placeWalker(game, 0, -18, 13.0, Math.PI, 1.2, 0.6);
    placeWalker(game, 1, -38, -12.6, 0, 1.3, 1.8);
    placeWalker(game, 2, 8, 12.4, Math.PI, 1.25, 2.4);
    placeWalker(game, 3, 20, -12.4, 0, 1.3, 0.9);
    placeWalker(game, 4, 33, 12.6, Math.PI, 1.2, 3.1);

    setPose(game, 56, 2.05, 1.1, -60, 8.0, -4.0, 58);
  }

  var Shots = {
    setup: function (name, game) {
      resetExtras(game);
      clearDynamic(game);
      if (BS.HUD) {
        BS.HUD.hideCard();
        BS.HUD.hideBig();
        BS.HUD.tickerTime = 0;
        BS.HUD.setVisible(true);
        BS.HUD.objective('Ciudad libre');
      }
      game.shotName = name;
      if (name === 'cover') cover(game);
      else if (name === 'foot') foot(game);
      else if (name === 'mission') mission(game);
      else if (name === 'night') night(game);
      else cover(game);
      game.camera.position.copy(game.shotPose.pos);
      game.camera.lookAt(game.shotPose.look);
    },

    update: function (name, game, t) {
      // police bars keep rolling so the stills read as a live chase
      for (var i = 0; i < game.police.cruisers.length; i++) {
        var car = game.police.cruisers[i].car;
        if (car.lightBar) {
          var on = Math.sin(t * 9 + i * 2.1) > 0;
          car.lightBar.red.color.setHex(on ? 0xff3b2e : 0x4a100e);
          car.lightBar.blue.color.setHex(!on ? 0x3b86ff : 0x0d1730);
        }
      }
      // wheel motion
      if (game.player.car) {
        var sp = game.player.car.speed * 0.05;
        for (var w = 0; w < game.player.car.wheels.length; w++) game.player.car.wheels[w].rotation.x += sp;
      }
      // pedestrians shoulder their way along, deterministically
      if (name === 'foot') {
        for (var p = 0; p < game.peds.peds.length; p++) {
          var ped = game.peds.peds[p];
          if (!ped.alive) continue;
          ped.phase += 0.07;
          game.peds.writeMatrices(ped, null);
        }
      }
      if (name === 'mission') {
        // muzzle flash and tracer, locked on a rival down the quay
        var from = new THREE.Vector3(-336.0, 1.32, 490.4);
        var to = new THREE.Vector3(-338.0, 1.24, 484.2);
        if (Math.sin(t * 21) > -0.2) {
          BS.Fx.muzzle(from, to);
          BS.Fx.tracer(from, to, 0xffe0a0);
        }
        if (Math.sin(t * 7) > 0.62) {
          BS.Fx.tracer(from, new THREE.Vector3(-333.2, 1.2, 482.0), 0xffd28a);
          BS.Fx.spark(-338.0, 1.24, 484.2);
          BS.Fx.spark(-342.2, 1.18, 480.8);
        }
        if (BS.HUD && BS.HUD.damageEl) BS.HUD.damageEl.style.opacity = '0.3';
        for (var r = 0; r < 3; r++) {
          if (Math.sin(t * 9 + r * 2) > 0.55) {
            var rf = new THREE.Vector3(-338 + r * 3, 1.32, 482.6 - r * 1.2);
            BS.Fx.muzzle(rf, from);
          }
        }
      }
      // keep the stage camera locked; shot mode has no mouse
      game.camera.position.copy(game.shotPose.pos);
      game.camera.lookAt(game.shotPose.look);
      game.camera.fov = game.shotPose.fov;
      game.camera.updateProjectionMatrix();
    }
  };

  BS.Shots = Shots;
})(window.BS);
