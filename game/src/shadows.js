/* Bahía Sol — ground contact kit.
   Three instanced decals, all laid flat on the ground plane and centred on the
   object that owns them:
     · carSoft — broad footprint scaled to wheelbase × track, soft radial
                 falloff that reaches zero at the outline (0.22 opacity)
     · carCore — half-size, darker pool directly under the chassis
     · peds    — one tight 0.55 m blob per person, faded per instance while the
                 walk cycle lifts a foot off the tarmac
   Also exposes the facade base shading that city.js bakes into the building
   rows (untouched here). */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CAP_CARS = 120, CAP_PEDS = 160;
  var GROUND_LIFT = 0.02;   // decal sits this far above the sampled ground
  var kit = null;
  var tmpObj = null, tmpPos = null, tmpQuat = null, tmpScale = null, UP = null;

  function groundY(x, z) {
    return BS.City && BS.City.groundYAt ? BS.City.groundYAt(x, z) : 0;
  }

  function makeLayer(scene, cap, map, opacity, perInstanceDim) {
    var geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);

    var mat = new THREE.MeshBasicMaterial({
      map: map,
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8
    });

    var dim = null;
    if (perInstanceDim) {
      dim = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      dim.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aDim', dim);
      // multiply the decal's alpha by the per-instance weight: one draw call,
      // no material swaps, no per-frame allocation
      mat.onBeforeCompile = function (shader) {
        shader.vertexShader = 'attribute float aDim;\nvarying float vDim;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n\tvDim = aDim;'
          );
        shader.fragmentShader = 'varying float vDim;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n\tdiffuseColor.a *= vDim;'
          );
      };
      // without its own key this material would reuse carCore's compiled
      // program (identical parameters) and the patch would never run
      mat.customProgramCacheKey = function () { return 'bs-blob-dim'; };
    } else {
      mat.customProgramCacheKey = function () { return 'bs-blob'; };
    }

    var mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.count = 0;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.dim = dim;
    scene.add(mesh);
    return mesh;
  }

  function init(scene) {
    if (kit) return kit;
    kit = {
      carSoft: makeLayer(scene, CAP_CARS, BS.Tex.contactShadow(), 0.22, false),
      carCore: makeLayer(scene, CAP_CARS, BS.Tex.contactCore(), 0.30, false),
      peds: makeLayer(scene, CAP_PEDS, BS.Tex.contactCore(), 0.48, true)
    };
    kit.carCore.renderOrder = 3;
    kit.peds.renderOrder = 3;
    tmpObj = new THREE.Object3D();
    tmpPos = new THREE.Vector3();
    tmpQuat = new THREE.Quaternion();
    tmpScale = new THREE.Vector3(1, 1, 1);
    UP = new THREE.Vector3(0, 1, 0);
    return kit;
  }

  // Exact world x/z of the owner, zero lateral offset, laid on the ground.
  function placeAt(layer, index, x, z, sx, sz, rot) {
    tmpPos.set(x, groundY(x, z) + GROUND_LIFT, z);
    tmpQuat.setFromAxisAngle(UP, rot || 0);
    tmpScale.set(sx, 1, sz);
    tmpObj.position.copy(tmpPos);
    tmpObj.quaternion.copy(tmpQuat);
    tmpObj.scale.copy(tmpScale);
    tmpObj.updateMatrix();
    layer.setMatrixAt(index, tmpObj.matrix);
  }

  function setDim(layer, index, value) {
    var dim = layer.userData.dim;
    if (dim) dim.array[index] = value;
  }

  // Called once per rendered frame (play or shot) with the live game object.
  function update(game) {
    if (!game || !game.scene) return;
    var k = init(game.scene);
    var ci = 0, pi = 0, i, car, ped, s, track, base, rot;

    for (i = 0; i < game.cars.length; i++) {
      car = game.cars[i];
      if (!car || !car.group || !car.group.visible) continue;
      if (ci >= CAP_CARS) break;
      s = car.spec;
      // wheels live at ±0.32·length and ±width/2, so the footprint follows them
      track = ((s && s.width) || 1.9) * 1.02;
      base = ((s && s.length) || 4.4) * 0.64;
      rot = car.group.rotation.y;
      placeAt(k.carSoft, ci, car.group.position.x, car.group.position.z,
        track + 0.34, base + 0.62, rot);
      placeAt(k.carCore, ci, car.group.position.x, car.group.position.z,
        track * 0.98, base * 0.86, rot);
      ci++;
    }
    if (k.carSoft.count !== ci) k.carSoft.count = ci;
    if (k.carCore.count !== ci) k.carCore.count = ci;
    k.carSoft.instanceMatrix.needsUpdate = true;
    k.carCore.instanceMatrix.needsUpdate = true;

    var peds = game.peds && game.peds.peds;
    if (peds) {
      for (i = 0; i < peds.length; i++) {
        ped = peds[i];
        if (!ped || !ped.alive) continue;
        if (pi >= CAP_PEDS) break;
        // 0.55 m radius, pressed tighter and lifted a touch while a foot swings
        var lift = ped.lift > 0 ? ped.lift : 0;
        var shrink = 1 - 0.14 * lift;
        placeAt(k.peds, pi, ped.x, ped.z, 1.1 * shrink, 1.1 * shrink, ped.heading);
        setDim(k.peds, pi, 1 - 0.42 * lift);
        pi++;
      }
    }
    if (game.player && !game.player.inCar && game.player.mesh && game.player.mesh.visible) {
      if (pi < CAP_PEDS) {
        placeAt(k.peds, pi, game.player.pos.x, game.player.pos.z, 1.1, 1.1, game.player.heading);
        setDim(k.peds, pi, 1);
        pi++;
      }
    }
    if (k.peds.count !== pi) k.peds.count = pi;
    k.peds.instanceMatrix.needsUpdate = true;
    if (k.peds.userData.dim) k.peds.userData.dim.needsUpdate = true;
  }

  BS.Shadows = { init: init, update: update, groundY: groundY };
})(window.BS);
