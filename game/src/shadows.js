/* Bahía Sol — ground contact kit.
   Two instanced multiply-blended blobs: one pool under every car, a lighter one
   under every pedestrian and under the player's boots. Without these the whole
   cast floats a hand's width above the pavement. Also exposes the facade base
   shading that city.js bakes into the building rows. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CAP_CARS = 120, CAP_PEDS = 160;
  var kit = null;
  var tmpObj = null, tmpPos = null, tmpQuat = null, tmpScale = null;

  function groundY(x, z) {
    return BS.City && BS.City.groundYAt ? BS.City.groundYAt(x, z) : 0;
  }

  function makeLayer(scene, cap, opacityScale) {
    var geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({
      map: BS.Tex.contactShadow(),
      color: 0xffffff,
      transparent: true,
      opacity: opacityScale,
      depthWrite: false,
      depthTest: true,
      
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8
    });
    var mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.count = 0;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    return mesh;
  }

  function init(scene) {
    if (kit) return kit;
    kit = {
      cars: makeLayer(scene, CAP_CARS, 1.0),
      peds: makeLayer(scene, CAP_PEDS, 0.82)
    };
    tmpObj = new THREE.Object3D();
    tmpPos = new THREE.Vector3();
    tmpQuat = new THREE.Quaternion();
    tmpScale = new THREE.Vector3(1, 1, 1);
    return kit;
  }

  function placeAt(layer, index, x, z, sx, sz, rot) {
    tmpPos.set(x, groundY(x, z) + 0.035, z);
    tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot || 0);
    tmpScale.set(sx, 1, sz);
    tmpObj.position.copy(tmpPos);
    tmpObj.quaternion.copy(tmpQuat);
    tmpObj.scale.copy(tmpScale);
    tmpObj.updateMatrix();
    layer.setMatrixAt(index, tmpObj.matrix);
  }

  // Called once per rendered frame (play or shot) with the live game object.
  function update(game) {
    if (!game || !game.scene) return;
    var k = init(game.scene);
    var ci = 0, pi = 0, i, car, ped, s;

    for (i = 0; i < game.cars.length; i++) {
      car = game.cars[i];
      if (!car || !car.group || !car.group.visible) continue;
      if (ci >= CAP_CARS) break;
      s = car.spec;
      placeAt(k.cars, ci++,
        car.group.position.x, car.group.position.z,
        ((s && s.width) || 1.9) * 1.14 + 0.35, ((s && s.length) || 4.4) * 1.03 + 0.4,
        car.group.rotation.y);
    }
    if (k.cars.count !== ci) { k.cars.count = ci; }
    k.cars.instanceMatrix.needsUpdate = true;

    var peds = game.peds && game.peds.peds;
    if (peds) {
      for (i = 0; i < peds.length; i++) {
        ped = peds[i];
        if (!ped || !ped.alive) continue;
        if (pi >= CAP_PEDS) break;
        placeAt(k.peds, pi++, ped.x, ped.z,
          ped.rival ? 0.82 : 0.78, ped.rival ? 0.92 : 0.74, ped.heading);
      }
    }
    if (game.player && !game.player.inCar && game.player.mesh && game.player.mesh.visible) {
      if (pi < CAP_PEDS) {
        placeAt(k.peds, pi++, game.player.pos.x, game.player.pos.z, 0.86, 0.84, game.player.heading);
      }
    }
    if (k.peds.count !== pi) { k.peds.count = pi; }
    k.peds.instanceMatrix.needsUpdate = true;
  }

  BS.Shadows = { init: init, update: update, groundY: groundY };
})(window.BS);
