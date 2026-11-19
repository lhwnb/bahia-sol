/* Bahía Sol — shared tunables.
   Everything a designer would want to nudge lives here: the city grid, the
   palette, car handling, weapons, district rules and the three story jobs. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var V3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };

  BS.CFG = {
    // ---- world geometry -------------------------------------------------
    world: {
      size: 1200,          // metres across, centred on the origin
      step: 120,           // road centre lines every 120 m
      roadHalf: 9,         // asphalt half-width
      walk: 6,             // sidewalk width on each side of the asphalt
      blockHalf: 45,       // walkable block half-size (step/2 - roadHalf - walk)
      gridMin: -600,
      gridMax: 600,
      beachStart: 505,     // sand begins here (south)
      shoreZ: 600,         // waterline
      bay: { minX: -600, maxX: -360, minZ: 300, maxZ: 600 },
      warehouse: { minX: 250, maxX: 470, minZ: -520, maxZ: -300 }
    },

    // ---- look ------------------------------------------------------------
    render: {
      exposure: 1.16,
      fogColorDay: 0xf3caa0,
      fogColorNight: 0x0b1220,
      fogDensityDay: 0.00115,
      fogDensityNight: 0.0018,
      shadowMap: 2048,
      maxPixelRatio: 1.5
    },
    sun: {
      // low, due west: the cover shot drives straight into it down Av. Sol
      dir: V3(-0.985, 0.145, 0.012).normalize(),
      colorDay: 0xffd2a0,
      colorNight: 0x9db6e8,
      intensityDay: 2.5,
      intensityNight: 0.22,
      distance: 900
    },
    palette: {
      asphalt: 0x2b2c31,
      asphaltWet: 0x1b1d24,
      sidewalk: 0xb5aea0,
      curb: 0x8d877c,
      sand: 0xe6cf9f,
      ocean: 0x2b8fa8,
      oceanDeep: 0x0a3350,
      skyTop: 0x2f6fa8,
      skyHorizon: 0xf6c79a,
      nightTop: 0x050a18,
      nightHorizon: 0x1d2b4a,
      neon: [0xff3fa4, 0x35e6ff, 0xffb347, 0xb6ff5a, 0xff6b3d, 0x8f7dff],
      glass: [0x8fb0c4, 0x9fc4d2, 0x6f8ea3, 0xb9cdd6, 0x7c9aa8, 0xc3b39a, 0x63828c],
      stucco: [0xf1c9a5, 0xf6e0c2, 0xe7a98d, 0xd7e3d5, 0xf2d9b0, 0xe9b9a0, 0xe8d3b4, 0xc98a63],
      warehouse: [0x8d918d, 0x767b78, 0xa39f93, 0x6b716f],
      cars: [0xc8232c, 0xf2f2ef, 0x1d1f24, 0x2f5f9e, 0xe0b23c, 0x2f8f7a, 0x8d8f95,
             0x6b2f4a, 0xd9d2c4, 0x37506b, 0xa8432f, 0x2a2d34]
    },

    // ---- vehicles --------------------------------------------------------
    cars: {
      falcon:  { name: 'Falcon GT',   kind: 'muscle',  length: 4.9, width: 2.0, height: 1.28, cabin: 0.52, maxSpeed: 46, accel: 17, brake: 30, grip: 8.0, mass: 1.2 },
      sedan:   { name: 'Costa',       kind: 'sedan',   length: 4.5, width: 1.86, height: 1.34, cabin: 0.46, maxSpeed: 34, accel: 12, brake: 24, grip: 8.6, mass: 1.0 },
      taxi:    { name: 'Taxi Sol',    kind: 'sedan',   length: 4.6, width: 1.9, height: 1.38, cabin: 0.48, maxSpeed: 32, accel: 11, brake: 22, grip: 8.2, mass: 1.0 },
      van:     { name: 'Panamericana',kind: 'van',     length: 5.3, width: 2.05, height: 2.15, cabin: 0.72, maxSpeed: 27, accel: 8, brake: 19, grip: 7.0, mass: 1.7 },
      pickup:  { name: 'Mulo',        kind: 'pickup',  length: 5.0, width: 2.0, height: 1.55, cabin: 0.4, maxSpeed: 33, accel: 12, brake: 22, grip: 7.4, mass: 1.4 },
      sport:   { name: 'Vela S',      kind: 'sport',   length: 4.4, width: 1.95, height: 1.12, cabin: 0.44, maxSpeed: 50, accel: 20, brake: 32, grip: 9.0, mass: 1.0 },
      cruiser: { name: 'Policía',     kind: 'cruiser', length: 4.8, width: 1.98, height: 1.42, cabin: 0.5, maxSpeed: 42, accel: 16, brake: 28, grip: 8.4, mass: 1.3 },
      rival:   { name: 'Chatarra',    kind: 'sedan',   length: 4.4, width: 1.9, height: 1.3, cabin: 0.46, maxSpeed: 30, accel: 10, brake: 20, grip: 7.6, mass: 1.0 }
    },
    traffic: { count: 30, speedScale: 0.72, honkChance: 0.004 },
    peds: { count: 50, walkSpeed: 1.35, runSpeed: 4.4 },

    // ---- combat ----------------------------------------------------------
    weapons: {
      fists:  { name: 'Puños',    damage: 14, rate: 0.42, range: 2.6, spread: 0,    ammo: -1, sound: 'punch' },
      pistol: { name: 'Pistola',  damage: 34, rate: 0.28, range: 130, spread: 0.006, ammo: 12, sound: 'pistol', tracer: 0xffe0a0 },
      smg:    { name: 'Subfusil', damage: 19, rate: 0.085, range: 95, spread: 0.022, ammo: 30, sound: 'smg', tracer: 0xfff0b0 }
    },
    player: { health: 100, armour: 50, walk: 4.2, sprint: 7.6, radius: 0.42, height: 1.78 },
    police: { maxCruisers: 6, shootRange: 46, ramRange: 18, decaySeconds: 20, bustSeconds: 3.2 },

    // ---- HUD / flow ------------------------------------------------------
    startCash: 350,
    hospital: V3(-84, 0, 132),
    station: V3(156, 0, -132),
    spawn: V3(13, 0, 352),
    tickerSeconds: 5.5,

    // ---- story jobs ------------------------------------------------------
    missions: [
      {
        id: 'marina',
        speaker: 'Rafa Vela',
        title: 'La Roja',
        line: 'That red Falcon at the marina? It is mine. Take it to the docks before the policía count the tide.',
        objective: 'Steal La Roja at the marina, deliver it to the docks',
        hint: 'La Roja is parked by the marina pier. 3:00 on the clock.',
        reward: 2500,
        seconds: 180,
        giver: V3(-300, 0, 372),
        carSpot: V3(-252, 0, 336),
        dropoff: V3(-347, 0, 306)
      },
      {
        id: 'drops',
        speaker: 'Nina Cruz',
        title: 'Three Falls',
        line: 'Three packages, three corners, and the policía already awake. Do not stop for the lights.',
        objective: 'Make three drop-offs with the policía on you',
        hint: 'Follow the markers. Keep moving.',
        reward: 4000,
        seconds: 165,
        giver: V3(-347, 0, 306),
        drops: [V3(66, 0, 228), V3(-66, 0, -132), V3(228, 0, 66)]
      },
      {
        id: 'warehouse',
        speaker: 'El Ruso',
        title: 'The Warehouse',
        line: 'Six of them in my warehouse, counting my crates. Go in, and make sure nobody counts after you.',
        objective: 'Clear the warehouse of six rivals',
        hint: 'Warehouse on the north quay. Six rivals, all armed.',
        reward: 6000,
        seconds: 0,
        giver: V3(348, 0, -390),
        warehouse: { x: 420, z: -420 }
      }
    ],
    epilogue: 'El Ruso: The city is yours now, chaval. Try not to burn all of it.'
  };
})(window.BS);
