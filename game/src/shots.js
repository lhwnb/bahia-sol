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

  // scene staging lives in scenes.js; this file supplies the kit

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
      if (BS.Scenes && BS.Scenes[name]) BS.Scenes[name](game);
      else if (BS.Scenes) BS.Scenes.cover(game);
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
      if (name === 'foot' || name === 'cover' || name === 'night') {
        for (var p = 0; p < game.peds.peds.length; p++) {
          var ped = game.peds.peds[p];
          if (!ped.alive) continue;
          ped.phase += 0.07;
          game.peds.writeMatrices(ped, null);
        }
      }
      // muzzle flash, tracers and return fire belong to the scene file
      if (BS.Scenes && BS.Scenes.tick) BS.Scenes.tick(name, game, t);
      // keep the stage camera locked; shot mode has no mouse
      game.camera.position.copy(game.shotPose.pos);
      game.camera.lookAt(game.shotPose.look);
      game.camera.fov = game.shotPose.fov;
      game.camera.updateProjectionMatrix();
    }
  };

  // the staging kit is shared with scenes.js: shots.js knows how to put a car,
  // a cop or a container in the world, scenes.js knows what the photo needs.
  Shots.kit = {
    stageCar: stageCar, stageCop: stageCop, clearDynamic: clearDynamic,
    placeWalker: placeWalker, addNeonPlane: addNeonPlane, addLightPool: addLightPool,
    addProp: addProp, stageContainer: stageContainer, stageCrane: stageCrane,
    stageShed: stageShed, stageBoat: stageBoat, stageBin: stageBin,
    stageHydrant: stageHydrant, setPose: setPose, resetExtras: resetExtras,
    addFlareAt: addFlareAt, addSunFlare: addSunFlare, addLightStreak: addLightStreak
  };

  BS.Shots = Shots;
})(window.BS);
