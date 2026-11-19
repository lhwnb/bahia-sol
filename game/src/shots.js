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
    // corrugated steel: the skin carries ribs, rust weeping and a ground grime band
    var skinTex = BS.Tex.containerSkin(color);
    skinTex.repeat.set(3, 1);
    var skin = new THREE.MeshStandardMaterial({
      map: skinTex, color: 0xffffff, roughness: 0.7, metalness: 0.34
    });
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
    // corrugated steel: ribs, rails and rust streaks at a real-world scale,
    // because a 27 m wall on a 0..1 box UV is otherwise a flat grey slab
    var wallTex = BS.Tex.containerSkin(0x8f918c);
    wallTex = wallTex.clone();
    wallTex.needsUpdate = true;
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(w / 7.5, h / 5.0);
    var mat = new THREE.MeshStandardMaterial({
      map: wallTex, color: 0xcfd0c8, roughness: 0.82, metalness: 0.26
    });
    addProp(game, new THREE.BoxGeometry(w, h, d), mat, x, h / 2, z, ry);
    addProp(game, new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2), new THREE.MeshStandardMaterial({
      color: 0x4d5257, roughness: 0.8, metalness: 0.3
    }), x, h + 0.3, z, ry);
    // a string of high windows catches the last of the sun
    var winMat = new THREE.MeshStandardMaterial({ color: 0x3a4a55, roughness: 0.35, metalness: 0.55 });
    for (var wi = 0; wi < 5; wi++) {
      addProp(game, new THREE.BoxGeometry(1.9, 1.1, 0.12), winMat,
        x - w * 0.36 + wi * (w * 0.18), h * 0.78, z + d / 2 + 0.05, ry);
    }
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

  // a warm flare pinned to a world point: lets the cover put the sun in the
  // slot between two towers instead of wherever the light rig happens to aim
  function addFlareAt(game, x, y, z, size, opacity, color) {
    var core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: color || 0xfff0cf, transparent: true, opacity: opacity || 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
    }));
    core.scale.set(size, size, 1);
    core.position.set(x, y, z);
    core.renderOrder = 900;
    game.scene.add(core);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: color || 0xffc48a, transparent: true, opacity: (opacity || 0.6) * 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
    }));
    halo.scale.set(size * 4.6, size * 3.2, 1);
    halo.position.set(x, y, z);
    halo.renderOrder = 899;
    game.scene.add(halo);
    // anamorphic smear so it reads as a lens flare, not as a lamp
    var bar = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.streak(), color: 0xffdcb0, transparent: true, opacity: (opacity || 0.6) * 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
    }));
    bar.scale.set(size * 7.5, size * 0.22, 1);
    bar.position.set(x, y, z);
    bar.renderOrder = 899;
    game.scene.add(bar);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(core, halo, bar);
  }

  function addSunFlare(game, dist) {
    var dir = CFG.sun.dir.clone().normalize();
    var pos = game.camera.position.clone().add(dir.multiplyScalar(dist || 300));
    var core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: 0xffe6bd, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    core.scale.set(122, 122, 1);
    core.position.copy(pos);
    game.scene.add(core);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: 0xffc48a, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    halo.scale.set(430, 300, 1);
    halo.position.copy(pos);
    game.scene.add(halo);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(core, halo);
  }

  // long additive smear on the tarmac: tail lights and headlights read as light,
  // not as paint, once it is stretched along the direction of travel
  function addLightStreak(game, x, z, ry, len, wid, color, opacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: color, transparent: true, opacity: opacity || 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = ry || 0;
    m.position.set(x, 0.07, z);
    game.scene.add(m);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(m);
    return m;
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
    // the first cruiser is angling across the asphalt to cut the falcon off
    stageCop(game, 40.6, 3.4, -Math.PI / 2 - 0.46);
    stageCop(game, 33.4, -5.2, -Math.PI / 2 + 0.2);
    stageCop(game, 24.6, 1.4, -Math.PI / 2 + 0.05);
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

    // people at human scale: one crossing nine metres out, a pair talking on the
    // far kerb, the rest walking away down the block
    placeWalker(game, 0, 48.2, 2.6, 0.1, 1.28, 0.55);
    placeWalker(game, 1, 43.6, 10.4, Math.PI - 0.1, 0.02, 1.7);
    placeWalker(game, 2, 42.7, 11.3, 0.35, 0.02, 2.6);
    placeWalker(game, 3, 52.0, 13.1, Math.PI, 1.2, 3.4);
    placeWalker(game, 4, 58.5, 12.6, 0.1, 1.35, 4.8);
    placeWalker(game, 5, 30.5, 13.4, Math.PI, 1.3, 5.5);

    // red and blue wash on the asphalt behind the pursuit
    addLightPool(game, 42.5, -0.4, 0xff2438, 15, 0.24);
    addLightPool(game, 41.0, 5.6, 0x2f5bff, 13, 0.2);
    addLightStreak(game, 51.0, -1.2, 0, 9, 3.2, 0xff3b2e, 0.22);
    addSunFlare(game, 340);

    setPose(game, 52.4, 2.1, -6.9, 45.6, 1.05, -1.9, 47);
    // the sun sits in the slot between the towers at the head of the avenue
    addFlareAt(game, 52.4 - 6.8 * 24, 46, -6.9 + 5.0 * 24, 30, 0.72, 0xfff2d6);
  }

  // 2-street: downtown junction at golden hour — the shot that has to read as a
  // living city in one frame: traffic, crowd, signals, palms, one cruiser.
  function foot(game) {
    game.city.setNight(false);
    var jx = 120, jz = 0;

    game.player.setPosition(128.2, jz + 6.2, Math.PI * 0.9);
    game.player.yaw = Math.PI * 0.88;
    game.player.heading = Math.PI * 0.88;
    game.player.pitch = 0.02;
    game.player.health = 96;
    game.player.armour = 60;
    game.player.mesh.visible = true;
    game.player.mesh.rotation.y = game.player.heading;
    game.player.mesh.userData.legL.rotation.x = 0.42;
    game.player.mesh.userData.legR.rotation.x = -0.42;
    game.player.mesh.userData.armL.rotation.x = -0.38;
    game.player.mesh.userData.armR.rotation.x = 0.34;
    game.cash = 8420;

    // queue on the avenue, nose to tail, waiting for the light
    stageCar(game, 'taxi', 0xe0b23c, jx + 5.0, 5.4, Math.PI / 2, { speed: 0 });
    stageCar(game, 'sedan', 0x9fb4c4, jx - 1.5, 5.4, Math.PI / 2, { speed: 0 });
    stageCar(game, 'van', 0xd8d2c6, jx - 8.5, 5.4, Math.PI / 2, { speed: 1.5 });
    // rolling the other way, through the box and away
    stageCar(game, 'sedan', 0x2f5f9e, jx - 6.0, -5.4, -Math.PI / 2, { speed: 10 });
    stageCar(game, 'sport', 0xa8432f, jx - 20.0, -5.4, -Math.PI / 2, { speed: 14 });
    // crossing traffic on the north-south street
    stageCar(game, 'pickup', 0x4a5b46, jx - 4.9, jz - 15.0, 0, { speed: 9 });
    stageCar(game, 'taxi', 0xe0b23c, jx + 4.9, jz + 18.0, Math.PI, { speed: 10 });
    // the cruiser sits behind the queue with the bar going
    stageCop(game, jx + 6.0, -5.4, -Math.PI / 2);
    game.police.setWanted(2);

    // crowd on both corners, plus two following the player over the stripes
    placeWalker(game, 0, jx - 6.0, jz + 12.4, Math.PI * 0.95, 1.2, 0.4);
    placeWalker(game, 1, jx - 9.6, jz + 13.0, 0.2, 1.3, 1.3);
    placeWalker(game, 2, jx - 13.4, jz + 12.2, Math.PI * 1.1, 1.15, 2.2);
    placeWalker(game, 3, jx - 8.4, jz + 14.0, 0.6, 0.02, 3.1);
    placeWalker(game, 4, jx - 7.0, jz - 12.6, Math.PI * 0.95, 1.35, 0.9);
    placeWalker(game, 5, jx - 12.8, jz - 13.2, 0.1, 1.25, 1.9);
    placeWalker(game, 6, jx - 2.2, jz - 12.8, Math.PI, 1.3, 2.7);
    placeWalker(game, 7, jx + 5.6, jz + 5.4, Math.PI * 0.86, 1.25, 3.9);
    placeWalker(game, 8, jx + 3.2, jz + 3.4, Math.PI * 0.8, 1.15, 4.6);
    // two more crossing under the camera, so the near lane is not a dead slab
    placeWalker(game, 9, jx + 10.4, jz + 2.0, Math.PI * 0.5, 1.2, 1.1);
    placeWalker(game, 10, jx + 9.0, jz + 0.4, Math.PI * 0.46, 1.15, 3.3);

    stageHydrant(game, jx + 17.6, jz + 11.4);
    stageBin(game, jx + 8.4, jz + 14.2);

    game.missions.objective = 'Cruza la avenida · Centro';
    game.missions.setMarker(new THREE.Vector3(jx - 46, 0, jz + 6.0), 0xffc46b);

    setPose(game, 135.6, 2.55, 12.4, 120.0, 1.15, 1.2, 55);
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
    game.player.setPosition(-335.8, 491.6, Math.PI - 0.03);
    game.player.yaw = Math.PI - 0.03;
    game.player.heading = Math.PI - 0.03;
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
    stageContainer(game, -340.8, 487.4, 0x9c4632, 0.06, 2);
    stageContainer(game, -345.6, 490.6, 0x2f6f73, 0.02, 1);
    stageContainer(game, -346.4, 481.6, 0xa8823a, -0.06, 1);
    stageContainer(game, -331.0, 477.6, 0x4d5f52, 0.1, 1);

    // six rivals in two clusters, all turned towards the player
    var rivals = game.peds.spawnRivals({ x: -336, z: 480 }, 6);
    var spots = [
      [-335.6, 483.4], [-334.4, 481.8], [-337.8, 480.8],
      [-331.2, 483.0], [-329.4, 481.6], [-332.6, 480.4]
    ];
    for (var i = 0; i < rivals.length; i++) {
      var p = rivals[i];
      p.x = spots[i][0];
      p.z = spots[i][1];
      p.heading = Math.atan2(-335.8 - p.x, 491.6 - p.z);
      p.shootTimer = 99;
      p.phase = i * 1.1;
      game.peds.writeMatrices(p, null);
    }

    // a cruiser arrives from the east and slews across the quay, bars lit
    stageCop(game, -324.6, 484.2, -Math.PI / 2 + 0.9);
    stageCop(game, -319.4, 480.2, -Math.PI / 2 + 0.1);
    game.police.setWanted(3);
    addLightPool(game, -323.6, 481.4, 0xff2438, 16, 0.32);
    addLightPool(game, -322.6, 487.2, 0x2f5bff, 14, 0.28);
    addLightPool(game, -318.0, 477.0, 0xff2438, 11, 0.16);
    addLightPool(game, -327.0, 486.0, 0xff2438, 21, 0.26);
    addLightPool(game, -329.2, 481.0, 0x2f5bff, 23, 0.3);

    // dock dressing
    stageCrane(game, -346.0, 474.0, 0.06);
    stageShed(game, -330.0, 467.5, 27, 9, 8.5, 0);
    stageBoat(game, -371.0, 493.0, 0.08, 0xe9e4d6);
    stageBoat(game, -381.0, 472.0, -0.04, 0xcfd8d4);
    stageHydrant(game, -338.4, 495.4);
    stageBin(game, -331.2, 497.0);
    var crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6b44, roughness: 0.85 });
    addProp(game, new THREE.BoxGeometry(1.25, 1.1, 1.05), crateMat, -330.6, 0.58, 496.2, 0.42);
    addProp(game, new THREE.BoxGeometry(0.95, 0.8, 0.9), crateMat, -329.4, 0.44, 497.4, -0.2);
    addProp(game, new THREE.BoxGeometry(1.1, 0.95, 0.95), crateMat, -331.6, 0.5, 497.1, 0.15);
    stageDockLamp(game, -338.6, 486.0, 6.4);
    stageDockLamp(game, -327.2, 478.6, 5.8);

    // concrete apron so the quay reads as a yard, not as beach sand
    var apronTex = BS.Tex.concrete();
    apronTex.repeat.set(24, 17);
    var apron = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 86),
      new THREE.MeshStandardMaterial({ map: apronTex, color: 0x8f908b, roughness: 0.88, metalness: 0.06 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-334.0, 0.04, 487.0);
    apron.receiveShadow = true;
    game.scene.add(apron);
    game.shotExtra.push(apron);

    game.missions.objective = 'Limpia el muelle · 3 rivales';
    game.missions.setMarker(new THREE.Vector3(-336, 0, 474), 0xffc46b);

    if (BS.HUD) {
      BS.HUD.ticker('El Ruso: <b>+$500</b> por cada contenedor asegurado');
      BS.HUD.hideCard();
    }

    setPose(game, -334.2, 2.18, 499.2, -335.8, 1.30, 479.0, 50);
  }

  function addHeadlightCone(game, x, z, dir, len, color, opacity) {
    // dir: +1 along +x, -1 along -x, or a heading in radians
    var rot = (typeof dir === 'number' && Math.abs(dir) > 1.4) ? dir : 0;
    var mat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: color || 0xffe3b0, transparent: true, opacity: opacity || 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(7.4, len || 20), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, 0.075, z);
    game.scene.add(m);
    if (!game.shotExtra) game.shotExtra = [];
    game.shotExtra.push(m);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: color || 0xffe3b0, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    s.scale.set(3.2, 2.0, 1);
    s.position.set(x, 0.85, z);
    game.scene.add(s);
    game.shotExtra.push(s);
    return m;
  }

  function night(game) {
    game.city.setNight(true);
    var car = stageCar(game, 'sport', 0xc2ccd2, 28, -2.2, -Math.PI / 2, { speed: 24 });
    car.wheelSpin = 2.4;
    car.steerVis = 0.06;
    for (var w = 0; w < car.wheels.length; w++) {
      car.wheels[w].rotation.x = 2.4;
      car.wheels[w].rotation.y = 0.06;
    }
    game.player.enterCar(car);
    game.player.pos.set(28, 0, -2.2);
    game.player.health = 74;
    game.player.armour = 30;
    game.cash = 9830;

    stageCop(game, -1.0, 5.2, -Math.PI / 2);
    game.police.setWanted(2);

    // two oncoming cars with their beams washing the wet tarmac toward us
    var onc1 = stageCar(game, 'taxi', 0xe0b23c, 12.0, 4.6, -Math.PI / 2, { speed: 13 });
    var onc2 = stageCar(game, 'sedan', 0x2f5f9e, -21.0, 4.6, -Math.PI / 2, { speed: 15 });
    // and two running away, tail lights streaking
    var away1 = stageCar(game, 'van', 0xdad6cc, 1.0, -4.6, Math.PI / 2, { speed: 11 });
    var away2 = stageCar(game, 'sport', 0xa8432f, -34.0, -4.6, Math.PI / 2, { speed: 17 });
    away1.wheelSpin = 1.8; away2.wheelSpin = 3.1;

    addHeadlightCone(game, 12.0, 4.6, -Math.PI / 2, 22, 0xffe4b4, 0.44);
    addHeadlightCone(game, -21.0, 4.6, -Math.PI / 2, 18, 0xffe4b4, 0.3);
    addHeadlightCone(game, 22.5, -2.2, -Math.PI / 2, 24, 0xffeacb, 0.5);
    addLightStreak(game, 6.5, -4.2, 0, 11, 2.6, 0xff2f24, 0.34);
    addLightStreak(game, -28.5, -4.2, 0, 13, 2.4, 0xff2f24, 0.3);
    addLightStreak(game, 34.0, -2.2, 0, 12, 2.8, 0xff3b2e, 0.4);
    // wet sheen: long coloured smears the signs and tail lights leave on the tarmac
    addLightStreak(game, 6.0, -7.4, 0, 40, 9.0, 0xff3fa4, 0.14);
    addLightStreak(game, -2.0, 6.4, 0, 44, 10.0, 0x35e6ff, 0.1);
    addLightStreak(game, -24.0, 0.0, 0, 52, 12.0, 0xffb347, 0.08);
    addLightStreak(game, 34.5, 3.4, 0, 12, 2.4, 0xff3fa4, 0.16);
    addLightStreak(game, 28.6, -2.2, 0, 9, 1.7, 0xff3b2e, 0.42);
    addLightStreak(game, 25.0, -6.2, 0, 14, 3.2, 0xffd9a0, 0.26);
    addLightStreak(game, 12.0, 4.6, 0, 15, 2.6, 0xfff0d0, 0.24);
    addLightStreak(game, -2.0, 4.2, 0, 20, 2.2, 0xffe6c0, 0.22);

    // neon facing the camera, plus shop glow
    addNeonPlane(game, -8, 17, -24, 'HOTEL', 0xff3fa4, 17, Math.PI / 2);
    addNeonPlane(game, -2, 8.5, 23, 'CLUB', 0x35e6ff, 12, Math.PI / 2);
    addNeonPlane(game, -66, 24, -25, 'SOL', 0xffb347, 15, Math.PI / 2);
    addNeonPlane(game, -58, 10, 22, '24H', 0xb6ff5a, 9, Math.PI / 2);
    addNeonPlane(game, -124, 19, -24, 'RADIO', 0x8f7dff, 16, Math.PI / 2);
    addNeonPlane(game, -118, 9, 21, 'MAR', 0x35e6ff, 10, Math.PI / 2);
    // a near sign so the foreground crowd stands in coloured light
    addNeonPlane(game, 31, 11.5, 20.5, 'BAR', 0xffb347, 8.5, Math.PI / 2);

    addLightPool(game, -6, -6, 0xff3fa4, 26, 0.3);
    addLightPool(game, -60, 6, 0xffb347, 22, 0.24);
    addLightPool(game, 30, 8, 0xffb347, 24, 0.34);
    addLightPool(game, 29, -2.2, 0xffd9a0, 18, 0.4);
    addLightPool(game, 12, 4.6, 0xffe0b0, 20, 0.3);
    addLightPool(game, -21, 4.6, 0xffe0b0, 16, 0.22);
    addLightPool(game, -1.0, 5.2, 0xff2438, 15, 0.26);
    addLightPool(game, -1.0, 1.0, 0x2f5bff, 13, 0.22);

    var carLamp = new THREE.PointLight(0xffd2a0, 2.2, 22, 1.5);
    carLamp.position.set(26, 5.2, -2.2);
    game.scene.add(carLamp);
    game.shotExtra.push(carLamp);

    var spot = new THREE.SpotLight(0xffe0b0, 2.6, 64, 0.6, 0.72, 1.4);
    spot.position.set(24.6, 1.05, -2.2);
    spot.target.position.set(-26, 0, -2.2);
    game.scene.add(spot);
    game.scene.add(spot.target);
    game.shotHeadlight = spot;

    game.missions.objective = 'Sin trabajo activo — la ciudad respira';
    game.missions.setMarker(new THREE.Vector3(-120, 0, 60), 0xffc46b);

    // two under the BAR sign, two further down the block
    placeWalker(game, 0, 26.5, 4.0, Math.PI * 1.3, 1.15, 0.6);
    placeWalker(game, 1, 27.6, 2.4, Math.PI * 0.22, 1.25, 2.2);
    placeWalker(game, 2, -6.0, 12.4, Math.PI, 1.2, 3.4);
    placeWalker(game, 3, -40.0, -12.6, 0, 1.3, 0.9);
    placeWalker(game, 4, 8.0, 12.8, Math.PI, 1.2, 4.2);

    setPose(game, 38.0, 2.15, 3.2, -60.0, 8.2, -3.0, 56);
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
        var from = new THREE.Vector3(-335.4, 1.34, 490.8);
        var to = new THREE.Vector3(-336.4, 1.22, 483.6);
        if (Math.sin(t * 21) > -0.2) {
          BS.Fx.muzzle(from, to);
          BS.Fx.tracer(from, to, 0xffe0a0);
        }
        if (Math.sin(t * 7) > 0.62) {
          BS.Fx.tracer(from, new THREE.Vector3(-331.2, 1.2, 483.0), 0xffd28a);
          BS.Fx.spark(-336.4, 1.24, 483.6);
          BS.Fx.spark(-334.4, 1.18, 481.8);
        }
        if (BS.HUD && BS.HUD.damageEl) BS.HUD.damageEl.style.opacity = '0.3';
        for (var r = 0; r < 3; r++) {
          if (Math.sin(t * 9 + r * 2) > 0.55) {
            var rf = new THREE.Vector3(-335.2 + r * 2.2, 1.32, 482.0 - r * 1.1);
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
