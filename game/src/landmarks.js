/* Bahía Sol — district landmarks.
   Four pieces of city that give each quarter its own silhouette and its own
   reason to be photographed: the hotel wall and the pier wheel at Playa Sol,
   the container terminal at Puerto Norte, the terraced barrio on the north
   hill, and the tower crane over Centro. Everything here is built from merged
   boxes and a handful of procedural textures, so the whole set costs about
   forty draw calls and never touches Math.random. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var G = BS.Geo;
  var P = BS.CFG.palette;

  // ---------------------------------------------------------------- helpers
  // merge geometries that carry uv only (textured pieces): boxes arrive
  // indexed, so they are flattened first and the attributes concatenated.
  function concatGeo(list) {
    var pos = [], nor = [], uv = [];
    for (var i = 0; i < list.length; i++) {
      var src = list[i];
      var g = src.index ? src.toNonIndexed() : src;
      var p = g.attributes.position.array;
      var n = g.attributes.normal.array;
      var u = g.attributes.uv ? g.attributes.uv.array : null;
      var k;
      for (k = 0; k < p.length; k++) pos.push(p[k]);
      for (k = 0; k < n.length; k++) nor.push(n[k]);
      if (u) for (k = 0; k < u.length; k++) uv.push(u[k]);
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return out;
  }

  function solid(parts, roughness, metalness, scene, cast) {
    if (!parts.length) return null;
    var mesh = new THREE.Mesh(G.merge(parts), new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: roughness === undefined ? 0.86 : roughness,
      metalness: metalness === undefined ? 0.08 : metalness
    }));
    mesh.castShadow = cast !== false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function textured(parts, map, roughness, metalness, scene, opts) {
    if (!parts.length) return null;
    opts = opts || {};
    var mat = new THREE.MeshStandardMaterial({
      map: map, roughness: roughness === undefined ? 0.8 : roughness,
      metalness: metalness === undefined ? 0.06 : metalness,
      transparent: !!opts.transparent, alphaTest: opts.alphaTest || 0,
      side: opts.side || THREE.FrontSide, emissive: opts.emissive || 0x000000,
      emissiveMap: opts.emissiveMap || null
    });
    if (opts.emissiveMap) mat.emissive.setHex(0xffffff), mat.emissiveIntensity = opts.emissiveIntensity || 0.4;
    var mesh = new THREE.Mesh(concatGeo(parts), mat);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // box geometry with uv tiled to metres — same convention as the city tiles
  function tbox(w, h, d, x, y, z, tileW, tileH) {
    var g = new THREE.BoxGeometry(w, h, d);
    G.scaleBoxUV(g, w, h, d, tileW, tileH);
    g.translate(x, y, z);
    return g;
  }

  function collider(city, x, z, w, d, h) {
    city.colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      height: h || 20
    });
  }

  // ========================================================== PLAYA SOL
  // A wall of hotel slabs along the coast road, the way a beach resort
  // actually looks from the sand: balconies stacked to the sky, canopies at
  // street level, rooftop signage. The fronts sit on z = 458 so the pavement
  // and the sea wall stay clear.
  var HOTEL_TINTS = [0xf6efe2, 0xf2e3d6, 0xe9d9c4, 0xf4ded0, 0xdfe9e4, 0xf7e8cf];

  function hotelTower(city, scene, cx, cz, w, d, h, tint, rng) {
    var body = tbox(w, h, d, cx, 0.3 + h / 2, cz, 5.4, 3.1);
    var bodyMesh = textured([body], BS.Tex.facadeHotel(tint), 0.62, 0.28, scene);
    bodyMesh.castShadow = true;
    city.buildingMeshes.push(bodyMesh);
    city.nightMaterials.push(bodyMesh.material);
    bodyMesh.material.userData.nightGlow = 0.55;
    bodyMesh.material.userData.dayGlow = 0.03;
    // the emissive map is the same wall with a few lit rooms
    bodyMesh.material.emissiveMap = BS.Tex.facadeHotelLit(tint);
    bodyMesh.material.emissive.setHex(0xffd9a8);
    bodyMesh.material.emissiveIntensity = 0.03;
    bodyMesh.material.needsUpdate = true;
    collider(city, cx, cz, w, d, h);

    var white = 0xf7f2e8;
    var trim = [];
    // floor lips: one 1.1 m balcony slab per storey on the sea face
    var floors = Math.max(2, Math.round(h / 3.2));
    for (var f = 1; f < floors; f++) {
      var y = 0.3 + f * (h / floors);
      trim.push(G.box(w + 0.5, 0.16, 0.9, cx, y, cz + d / 2 + 0.42, white));
      trim.push(G.box(w + 0.5, 0.62, 0.09, cx, y + 0.36, cz + d / 2 + 0.86, 0xeae2d2));
    }
    // vertical fins at the corners break the slab silhouette
    trim.push(G.box(0.5, h, d + 1.4, cx - w / 2 - 0.1, 0.3 + h / 2, cz, 0xefe7d8));
    trim.push(G.box(0.5, h, d + 1.4, cx + w / 2 + 0.1, 0.3 + h / 2, cz, 0xe6ddcc));
    // parapet + rooftop plant
    trim.push(G.box(w + 1.0, 0.55, d + 1.0, cx, 0.3 + h + 0.2, cz, 0xdcd3c2));
    trim.push(G.box(w * 0.28, 2.2, d * 0.3, cx + w * 0.2, 0.3 + h + 1.3, cz - d * 0.2, 0xc9c3b6));
    solid(trim, 0.86, 0.05, scene);

    // entrance canopy on columns
    var can = [];
    can.push(G.box(11, 0.42, 4.6, cx, 5.3, cz + d / 2 + 2.2, 0xffffff));
    can.push(G.box(11, 0.16, 4.6, cx, 5.55, cz + d / 2 + 2.2, 0xd8cfbd));
    for (var c = 0; c < 2; c++) {
      can.push(G.box(0.34, 5.2, 0.34, cx + (c ? 4.6 : -4.6), 2.9, cz + d / 2 + 4.0, 0xc8bfae));
    }
    can.push(G.box(9.0, 3.6, 0.2, cx, 2.0, cz + d / 2 + 0.25, 0x1d2a31));
    solid(can, 0.7, 0.2, scene);

    // rooftop name sign, facing the sea
    if (rng.chance(0.8) && h > 26) {
      var text = rng.pick(['MARINA', 'SOL', 'AZUL', 'CABAÑA', 'CORAL', 'BAHÍA', 'OCÉANO']);
      var sign = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 3.2),
        new THREE.MeshBasicMaterial({
          map: BS.Tex.neon(text, P.neon[rng.int(0, 5)]), transparent: true,
          opacity: 0.22, depthWrite: false, side: THREE.DoubleSide
        })
      );
      sign.position.set(cx, 0.3 + h + 2.6, cz + d / 2 + 0.2);
      scene.add(sign);
      city.neonMaterials.push(sign.material);
      sign.material.userData.nightOpacity = 1;
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: BS.Tex.glow(), color: P.neon[rng.int(0, 5)], transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      glow.scale.set(22, 10, 1);
      glow.position.copy(sign.position);
      scene.add(glow);
      city.neonGlows.push(glow.material);
    }
  }

  function buildBeachfront(city, scene) {
    var rng = BS.makeRng(9091);
    var row = [-540, -420, -300, -180, -60, 60, 180, 300, 420, 540];
    for (var r = 0; r < row.length; r++) {
      var cx = row[r];
      if (BS.City.inBay(cx, 420)) continue;
      // two towers per block, one taller, gaps at the cross streets
      var pair = rng.chance(0.72) ? 2 : 1;
      for (var k = 0; k < pair; k++) {
        var w = rng.float(30, 38);
        var h = k === 0 ? rng.float(38, 78) : rng.float(24, 52);
        if (cx === 60 || cx === -60) h = k === 0 ? 62 : 40;   // hero wall
        var d = rng.float(18, 23);
        var px = cx + (pair === 2 ? (k ? 22 : -22) : 0) + rng.float(-1.5, 1.5);
        hotelTower(city, scene, px, 447 + rng.float(-2, 2), w, d, h, HOTEL_TINTS[(r + k) % HOTEL_TINTS.length], rng);
      }
    }
    // low beach bars between the towers, right on the pavement edge
    var bars = [];
    for (var b = 0; b < 10; b++) {
      var bx = -520 + b * 108 + rng.float(-8, 8);
      var bw = rng.float(9, 14), bd = rng.float(7, 9), bh = rng.float(3.4, 4.6);
      bars.push(G.box(bw, bh, bd, bx, bh / 2 + 0.3, 456, rng.pick([0xe4d3b6, 0xd9c2a4, 0xcbb79b])));
      bars.push(G.box(bw + 1.6, 0.22, bd + 1.6, bx, bh + 0.5, 456, 0x8c6c4a));
      collider(city, bx, 456, bw, bd, bh);
    }
    solid(bars, 0.9, 0.02, scene);
    buildPier(city, scene, rng);
  }

  // The pier runs south from the promenade into open water and ends in a
  // ferris wheel: the silhouette the whole beach is known by.
  function buildPier(city, scene, rng) {
    var px = -40, z0 = 492, z1 = 668;
    var wood = BS.Tex.wood();
    var deckParts = [];
    deckParts.push(tbox(9.6, 0.5, z1 - z0, px, 1.15, (z0 + z1) / 2, 6, 6));
    deckParts.push(tbox(26, 0.5, 14, px, 1.15, z1 - 6, 6, 6));
    textured(deckParts, wood, 0.9, 0.02, scene);

    var piles = [], rails = [];
    for (var p = 0; p < 26; p++) {
      var pz = z0 + 6 + p * 6.8;
      for (var s = -1; s <= 1; s += 2) {
        piles.push(G.box(0.34, 2.4, 0.34, px + s * 4.6, 0.2, pz, 0x5d4730));
        rails.push(G.box(0.12, 1.05, 0.12, px + s * 4.6, 1.9, pz, 0xe8e2d0));
        rails.push(G.box(0.1, 0.1, 6.8, px + s * 4.6, 2.4, pz + 3.4, 0xe8e2d0));
      }
    }
    // lamp posts along the deck
    for (var l = 0; l < 8; l++) {
      var lz = z0 + 14 + l * 21;
      rails.push(G.box(0.16, 4.4, 0.16, px - 4.2, 3.3, lz, 0x3a3a38));
      rails.push(G.box(1.1, 0.3, 0.5, px - 4.2, 5.5, lz, 0xfff2cf));
    }
    solid(piles, 0.95, 0.02, scene);
    solid(rails, 0.55, 0.35, scene);

    // entrance arch with the pier number
    var arch = [];
    arch.push(G.box(1.0, 9, 1.0, px - 5.2, 5.8, z0 + 2, 0x2f3a3f));
    arch.push(G.box(1.0, 9, 1.0, px + 5.2, 5.8, z0 + 2, 0x2f3a3f));
    arch.push(G.box(12.4, 1.1, 1.2, px, 10.4, z0 + 2, 0xf0e6d2));
    solid(arch, 0.6, 0.25, scene);
    var archSign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.1),
      new THREE.MeshBasicMaterial({
        map: BS.Tex.neon('MUELLE 4', 0xffb347), transparent: true, opacity: 0.3,
        depthWrite: false, side: THREE.DoubleSide
      })
    );
    archSign.position.set(px, 10.0, z0 + 1.35);
    scene.add(archSign);
    city.neonMaterials.push(archSign.material);
    archSign.material.userData.nightOpacity = 1;

    // kiosks on the wide end of the pier
    var kiosks = [];
    for (var k = 0; k < 3; k++) {
      var kx = px - 9 + k * 9;
      kiosks.push(G.box(5.2, 3.4, 5.2, kx, 3.1, z1 - 10, rng.pick([0xe8dcc4, 0xd8c9ae, 0xc9b9a0])));
      kiosks.push(G.box(5.9, 0.24, 5.9, kx, 4.9, z1 - 10, rng.pick([0xc05a44, 0x2f6f7a, 0xd9a03c])));
    }
    solid(kiosks, 0.85, 0.03, scene);

    // ---- the wheel ----
    var wheel = new THREE.Group();
    var R = 21;
    var steel = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.45, metalness: 0.5 });
    var steelDark = new THREE.MeshStandardMaterial({ color: 0x6f7a80, roughness: 0.5, metalness: 0.6 });
    var rimGeo = new THREE.TorusGeometry(R, 0.32, 6, 44);
    var rim1 = new THREE.Mesh(rimGeo, steel);
    var rim2 = new THREE.Mesh(rimGeo, steel);
    rim2.position.z = 3.2;
    wheel.add(rim1); wheel.add(rim2);
    var spokeGeo = new THREE.BoxGeometry(R, 0.2, 0.2);
    for (var sp = 0; sp < 16; sp++) {
      for (var side = 0; side < 2; side++) {
        var spoke = new THREE.Mesh(spokeGeo, steel);
        spoke.position.set(0, 0, side * 3.2);
        spoke.geometry = spokeGeo;
        spoke.rotation.z = (sp / 16) * Math.PI * 2;
        spoke.position.x = Math.cos(spoke.rotation.z) * R * 0.5;
        spoke.position.y = Math.sin(spoke.rotation.z) * R * 0.5;
        spoke.rotation.z = spoke.rotation.z;
        spoke.position.z = side * 3.2;
        wheel.add(spoke);
      }
    }
    var gondolaGeo = new THREE.BoxGeometry(2.6, 2.2, 2.4);
    for (var gd = 0; gd < 16; gd++) {
      var ang = (gd / 16) * Math.PI * 2;
      var car = new THREE.Mesh(gondolaGeo, new THREE.MeshStandardMaterial({
        color: gd % 2 ? 0xe8b34a : 0xd8544a, roughness: 0.6, metalness: 0.1
      }));
      car.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 1.6);
      wheel.add(car);
    }
    // A-frame legs
    var legLen = R + 16;
    for (var lg = -1; lg <= 1; lg += 2) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.85, legLen, 0.85), steelDark);
      leg.position.set(lg * 8, -R / 2 + 4, 1.6);
      leg.rotation.z = lg * 0.24;
      wheel.add(leg);
    }
    var axle = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 0.5), steelDark);
    wheel.add(axle);
    wheel.position.set(px, 1.4 + R + 12, 552);
    wheel.rotation.y = Math.PI / 2;
    scene.add(wheel);
    city.ferrisWheel = wheel;
    collider(city, px, 552, 20, 20, 40);

    // water beneath the pier end, so the deck reads as standing in the sea
    var pad = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.MeshStandardMaterial({ color: 0x16414f, roughness: 0.15, metalness: 0.5 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(px, 0.62, z1 - 6);
    scene.add(pad);
  }

  // --------------------------------------------------- promenade furniture
  // Sea wall, benches, planters and beach kit close to the road, so the
  // foreground of any beach shot has something to read at 3–8 m.
  function buildPromenade(city, scene) {
    var rng = BS.makeRng(5151);
    var wall = [];
    for (var x = -560; x < 560; x += 24) {
      // gaps where steps run down to the sand
      if (Math.abs(((x + 600) % 120)) < 14) continue;
      wall.push(G.box(23, 0.62, 0.7, x + 11.5, 0.66, 494.5, 0xd9d2c2));
      wall.push(G.box(23.4, 0.16, 0.9, x + 11.5, 1.02, 494.5, 0xf2ece0));
    }
    for (var s = -540; s < 560; s += 120) {
      // steps down to the beach
      for (var st = 0; st < 4; st++) {
        wall.push(G.box(8, 0.16, 0.9, s + 60, 0.2 + st * 0.16, 494.5 + st * 0.9, 0xcfc8b8));
      }
    }
    solid(wall, 0.9, 0.03, scene);

    // benches facing the sea + bins, along the promenade
    var iron = [], timber = [];
    for (var b = -500; b < 560; b += 60) {
      var bz = 492.4;
      timber.push(G.box(2.4, 0.12, 0.6, b, 0.62, bz, 0x9a6f43));
      timber.push(G.box(2.4, 0.12, 0.55, b, 0.86, bz - 0.34, 0x9a6f43));
      iron.push(G.box(0.1, 0.7, 0.1, b - 1.05, 0.35, bz - 0.1, 0x35322e));
      iron.push(G.box(0.1, 0.7, 0.1, b + 1.05, 0.35, bz - 0.1, 0x35322e));
      if (b % 120 === 20) iron.push(G.box(0.5, 1.1, 0.5, b + 3.4, 0.55, bz, 0x2f4a3a));
    }
    solid(iron, 0.7, 0.3, scene);
    solid(timber, 0.9, 0.02, scene);

    // palm planters between the kerb and the sea wall
    var planters = [], fronds = [];
    for (var p = -480; p < 560; p += 80) {
      planters.push(G.box(3.4, 0.55, 3.4, p, 0.5, 490.5, 0x8c8478));
      planters.push(G.box(2.9, 0.5, 2.9, p, 0.62, 490.5, 0x3a3126));
    }
    solid(planters, 0.9, 0.04, scene);
  }

  function buildBeachKit(city, scene) {
    var rng = BS.makeRng(3311);
    var metal = [], fabric = [], wood = [];
    var cloth = [0xe0604c, 0x2f8f9a, 0xe8b93c, 0xf2efe4, 0xa8506f];

    // sunbeds in neat rows behind the umbrellas
    for (var r = 0; r < 5; r++) {
      var z = 512 + r * 11;
      for (var i = 0; i < 22; i++) {
        var x = -520 + i * 46 + rng.float(-6, 6) + (r % 2) * 12;
        if (Math.abs(x + 40) < 16) continue;
        var c = cloth[(i + r) % cloth.length];
        fabric.push(G.box(0.78, 0.16, 2.0, x, 0.42, z, c));
        fabric.push(G.box(0.78, 0.14, 0.9, x, 0.62, z - 1.3, c));
        metal.push(G.box(0.1, 0.36, 1.9, x - 0.34, 0.2, z, 0xcfcabd));
        metal.push(G.box(0.1, 0.36, 1.9, x + 0.34, 0.2, z, 0xcfcabd));
      }
    }
    // beach huts / bars on the sand
    for (var h = 0; h < 7; h++) {
      var hx = -430 + h * 140 + rng.float(-14, 14);
      var hz = 536 + rng.float(-6, 6);
      wood.push(G.box(7.5, 3.2, 5.4, hx, 1.9, hz, 0xc9a273));
      wood.push(G.box(8.6, 0.3, 6.4, hx, 3.6, hz, 0x8a5f3c));
      wood.push(G.box(3.0, 2.4, 0.2, hx, 1.6, hz + 2.72, 0x2a2320));
    }
    // lifeguard towers
    for (var t = 0; t < 4; t++) {
      var tx = -340 + t * 210;
      var tz = 570;
      wood.push(G.box(3.4, 0.2, 3.4, tx, 3.4, tz, 0xe8dcc4));
      wood.push(G.box(3.4, 1.9, 3.4, tx, 4.4, tz, 0xf2e6cc));
      wood.push(G.box(4.4, 0.24, 4.4, tx, 5.5, tz, 0xc8503f));
      metal.push(G.box(0.22, 3.4, 0.22, tx - 1.4, 1.7, tz - 1.4, 0xe8e2d2));
      metal.push(G.box(0.22, 3.4, 0.22, tx + 1.4, 1.7, tz - 1.4, 0xe8e2d2));
      metal.push(G.box(0.22, 3.4, 0.22, tx - 1.4, 1.7, tz + 1.4, 0xe8e2d2));
      metal.push(G.box(0.22, 3.4, 0.22, tx + 1.4, 1.7, tz + 1.4, 0xe8e2d2));
      cloth.push;
    }
    // volleyball court posts
    for (var v = 0; v < 3; v++) {
      var vx = -200 + v * 260, vz = 522;
      metal.push(G.box(0.16, 3.2, 0.16, vx - 5, 1.6, vz, 0xe6e0d2));
      metal.push(G.box(0.16, 3.2, 0.16, vx + 5, 1.6, vz, 0xe6e0d2));
    }
    solid(metal, 0.55, 0.4, scene);
    solid(wood, 0.9, 0.03, scene);
    solid(fabric, 0.95, 0.0, scene);

    // umbrellas: a pole and a ribbed canopy, cheap but reads at any distance
    var poles = [], canopies = [];
    for (var u = 0; u < 46; u++) {
      var ux = -520 + (u % 23) * 46 + rng.float(-8, 8);
      var uz = 505 + Math.floor(u / 23) * 26 + rng.float(-7, 7);
      if (Math.abs(ux + 40) < 16) continue;
      var col = cloth[(u * 3) % cloth.length];
      poles.push(G.box(0.09, 2.6, 0.09, ux, 1.3, uz, 0xd9d2c2));
      canopies.push(G.box(3.6, 0.26, 3.6, ux, 2.55, uz, col));
      canopies.push(G.box(2.4, 0.22, 2.4, ux, 2.78, uz, col));
    }
    solid(poles, 0.6, 0.3, scene);
    solid(canopies, 0.92, 0.02, scene);
  }

  // =========================================================== PUERTO NORTE
  // Container terminal: a basin cut into the east edge of the map, a quay
  // wall, rows of stacked boxes in four colours, two portal cranes and a
  // moored feeder ship.
  function buildDocks(city, scene) {
    var rng = BS.makeRng(6060);

    // stockyard floor
    var apron = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 300),
      new THREE.MeshStandardMaterial({ color: 0x6f6d68, roughness: 0.95 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(330, 0.02, -420);
    apron.receiveShadow = true;
    scene.add(apron);

    // basin
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 330, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x123b47, roughness: 0.12, metalness: 0.55 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(630, 0.3, -420);
    scene.add(water);
    city.harbour = water;

    // quay wall with bollards
    var quay = [], bollards = [];
    quay.push(G.box(4, 2.6, 330, 500, 1.3, -420, 0x9a958a));
    quay.push(G.box(5.2, 0.34, 330, 500, 2.66, -420, 0xc2bbac));
    for (var b = 0; b < 22; b++) {
      bollards.push(G.box(0.5, 0.7, 0.5, 498, 2.9, -570 + b * 14, 0x2f3234));
    }
    solid(quay, 0.9, 0.05, scene);
    solid(bollards, 0.6, 0.4, scene);
    city.colliders.push({ minX: 498, maxX: 502, minZ: -590, maxZ: -250, height: 2.7 });

    // ---- container stacks ------------------------------------------------
    var colours = [0xb5443a, 0x2f6f7a, 0xc9902e, 0x4c6b52];
    var rows = [];
    for (var c = 0; c < 4; c++) rows.push([]);
    for (var rz = 0; rz < 9; rz++) {
      for (var rx = 0; rx < 7; rx++) {
        var x = 232 + rx * 15.6;
        var z = -570 + rz * 17;
        if (rx === 6 && rz > 5) continue;
        var stack = rng.int(1, 4);
        for (var s = 0; s < stack; s++) {
          var ci = (rx + rz + s) % 4;
          var g = tbox(13.2, 2.6, 2.7, x, 1.4 + s * 2.62, z, 13.2, 2.6);
          rows[ci].push(g);
        }
        if (stack > 1) collider(city, x, z, 13.2, 2.7, stack * 2.62);
      }
    }
    for (var ci2 = 0; ci2 < 4; ci2++) {
      textured(rows[ci2], BS.Tex.containerSkin(colours[ci2]), 0.72, 0.24, scene);
    }

    // ---- portal cranes ---------------------------------------------------
    for (var cr = 0; cr < 2; cr++) {
      buildGantry(city, scene, 470 - cr * 90, -400 + cr * 150, cr === 0 ? 0 : Math.PI);
    }

    // ---- moored feeder ship ---------------------------------------------
    var ship = [];
    var sx = 560, sz = -430;
    ship.push(G.box(24, 8.2, 150, sx, 3.6, sz, 0x2b3a44));           // hull
    ship.push(G.box(24.6, 1.4, 150, sx, 8.2, sz, 0x8a3f36));          // boot stripe
    ship.push(G.box(22, 1.2, 146, sx, 0.7, sz, 0x1a2228));
    ship.push(G.box(20, 7.0, 22, sx, 12.2, sz - 52, 0xd9d2c2));       // bridge
    ship.push(G.box(14, 3.4, 12, sx, 17.4, sz - 54, 0xe8e2d2));
    for (var sc = 0; sc < 4; sc++) {
      for (var scc = 0; scc < 3; scc++) {
        ship.push(G.box(15, 2.6, 2.6, sx - 2 + scc * 2.2, 10.2 + sc * 2.6, sz - 20 + sc * 9, colours[(sc + scc) % 4]));
      }
    }
    solid(ship, 0.66, 0.3, scene);

    // ---- warehouse gables + light masts along the yard -------------------
    var masts = [];
    for (var m = 0; m < 6; m++) {
      var mx = 260 + m * 46, mz = -240;
      masts.push(G.box(0.34, 22, 0.34, mx, 11, mz, 0x3c3f42));
      masts.push(G.box(2.6, 0.5, 0.5, mx, 22, mz, 0x2b2e31));
      masts.push(G.box(1.4, 0.4, 0.8, mx, 21.4, mz, 0xfff0cf));
    }
    solid(masts, 0.55, 0.45, scene);
  }

  function buildGantry(city, scene, x, z, rot) {
    var parts = [], lights = [];
    var legH = 26, span = 46;
    var orange = 0xc9722f;
    for (var s = -1; s <= 1; s += 2) {
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        parts.push(G.box(1.5, legH, 1.5, x + s * span / 2, legH / 2, z + s2 * 9, orange));
        // lattice bracing
        for (var br = 0; br < 6; br++) {
          parts.push(G.box(1.2, 0.5, 1.2, x + s * span / 2, 3 + br * 4.2, z + s2 * 9, 0xa85c26));
        }
      }
      parts.push(G.box(1.4, 1.4, 22, x + s * span / 2, legH - 1, z, orange));
    }
    // main girder over the quay, cantilevered out to the water
    parts.push(G.box(span + 26, 2.0, 3.4, x + 10, legH + 1, z, orange));
    parts.push(G.box(span + 26, 0.5, 4.2, x + 10, legH + 2.2, z, 0xd98a3c));
    // trolley + spreader
    parts.push(G.box(6, 2.2, 5, x + 26, legH - 1.4, z, 0xe8e2d2));
    parts.push(G.box(1.2, 8, 1.2, x + 26, legH - 6, z, 0x8a8d90));
    parts.push(G.box(12.4, 1.2, 2.9, x + 26, legH - 10.4, z, 0xd9a03c));
    lights.push(G.box(1.4, 0.4, 1.4, x + 26, legH - 0.4, z + 2.6, 0xfff2cf));
    var mesh = solid(parts, 0.72, 0.28, scene);
    mesh.rotation.y = 0;
    solid(lights, 0.4, 0.2, scene);
    city.colliders.push({ minX: x - span / 2 - 1, maxX: x - span / 2 + 1, minZ: z - 10, maxZ: z + 10, height: legH });
    city.colliders.push({ minX: x + span / 2 - 1, maxX: x + span / 2 + 1, minZ: z - 10, maxZ: z + 10, height: legH });
    return mesh;
  }

  // ============================================================== BARRIO
  // Terraced hillside housing on the north edge: four retaining courses,
  // painted boxes stacked on each, stairs cut between them and washing strung
  // across the alleys.
  function buildBarrio(city, scene) {
    var rng = BS.makeRng(7373);
    var x0 = -300, x1 = -30, zFront = -378;
    var terraceD = 42, stepH = 8.5, levels = 4;
    var walls = [], paint = [], roof = [];

    for (var lv = 0; lv < levels; lv++) {
      var top = (lv + 1) * stepH;
      var zc = zFront - terraceD / 2 - lv * terraceD;
      walls.push(G.box(x1 - x0, top, terraceD, (x0 + x1) / 2, top / 2, zc, 0xb8ab96));
      // terrace lip
      walls.push(G.box(x1 - x0 + 1, 0.6, 1.4, (x0 + x1) / 2, top + 0.3, zc + terraceD / 2, 0xd6cbb6));
      city.colliders.push({
        minX: x0, maxX: x1, minZ: zc - terraceD / 2, maxZ: zc + terraceD / 2, height: top
      });

      var houseCount = 7 - (lv > 2 ? 2 : 0);
      for (var i = 0; i < houseCount; i++) {
        var hx = x0 + 16 + i * ((x1 - x0 - 32) / Math.max(1, houseCount - 1)) + rng.float(-4, 4);
        var hz = zc + rng.float(-9, 9);
        var hw = rng.float(8.5, 12.5), hd = rng.float(8, 11), hh = rng.float(6.5, 10.5);
        var col = rng.pick([0xe8b04a, 0xd4584a, 0x3f8f86, 0xe088a0, 0x6f9ad4, 0xe6d9b8, 0xc9d98a]);
        paint.push(G.box(hw, hh, hd, hx, top + hh / 2, hz, col));
        roof.push(G.box(hw + 0.9, 0.35, hd + 0.9, hx, top + hh + 0.15, hz, rng.pick([0x8c4f3c, 0x6f6a62, 0x9a6a4a])));
        roof.push(G.box(hw + 0.5, 0.5, 0.5, hx, top + hh - 0.2, hz + hd / 2, 0xf2ece0));
        // water tank or satellite dish on the roof
        if (rng.chance(0.6)) {
          roof.push(G.box(1.7, 1.9, 1.7, hx + rng.float(-3, 3), top + hh + 1.2, hz + rng.float(-2, 2), 0x2f3234));
        }
        // dark window + door insets
        for (var wq = 0; wq < 3; wq++) {
          walls.push(G.box(1.5, 1.7, 0.18, hx - 2.6 + wq * 2.6, top + hh * 0.62, hz + hd / 2 + 0.06, 0x222a2c));
        }
        walls.push(G.box(1.5, 2.6, 0.18, hx, top + 1.4, hz + hd / 2 + 0.06, 0x2a2320));
      }
      // stair flights between the courses
      for (var st = 0; st < 3; st++) {
        var sx = x0 + 40 + st * 88;
        for (var s = 0; s < 9; s++) {
          walls.push(G.box(5.2, stepH / 9, 2.4, sx, top - stepH + (s + 0.5) * (stepH / 9), zc + terraceD / 2 - s * 1.2, 0xd6cbb6));
        }
      }
      // washing lines across the alleys
      for (var wl = 0; wl < 4; wl++) {
        var la = x0 + 30 + wl * 58, lz = zc + 6;
        var lcol = rng.pick([0xf2efe4, 0xe0604c, 0x6f9ad4, 0xf2d9a0]);
        roof.push(G.box(9, 0.06, 0.06, la, top + 5.4, lz, 0x9a958a));
        for (var pc = 0; pc < 4; pc++) {
          roof.push(G.box(1.5, 1.3, 0.06, la - 3 + pc * 2, top + 4.7, lz, lcol));
        }
      }
    }
    solid(walls, 0.94, 0.03, scene);
    solid(paint, 0.9, 0.02, scene);
    solid(roof, 0.88, 0.06, scene);

    // a few palms on the lower terrace so the hill reads as tropical
    var palmRng = BS.makeRng(4242);
    for (var p = 0; p < 7; p++) {
      var v = BS.City.makePalmVariant(palmRng, palmRng.float(6, 10));
      v.position.set(x0 + 20 + p * 38, stepH, zFront - 12 + palmRng.float(-6, 6));
      scene.add(v);
    }
    // a water tower crowning the barrio
    var tower = [];
    tower.push(G.box(3.4, 12, 3.4, x0 + 30, levels * stepH + 6, zFront - terraceD * 3, 0xd9d2c2));
    tower.push(G.cyl(4.6, 4.6, 5.2, 10, x0 + 30, levels * stepH + 14, zFront - terraceD * 3, 0xe8e2d2));
    solid(tower, 0.8, 0.15, scene);
  }

  // ============================================================== CENTRO
  // A tower crane over a half-finished block: the one silhouette that says
  // "this city is still being built".
  function buildCrane(city, scene, x, z, h, jib) {
    var parts = [], mast = 2.4;
    for (var s = 0; s < h; s += 3) {
      var y = s + 1.5;
      parts.push(G.box(mast, 0.34, 0.34, x - mast / 2, y, z - mast / 2, 0xe0a02c));
      parts.push(G.box(mast, 0.34, 0.34, x + mast / 2, y, z - mast / 2, 0xe0a02c));
      parts.push(G.box(mast, 0.34, 0.34, x - mast / 2, y, z + mast / 2, 0xe0a02c));
      parts.push(G.box(mast, 0.34, 0.34, x + mast / 2, y, z + mast / 2, 0xe0a02c));
      parts.push(G.box(mast + 0.4, 0.24, 0.24, x, y, z - mast / 2, 0xc98c22));
      parts.push(G.box(mast + 0.4, 0.24, 0.24, x, y, z + mast / 2, 0xc98c22));
    }
    // top: jib to the west, counter-jib east, cab at the mast head
    parts.push(G.box(jib, 1.3, 1.3, x - jib / 2, h + 1, z, 0xe0a02c));
    parts.push(G.box(jib * 0.32, 1.6, 1.6, x + jib * 0.16, h + 1, z, 0xc98c22));
    parts.push(G.box(3.2, 2.6, 3.0, x, h - 0.2, z + 2.2, 0xf2efe6));
    parts.push(G.box(1.0, 5.4, 1.0, x, h + 4.4, z, 0xc98c22));
    parts.push(G.box(0.3, 0.3, jib * 0.9, x - jib * 0.42, h + 8, z, 0x8a8d90));
    // hook block hanging over the site
    parts.push(G.box(0.14, 12, 0.14, x - jib * 0.55, h - 5, z, 0x6f7478));
    parts.push(G.box(1.6, 1.2, 1.6, x - jib * 0.55, h - 11.4, z, 0xe0a02c));
    solid(parts, 0.62, 0.4, scene);
    city.colliders.push({ minX: x - 1.6, maxX: x + 1.6, minZ: z - 1.6, maxZ: z + 1.6, height: h });

    // the unfinished slab it is serving
    var site = [];
    var fh = 22;
    site.push(G.box(34, fh, 30, x - 26, fh / 2 + 0.3, z, 0xa8a196));
    for (var fl = 0; fl < 6; fl++) {
      site.push(G.box(36, 0.3, 32, x - 26, 0.3 + fl * 3.6, z, 0xd6cfc2));
    }
    // exposed columns above the slab
    for (var cc = 0; cc < 6; cc++) {
      site.push(G.box(0.7, 4.2, 0.7, x - 26 + (cc % 3 - 1) * 10, fh + 2.4, z + (cc < 3 ? -11 : 11), 0xb8b1a4));
    }
    solid(site, 0.9, 0.04, scene);
    city.colliders.push({ minX: x - 43, maxX: x - 9, minZ: z - 15, maxZ: z + 15, height: fh + 4 });
  }

  // ---------------------------------------------------------------- entry
  function build(city, scene) {
    buildBeachfront(city, scene);
    buildPromenade(city, scene);
    buildBeachKit(city, scene);
    buildDocks(city, scene);
    buildBarrio(city, scene);
    buildCrane(city, scene, 128, -196, 62, 44);
    buildCrane(city, scene, 372, 128, 48, 38);
  }

  BS.Landmarks = { build: build };
})(window.BS);
