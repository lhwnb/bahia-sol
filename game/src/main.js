/* Bahía Sol — bootstrap and the game loop.
   Builds the renderer, the world and every system, wires the title and pause
   menus, routes ?shot= to the deterministic stages, and runs one fixed order of
   updates per frame. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;
  var canvas = document.getElementById('game');
  var uiLayer = document.getElementById('ui');
  var params = new URLSearchParams(window.location.search);
  var shotName = params.get('shot');
  var isShot = !!shotName;

  // ------------------------------------------------------------- renderer
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.render.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CFG.render.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.12, 4200);

  BS.Fx.init(scene);
  var city = BS.City.build(scene, { seed: 7411 });
  BS.Shadows.init(scene);
  if (BS.Env) {
    BS.Env.init(renderer);
    BS.Env.apply(scene, 'golden');
  }

  var game = {
    scene: scene,
    camera: camera,
    renderer: renderer,
    city: city,
    cars: [],
    cash: CFG.startCash,
    time: 0,
    mode: 'title',
    paused: false,
    respawnTimer: 0,
    respawnKind: null,
    saveTimer: 20,
    shotName: shotName || ''
  };
  window.BS.game = game;

  var input = new BS.Input(canvas);
  game.input = input;

  var player = new BS.Player(scene, camera, city);
  game.player = player;

  var parked = BS.Vehicles.spawnParked(scene, city, BS.makeRng(1001));
  for (var i = 0; i < parked.length; i++) game.cars.push(parked[i]);

  var traffic = new BS.Traffic(scene, city, BS.makeRng(2002));
  traffic.populate(player.pos);
  for (var t = 0; t < traffic.cars.length; t++) game.cars.push(traffic.cars[t].car);
  game.traffic = traffic;

  var peds = new BS.Pedestrians(scene, city, BS.makeRng(3003));
  game.peds = peds;

  var combat = new BS.Combat(scene, camera, player, city, game);
  game.combat = combat;
  player.weaponDrawn = true;

  var police = new BS.Police(scene, city, player, game);
  game.police = police;

  var missions = new BS.Missions(scene, city, game);
  game.missions = missions;

  var hud = BS.HUD;
  hud.init(game);
  game.hud = hud;

  game.saves = BS.Saves;
  game.saveState = function () { BS.Saves.save(game); };
  game.onPedKilled = function (ped) {
    if (ped.rival) {
      game.cash += 150;
      hud.cashChanged();
      hud.ticker('Rival abatido · +$150');
      if (BS.Audio) BS.Audio.ui('pickup');
    } else {
      police.addWanted(2);
      hud.ticker('Testigo en el suelo: la policía lo sabe');
    }
  };
  game.onBusted = function () {
    if (game.respawnTimer > 0) return;
    startRespawn('busted');
  };
  game.shotExtra = [];

  // --------------------------------------------------------------- camera
  function followSunAt(x, z) {
    var d = CFG.sun.dir;
    city.sunLight.position.set(x + d.x * 420, Math.max(60, d.y * 420), z + d.z * 420);
    city.sunLight.target.position.set(x, 0, z);
    city.sunLight.target.updateMatrixWorld();
  }
  function followSun() {
    var p = player.pos;
    followSunAt(p.x, p.z);
  }
  followSun();

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);

  // ----------------------------------------------------------------- menus
  var startScreen = BS.HUD.el('div', '');
  startScreen.id = 'start-screen';
  startScreen.innerHTML = [
    '<div class="title-block">',
    '  <div class="eyebrow">Costa del Crimen · Playa Sol</div>',
    '  <h1>Bahía<br>Sol<span>Un mundo abierto bajo el sol</span></h1>',
    '  <p class="lede">Tres trabajos, una ciudad y demasiado calor. Roba el Falcon rojo de la marina,',
    '  corre tres entregas con la policía pisándote los talones y limpia el almacén de El Ruso.</p>',
    '  <div class="controls">',
    '    <div><kbd>W A S D</kbd><span>Caminar / conducir</span></div>',
    '    <div><kbd>RATÓN</kbd><span>Mirar / apuntar</span></div>',
    '    <div><kbd>SHIFT</kbd><span>Correr / freno de mano</span></div>',
    '    <div><kbd>CLIC IZQ.</kbd><span>Disparar</span></div>',
    '    <div><kbd>E</kbd><span>Entrar / salir del coche</span></div>',
    '    <div><kbd>1 · 2 · Q</kbd><span>Pistola / subfusil / puños</span></div>',
    '    <div><kbd>M</kbd><span>Silenciar el audio</span></div>',
    '    <div><kbd>ESC</kbd><span>Pausa y guardado</span></div>',
    '  </div>',
    '  <div class="menu-buttons">',
    '    <button class="menu-btn" id="btn-new">Nueva partida</button>',
    '    <button class="menu-btn ghost" id="btn-continue">Continuar</button>',
    '  </div>',
    '  <div class="menu-note">Ratón + teclado · haz clic en la ciudad para capturar el cursor</div>',
    '  <div class="badge-row"><span>3 TRABAJOS</span><span>1 CIUDAD</span><span>0 EXCUSAS</span></div>',
    '</div>'
  ].join('');
  uiLayer.appendChild(startScreen);

  var pauseScreen = BS.HUD.el('div', 'hidden');
  pauseScreen.id = 'pause-screen';
  pauseScreen.innerHTML = [
    '<div class="panel">',
    '  <div class="sub">Pausa</div>',
    '  <h2>Bahía Sol</h2>',
    '  <div class="row"><span>Efectivo</span><b id="pause-cash">$0</b></div>',
    '  <div class="row"><span>Trabajos</span><b id="pause-jobs">0 / 3</b></div>',
    '  <div class="row"><span>Distrito</span><b id="pause-district">Centro</b></div>',
    '  <div class="row"><span>Audio</span><b id="pause-audio">Activado</b></div>',
    '  <div class="menu-buttons">',
    '    <button class="menu-btn" id="btn-resume">Seguir</button>',
    '    <button class="menu-btn ghost" id="btn-save">Guardar</button>',
    '    <button class="menu-btn ghost" id="btn-quit">Salir al título</button>',
    '  </div>',
    '</div>'
  ].join('');
  uiLayer.appendChild(pauseScreen);

  var contBtn = document.getElementById('btn-continue');
  if (!BS.Saves.has()) {
    contBtn.disabled = true;
    contBtn.style.opacity = '0.45';
  }

  function refreshPause() {
    document.getElementById('pause-cash').textContent = '$' + game.cash.toLocaleString('en-US');
    document.getElementById('pause-jobs').textContent = missions.completed + ' / 3';
    var d = BS.City.districtAt(player.pos.x, player.pos.z);
    document.getElementById('pause-district').textContent = d.name;
    document.getElementById('pause-audio').textContent = BS.Audio.muted ? 'Silenciado' : 'Activado';
  }

  function startPlaying(kind) {
    BS.Audio.ensure();
    if (kind === 'continue') {
      var data = BS.Saves.load();
      if (data) BS.Saves.apply(game, data);
      if (!data) resetNewGame();
    } else {
      resetNewGame();
    }
    game.mode = 'playing';
    game.paused = false;
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hud.setVisible(true);
    hud.hideBig();
    hud.update(0.016, game);
    hud.ticker('Bahía Sol · busca el marcador de la marina');
    input.lock();
  }

  function resetNewGame() {
    game.cash = CFG.startCash;
    player.reset(CFG.spawn.x, CFG.spawn.z);
    player.health = player.maxHealth;
    player.armour = CFG.player.armour;
    player.yaw = Math.PI * 0.75;
    player.heading = Math.PI * 0.75;
    player.dead = false;
    police.clear();
    police.setWanted(0);
    missions.completed = 0;
    missions.index = 0;
    missions.state = 'idle';
    missions.cooldown = 0.1;
    missions.startOffers();
    combat.weapon = 'pistol';
    combat.ammo.pistol = 72;
    combat.ammo.smg = 90;
    combat.select('pistol');
    hud.cashChanged();
    hud.wantedChanged();
  }

  function setPaused(paused) {
    if (game.mode !== 'playing') return;
    game.paused = paused;
    pauseScreen.classList.toggle('hidden', !paused);
    if (paused) {
      refreshPause();
      BS.Saves.save(game);
      if (document.exitPointerLock) document.exitPointerLock();
    } else {
      input.lock();
    }
  }

  function quitToTitle() {
    BS.Saves.save(game);
    game.mode = 'title';
    game.paused = false;
    pauseScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    hud.setVisible(false);
    if (document.exitPointerLock) document.exitPointerLock();
    if (BS.Saves.has()) {
      contBtn.disabled = false;
      contBtn.style.opacity = '1';
    }
  }

  document.getElementById('btn-new').addEventListener('click', function () { startPlaying('new'); });
  contBtn.addEventListener('click', function () { if (!contBtn.disabled) startPlaying('continue'); });
  document.getElementById('btn-resume').addEventListener('click', function () { setPaused(false); });
  document.getElementById('btn-save').addEventListener('click', function () {
    BS.Saves.save(game);
    hud.ticker('Partida guardada');
    refreshPause();
  });
  document.getElementById('btn-quit').addEventListener('click', quitToTitle);

  canvas.addEventListener('click', function () {
    if (game.mode === 'playing' && !game.paused) input.lock();
  });

  // ------------------------------------------------------------ interaction
  function nearestCar(maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < game.cars.length; i++) {
      var c = game.cars[i];
      if (c.dead) continue;
      var d = Math.hypot(c.group.position.x - player.pos.x, c.group.position.z - player.pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function interact() {
    if (player.inCar) {
      player.exitCar();
      return;
    }
    var car = nearestCar(5.0);
    if (!car) {
      hud.ticker('No hay ningún coche cerca');
      return;
    }
    if (car.driver === 'npc' && car.npc && game.traffic) {
      car.npc.stolen = true;
      var idx = game.traffic.cars.indexOf(car.npc);
      if (idx >= 0) game.traffic.cars.splice(idx, 1);
    }
    if (car.isPolice) {
      police.addWanted(1);
      hud.ticker('Te llevas un coche patrulla: +1 estrella');
    }
    player.enterCar(car);
    hud.ticker('Vehículo: ' + car.spec.name);
  }

  function handleKeys() {
    if (input.pressed.Escape) {
      setPaused(!game.paused);
      return;
    }
    if (game.paused) return;
    if (input.pressed.KeyM) {
      var muted = BS.Audio.toggleMute();
      hud.ticker(muted ? 'Audio silenciado' : 'Audio activado');
    }
    if (input.pressed.KeyE) interact();
    if (input.pressed.KeyR && game.respawnTimer > 0) {
      game.respawnTimer = 0.05;
    }
  }

  // --------------------------------------------------------------- respawn
  function startRespawn(kind) {
    if (game.respawnTimer > 0) return;
    game.respawnKind = kind;
    game.respawnTimer = 3.4;
    player.dead = true;
    if (player.inCar) player.exitCar();
    player.mesh.rotation.z = 1.35;
    hud.showBig(kind === 'wasted' ? 'WASTED' : 'BUSTED',
      kind === 'wasted' ? 'Te despiertas en el hospital · -$500' : 'Te llevan a comisaría · -$750', 3.2);
    if (BS.Audio) BS.Audio.ui('fail');
    missions.onPlayerDown();
  }

  function finishRespawn() {
    var kind = game.respawnKind || 'wasted';
    var fine = kind === 'wasted' ? 500 : 750;
    game.cash = Math.max(0, game.cash - fine);
    player.dead = false;
    player.mesh.rotation.z = 0;
    player.reset(kind === 'wasted' ? CFG.hospital.x : CFG.station.x,
      kind === 'wasted' ? CFG.hospital.z : CFG.station.z);
    player.health = kind === 'wasted' ? player.maxHealth : 80;
    player.armour = kind === 'wasted' ? 25 : 0;
    player.yaw = Math.PI * 0.5;
    hud.hideBig();
    hud.cashChanged();
    hud.ticker(kind === 'wasted' ? 'Hospital de Playa Sol · sigue en pie' : 'Comisaría del Centro · fianza pagada');
    game.respawnKind = null;
    police.setWanted(0);
    if (BS.Saves) BS.Saves.save(game);
  }

  // ------------------------------------------------------------- game step
  function stepPlay(dt) {
    game.time += dt;
    handleKeys();
    if (game.paused || game.mode !== 'playing') {
      input.endFrame();
      return;
    }

    player.update(dt, input, game);
    if (player.dead && game.respawnTimer <= 0 && player.health <= 0) startRespawn('wasted');

    combat.update(dt, input, game);
    traffic.update(dt, game);
    peds.update(dt, game);
    police.update(dt, game);
    missions.update(dt, game);
    BS.Fx.update(dt);
    city.update(dt, game.time);
    followSun();
    BS.Shadows.update(game);

    if (game.respawnTimer > 0) {
      game.respawnTimer -= dt;
      if (police.wanted > 0) police.setWanted(0);
      if (game.respawnTimer <= 0) finishRespawn();
    }

    game.saveTimer -= dt;
    if (game.saveTimer <= 0) {
      game.saveTimer = 20;
      BS.Saves.save(game);
    }

    hud.update(dt, game);
    BS.Audio.setListener(player);
    if (player.dead) BS.Audio.setEngine(0, false);

    input.endFrame();
  }

  function stepIdle(dt) {
    game.time += dt;
    city.update(dt, game.time);
    BS.Fx.update(dt);
    followSun();
    if (game.mode === 'title') {
      camera.position.set(58 + Math.sin(game.time * 0.02) * 2, 8.5, 34);
      camera.lookAt(-40, 16, -50);
    }
    hud.update(dt, game);
  }

  function stepShot(dt) {
    game.time += dt;
    city.update(dt, game.time);
    BS.Shots.update(game.shotName, game, game.time);
    followSunAt(camera.position.x, camera.position.z);
    BS.Shadows.update(game);
    BS.Fx.update(dt);
    hud.update(dt, game);
  }

  var lastNow = 0;
  var frameCount = 0;

  function loop(now) {
    window.requestAnimationFrame(loop);
    var dt = 0.016;
    if (!isShot) {
      var raw = (now - lastNow) / 1000;
      lastNow = now;
      if (raw > 0 && raw < 0.25) dt = raw;
    } else {
      dt = 1 / 60;
    }

    if (isShot) {
      stepShot(dt);
    } else if (game.mode === 'playing' && !game.paused) {
      stepPlay(dt);
    } else {
      stepIdle(dt);
    }

    renderer.render(scene, camera);
    frameCount++;
    window.__frame = frameCount;

    if (isShot && frameCount >= 8 && !window.__ready) {
      window.__ready = true;
      window.__probe = {
        gl: !!(renderer.getContext() && renderer.getContext().VERSION),
        ready: true,
        shot: shotName,
        frame: frameCount
      };
    }
  }

  // ------------------------------------------------------------------ boot
  if (isShot) {
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hud.setVisible(true);
    BS.Shots.setup(shotName, game);
    game.mode = 'shot';
    hud.update(0.016, game);
  } else {
    hud.setVisible(false);
    camera.position.set(58, 8.5, 34);
    camera.lookAt(-40, 16, -50);
    // a slow sweep of the skyline behind the title
    game.city.setNight(false);
  }

  // start audio on the first gesture, whichever it is
  ['pointerdown', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, function once() {
      BS.Audio.ensure();
      window.removeEventListener(evt, once);
    }, { once: true });
  });

  window.requestAnimationFrame(loop);
})(window.BS);
