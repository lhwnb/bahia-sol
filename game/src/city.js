/* Bahía Sol — the city.
   One 1,200 m grid: asphalt, sidewalks, glass towers downtown, pastel blocks at
   the marina, warehouses on the north quay, sand and surf along the south edge.
   Also builds the sky, the sun, the fog and the night lighting switch. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG, P = CFG.palette, W = CFG.world;

  var AVENUES = ['Av. Faro', 'Av. Corona', 'Av. Mirador', 'Av. Central', 'Av. Palmas', 'Av. del Mar',
    'Av. Sol', 'Av. Libertad', 'Av. Coral', 'Av. Marina', 'Av. Bahía'];
  var CALLES = ['Calle 1', 'Calle 2', 'Calle 3', 'Calle 4', 'Calle 5', 'Calle 6',
    'Calle 7', 'Calle 8', 'Calle 9', 'Calle 10', 'Calle 11'];

  // ------------------------------------------------------------ geometry kit
  function paint(geo, colorHex) {
    var g = geo.index ? geo.toNonIndexed() : geo;
    var c = new THREE.Color(colorHex);
    var count = g.attributes.position.count;
    var arr = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  }

  function merge(geos) {
    var list = [], total = 0, i, g;
    for (i = 0; i < geos.length; i++) {
      g = geos[i].index ? geos[i].toNonIndexed() : geos[i];
      list.push(g);
      total += g.attributes.position.count;
    }
    var pos = new Float32Array(total * 3);
    var nor = new Float32Array(total * 3);
    var uv = new Float32Array(total * 2);
    var col = new Float32Array(total * 3);
    var offset = 0;
    for (i = 0; i < list.length; i++) {
      g = list[i];
      pos.set(g.attributes.position.array, offset * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, offset * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, offset * 2);
      if (g.attributes.color) col.set(g.attributes.color.array, offset * 3);
      else for (var k = offset * 3; k < (offset + g.attributes.position.count) * 3; k++) col[k] = 1;
      offset += g.attributes.position.count;
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }

  function box(w, h, d, x, y, z, color) {
    var g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return color === undefined ? g : paint(g, color);
  }

  function cyl(rTop, rBottom, h, seg, x, y, z, color) {
    var g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    g.translate(x, y, z);
    return color === undefined ? g : paint(g, color);
  }

  // Scale a box's face UVs so one texture tile covers tileW x tileH metres.
  function scaleBoxUV(geo, w, h, d, tileW, tileH) {
    var uv = geo.attributes.uv;
    var horiz = [d, d, w, w, w, w];
    for (var f = 0; f < 6; f++) {
      for (var i = 0; i < 4; i++) {
        var k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * horiz[f] / tileW, uv.getY(k) * h / tileH);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  function quadMesh(positions, uvs, color, opts) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      color: color, roughness: 0.82, metalness: 0.0,
      polygonOffset: true, polygonOffsetFactor: (opts && opts.offset) || -2, polygonOffsetUnits: -2
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  function pushQuad(positions, uvs, cx, cz, sx, sz, y) {
    var hx = sx / 2, hz = sz / 2, yy = y === undefined ? 0.03 : y;
    // two triangles, wound counter-clockwise seen from above
    positions.push(cx - hx, yy, cz - hz, cx - hx, yy, cz + hz, cx + hx, yy, cz + hz);
    positions.push(cx - hx, yy, cz - hz, cx + hx, yy, cz + hz, cx + hx, yy, cz - hz);
    uvs.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0);
  }

  // --------------------------------------------------------------- districts
  var DISTRICTS = {
    marina: { id: 'marina', name: 'Marina Vieja' },
    beach: { id: 'beach', name: 'Playa Sol' },
    industrial: { id: 'industrial', name: 'Puerto Norte' },
    downtown: { id: 'downtown', name: 'Centro' },
    norte: { id: 'norte', name: 'Vista Norte' },
    costa: { id: 'costa', name: 'Costa Este' }
  };

  function districtAt(x, z) {
    if (x < -200 && z > 140) return DISTRICTS.marina;
    if (z > 470) return DISTRICTS.beach;
    if (x > 240 && z < -140) return DISTRICTS.industrial;
    if (Math.abs(x) < 260 && Math.abs(z) < 260) return DISTRICTS.downtown;
    if (z < -260) return DISTRICTS.norte;
    return DISTRICTS.costa;
  }

  function streetLine(x, z) {
    var ai = Math.max(0, Math.min(10, Math.round(x / 120) + 5));
    var ci = Math.max(0, Math.min(10, Math.round(z / 120) + 5));
    return AVENUES[ai] + ' / ' + CALLES[ci];
  }

  function inBay(x, z) {
    return x < W.bay.maxX && z > W.bay.minZ;
  }

  // -------------------------------------------------------------- materials
  function facadeMaterial(city, kind, tint, style) {
    var key = kind + ':' + tint + ':' + (style || 'grid');
    if (city.facadeMats[key]) return city.facadeMats[key];
    var pair, mat;
    if (kind === 'glass') {
      pair = BS.Tex.facadeGlass(tint, style || 'grid');
      mat = new THREE.MeshStandardMaterial({
        map: pair.map, emissiveMap: pair.emissive, emissive: 0xffffff,
        emissiveIntensity: 0.04, roughness: 0.3, metalness: 0.42
      });
    } else if (kind === 'warehouse') {
      pair = BS.Tex.facadeWarehouse(tint);
      mat = new THREE.MeshStandardMaterial({
        map: pair, emissiveMap: pair, emissive: 0x000000,
        emissiveIntensity: 0.0, roughness: 0.72, metalness: 0.28
      });
    } else {
      pair = BS.Tex.facadeStucco(tint);
      mat = new THREE.MeshStandardMaterial({
        map: pair.map, emissiveMap: pair.emissive, emissive: 0xffffff,
        emissiveIntensity: 0.04, roughness: 0.88, metalness: 0.0
      });
    }
    mat.userData.nightGlow = kind === 'warehouse' ? 0.4 : 0.85;
    mat.userData.dayGlow = kind === 'warehouse' ? 0.0 : 0.04;
    city.facadeMats[key] = mat;
    city.facadeList.push(mat);
    return mat;
  }

  function collectFacadeMats(city) {
    for (var i = 0; i < city.facadeList.length; i++) {
      if (city.nightMaterials.indexOf(city.facadeList[i]) === -1) city.nightMaterials.push(city.facadeList[i]);
    }
  }

  // ---------------------------------------------------------------- sky/sun
  function buildSky(city, scene) {
    var uniforms = {
      uTop: { value: new THREE.Color(P.skyTop) },
      uHorizon: { value: new THREE.Color(P.skyHorizon) },
      uSunDir: { value: CFG.sun.dir.clone() },
      uSun: { value: new THREE.Color(CFG.sun.colorDay) },
      uNight: { value: 0 }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSun; uniform float uNight;',
        'void main() {',
        '  vec3 d = normalize(vDir);',
        '  float h = clamp(d.y * 1.25 + 0.07, 0.0, 1.0);',
        '  vec3 col = mix(uHorizon, uTop, pow(h, 0.62));',
        '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
        '  col += uSun * pow(sd, 90.0) * 1.4;',
        '  col += uSun * pow(sd, 7.0) * 0.22;',
        '  col += uSun * pow(max(0.0, 1.0 - abs(d.y) * 7.0), 3.0) * 0.12;',
        '  float night = uNight;',
        '  col = mix(col, vec3(0.015, 0.03, 0.08), night * (0.55 + 0.45 * smoothstep(0.0, 0.5, d.y)));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 18), mat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    scene.add(dome);
    city.sky = dome;
    city.skyUniforms = uniforms;

    // sun disc + flare
    var sunTex = BS.Tex.glow();
    var sunMat = new THREE.SpriteMaterial({
      map: sunTex, color: 0xfff2d6, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false
    });
    var sun = new THREE.Sprite(sunMat);
    sun.scale.set(260, 260, 1);
    sun.position.copy(CFG.sun.dir).multiplyScalar(2100);
    scene.add(sun);
    city.sunSprite = sun;

    var flareMat = new THREE.SpriteMaterial({
      map: BS.Tex.streak(), color: 0xffe6c0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var flare = new THREE.Sprite(flareMat);
    flare.scale.set(760, 150, 1);
    flare.position.copy(sun.position);
    scene.add(flare);
    city.sunFlare = flare;

    // stars, night only
    var rng = BS.makeRng(9001);
    var starGeo = new THREE.BufferGeometry();
    var pts = [];
    for (var i = 0; i < 700; i++) {
      var a = rng.angle(), y = rng.float(0.16, 1.0);
      var r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * r * 2600, y * 2600, Math.sin(a) * r * 2600);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xdce9ff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false
    }));
    stars.visible = false;
    scene.add(stars);
    city.stars = stars;

    return dome;
  }

  function buildLights(city, scene) {
    var hemi = new THREE.HemisphereLight(0xc4dcf2, 0xd8b184, 1.15);
    scene.add(hemi);
    city.hemi = hemi;

    var amb = new THREE.AmbientLight(0xffe6c8, 0.32);
    scene.add(amb);
    city.ambient = amb;

    var sun = new THREE.DirectionalLight(CFG.sun.colorDay, CFG.sun.intensityDay);
    sun.position.copy(CFG.sun.dir).multiplyScalar(420);
    sun.castShadow = true;
    sun.shadow.mapSize.set(CFG.render.shadowMap, CFG.render.shadowMap);
    var cam = sun.shadow.camera;
    cam.left = -150; cam.right = 150; cam.top = 150; cam.bottom = -150;
    cam.near = 20; cam.far = 900;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);
    city.sunLight = sun;

    var fill = new THREE.DirectionalLight(0xffc9a0, 0.8);
    fill.position.set(160, 120, -220);
    scene.add(fill);
    city.fillLight = fill;
  }

  // ------------------------------------------------------------------ ocean
  function oceanMaterial(city) {
    var uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 1.0 },
      uDeep: { value: new THREE.Color(P.oceanDeep) },
      uShallow: { value: new THREE.Color(P.ocean) },
      uSun: { value: new THREE.Color(0xffd9a6) },
      uFog: { value: new THREE.Color(CFG.render.fogColorDay) },
      uFogDensity: { value: CFG.render.fogDensityDay }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: [
        'uniform float uTime;',
        'uniform float uAmp;',
        'varying vec3 vWorld;',
        'void main() {',
        '  vec3 p = position;',
        '  float w = sin(p.x * 0.045 + uTime * 1.1) * 0.45',
        '          + sin(p.z * 0.07 - uTime * 1.5) * 0.32',
        '          + sin((p.x + p.z) * 0.021 + uTime * 0.7) * 0.7;',
        '  p.y += (w * 0.5 + 0.5) * uAmp * 0.12;',
        '  vec4 wp = modelMatrix * vec4(p, 1.0);',
        '  vWorld = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSun; uniform vec3 uFog;',
        'uniform float uFogDensity;',
        'varying vec3 vWorld;',
        'void main() {',
        '  float depthMix = clamp((vWorld.z - 620.0) / 900.0, 0.0, 1.0);',
        '  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, depthMix));',
        // five swell lines rolling in toward the beach
        '  float lines = 0.0;',
        '  for (int i = 0; i < 5; i++) {',
        '    float z0 = 632.0 + float(i) * 76.0 + sin(vWorld.x * 0.02 + uTime * 0.4 + float(i) * 1.7) * 15.0;',
        '    lines += exp(-pow((vWorld.z - z0) / 6.5, 2.0)) * (1.0 - float(i) * 0.13);',
        '  }',
        '  col += vec3(0.50, 0.74, 0.78) * clamp(lines, 0.0, 1.0) * 0.34;',
        // fine ripple keeps the surface from reading as a flat sheet
        '  float rip = sin(vWorld.x * 0.11 + uTime * 1.3) * sin(vWorld.z * 0.17 - uTime * 1.1);',
        '  col += vec3(0.10, 0.17, 0.19) * rip * 0.5;',
        // narrow sun path straight down the bay
        '  float sunX = 40.0 + sin(uTime * 0.08) * 26.0;',
        '  float band = exp(-pow((vWorld.x - sunX) / 80.0, 2.0));',
        '  float g = pow(max(0.0, sin(vWorld.x * 0.7 + vWorld.z * 1.4 + uTime * 2.2)), 26.0);',
        '  col += uSun * (band * 0.10 + g * (0.10 + band * 0.34));',
        '  float d = distance(cameraPosition.xz, vWorld.xz);',
        '  float fog = 1.0 - exp(-pow(d * uFogDensity, 2.0));',
        '  col = pow(max(col, vec3(0.0)), vec3(0.4545));',
        '  gl_FragColor = vec4(mix(col, uFog, clamp(fog, 0.0, 1.0)), 1.0);',
        '}'
      ].join('\n')
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(5200, 2600, 160, 90), mat);
    geoLayFlat(mesh.geometry);
    mesh.position.set(0, 0.18, 1913);
    mesh.renderOrder = 1;
    city.oceanUniforms = uniforms;
    return mesh;
  }

  function geoLayFlat(geo) {
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function buildOcean(city, scene) {
    var ocean = oceanMaterial(city);
    scene.add(ocean);
    city.ocean = ocean;
    var mainUniforms = city.oceanUniforms;

    // foam line at the waterline
    var foamMat = new THREE.MeshBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0.34, depthWrite: false });
    var foam = new THREE.Mesh(new THREE.PlaneGeometry(1900, 2.4), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(90, 0.3, 616.4);
    scene.add(foam);
    city.foam = foam;

    // marina bay, calmer
    var bayMesh = oceanMaterial(city);
    var bayMat = bayMesh.material;
    bayMat.uniforms.uAmp.value = 0.45;
    var bay = new THREE.Mesh(new THREE.PlaneGeometry(280, 330, 50, 50), bayMat);
    geoLayFlat(bay.geometry);
    bay.material.uniforms.uTime = city.oceanUniforms.uTime; // shared clock
    bay.material.uniforms.uFog.value = new THREE.Color(CFG.render.fogColorDay);
    bay.position.set(-500, 0.55, 450);
    scene.add(bay);
    city.bayWater = bay;
    city.bayUniforms = bayMat.uniforms;
    city.oceanUniforms = mainUniforms;
  }

  // ------------------------------------------------------------------ roads
  function buildRoads(city, scene) {
    var rng = BS.makeRng(31337);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2200, 2200),
      new THREE.MeshStandardMaterial({ map: BS.Tex.asphalt(), roughness: 0.74, metalness: 0.16, color: 0xb0b6bd })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.02;
    var at = ground.material.map;
    at.repeat.set(110, 110);
    scene.add(ground);
    city.ground = ground;

    var white = [], wuv = [], yellow = [], yuv = [];
    var step = W.step;

    function dashLine(vertical, fixed, offset, from, to) {
      for (var t = from; t <= to; t += 9) {
        // leave the intersections clean
        var near = Math.abs(t / step - Math.round(t / step)) * step;
        if (near < 15) continue;
        if (vertical) pushQuad(white, wuv, fixed + offset, t, 0.26, 2.8);
        else pushQuad(white, wuv, t, fixed + offset, 2.8, 0.26);
      }
    }

    for (var i = -5; i <= 5; i++) {
      var x = i * step;
      dashLine(true, x, -4.6, -594, 594);
      dashLine(true, x, 4.6, -594, 594);
      // double yellow at the centre, broken into block-length runs
      for (var b = -5; b < 5; b++) {
        var mid = b * step + step / 2;
        for (var s = -1; s <= 1; s += 2) {
          pushQuad(yellow, yuv, x + 0.32 * s, mid, 0.26, step - 26, 0.031);
        }
      }
    }
    for (var j = -5; j <= 5; j++) {
      var z = j * step;
      dashLine(false, z, -4.6, -594, 594);
      dashLine(false, z, 4.6, -594, 594);
      for (var bb = -5; bb < 5; bb++) {
        var midd = bb * step + step / 2;
        for (var ss = -1; ss <= 1; ss += 2) {
          pushQuad(yellow, yuv, midd, z + 0.32 * ss, step - 26, 0.26, 0.031);
        }
      }
    }

    // zebra crossings at every intersection
    for (var ix = -5; ix <= 5; ix++) {
      for (var iz = -5; iz <= 5; iz++) {
        var cx = ix * step, cz = iz * step;
        if (cz > 470) continue; // no paint on the sand: the coast road ends the grid
        for (var side = -1; side <= 1; side += 2) {
          for (var q = 0; q < 6; q++) {
            var off = -7.5 + q * 3.0;
            pushQuad(white, wuv, cx + off, cz + side * 12.2, 1.0, 3.0, 0.032);
            pushQuad(white, wuv, cx + side * 12.2, cz + off, 3.0, 1.0, 0.032);
          }
        }
        // stop bars
        pushQuad(white, wuv, cx, cz - 14.6, W.roadHalf * 2 - 2, 0.7, 0.032);
        pushQuad(white, wuv, cx, cz + 14.6, W.roadHalf * 2 - 2, 0.7, 0.032);
      }
    }

    var marks = quadMesh(white, wuv, 0xdedad0);
    scene.add(marks);
    var yellows = quadMesh(yellow, yuv, 0xd8b04a);
    scene.add(yellows);

    // pavements: one slab per block, with a slightly wider curb base
    var walkTex = BS.Tex.sidewalk();
    var walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.92, metalness: 0.0 });
    var curbMat = new THREE.MeshStandardMaterial({ color: P.curb, roughness: 0.95 });
    for (var bi = -5; bi < 5; bi++) {
      for (var bj = -5; bj < 5; bj++) {
        var bx = bi * step + 60, bz = bj * step + 60;
        if (inBay(bx, bz) || bz > 470) continue;
        var base = new THREE.Mesh(new THREE.BoxGeometry(91.5, 0.34, 91.5), curbMat);
        base.position.set(bx, 0.15, bz);
        base.receiveShadow = true;
        scene.add(base);
        var slab = new THREE.Mesh(new THREE.BoxGeometry(90, 0.3, 90), walkMat);
        slab.position.set(bx, 0.2, bz);
        slab.receiveShadow = true;
        scene.add(slab);
      }
    }
  }

  // -------------------------------------------------------------- buildings
  function addBuilding(city, opts) {
    var w = opts.w, h = opts.h, d = opts.d;
    var baseY = opts.baseY || 0.3;
    var geo = new THREE.BoxGeometry(w, h, d);
    var tile = opts.kind === 'glass' ? [18, 24] : opts.kind === 'warehouse' ? [12, 8] : [14, 10.5];
    scaleBoxUV(geo, w, h, d, tile[0], tile[1]);
    var mat = facadeMaterial(city, opts.kind, opts.tint, opts.style);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(opts.x, baseY + h / 2, opts.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    city.group.add(mesh);
    city.buildingMeshes.push(mesh);
    city.roofParts.push(box(w + 0.7, 0.55, d + 0.7, opts.x, baseY + h - 0.22, opts.z, 0x53575b));
    if (!opts.noCollide) {
      city.colliders.push({
        minX: opts.x - w / 2, maxX: opts.x + w / 2,
        minZ: opts.z - d / 2, maxZ: opts.z + d / 2,
        height: h
      });
    }

    // roof furniture
    if (h > 26 && opts.roof !== false) {
      var dark = 0x4b4d4f;
      var parts = [];
      parts.push(box(w * 0.22, 2.2, d * 0.22, opts.x + w * 0.2, baseY + h + 1.1, opts.z - d * 0.2, dark));
      parts.push(box(w * 0.12, 3.0, d * 0.12, opts.x - w * 0.24, baseY + h + 1.5, opts.z + d * 0.18, 0x6a655c));
      if (h > 70) parts.push(cyl(0.18, 0.3, 9, 5, opts.x, baseY + h + 4.5, opts.z, 0x8a8d90));
      var roofMesh = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.8, metalness: 0.3
      }));
      roofMesh.castShadow = true;
      city.group.add(roofMesh);
    }

    // awning over the shop band
    if (opts.awning) {
      var awGeo = new THREE.BoxGeometry(Math.min(w * 0.86, 30), 0.3, 3.4);
      var awMat = new THREE.MeshStandardMaterial({ color: opts.awning, roughness: 0.85 });
      var aw = new THREE.Mesh(awGeo, awMat);
      var side = opts.shopSide || 'z+';
      if (side === 'z+') { aw.position.set(opts.x, 5.0, opts.z + d / 2 + 1.7); }
      else if (side === 'z-') { aw.position.set(opts.x, 5.0, opts.z - d / 2 - 1.7); }
      else if (side === 'x+') { aw.position.set(opts.x + w / 2 + 1.7, 5.0, opts.z); aw.rotation.y = Math.PI / 2; }
      else { aw.position.set(opts.x - w / 2 - 1.7, 5.0, opts.z); aw.rotation.y = Math.PI / 2; }
      aw.castShadow = true;
      city.group.add(aw);
    }

    // awning / shop band on low street-facing buildings
    if (h < 30 && opts.shops) {
      var shops = BS.Tex.shopStrip();
      var sw = Math.min(w * 0.92, 44);
      var sg = new THREE.BoxGeometry(sw, 4.4, 0.5);
      scaleBoxUV(sg, sw, 4.4, 0.5, 32, 6);
      var strip = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({
        map: shops, roughness: 0.7, metalness: 0.05,
        emissiveMap: shops, emissive: 0xffffff, emissiveIntensity: 0.05
      }));
      city.nightMaterials.push(strip.material);
      strip.material.userData.nightGlow = 0.55;
      var side = opts.shopSide || 'z+';
      if (side === 'z+') { strip.position.set(opts.x, 2.6, opts.z + d / 2 + 0.28); }
      else if (side === 'z-') { strip.position.set(opts.x, 2.6, opts.z - d / 2 - 0.28); strip.rotation.y = Math.PI; }
      else if (side === 'x+') { strip.position.set(opts.x + w / 2 + 0.28, 2.6, opts.z); strip.rotation.y = Math.PI / 2; }
      else { strip.position.set(opts.x - w / 2 - 0.28, 2.6, opts.z); strip.rotation.y = -Math.PI / 2; }
      city.group.add(strip);
    }
    return mesh;
  }

  function addNeon(city, opts) {
    var tex = BS.Tex.neon(opts.text, opts.color);
    var w = opts.width || 14;
    var h = w / 4;
    var geo = new THREE.PlaneGeometry(w, h);
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.25, depthWrite: false, fog: true, side: THREE.DoubleSide
    });
    var sign = new THREE.Mesh(geo, mat);
    sign.position.set(opts.x, opts.y, opts.z);
    sign.rotation.y = opts.rotY || 0;
    city.group.add(sign);
    city.neonMaterials.push(mat);
    mat.userData.nightOpacity = 1.0;

    var glowMat = new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: opts.color, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var glow = new THREE.Sprite(glowMat);
    glow.scale.set(w * 1.7, h * 3.2, 1);
    glow.position.copy(sign.position);
    glow.position.x += Math.sin(sign.rotation.y) * 0.6;
    glow.position.z += Math.cos(sign.rotation.y) * 0.6;
    city.group.add(glow);
    city.neonGlows.push(glowMat);
    return sign;
  }

  // --------------------------------------------------------------- street kit
  function buildStreetlights(city, scene) {
    var poleParts = [], headParts = [], pools = [], puv = [];
    var step = W.step;
    var poolTex = BS.Tex.glow();
    function place(x, z) {
      poleParts.push(cyl(0.11, 0.15, 8.4, 6, x, 4.2, z, 0x3b3f42));
      poleParts.push(box(2.2, 0.16, 0.16, x + 1.0, 8.3, z, 0x3b3f42));
      headParts.push(box(0.8, 0.16, 0.34, x + 2.0, 8.2, z, 0xffe0a8));
      pushQuad(pools, puv, x + 2.0, z, 15, 15, 0.05);
    }
    for (var i = -5; i <= 5; i++) {
      for (var t = -540; t <= 540; t += 120) {
        place(i * step + 11.2, t + (i % 2 ? 60 : 0));
      }
    }
    for (var j = -5; j <= 5; j++) {
      for (var t2 = -540; t2 <= 540; t2 += 120) {
        place(t2 + (j % 2 ? 60 : 0), j * step + 11.2);
      }
    }
    var poles = new THREE.Mesh(merge(poleParts), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.55, metalness: 0.65
    }));
    poles.castShadow = true;
    scene.add(poles);

    var heads = new THREE.Mesh(merge(headParts), new THREE.MeshBasicMaterial({ vertexColors: true }));
    scene.add(heads);

    var poolMat = new THREE.MeshBasicMaterial({
      map: poolTex, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending,
      depthWrite: false, color: 0xffbd72
    });
    var poolMesh = new THREE.Mesh((function () {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pools, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(puv, 2));
      g.computeVertexNormals();
      return g;
    })(), poolMat);
    poolMesh.renderOrder = 2;
    scene.add(poolMesh);
    city.lightPools = poolMesh;
  }

  // ------------------------------------------------------------- street kit
  function buildStreetKit(city, scene) {
    var rng = BS.makeRng(8831);
    var metal = [], paint = [], lamps = [];
    // traffic lights on opposite corners of every intersection
    for (var i = -5; i <= 5; i++) {
      for (var j = -5; j <= 5; j++) {
        var cx = i * W.step, cz = j * W.step;
        for (var s = 0; s < 2; s++) {
          var sx = cx + (s ? 12.8 : -12.8);
          var sz = cz + (s ? -12.8 : 12.8);
          metal.push(cyl(0.13, 0.17, 6.4, 6, sx, 3.2, sz, 0x33383b));
          var dirX = sx > cx ? -1 : 1;
          metal.push(box(3.4, 0.15, 0.15, sx + dirX * 1.7, 6.2, sz, 0x33383b));
          var hx = sx + dirX * 3.1;
          lamps.push(box(0.42, 0.28, 0.42, hx, 6.02, sz, 0xff3b2e));
          lamps.push(box(0.42, 0.28, 0.42, hx, 5.64, sz, 0xffc23b));
          lamps.push(box(0.42, 0.28, 0.42, hx, 5.26, sz, 0x35d66b));
        }
      }
    }
    // hydrants, bins and news boxes along the sidewalks
    for (var x = -486; x <= 486; x += 21) {
      for (var side = -1; side <= 1; side += 2) {
        if (Math.abs((x + 600) % 120) < 15) continue;
        var z = side * 13.4;
        var kind = rng.int(0, 2);
        if (kind === 0) {
          paint.push(cyl(0.23, 0.3, 0.85, 7, x, 0.72, z, 0xb33a2b));
          paint.push(cyl(0.28, 0.28, 0.12, 7, x, 1.18, z, 0xd44a37));
          metal.push(cyl(0.09, 0.09, 0.28, 6, x, 1.34, z, 0x8a8d90));
        } else if (kind === 1) {
          metal.push(cyl(0.4, 0.34, 1.02, 8, x, 0.82, z, 0x3c4a45));
          metal.push(cyl(0.43, 0.43, 0.1, 8, x, 1.36, z, 0x2a3430));
        } else {
          paint.push(box(0.66, 0.92, 0.5, x, 0.76, z, 0xd8b23c));
          paint.push(box(0.68, 0.16, 0.52, x, 1.28, z, 0x2f5f9e));
          paint.push(box(0.5, 0.3, 0.06, x, 0.95, z + side * 0.3, 0x24303f));
        }
      }
    }
    var mMesh = new THREE.Mesh(merge(metal), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.5, metalness: 0.6
    }));
    mMesh.castShadow = true;
    scene.add(mMesh);
    var pMesh = new THREE.Mesh(merge(paint), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.75, metalness: 0.15
    }));
    pMesh.castShadow = true;
    scene.add(pMesh);
    var lMesh = new THREE.Mesh(merge(lamps), new THREE.MeshBasicMaterial({ vertexColors: true }));
    scene.add(lMesh);
    city.streetLamps = lMesh;
  }

  // ------------------------------------------------------------- landmarks
  function buildLandmarks(city, scene) {
    var spots = [
      { x: 180, z: 180, h: 206, tint: 0x9fc4d2 },
      { x: -180, z: -60, h: 178, tint: 0x7c9aa8 }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      addBuilding(city, {
        x: s.x, z: s.z, w: 44, d: 44, h: s.h, kind: 'glass',
        tint: s.tint, style: 'fins', roof: false
      });
      addBuilding(city, {
        x: s.x, z: s.z, w: 28, d: 28, h: 16, baseY: 0.3 + s.h, kind: 'glass',
        tint: s.tint, style: 'fins', noCollide: true, roof: false
      });
      var spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 1.3, 26, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.4, metalness: 0.7 })
      );
      spire.position.set(s.x, 0.3 + s.h + 16 + 13, s.z);
      scene.add(spire);
      var beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: BS.Tex.glow(), color: 0xff3b2e, transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      beacon.scale.set(7, 7, 1);
      beacon.position.set(s.x, 0.3 + s.h + 16 + 26, s.z);
      scene.add(beacon);
      city.neonGlows.push(beacon.material);
    }
  }

  // ------------------------------------------------------------------ palms
  function makePalmVariant(rng, height) {
    var group = new THREE.Group();
    var lean = rng.float(-0.12, 0.12);
    var trunkGeo = new THREE.CylinderGeometry(0.2, 0.42, height, 6, 4);
    trunkGeo.translate(0, height / 2, 0);
    var trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({
      color: 0x7a5c3c, roughness: 0.95
    }));
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    group.add(trunk);

    var topX = Math.sin(lean) * -height, topY = Math.cos(lean) * height;
    var fronds = [];
    var count = 8;
    for (var i = 0; i < count; i++) {
      var plane = new THREE.PlaneGeometry(5.2, 2.6, 4, 1);
      plane.translate(2.6, 0, 0);
      var m = new THREE.Matrix4();
      var rot = new THREE.Matrix4().makeRotationY((i / count) * Math.PI * 2 + rng.float(-0.2, 0.2));
      var tilt = new THREE.Matrix4().makeRotationZ(-0.35 - rng.float(0, 0.35));
      plane.applyMatrix4(tilt);
      plane.applyMatrix4(rot);
      plane.translate(topX, topY, 0);
      fronds.push(plane);
    }
    var frondMesh = new THREE.Mesh(merge(fronds), new THREE.MeshStandardMaterial({
      map: BS.Tex.frond(), transparent: true, alphaTest: 0.28, side: THREE.DoubleSide,
      color: 0x94b86a, roughness: 0.9
    }));
    frondMesh.castShadow = true;
    group.add(frondMesh);
    return group;
  }

  function buildPalms(city, scene) {
    var rng = BS.makeRng(5150);
    var variants = [makePalmVariant(rng, 8.5), makePalmVariant(rng, 10.5), makePalmVariant(rng, 7.2)];
    var spots = [];
    // beach row
    for (var x = -320; x <= 570; x += 46) {
      spots.push([x + rng.float(-6, 6), 520 + rng.float(-4, 8)]);
      spots.push([x + 22 + rng.float(-5, 5), 566 + rng.float(-6, 6)]);
    }
    // marina
    for (var i = 0; i < 8; i++) spots.push([-330 + rng.float(-8, 8), 300 + i * 34 + rng.float(-6, 6)]);
    // downtown avenue rows, framing the main street
    for (var ax = -240; ax <= 240; ax += 40) {
      if (Math.abs(ax % 120) < 18) continue;
      spots.push([ax + rng.float(-2.5, 2.5), -15.7 + rng.float(-0.5, 0.5)]);
      spots.push([ax + rng.float(-2.5, 2.5), 15.7 + rng.float(-0.5, 0.5)]);
    }
    // downtown plaza
    for (var j = 0; j < 8; j++) spots.push([-60 + rng.float(-30, 30), -300 + rng.float(-30, 30)]);
    for (var k = 0; k < 6; k++) spots.push([180 + rng.float(-30, 30), 180 + rng.float(-30, 30)]);

    for (var s = 0; s < spots.length; s++) {
      var v = variants[s % 3].clone(true);
      v.position.set(spots[s][0], 0.35, spots[s][1]);
      v.rotation.y = rng.angle();
      var sc = rng.float(0.8, 1.15);
      v.scale.set(sc, sc, sc);
      scene.add(v);
    }
    city.palmCount = spots.length;
  }

  // ------------------------------------------------------------- beach props
  function buildBeach(city, scene) {
    var rng = BS.makeRng(818);
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(1240, 100, 1, 1),
      new THREE.MeshStandardMaterial({ map: BS.Tex.sand(), roughness: 0.98, color: 0xfff1cf })
    );
    sand.material.map.repeat.set(40, 4);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(120, 0.03, 540);
    sand.receiveShadow = true;
    scene.add(sand);

    // narrow sand shoulder between the coast road and the waterline
    var shoulder = new THREE.Mesh(
      new THREE.PlaneGeometry(1240, 6, 1, 1),
      new THREE.MeshStandardMaterial({ map: BS.Tex.sand(), roughness: 0.98, color: 0xe8d3a8 })
    );
    shoulder.material.map = sand.material.map.clone();
    shoulder.material.map.needsUpdate = true;
    shoulder.material.map.repeat.set(220, 2);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(120, 0.04, 611.5);
    shoulder.receiveShadow = true;
    scene.add(shoulder);

    // umbrellas, towels, a lifeguard tower
    var umbCols = [0xe35d4f, 0x2f8f9a, 0xe0b23c, 0xf0efe6];
    var poleMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4 });
    function umbrella(x, z, ci) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), poleMat);
      pole.position.set(x, 1.6, z);
      scene.add(pole);
      var canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.7, 10),
        new THREE.MeshStandardMaterial({ color: umbCols[ci % 4], roughness: 0.85, side: THREE.DoubleSide }));
      canopy.position.set(x, 2.9, z);
      canopy.castShadow = true;
      scene.add(canopy);
      var towel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4),
        new THREE.MeshStandardMaterial({ color: umbCols[(ci + 2) % 4], roughness: 1 }));
      towel.rotation.x = -Math.PI / 2;
      towel.rotation.z = rng.angle();
      towel.position.set(x + rng.float(-2, 2), 0.06, z + 2.6);
      scene.add(towel);
    }
    for (var i = 0; i < 16; i++) {
      umbrella(-280 + i * 52 + rng.float(-10, 10), 545 + rng.float(-16, 20), i);
    }
    // a cluster near the waterline so the near beach is not bare
    for (var u = 0; u < 6; u++) {
      umbrella(-40 + u * 26 + rng.float(-5, 5), 584 + rng.float(-6, 6), u + 2);
    }
    var tower = new THREE.Group();
    var legMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2 });
    for (var l = 0; l < 4; l++) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 5), legMat);
      leg.position.set((l % 2 ? 1 : -1) * 1.3, 1.6, (l < 2 ? 1 : -1) * 1.3);
      tower.add(leg);
    }
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xf2d9a8, roughness: 0.85 }));
    cabin.position.y = 4.1;
    tower.add(cabin);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xc8503f }));
    roof.position.y = 5.2;
    tower.add(roof);
    tower.position.set(-140, 0.4, 566);
    scene.add(tower);
    city.lifeguard = tower;
  }

  // ----------------------------------------------------------------- marina
  function buildMarina(city, scene) {
    var wood = BS.Tex.wood();
    var woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.9 });
    wood.repeat.set(1, 1);
    for (var p = 0; p < 3; p++) {
      var z = 330 + p * 95;
      var pier = new THREE.Mesh(new THREE.BoxGeometry(120, 0.45, 9), woodMat);
      pier.position.set(-420, 1.0, z);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);
      for (var post = 0; post < 12; post++) {
        var pile = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x5d4730 }));
        pile.position.set(-360 - post * 10, 0.2, z + (post % 2 ? 3.8 : -3.8));
        scene.add(pile);
      }
      // a couple of moored boats
      for (var b = 0; b < 2; b++) {
        var bx = -400 - b * 46 + p * 12;
        var hull = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.15, 2.8),
          new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.5 }));
        hull.position.set(bx, 1.35, z + (b ? 6.2 : -6.2));
        scene.add(hull);
        var cab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.2),
          new THREE.MeshStandardMaterial({ color: 0xdfe6e8, roughness: 0.4 }));
        cab.position.set(bx - 1.5, 2.5, hull.position.z);
        scene.add(cab);
      }
    }
    // quay wall along the bay
    var quay = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 320),
      new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.95 }));
    quay.position.set(-359, 0.9, 450);
    quay.castShadow = true;
    scene.add(quay);
    city.colliders.push({ minX: -362, maxX: -356, minZ: 290, maxZ: 610, height: 2.2 });
  }

  // ------------------------------------------------------------- warehouses
  function buildWarehouseLot(city, scene, cx, cz) {
    // open-front warehouse used by the third job
    var wallMat = new THREE.MeshStandardMaterial({ color: 0x8b8f8b, roughness: 0.88, metalness: 0.1 });
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x5c6163, roughness: 0.85, metalness: 0.25 });
    var h = 11, w = 74, d = 60;
    var parts = [];
    // back (east) + two sides, front (west) open
    parts.push(box(1.2, h, d, cx + w / 2, h / 2, cz, 0x8b8f8b));
    parts.push(box(w, h, 1.2, cx, h / 2, cz - d / 2, 0x848883));
    parts.push(box(w, h, 1.2, cx, h / 2, cz + d / 2, 0x848883));
    var walls = new THREE.Mesh(merge(parts), wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    scene.add(walls);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.5, d + 2), roofMat);
    roof.position.set(cx, h + 0.25, cz);
    roof.castShadow = true;
    scene.add(roof);
    // corrugated facade on the two outer faces, drawn as thin planes
    var fac = new THREE.Mesh(new THREE.PlaneGeometry(d, h),
      new THREE.MeshStandardMaterial({ map: BS.Tex.facadeWarehouse(0x8d918d), roughness: 0.8 }));
    fac.rotation.y = Math.PI / 2;
    fac.position.set(cx + w / 2 + 0.62, h / 2, cz);
    scene.add(fac);

    city.colliders.push({ minX: cx + w / 2 - 0.6, maxX: cx + w / 2 + 0.6, minZ: cz - d / 2, maxZ: cz + d / 2, height: h });
    city.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2 - 0.6, maxZ: cz - d / 2 + 0.6, height: h });
    city.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz + d / 2 - 0.6, maxZ: cz + d / 2 + 0.6, height: h });

    // crates and cover inside
    var rng = BS.makeRng(4242);
    var crates = [];
    var spots = [
      [cx - 16, cz - 12], [cx - 16, cz + 13], [cx + 4, cz - 4],
      [cx + 16, cz + 12], [cx + 18, cz - 16], [cx - 4, cz + 20]
    ];
    for (var i = 0; i < spots.length; i++) {
      var size = rng.float(2.2, 3.4);
      crates.push(box(size, size * 1.1, size, spots[i][0], size * 0.55, spots[i][1], 0x8a6a45));
      crates.push(box(size * 0.8, size * 0.8, size * 0.8, spots[i][0] + 2.2, size * 0.4, spots[i][1] + 1.0, 0x9a7a52));
    }
    var crateMesh = new THREE.Mesh(merge(crates), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, map: BS.Tex.wood()
    }));
    crateMesh.castShadow = true;
    crateMesh.receiveShadow = true;
    scene.add(crateMesh);

    var lamp = new THREE.PointLight(0xffd9a0, 1.6, 60, 1.6);
    lamp.position.set(cx, h - 2, cz);
    scene.add(lamp);
    city.warehouseLight = lamp;
    city.warehouse = { x: cx, z: cz, h: h, w: w, d: d };
  }

  function buildIndustrialProps(city, scene, cx, cz, rng) {
    var bits = [];
    for (var i = 0; i < 5; i++) {
      var x = cx + rng.float(-30, 30), z = cz + rng.float(-30, 30);
      var h = rng.float(2, 4);
      bits.push(box(2.4, h, 2.4, x, h / 2, z, 0x7c6a4e));
    }
    // containers
    var cols = [0xa8483a, 0x2f6f7a, 0xb98a2e, 0x5b6c52];
    for (var c = 0; c < 4; c++) {
      bits.push(box(12, 2.6, 2.7, cx + rng.float(-26, 26), 1.3, cz + rng.float(-26, 26), cols[c]));
    }
    var mesh = new THREE.Mesh(merge(bits), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // ------------------------------------------------------------------- blocks
  function buildBlocks(city, scene) {
    var rng = BS.makeRng(76231);
    var step = W.step;
    var glassList = P.glass, stuccoList = P.stucco, whList = P.warehouse;

    for (var bi = -5; bi < 5; bi++) {
      for (var bj = -5; bj < 5; bj++) {
        var cx = bi * step + 60, cz = bj * step + 60;
        var dist = districtAt(cx, cz);
        if (inBay(cx, cz)) continue;
        if (dist.id === 'beach') continue;
        if (dist.id === 'industrial' && cx > 360 && cz < -360) { buildWarehouseLot(city, scene, cx, cz); continue; }
        // two plaza blocks stay open
        if ((cx === -60 && cz === -300) || (cx === 180 && cz === 180)) continue;

        if (dist.id === 'downtown') {
          var tw = rng.float(56, 78), td = rng.float(56, 78);
          var roll = rng.float(0, 1);
          var th = roll < 0.3 ? rng.float(30, 52) : roll < 0.7 ? rng.float(52, 98) : rng.float(98, 158);
          var style = rng.pick(['grid', 'bands', 'fins']);
          var tint = rng.pick(glassList);
          var stone = th < 94 && rng.chance(0.28);
          var kind = stone ? 'stucco' : 'glass';
          if (stone) tint = rng.pick([0xe8d3b4, 0xc98a63, 0xdcc7a8, 0xb98f74]);
          var shopSide = rng.pick(['z+', 'z-', 'x+', 'x-']);
          var shop = rng.chance(0.6);
          addBuilding(city, {
            x: cx + rng.float(-4, 4), z: cz + rng.float(-4, 4),
            w: tw, d: td, h: th, kind: kind, tint: tint, style: style,
            shops: shop, shopSide: shopSide,
            awning: shop ? rng.pick([0x9c3b3b, 0x2f5f6e, 0xc8913c, 0x3e6b4a]) : null
          });
          // stepped crown on the tall ones
          if (th > 92) {
            var cw2 = tw * rng.float(0.48, 0.68), cd2 = td * rng.float(0.48, 0.68), ch2 = rng.float(12, 30);
            addBuilding(city, {
              x: cx + rng.float(-2, 2), z: cz + rng.float(-2, 2),
              w: cw2, d: cd2, h: ch2, baseY: 0.3 + th,
              kind: kind, tint: tint, style: style, roof: true, noCollide: true
            });
          } else if (th > 48 && rng.chance(0.35)) {
            var pw = tw * 0.9, pd2 = td * 0.9;
            addBuilding(city, {
              x: cx, z: cz, w: pw, d: pd2, h: rng.float(3, 7), baseY: 0.3 + th,
              kind: kind, tint: tint, style: style, roof: false, noCollide: true
            });
          }
          // neon on the avenue-facing faces
          if (rng.chance(0.85)) {
            var color = rng.pick(P.neon);
            var text = rng.pick(['HOTEL', 'CLUB', 'SOL', 'MAR', 'RADIO', '24H', 'CAFÉ', 'SUR', 'MOTEL', 'BAHÍA', 'NOCTURNO']);
            var face = shopSide;
            var nx = cx, nz = cz, rotY = 0;
            if (face === 'z+') { nz = cz + td / 2 + 1.2; rotY = 0; }
            else if (face === 'z-') { nz = cz - td / 2 - 1.2; rotY = Math.PI; }
            else if (face === 'x+') { nx = cx + tw / 2 + 1.2; rotY = Math.PI / 2; }
            else { nx = cx - tw / 2 - 1.2; rotY = -Math.PI / 2; }
            addNeon(city, {
              x: nx, z: nz, y: rng.float(9, Math.max(12, th * 0.42)),
              text: text, color: color, width: rng.float(11, 17), rotY: rotY
            });
          }
        } else if (dist.id === 'marina' || dist.id === 'costa') {
          var count = rng.int(2, 3);
          for (var m = 0; m < count; m++) {
            var bw = rng.float(24, 38), bd = rng.float(22, 34);
            var bh = rng.float(9, 26);
            var ox = (m % 2 ? 1 : -1) * rng.float(8, 20);
            var oz = (m < 2 ? -1 : 1) * rng.float(8, 20);
            addBuilding(city, {
              x: cx + ox, z: cz + oz, w: bw, d: bd, h: bh,
              kind: 'stucco', tint: rng.pick(stuccoList),
              shops: rng.chance(0.5), shopSide: rng.pick(['z+', 'z-', 'x+', 'x-'])
            });
          }
          if (rng.chance(0.55)) {
            addNeon(city, {
              x: cx, z: cz + 28, y: rng.float(6, 12),
              text: rng.pick(['MAR', 'SOL', 'CAFÉ', 'HOTEL', 'DOCK']), color: rng.pick(P.neon),
              width: rng.float(7, 11), rotY: 0
            });
          }
        } else if (dist.id === 'industrial') {
          var ww = rng.float(62, 80), wd = rng.float(48, 64), wh = rng.float(8, 13);
          addBuilding(city, {
            x: cx, z: cz + rng.float(-3, 3), w: ww, d: wd, h: wh,
            kind: 'warehouse', tint: rng.pick(whList), shops: false
          });
          buildIndustrialProps(city, scene, cx, cz, rng);
        } else {
          var n = rng.int(3, 4);
          for (var b = 0; b < n; b++) {
            var lw = rng.float(20, 32), ld = rng.float(20, 30), lh = rng.float(7, 19);
            addBuilding(city, {
              x: cx + rng.float(-22, 22), z: cz + rng.float(-22, 22),
              w: lw, d: ld, h: lh, kind: rng.chance(0.35) ? 'glass' : 'stucco',
              tint: rng.chance(0.35) ? rng.pick(glassList) : rng.pick(stuccoList),
              shops: rng.chance(0.6), shopSide: rng.pick(['z+', 'z-', 'x+', 'x-'])
            });
          }
        }

        // a little street furniture at the block corner
        if (rng.chance(0.5)) {
          var bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.7),
            new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }));
          bench.position.set(cx + rng.float(-34, 34), 0.75, cz + (rng.chance(0.5) ? 41 : -41));
          bench.castShadow = true;
          scene.add(bench);
        }
      }
    }
    collectFacadeMats(city);
  }

  // ------------------------------------------------------------ day / night
  function setNight(city, night) {
    city.night = !!night;
    var fog = night ? CFG.render.fogColorNight : CFG.render.fogColorDay;
    city.scene.fog.color.setHex(fog);
    city.scene.fog.density = night ? CFG.render.fogDensityNight : CFG.render.fogDensityDay;
    city.scene.background = null;

    city.skyUniforms.uTop.value.setHex(night ? P.nightTop : P.skyTop);
    city.skyUniforms.uHorizon.value.setHex(night ? P.nightHorizon : P.skyHorizon);
    city.skyUniforms.uNight.value = night ? 1 : 0;
    city.skyUniforms.uSun.value.setHex(night ? 0x2a3a66 : CFG.sun.colorDay);

    city.sunLight.color.setHex(night ? CFG.sun.colorNight : CFG.sun.colorDay);
    city.sunLight.intensity = night ? CFG.sun.intensityNight : CFG.sun.intensityDay;
    city.hemi.intensity = night ? 0.42 : 0.95;
    city.hemi.color.setHex(night ? 0x26365a : 0xbcd8f2);
    city.hemi.groundColor.setHex(night ? 0x131722 : 0xc9a87c);

    city.sunSprite.visible = !night;
    city.sunFlare.visible = !night;
    city.stars.visible = !!night;

    var i;
    for (i = 0; i < city.nightMaterials.length; i++) {
      var m = city.nightMaterials[i];
      m.emissiveIntensity = night ? (m.userData.nightGlow || 0.55) : (m.userData.dayGlow || 0.04);
    }
    for (i = 0; i < city.neonMaterials.length; i++) {
      city.neonMaterials[i].opacity = night ? (city.neonMaterials[i].userData.nightOpacity || 1) : 0.22;
    }
    for (i = 0; i < city.neonGlows.length; i++) {
      city.neonGlows[i].opacity = night ? 0.5 : 0.0;
    }
    city.lightPools.material.opacity = night ? 0.55 : 0.0;
    if (city.oceanUniforms) {
      city.oceanUniforms.uFog.value.setHex(fog);
      city.oceanUniforms.uFogDensity.value = night ? CFG.render.fogDensityNight : CFG.render.fogDensityDay;
      city.oceanUniforms.uShallow.value.setHex(night ? 0x0b2634 : P.ocean);
      city.oceanUniforms.uDeep.value.setHex(night ? 0x061520 : P.oceanDeep);
      city.oceanUniforms.uSun.value.setHex(night ? 0x556a8a : 0xffd9a6);
    }
    if (city.bayWater) {
      var bu = city.bayUniforms;
      bu.uFog.value.setHex(fog);
      bu.uFogDensity.value = night ? CFG.render.fogDensityNight : CFG.render.fogDensityDay;
      bu.uShallow.value.setHex(night ? 0x0b2634 : P.ocean);
      bu.uDeep.value.setHex(night ? 0x061520 : P.oceanDeep);
      bu.uSun.value.setHex(night ? 0x556a8a : 0xffd9a6);
    }
    if (city.ground) city.ground.material.color.setHex(night ? 0x596070 : 0xdfe0e2);
    if (city.warehouseLight) city.warehouseLight.intensity = night ? 2.4 : 1.4;
    if (city.moon) city.moon.intensity = night ? 0.4 : 0;
  }

  // ------------------------------------------------------------------- build
  function build(scene, opts) {
    opts = opts || {};
    var city = {
      scene: scene,
      group: new THREE.Group(),
      colliders: [],
      buildingMeshes: [],
      roofParts: [],
      facadeMats: {},
      facadeList: [],
      nightMaterials: [],
      neonMaterials: [],
      neonGlows: [],
      night: false
    };
    scene.add(city.group);

    scene.fog = new THREE.FogExp2(CFG.render.fogColorDay, CFG.render.fogDensityDay);

    buildSky(city, scene);
    buildLights(city, scene);
    buildOcean(city, scene);
    buildRoads(city, scene);
    buildMarina(city, scene);
    buildBeach(city, scene);
    buildBlocks(city, scene);
    if (city.roofParts.length) {
      var roofs = new THREE.Mesh(merge(city.roofParts), new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.92, metalness: 0.08
      }));
      roofs.castShadow = true;
      scene.add(roofs);
    }
    buildPalms(city, scene);
    buildStreetlights(city, scene);
    buildStreetKit(city, scene);
    buildLandmarks(city, scene);

    // moon light, only used at night
    var moon = new THREE.DirectionalLight(0x92b4ff, 0);
    moon.position.set(160, 220, -120);
    scene.add(moon);
    city.moon = moon;

    // drift a little haze above the horizon
    var hazeMat = new THREE.MeshBasicMaterial({
      map: BS.Tex.glow(), color: 0xffd9b0, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var haze = new THREE.Mesh(new THREE.PlaneGeometry(2400, 260), hazeMat);
    haze.position.set(-900, 60, 700);
    haze.lookAt(0, 60, 0);
    scene.add(haze);
    city.haze = haze;

    setNight(city, false);
    city.setNight = function (on) { setNight(city, on); };

    city.update = function (dt, time) {
      if (city.oceanUniforms) city.oceanUniforms.uTime.value = time;
      if (city.sunLight) {
        // keep the shadow frustum around the action; the caller moves the target
      }
    };

    return city;
  }

  BS.City = {
    build: build,
    districtAt: districtAt,
    streetLine: streetLine,
    inBay: inBay,
    setNight: setNight,
    makePalmVariant: makePalmVariant
  };
  BS.Geo = { paint: paint, merge: merge, box: box, cyl: cyl, scaleBoxUV: scaleBoxUV };
})(window.BS);
