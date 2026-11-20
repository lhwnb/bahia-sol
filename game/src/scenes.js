// scenes.js — the four scripted photographs. shots.js owns the staging kit
// (car/cop/prop helpers, the pose lock, per-frame extras) and scenes.js owns
// composition: which district, which light rig, who stands where, what the
// camera sees. One scene per screenshot, no shared state between them.
(function (BS) {
  'use strict';

  var CFG = BS.CFG;
  var K = null;            // BS.Shots.kit — resolved on first use (script order)
  var propRng = null;

  function kit() {
    if (!K) K = BS.Shots.kit;
    return K;
  }
  function rng() {
    if (!propRng) propRng = BS.makeRng(31337);
    return propRng;
  }

  // ------------------------------------------------------------------ light
  // Every frame gets its own sun. The rig drives the dome, the sprite, the
  // directional light, fog and exposure together, because a golden-hour shot
  // built out of a noon sky always reads as a mock-up.
  function setRig(game, o) {
    var city = game.city;
    var dir = new THREE.Vector3(o.sun[0], o.sun[1], o.sun[2]).normalize();
    CFG.sun.dir.copy(dir);

    if (city.sunLight) {
      city.sunLight.color.setHex(o.sunColor);
      city.sunLight.intensity = o.sunI;
    }
    if (city.skyUniforms) {
      city.skyUniforms.uSunDir.value.copy(dir);
      city.skyUniforms.uTop.value.setHex(o.top);
      city.skyUniforms.uHorizon.value.setHex(o.horizon);
      city.skyUniforms.uSun.value.setHex(o.sunColor);
      city.skyUniforms.uNight.value = o.night ? 1 : 0;
    }
    if (city.sunSprite) {
      city.sunSprite.position.copy(dir).multiplyScalar(2400);
      city.sunSprite.material.color.setHex(o.sunColor);
      city.sunSprite.scale.setScalar(o.sunSize || 200);
      city.sunSprite.visible = o.sunVisible !== false;
      if (city.sunFlare) {
        city.sunFlare.position.copy(city.sunSprite.position);
        city.sunFlare.material.opacity = o.flare === undefined ? 0.5 : o.flare;
        city.sunFlare.visible = o.sunVisible !== false;
      }
    }
    if (city.hemi) {
      city.hemi.color.setHex(o.sky === undefined ? 0xc4dcf2 : o.sky);
      city.hemi.groundColor.setHex(o.bounce === undefined ? 0xd8b184 : o.bounce);
      city.hemi.intensity = o.hemi === undefined ? 1.1 : o.hemi;
    }
    if (city.ambient) {
      city.ambient.color.setHex(o.amb === undefined ? 0xffe6c8 : o.amb);
      city.ambient.intensity = o.ambI === undefined ? 0.3 : o.ambI;
    }
    if (city.moon) city.moon.intensity = o.moon || 0;
    if (game.scene.fog) {
      game.scene.fog.color.setHex(o.fog);
      game.scene.fog.density = o.fogD;
    }
    if (game.renderer) game.renderer.toneMappingExposure = o.exposure || 1.12;
    if (BS.Env && o.env) BS.Env.apply(game.scene, o.env);
    if (o.wet) wetGround(game, o.wet);
  }

  // Wet tarmac without an env map: dark and smooth picks up the point lights
  // and the additive smears as a stretched sheen instead of a flat grey.
  function wetGround(game, amount) {
    var g = game.city.ground;
    if (!g || !g.material) return;
    var m = g.material.clone();
    m.color.multiplyScalar(1 - 0.72 * amount);
    m.roughness = 0.86 - 0.6 * amount;
    m.metalness = 0.05 + 0.25 * amount;
    m.needsUpdate = true;
    g.material = m;
  }

  // ------------------------------------------------------------------ props
  function add(game, mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    game.scene.add(mesh);
    game.shotExtra.push(mesh);
    return mesh;
  }

  function boxMat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough === undefined ? 0.7 : rough, metalness: metal || 0.1
    });
  }

  function slab(game, w, h, d, x, y, z, color, ry, rough, metal) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat(color, rough, metal));
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    return add(game, m);
  }

  // A glass tower with a real curtain wall, a setback crown and rooftop
  // clutter: the downtown frames need vertical mass, not one more grey box.
  function tower(game, x, z, w, d, h, tint, style, opts) {
    opts = opts || {};
    var geo = new THREE.BoxGeometry(w, h, d);
    BS.Geo.scaleBoxUV(geo, w, h, d, opts.tile || 17, opts.tileY || 23);
    var skin = BS.Tex.facadeGlass(tint, style || 'grid');
    var mat = new THREE.MeshStandardMaterial({
      map: skin.map, emissiveMap: skin.emissive, emissive: 0xffffff, emissiveIntensity: 0.05,
      roughness: 0.24, metalness: 0.5, color: 0xf2f6fa
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.3 + h / 2, z);
    add(game, m);

    // spandrel bands so the wall is not a single flat sheet at close range
    var bandMat = boxMat(opts.band || 0x2b3138, 0.5, 0.45);
    var bands = Math.min(9, Math.max(3, Math.round(h / 14)));
    for (var i = 1; i < bands; i++) {
      var y = 0.3 + (h / bands) * i;
      var b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.42, d + 0.5), bandMat);
      b.position.set(x, y, z);
      add(game, b);
    }
    // crown: a smaller box on top plus a mast, the silhouette every skyline needs
    var cw = w * 0.62, cd = d * 0.62, ch = h * 0.09 + 3;
    var crownSkin = BS.Tex.facadeGlass(tint, 'bands');
    var crown = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd),
      new THREE.MeshStandardMaterial({
        map: crownSkin.map, emissiveMap: crownSkin.emissive, emissive: 0xffffff,
        emissiveIntensity: 0.05, roughness: 0.3, metalness: 0.45, color: 0xe8eef4
      }));
    crown.position.set(x, 0.3 + h + ch / 2, z);
    add(game, crown);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 12, 6),
      boxMat(0x9aa0a6, 0.5, 0.6));
    mast.position.set(x, 0.3 + h + ch + 6, z);
    add(game, mast);

    if (opts.gear !== false) {
      var gear = [];
      var gx = x + (opts.gearX || 0), gz = z + (opts.gearZ || 0);
      gear.push(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), boxMat(0x6b7178, 0.8, 0.2)));
      gear[0].position.set(gx - w * 0.22, 0.3 + h + 1.3, gz + d * 0.18);
      gear.push(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.2), boxMat(0x767c82, 0.8, 0.2)));
      gear[1].position.set(gx + w * 0.2, 0.3 + h + 0.9, gz - d * 0.2);
      var tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 10), boxMat(0x8b8378, 0.9, 0.1));
      tank.position.set(gx + w * 0.1, 0.3 + h + 1.2, gz + d * 0.24);
      for (var q = 0; q < gear.length; q++) add(game, gear[q]);
      add(game, tank);
    }
    return m;
  }

  function billboard(game, x, y, z, w, ry, index) {
    var h = w * 0.52;
    var face = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map: BS.Tex.billboard(index), emissive: 0xffffff, emissiveMap: BS.Tex.billboard(index),
        emissiveIntensity: 0.55, roughness: 0.7, metalness: 0.05
      }));
    face.position.set(x, y, z);
    face.rotation.y = ry;
    add(game, face);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, h + 1.4, 0.5), boxMat(0x24282d, 0.7, 0.4));
    frame.position.set(x - Math.sin(ry) * 0.4, y, z - Math.cos(ry) * 0.4);
    frame.rotation.y = ry;
    add(game, frame);
    return face;
  }

  function palm(game, x, z, h, ry, scale) {
    var v = BS.City.makePalmVariant(rng(), h).clone(true);
    v.position.set(x, 0.3, z);
    v.rotation.y = ry === undefined ? rng().angle() : ry;
    var s = scale || rng().float(0.9, 1.15);
    v.scale.set(s, s, s);
    game.scene.add(v);
    game.shotExtra.push(v);
    return v;
  }

  function umbrella(game, x, z, color, scale) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 6), boxMat(0xcfc7b6, 0.8));
    pole.position.set(x, 1.15, z);
    add(game, pole);
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.62, 8),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.85, side: THREE.DoubleSide }));
    canopy.position.set(x, 2.36, z);
    canopy.scale.y = 0.9;
    if (scale) canopy.scale.x = canopy.scale.z = scale;
    return add(game, canopy);
  }

  function sunbed(game, x, z, ry, color) {
    var g = new THREE.Group();
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 1.95), boxMat(0xd8d2c4, 0.7, 0.2));
    frame.position.y = 0.42;
    var pad = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 1.55), boxMat(color, 0.9));
    pad.position.set(0, 0.5, 0.1);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.85), boxMat(color, 0.9));
    back.position.set(0, 0.62, -0.92);
    back.rotation.x = -0.42;
    g.add(frame, pad, back);
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    game.scene.add(g);
    game.shotExtra.push(g);
    return g;
  }

  function lifeguard(game, x, z, ry) {
    var g = new THREE.Group();
    for (var i = 0; i < 4; i++) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), boxMat(0xefe9dc, 0.85));
      leg.position.set(i % 2 ? 1.5 : -1.5, 1.3, i < 2 ? 1.3 : -1.3);
      g.add(leg);
    }
    var deck = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 4.0), boxMat(0xe6dfd0, 0.85));
    deck.position.y = 2.7;
    g.add(deck);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.9, 3.0), boxMat(0xf2ece0, 0.8));
    cab.position.y = 3.8;
    g.add(cab);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 0.85, 4), boxMat(0xd2452f, 0.85));
    roof.position.y = 5.2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.1), boxMat(0x2b4356, 0.3, 0.4));
    glass.position.set(0, 4.0, 1.52);
    g.add(glass);
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    game.scene.add(g);
    game.shotExtra.push(g);
    return g;
  }

  function lamp(game, x, z, h, color) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, h, 6), boxMat(0x2f353b, 0.6, 0.5));
    pole.position.set(x, h / 2, z);
    add(game, pole);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.5),
      new THREE.MeshBasicMaterial({ color: color || 0xffd9a4, toneMapped: false }));
    head.position.set(x, h, z);
    add(game, head);
    var light = new THREE.PointLight(color || 0xffc98a, 2.2, 26, 1.6);
    light.position.set(x, h - 0.2, z);
    game.scene.add(light);
    game.shotExtra.push(light);
  }

  function cone(game, x, z, rot, len, color, opacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: color || 0xffe3b0, transparent: true, opacity: opacity || 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(7.2, len || 22), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = rot || 0;
    plane.position.set(x, 0.08, z);
    game.scene.add(plane);
    game.shotExtra.push(plane);
    return plane;
  }

  // Neon spill on wet asphalt: a stretched additive smear that runs from the
  // base of a sign towards the camera, so the road reflects instead of glowing.
  function spill(game, x, z, ry, len, wid, color, opacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: color, transparent: true, opacity: opacity || 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = ry;
    m.position.set(x, 0.075, z);
    game.scene.add(m);
    game.shotExtra.push(m);
    return m;
  }

  // Standing water: a low-roughness patch that mirrors the environment map
  // instead of glowing, so the tarmac reads as wet rather than as a light box.
  function puddle(game, x, z, w, d) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x0a0f18, roughness: 0.08, metalness: 0.95, envMapIntensity: 1.5
      }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.056, z);
    game.scene.add(m);
    game.shotExtra.push(m);
    return m;
  }

  function darkOverlay(game, y, w, d, x, z, opacity) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: opacity || 0.2, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    game.scene.add(m);
    game.shotExtra.push(m);
    return m;
  }

  // A street vendor: counter, striped canopy, price board. Small prop, but it
  // is the thing that turns a sidewalk into a place where people live.
  function kiosk(game, x, z, ry, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 1.5), boxMat(0xe8dfcc, 0.8, 0.05));
    body.position.y = 0.78;
    g.add(body);
    var top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.14, 1.8), boxMat(0xbcae95, 0.7, 0.15));
    top.position.y = 1.34;
    g.add(top);
    var steel = boxMat(0x7d837f, 0.5, 0.55);
    for (var i = 0; i < 4; i++) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.32, 5), steel);
      post.position.set(i % 2 ? 1.34 : -1.34, 1.16, i < 2 ? 0.82 : -0.82);
      g.add(post);
    }
    var canopy = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.1, 2.15), boxMat(color || 0xd8544a, 0.85));
    canopy.position.y = 2.36;
    g.add(canopy);
    for (var s = 0; s < 5; s++) {
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.115, 2.17), boxMat(0xf6efe2, 0.85));
      stripe.position.set(-1.28 + s * 0.64, 2.355, 0);
      g.add(stripe);
    }
    var board = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.06), boxMat(0x252b31, 0.85));
    board.position.set(0.92, 1.78, 0.8);
    g.add(board);
    var tray = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.5), boxMat(0xc75a2a, 0.9));
    tray.position.set(-0.4, 1.48, 0.42);
    g.add(tray);
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    game.scene.add(g);
    game.shotExtra.push(g);
    return g;
  }

  // Striped awning over a shop door: cheap, and it gives the pavement a ceiling.
  function awning(game, x, z, w, ry, color) {
    var g = new THREE.Group();
    var cloth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 2.3), boxMat(color || 0xc4443a, 0.9));
    cloth.position.set(0, 3.0, 1.15);
    cloth.rotation.x = 0.16;
    g.add(cloth);
    for (var s = 0; s < Math.round(w / 0.9); s++) {
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 2.32), boxMat(0xf2ead8, 0.9));
      stripe.position.set(-w / 2 + 0.45 + s * 0.9, 3.005, 1.15);
      stripe.rotation.x = 0.16;
      g.add(stripe);
    }
    var valance = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, 0.06), boxMat(color || 0xc4443a, 0.9));
    valance.position.set(0, 2.72, 2.3);
    g.add(valance);
    var lit = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 1.85, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2a1c12, emissive: 0xffb264, emissiveIntensity: 0.3, roughness: 0.8 }));
    lit.position.set(0, 1.0, 0.08);
    g.add(lit);
    // a warm strip under the cloth so the shopfront reads as lit, not painted on
    var strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffc07a, transparent: true, opacity: 0.32, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 2.86, 1.5);
    g.add(strip);
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    game.scene.add(g);
    game.shotExtra.push(g);
    return g;
  }

  // City bus. Long box, band of glass, livery stripe: at 20 m it reads instantly
  // and it is the one silhouette the traffic set was missing.
  function cityBus(game, x, z, ry, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.56, 2.3, 11.4), boxMat(color || 0x8fa8a0, 0.55, 0.28));
    body.position.y = 1.66;
    g.add(body);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 11.2), boxMat(0xdad9d2, 0.7, 0.2));
    roof.position.y = 2.93;
    g.add(roof);
    var glass = new THREE.MeshStandardMaterial({ color: 0x1b2830, roughness: 0.16, metalness: 0.62 });
    for (var s = -1; s <= 1; s += 2) {
      var band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.98, 10.3), glass);
      band.position.set(s * 1.3, 2.16, -0.2);
      g.add(band);
    }
    var windscreen = new THREE.Mesh(new THREE.BoxGeometry(2.32, 1.24, 0.08), glass);
    windscreen.position.set(0, 2.08, 5.72);
    g.add(windscreen);
    var sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xffc245, toneMapped: false }));
    sign.position.set(0, 2.76, 5.75);
    g.add(sign);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 11.42), boxMat(0xd8544a, 0.6, 0.2));
    stripe.position.y = 1.34;
    g.add(stripe);
    var tyre = boxMat(0x15171a, 0.85);
    for (var i = 0; i < 4; i++) {
      var tyreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 12), tyre);
      tyreMesh.rotation.z = Math.PI / 2;
      tyreMesh.position.set(i % 2 ? 1.24 : -1.24, 0.52, i < 2 ? 3.6 : -3.5);
      g.add(tyreMesh);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    game.scene.add(g);
    game.shotExtra.push(g);
    return g;
  }

  // ------------------------------------------------------------------ cover
  // 1-cover — Playa Sol boulevard, golden hour. Camera stands in the parking
  // lane looking west into the sun: the pier and its ferris wheel close the
  // vanishing point, palms rake the road, the sea and the beach kit hold the
  // left third, the hotel row and downtown hold the right.
  function cover(game) {
    game.city.setNight(false);
    setRig(game, {
      sun: [-0.95, 0.19, 0.1], sunColor: 0xffc286, sunI: 2.1, sunSize: 220, flare: 0.42,
      top: 0x3576b4, horizon: 0xf7c093, fog: 0xefbe95, fogD: 0.00082,
      hemi: 1.05, sky: 0xc2d9ee, bounce: 0xe8b87c, amb: 0xffd9b2, ambI: 0.34,
      exposure: 0.94, env: 'golden'
    });

    // La Roja, eight metres off the lens, rear quarter into the sun
    var hero = kit().stageCar(game, 'falcon', 0xb51f2a, -113.0, 482.4, -0.35, { speed: 16 });
    hero.mission = true;
    hero.name = 'La Roja';
    hero.braking = true;
    hero.wheelSpin = 2.6;
    for (var w = 0; w < hero.wheels.length; w++) hero.wheels[w].rotation.x = 2.6;
    if (hero.body && hero.body.material) {
      hero.body.material.roughness = 0.26;
      hero.body.material.metalness = 0.58;
      hero.body.material.envMapIntensity = 1.6;
    }
    game.player.enterCar(hero);
    game.player.pos.set(-113.0, 0, 482.4);
    game.player.health = 76;
    game.player.armour = 38;
    game.cash = 12450;

    // the pursuit fills the north half of the boulevard, bars lit
    kit().stageCop(game, -106.0, 475.0, Math.PI / 2 + 0.12);
    kit().stageCop(game, -96.5, 473.4, Math.PI / 2 - 0.06);
    kit().stageCop(game, -78.0, 471.6, Math.PI / 2 + 1.24);
    game.police.setWanted(4);

    // traffic further down the road so the boulevard keeps running
    kit().stageCar(game, 'taxi', 0xe0b23c, -62.0, 484.4, -Math.PI / 2, { speed: 13 });
    kit().stageCar(game, 'van', 0xe8e4da, -80.0, 471.4, Math.PI / 2, { speed: 11 });
    kit().stageCar(game, 'sedan', 0x2f5f9e, -104.0, 486.4, -Math.PI / 2, { speed: 14 });
    kit().stageCar(game, 'van', 0xd9d3c4, -140.0, 487.8, -Math.PI / 2, { speed: 0 });
    kit().stageCar(game, 'sport', 0x1f3b52, -42.0, 481.2, -Math.PI / 2, { speed: 17 });

    // beach kit on the right: the half of the frame that says seaside
    lifeguard(game, -96.0, 512.0, 0.1);
    for (var u = 0; u < 8; u++) {
      umbrella(game, -124.0 + u * 7.4 + rng().float(-1.4, 1.4), 499.0 + (u % 3) * 6.2,
        [0xe0604c, 0xf2efe4, 0x2f8f9a, 0xe8b93c, 0xd8544a][u % 5], 1.12);
    }
    for (var b = 0; b < 9; b++) {
      sunbed(game, -120.0 + b * 6.2, 508.5 + (b % 2) * 2.8, 0.04,
        [0xe0604c, 0x2f8f9a, 0xe8b93c, 0xf2efe4][b % 4]);
    }

    // promenade: palms raking the light, kerb furniture inside the near ring
    palm(game, -98.0, 493.4, 9.8, 0.5, 1.08);
    palm(game, -80.0, 493.0, 8.6, 1.3, 1.0);
    palm(game, -62.0, 493.6, 10.4, 2.2, 1.05);
    palm(game, -44.0, 493.2, 10.8, 0.7, 1.12);
    kit().stageBin(game, -108.4, 490.6);
    kit().stageHydrant(game, -117.0, 489.6);
    kiosk(game, -95.0, 491.6, 0.42, 0xd8544a);
    kit().stageBin(game, -85.0, 491.0);
    // near-ring detail: paving joints, a bench, a parked car half out of frame
    var kerbMat = boxMat(0x8f8a7e, 0.9);
    for (var k = 0; k < 7; k++) {
      var kk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 5.4), kerbMat);
      kk.position.set(-118.0 + k * 2.4, 0.36, 491.6);
      add(game, kk);
    }
    var bench = new THREE.Group();
    var bseat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.52), boxMat(0xa07a4c, 0.85));
    bseat.position.y = 0.46;
    bench.add(bseat);
    var bback = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.1), boxMat(0xa07a4c, 0.85));
    bback.position.set(0, 0.72, -0.22);
    bench.add(bback);
    for (var lg = 0; lg < 2; lg++) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.46, 0.46), boxMat(0x2b2f33, 0.5, 0.6));
      leg.position.set(-0.8 + lg * 1.6, 0.23, 0);
      bench.add(leg);
    }
    bench.position.set(-100.0, 0.3, 493.2);
    bench.rotation.y = 0.02;
    bench.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    game.scene.add(bench);
    game.shotExtra.push(bench);

    // people: a couple at the kerb, two out on the sand, one at the vendor
    kit().placeWalker(game, 0, -110.4, 492.6, Math.PI * 0.95, 1.2, 0.4);
    kit().placeWalker(game, 1, -109.0, 493.8, Math.PI * 1.08, 0.03, 1.7);
    kit().placeWalker(game, 2, -97.4, 490.9, -1.4, 1.15, 2.5);
    kit().placeWalker(game, 3, -101.0, 502.0, 1.35, 1.1, 3.2);
    kit().placeWalker(game, 4, -87.0, 505.0, 0.25, 1.25, 4.4);
    kit().placeWalker(game, 5, -77.0, 491.4, -1.45, 1.2, 5.1);
    kit().placeWalker(game, 6, -63.0, 490.8, 1.4, 1.18, 2.9);

    // light on the tarmac: sun streak plus the bars from the cruisers
    spill(game, -84.0, 482.0, Math.PI / 2, 160, 16, 0xffb066, 0.14);
    spill(game, -100.0, 476.4, Math.PI / 2, 24, 9, 0xff2438, 0.26);
    spill(game, -89.0, 475.2, Math.PI / 2, 22, 9, 0x2f5bff, 0.24);
    kit().addFlareAt(game, -40.0, 6.0, 520.0, 40, 0.4, 0xffd9a8);

    game.missions.objective = 'Lleva La Roja al Muelle 4 · 2:14';
    game.missions.setMarker(new THREE.Vector3(-40, 0, 470), 0xffc46b);
    if (BS.HUD) {
      BS.HUD.hideCard();
      BS.HUD.ticker('Rafa Vela: <b>La Roja</b> no se toca — llévala al muelle');
    }
    game.combat.weapon = 'pistol';
    game.combat.ammo.pistol = 12;

    kit().setPose(game, -120.5, 1.72, 485.6, -58.0, 3.2, 493.0, 57);
  }

  // ------------------------------------------------------------------- foot
  // 2-street — downtown canyon at midday. High sun, one wall of glass lit, the
  // other in shade, traffic both ways and a crowd on the stripes.
  function foot(game) {
    game.city.setNight(false);
    setRig(game, {
      sun: [0.46, 0.83, -0.31], sunColor: 0xfff4e2, sunI: 3.2, sunSize: 120, flare: 0.14,
      top: 0x2d74b4, horizon: 0xd2dded, fog: 0xc9d6e4, fogD: 0.00078,
      hemi: 1.2, sky: 0xd6e6f6, bounce: 0xaba79d, amb: 0xe8f0ff, ambI: 0.4,
      exposure: 1.0, env: 'day'
    });

    // the canyon walls: staged towers on both corners of the junction, so the
    // street reads as a slot between glass instead of a wide open plain
    tower(game, 108.0, 62.0, 46, 44, 132, 0x9fc4d2, 'curtain', { gearX: 6 });
    tower(game, 108.0, -64.0, 44, 46, 156, 0x7c9aa8, 'fins', { gearX: -4 });
    tower(game, 62.0, 64.0, 40, 42, 96, 0xb9cdd6, 'bands');
    tower(game, 62.0, -62.0, 42, 40, 118, 0x8fb0c4, 'grid');
    tower(game, 16.0, 66.0, 38, 40, 74, 0xc3b39a, 'louvre');
    billboard(game, 96.0, 27.0, 40.4, 20, 0, 3);
    billboard(game, 76.0, 22.0, -40.4, 17, Math.PI, 1);
    // shopfront awnings on the far side of the junction, not over the lens
    awning(game, 74.0, -15.2, 8.0, 0, 0xc4443a);
    awning(game, 86.0, -15.2, 7.0, 0, 0x2f7f8a);

    // traffic queued at the light: fronts toward the lens, a bus crossing west
    kit().stageCar(game, 'taxi', 0xe0b23c, 134.0, 5.4, -Math.PI / 2, { speed: 0 });
    kit().stageCar(game, 'sedan', 0x9fb4c4, 128.0, 5.4, -Math.PI / 2, { speed: 0 });
    kit().stageCar(game, 'sport', 0xa8432f, 122.0, 5.4, -Math.PI / 2, { speed: 2.5 });
    kit().stageCar(game, 'pickup', 0x4c5b46, 100.0, -5.4, Math.PI / 2, { speed: 13 });
    kit().stageCar(game, 'sedan', 0x2f5f9e, 150.0, -5.4, Math.PI / 2, { speed: 11 });
    cityBus(game, 108.0, -5.4, Math.PI / 2, 0x8fa8a0);
    kit().stageCar(game, 'pickup', 0x8a6a44, 113.6, -22.0, 0, { speed: 10 });
    kit().stageCar(game, 'taxi', 0xe0b23c, 126.4, 24.0, Math.PI, { speed: 11 });
    kit().stageCop(game, 112.0, -5.4, Math.PI / 2);
    game.police.setWanted(2);

    // the crowd: half of them on the stripes, the rest on the near corner
    var crowd = [
      [126.0, 11.0, Math.PI * 0.98], [124.4, 8.0, 0.1], [122.6, 4.5, Math.PI],
      [123.4, 1.0, 0.05], [121.0, -3.0, Math.PI * 1.02], [124.0, -7.5, 0.0],
      [118.0, 10.5, Math.PI * 0.5], [116.6, 6.0, Math.PI * 0.48],
      [130.0, 12.4, Math.PI * 1.05], [127.0, 13.4, 0.2],
      [108.0, 12.0, Math.PI], [104.0, -12.4, 0.1],
      [96.0, 12.6, Math.PI * 1.1], [92.0, -12.0, 0.2],
      [110.0, 13.0, Math.PI * 0.9], [86.0, 12.4, Math.PI]
    ];
    for (var i = 0; i < crowd.length; i++) {
      kit().placeWalker(game, i, crowd[i][0], crowd[i][1], crowd[i][2],
        1.05 + (i % 3) * 0.12, rng().float(0, 6.2));
    }
    // vendor cart under the awning, plus the kerb furniture in the near ring
    kiosk(game, 122.0, 13.6, Math.PI * 0.92, 0x2f7f8a);
    kit().stageHydrant(game, 141.6, 13.9);
    kit().stageBin(game, 133.6, 13.9);
    kit().stageBin(game, 118.0, 13.6);
    lamp(game, 134.0, 13.4, 7.6, 0xdfe9f2);
    lamp(game, 100.0, -13.2, 7.2, 0xdfe9f2);

    game.player.setPosition(140.6, 10.4, -2.05);
    game.player.heading = -1.2;
    game.player.yaw = -1.2;
    game.player.mesh.rotation.y = -1.2;
    game.cash = 8640;
    game.missions.objective = 'Recoge el paquete en el cruce · Centro';
    game.missions.setMarker(new THREE.Vector3(102, 0, 6), 0xffc46b);
    if (BS.HUD) {
      BS.HUD.hideCard();
      BS.HUD.ticker('Radio Centro: tráfico denso en la avenida, usa las calles laterales');
    }
    game.combat.weapon = 'smg';
    game.combat.ammo.smg = 30;

    kit().setPose(game, 147.0, 2.05, 12.8, 108.0, 3.6, -1.8, 56);
  }

  // ---------------------------------------------------------------- mission
  // 3-mission — Puerto Norte at dusk. Containers hold the foreground, the
  // gantry and the moored ship close the frame, the player fires from behind
  // steel and a cruiser slides in with the bar lit.
  function mission(game) {
    game.city.setNight(false);
    setRig(game, {
      sun: [-0.86, 0.26, 0.44], sunColor: 0xffb070, sunI: 3.1, sunSize: 240, flare: 0.36,
      top: 0x35608f, horizon: 0xf6c49b, fog: 0xa89aa0, fogD: 0.00078,
      hemi: 1.25, sky: 0xa8bcd6, bounce: 0x9a7a5e, amb: 0xffcba0, ambI: 0.62,
      exposure: 1.06, env: 'dusk', wet: 0.3
    });

    if (game.city.ground && game.city.ground.material) {
      game.city.ground.material.color.setHex(0x55524d);
      game.city.ground.material.roughness = 0.72;
      game.city.ground.material.metalness = 0.2;
    }

    // the player, shoulder into the corridor, pistol up and firing east
    game.player.setPosition(441.0, -474.8, -Math.PI / 2 + 0.10);
    game.player.heading = -Math.PI / 2 + 0.10;
    game.player.yaw = -Math.PI / 2 + 0.10;
    game.player.mesh.visible = true;
    game.player.mesh.rotation.y = game.player.heading;
    game.player.weaponDrawn = true;
    if (game.player.mesh.userData.gun) game.player.mesh.userData.gun.visible = true;
    if (game.player.mesh.userData.armR) game.player.mesh.userData.armR.rotation.x = -1.52;
    if (game.player.mesh.userData.armL) game.player.mesh.userData.armL.rotation.x = -1.05;
    if (game.player.mesh.userData.legL) game.player.mesh.userData.legL.rotation.x = -0.26;
    if (game.player.mesh.userData.legR) game.player.mesh.userData.legR.rotation.x = 0.18;
    game.player.health = 44;
    game.player.armour = 16;
    game.player.dead = false;
    game.cash = 6720;
    game.combat.weapon = 'pistol';
    game.combat.ammo.pistol = 9;

    // the corridor: two walls of stacked steel along the quay road, four liveries
    var yardCols = [0xb5443a, 0x2f6f7a, 0xc9902e, 0x4c6b52];
    for (var s = 0; s < 7; s++) {
      kit().stageContainer(game, 441.0 + s * 7.2, -472.8, yardCols[s % 4], (s % 2 ? 0.02 : -0.02), s < 2 ? 1 : 2 + (s % 2));
      kit().stageContainer(game, 444.0 + s * 7.2, -487.2, yardCols[(s + 2) % 4], (s % 2 ? -0.02 : 0.02), s < 2 ? 1 : 2 + ((s + 1) % 2));
    }
    // tall stacks set back so the corridor reads deep without roofing the lens
    for (var t = 0; t < 4; t++) {
      kit().stageContainer(game, 462.0 + t * 13.0, -487.2, yardCols[(t + 1) % 4], 0.01, 3);
    }
    kit().stageContainer(game, 468.0, -472.8, 0xb5443a, 0.02, 3);

    // the deck: painted quay lines, tyre scuff, standing water
    var lineMat = boxMat(0xc2a052, 0.92);
    for (var q = 0; q < 2; q++) {
      var line = new THREE.Mesh(new THREE.BoxGeometry(96, 0.02, 0.16), lineMat);
      line.position.set(452.0, 0.05, -477.0 - q * 6.6);
      add(game, line);
    }
    for (var sc = 0; sc < 5; sc++) {
      var scuff = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.01, 0.14), boxMat(0x6a635c, 0.95));
      scuff.position.set(434.0 + sc * 3.4, 0.045, -482.4 + sc * 1.15);
      scuff.rotation.y = -0.12;
      add(game, scuff);
    }
    // aisle fill: warm bounce off the steel so the corridor is not a black slot
    for (var fl = 0; fl < 3; fl++) {
      var flLight = new THREE.PointLight(0xffb87a, 5.2, 44, 1.7);
      flLight.position.set(446.0 + fl * 12.0, 5.4, -480.2);
      game.scene.add(flLight);
      game.shotExtra.push(flLight);
    }
    puddle(game, 458.0, -478.2, 4.2, 2.2);
    puddle(game, 466.0, -484.4, 3.4, 1.8);

    // the crew: five rivals spread down the corridor, one behind the marker
    var rivals = game.peds.spawnRivals({ x: 456, z: -480 }, 5);
    var spots = [[452.0, -476.4], [457.4, -481.2], [461.0, -474.8], [466.2, -480.0], [470.0, -475.2]];
    for (var i = 0; i < rivals.length; i++) {
      var p = rivals[i];
      p.x = spots[i][0];
      p.z = spots[i][1];
      p.heading = Math.atan2(441.0 - p.x, -474.8 - p.z) + Math.PI;
      p.shootTimer = 99;
      p.phase = i * 1.1;
      game.peds.writeMatrices(p, null);
    }

    // a cruiser arriving through the portal, bar going, headlights into the yard
    kit().stageCop(game, 492.0, -485.0, Math.PI / 2 + 0.14);
    game.police.setWanted(3);
    kit().addLightPool(game, 490.0, -483.0, 0xff2438, 18, 0.42);
    kit().addLightPool(game, 487.0, -486.6, 0x2f5bff, 16, 0.38);
    cone(game, 479.0, -482.2, Math.PI / 2 + 0.12, 34, 0xffe0b0, 0.42);
    cone(game, 479.0, -487.4, Math.PI / 2 + 0.12, 30, 0xffe0b0, 0.34);

    // the portal crane spans the road at the quay, the hull sits beyond it
    kit().stageCrane(game, 496.0, -480.4, Math.PI / 2);
    kit().stageBoat(game, 520.0, -486.0, 0.12, 0x5f5344);
    lamp(game, 447.0, -474.0, 7.4, 0xffc98a);
    lamp(game, 472.0, -487.0, 7.4, 0xffc98a);
    lamp(game, 419.0, -476.0, 7.4, 0xffc98a);
    kit().addLightPool(game, 447.0, -476.0, 0xffb877, 15, 0.26);
    kit().addLightPool(game, 472.0, -485.0, 0xffb877, 15, 0.24);
    kit().stageBin(game, 437.0, -474.2);
    kit().stageBin(game, 458.0, -486.2);

    // dunnage in the near ring: crates, a pallet, a coiled hose
    var crateMat = boxMat(0x8a6b44, 0.85);
    for (var c = 0; c < 6; c++) {
      var cm = new THREE.Mesh(new THREE.BoxGeometry(1.2 + (c % 2) * 0.3, 0.95, 1.05), crateMat);
      cm.position.set(431.2 + (c % 3) * 1.4, 0.48 + Math.floor(c / 3) * 0.95, -482.8 - (c % 2) * 1.3);
      cm.rotation.y = 0.18 * c;
      add(game, cm);
    }
    var pallet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 1.1), boxMat(0x9a8262, 0.9));
    pallet.position.set(452.6, 0.1, -484.2);
    add(game, pallet);
    var hose = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 6, 18), boxMat(0x2f3a33, 0.8));
    hose.rotation.x = Math.PI / 2;
    hose.position.set(432.4, 0.1, -476.0);
    add(game, hose);

    game.missions.objective = 'Limpia el muelle · El Ruso espera';
    game.missions.setMarker(new THREE.Vector3(470, 0, -475.2), 0xffc46b);
    if (BS.HUD) {
      BS.HUD.showCard('El Ruso', 'El Muelle', 'Cinco hombres y un barco. No dejes que zarpe.');
      BS.HUD.objective('Limpia el muelle · El Ruso espera');
    }

    kit().setPose(game, 433.0, 1.70, -480.6, 500.0, 3.2, -478.4, 58);
  }

  // ------------------------------------------------------------------ night
  // 4-night — Centro after dark, rain-free but glossy. Neon goes down as a
  // smear on the tarmac, headlight cones cut the haze, and the pavement holds
  // the crowd under the awnings.
  function night(game) {
    game.city.setNight(true);
    setRig(game, {
      sun: [-0.9, 0.16, 0.14], sunColor: 0x3c4f78, sunI: 0.26, sunSize: 90, sunVisible: false,
      top: 0x060b18, horizon: 0x1e2c4c, fog: 0x0d1424, fogD: 0.0017,
      hemi: 0.44, sky: 0x2a3a5c, bounce: 0x16181f, amb: 0x33415e, ambI: 0.3,
      exposure: 1.42, env: 'night', wet: 1.0
    });
    if (game.city.ground && game.city.ground.material) {
      game.city.ground.material.color.setHex(0x2b3038);
    }

    // blade signs hang over the pavement on both sides of the canyon
    kit().addNeonPlane(game, 22.0, 12.5, -13.2, 'HOTEL', 0xff3fa4, 15, Math.PI / 2);
    kit().addNeonPlane(game, -6.0, 6.6, -13.0, 'CLUB', 0x35e6ff, 11, Math.PI / 2);
    kit().addNeonPlane(game, -30.0, 15.0, 13.4, 'SOL', 0xffb347, 14, Math.PI / 2);
    kit().addNeonPlane(game, -24.0, 7.8, -13.2, '24H', 0xb6ff5a, 9, Math.PI / 2);
    kit().addNeonPlane(game, -52.0, 13.4, -13.0, 'RADIO', 0x8f7dff, 15, Math.PI / 2);
    kit().addNeonPlane(game, -64.0, 6.8, 13.4, 'MAR', 0x35e6ff, 10, Math.PI / 2);
    kit().addNeonPlane(game, -84.0, 10.6, -13.2, 'TACOS', 0xff6b3d, 12, Math.PI / 2);
    kit().addNeonPlane(game, 6.0, 5.4, 13.4, 'BAR', 0xffb347, 8, Math.PI / 2);

    // the reflection pass: every sign drags a smear of colour down the asphalt
    spill(game, 12.0, -6.4, Math.PI / 2, 30, 7, 0xff3fa4, 0.42);
    spill(game, -4.0, -6.0, Math.PI / 2, 26, 6, 0x35e6ff, 0.38);
    spill(game, -20.0, 6.2, Math.PI / 2, 30, 7, 0xffb347, 0.36);
    spill(game, -26.0, -6.2, Math.PI / 2, 24, 6, 0xb6ff5a, 0.3);
    spill(game, -44.0, -6.0, Math.PI / 2, 26, 6, 0x8f7dff, 0.34);
    spill(game, -56.0, 6.2, Math.PI / 2, 24, 6, 0x35e6ff, 0.32);
    spill(game, 4.0, 0.0, Math.PI / 2, 70, 15, 0xffd9a8, 0.06);
    // near-field colour right under the lens so the foreground is never black
    spill(game, 30.0, -2.0, Math.PI / 2, 16, 9, 0xff3fa4, 0.4);
    spill(game, 26.0, 5.6, Math.PI / 2, 14, 8, 0x35e6ff, 0.34);
    spill(game, 20.0, -7.4, Math.PI / 2, 12, 7, 0xffb347, 0.3);
    puddle(game, 30.0, 3.0, 6.5, 9.0);
    puddle(game, 22.0, -3.4, 5.0, 7.0);
    puddle(game, 12.0, 6.6, 7.5, 5.0);
    puddle(game, -2.0, 1.0, 8.0, 10.0);
    puddle(game, -14.0, -4.6, 6.0, 6.0);
    puddle(game, 32.0, -0.6, 9.0, 11.0);
    puddle(game, 27.0, 5.2, 6.0, 6.0);

    // a car parked hard on the near kerb, half in frame, catching the signs
    kit().stageCar(game, 'pickup', 0x3f4a3c, 30.5, -10.6, Math.PI / 2, { speed: 0, brake: true });
    spill(game, 30.5, -9.0, Math.PI / 2, 12, 4, 0xff2f24, 0.26);
    kit().stageBin(game, 34.0, -9.6);
    kit().stageHydrant(game, 32.4, -9.9);
    kit().stageBin(game, 33.2, 9.8);

    // traffic: two coming at the lens with cones, one leaving with tail lights
    kit().stageCar(game, 'sedan', 0x2b3540, 14.0, 5.4, -Math.PI / 2, { speed: 14 });
    cone(game, 20.0, 5.4, Math.PI / 2, 26, 0xfff0c8, 0.42);
    kit().stageCar(game, 'sport', 0x8a2434, -16.0, 5.4, -Math.PI / 2, { speed: 17 });
    cone(game, -10.0, 5.4, Math.PI / 2, 26, 0xfff0c8, 0.36);
    kit().stageCar(game, 'van', 0xd8d2c6, 4.0, -5.4, Math.PI / 2, { speed: 11 });
    kit().stageCar(game, 'sedan', 0x1f2a36, 30.0, -5.4, Math.PI / 2 + 0.03, { speed: 12 });
    cone(game, 24.0, -5.4, Math.PI / 2, 24, 0xfff0c8, 0.46);
    spill(game, 36.0, -5.2, Math.PI / 2, 10, 4, 0xff2f24, 0.34);
    spill(game, 8.0, -4.4, Math.PI / 2, 16, 5, 0xff2f24, 0.3);
    kit().stageCar(game, 'taxi', 0xe0b23c, 26.0, 10.4, Math.PI / 2, { speed: 0 });
    kit().stageCar(game, 'pickup', 0x4c5b46, -40.0, 5.4, -Math.PI / 2, { speed: 13 });
    kit().stageCop(game, -2.0, -5.4, Math.PI / 2);
    game.police.setWanted(2);
    kit().addLightPool(game, 0.0, -6.6, 0x2f5bff, 12, 0.4);
    kit().addLightPool(game, 2.0, -4.0, 0xff2438, 10, 0.3);

    // awnings and the crowd that shelters under them
    awning(game, 20.0, -15.0, 8.0, 0, 0xc4443a);
    awning(game, 2.0, -15.0, 7.0, 0, 0x2f7f8a);
    awning(game, -22.0, 15.0, 9.0, Math.PI, 0xb8863a);
    awning(game, -46.0, -15.0, 7.0, 0, 0x8a4a86);
    kit().placeWalker(game, 0, 26.0, -12.6, Math.PI * 1.32, 1.05, 0.6);
    kit().placeWalker(game, 1, 24.4, -14.0, Math.PI * 0.24, 1.15, 2.1);
    kit().placeWalker(game, 2, 18.6, -13.4, Math.PI, 1.1, 3.2);
    kit().placeWalker(game, 3, 4.0, -13.8, 0.1, 1.2, 1.4);
    kit().placeWalker(game, 4, -18.0, -13.6, Math.PI * 1.1, 1.15, 4.4);
    kit().placeWalker(game, 5, -30.0, 13.2, 0.2, 1.25, 2.6);
    kit().placeWalker(game, 6, 8.0, 12.8, Math.PI * 0.9, 1.15, 5.1);
    kit().placeWalker(game, 7, 16.0, 13.6, Math.PI * 1.2, 1.1, 3.8);

    // street furniture that catches the neon
    kit().stageBin(game, 33.0, 13.0);
    kit().stageHydrant(game, 24.0, 12.4);
    kit().stageBin(game, -6.0, 13.2);
    kiosk(game, 18.0, 13.6, Math.PI * 0.95, 0xd8544a);
    lamp(game, 30.0, 12.6, 7.0, 0xffd9a4);
    lamp(game, 4.0, -12.6, 7.0, 0xffd9a4);
    lamp(game, -26.0, 12.6, 7.0, 0xffd9a4);
    kit().addLightPool(game, 30.0, 12.0, 0xffb877, 16, 0.4);
    kit().addLightPool(game, 4.0, -12.0, 0xffb877, 16, 0.38);
    kit().addLightPool(game, -26.0, 12.0, 0xffb877, 16, 0.34);
    palm(game, 40.0, 14.4, 8.4, 1.1, 0.95);
    palm(game, -12.0, -14.6, 9.0, 2.2, 1.0);

    var spot = new THREE.SpotLight(0xffe0b0, 2.8, 70, 0.55, 0.7, 1.4);
    spot.position.set(18.0, 1.1, 5.4);
    spot.target.position.set(-40.0, 0, 5.4);
    game.scene.add(spot);
    game.scene.add(spot.target);
    game.shotHeadlight = spot;

    game.player.setPosition(28.5, 9.2, 0.45);
    game.missions.objective = 'Entrega en el club · Centro';
    game.missions.setMarker(new THREE.Vector3(-120, 0, 60), 0xffc46b);
    if (BS.HUD) {
      BS.HUD.hideCard();
      BS.HUD.ticker('Nina Cruz: la ciudad no duerme, y tú tampoco deberías');
    }
    game.combat.weapon = 'smg';
    game.combat.ammo.smg = 24;
    game.cash = 15980;

    kit().setPose(game, 37.0, 1.86, 6.6, -58.0, 4.6, 1.2, 56);
  }

  // ------------------------------------------------------------------- tick
  // Per-frame extras the static staging cannot express: muzzle flash, tracers
  // and return fire in the mission frame, plus the police bars in every shot.
  function tick(name, game, t) {
    if (name === 'mission') {
      var muzzle = new THREE.Vector3(441.92, 1.36, -474.72);
      var target = new THREE.Vector3(452.2, 1.30, -476.5);
      if (true) {
        BS.Fx.muzzle(muzzle, target);
        BS.Fx.tracer(muzzle, target, 0xffe0a0);
      }
      if (true) {
        BS.Fx.tracer(muzzle, new THREE.Vector3(468.0, 1.24, -475.2), 0xffd28a);
        BS.Fx.spark(452.2, 1.30, -476.5);
      }
      for (var r = 0; r < 3; r++) {
        if (Math.sin(t * 7.7 + r * 2.1) > 0.45) {
          var from = new THREE.Vector3(452.0 + r * 6.0, 1.32, -476.4 - r * 1.4);
          BS.Fx.muzzle(from, muzzle);
          BS.Fx.tracer(from, muzzle, 0xffc070);
        }
      }
      if (BS.HUD && BS.HUD.damageEl) BS.HUD.damageEl.style.opacity = '0.26';
    }
    if (name === 'cover' && Math.sin(t * 3.1) > 0.2) {
      // dust off the kerb where the lead cruiser skids
      BS.Fx.dust(-99.0, 0.1, 476.8);
    }
  }

  BS.Scenes = { cover: cover, foot: foot, mission: mission, night: night, tick: tick };
})(window.BS);
