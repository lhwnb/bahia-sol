/* Bahía Sol — story jobs.
   Three connected missions with speakers, cards, markers, timers and cash:
   steal La Roja at the marina, run three drops with the policía awake, then
   clear El Ruso's warehouse. State lives in one small object so the save file
   only needs an index and a completed count. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;

  function Missions(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.index = 0;
    this.completed = 0;
    this.state = 'idle';       // idle | offer | active | done
    this.current = null;
    this.stage = '';
    this.timer = 0;
    this.timeLimit = 0;
    this.dropIndex = 0;
    this.marker = null;
    this.markerGroup = null;
    this.markerColor = 0xffc46b;
    this.markerPulse = 0;
    this.objective = '';
    this.laRoja = null;
    this.missionCars = [];
    this.cooldown = 0;
    this.markerPos = new THREE.Vector3();
    this.buildMarker();
    this.setState('offer', 0);
  }

  Missions.prototype.buildMarker = function () {
    var g = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.16, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.9, toneMapped: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    g.add(ring);
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.45, 8, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc46b, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
      })
    );
    beam.position.y = 4.2;
    g.add(beam);
    var inner = new THREE.Sprite(new THREE.SpriteMaterial({
      map: BS.Tex.glow(), color: 0xffc46b, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    inner.scale.set(3.4, 3.4, 1);
    inner.position.y = 0.6;
    g.add(inner);
    g.visible = false;
    this.scene.add(g);
    this.markerGroup = g;
    this.markerRing = ring;
    this.markerBeam = beam;
    this.markerGlow = inner;
  };

  Missions.prototype.setMarker = function (pos, color) {
    if (!pos) {
      this.markerGroup.visible = false;
      this.marker = null;
      return;
    }
    this.markerPos.copy(pos);
    this.markerGroup.position.set(pos.x, 0, pos.z);
    this.markerGroup.visible = true;
    this.marker = pos;
    if (color) {
      this.markerColor = color;
      this.markerRing.material.color.setHex(color);
      this.markerBeam.material.color.setHex(color);
      this.markerGlow.material.color.setHex(color);
    }
  };

  Missions.prototype.setState = function (state, index) {
    this.state = state;
    if (index !== undefined) this.index = index;
    if (state === 'offer') {
      var m = CFG.missions[this.index];
      if (!m) { this.state = 'done'; this.setMarker(null); this.objective = 'Ciudad libre'; return; }
      this.current = m;
      this.setMarker(m.giver, 0xffc46b);
      this.objective = 'Trabajo disponible: ' + m.title;
      this.timer = 0;
      this.timeLimit = 0;
    }
  };

  Missions.prototype.startOffers = function () {
    if (this.index >= CFG.missions.length) {
      this.state = 'done';
      this.objective = 'Ciudad libre';
      this.setMarker(null);
      return;
    }
    this.setState('offer', this.index);
  };

  Missions.prototype.begin = function () {
    var m = this.current;
    if (!m) return;
    this.state = 'active';
    this.stage = '';
    this.dropIndex = 0;
    this.timer = 0;
    this.timeLimit = 0;
    if (BS.HUD) BS.HUD.showCard(m.speaker, m.title, m.line);
    if (BS.Audio) BS.Audio.ui('mission');

    if (m.id === 'marina') {
      this.ensureLaRoja();
      this.stage = 'steal';
      this.objective = 'Roba La Roja en la marina';
      this.setMarker(m.carSpot, 0xff6b5a);
      if (this.game.player.car === this.laRoja) this.onLaRojaEntered();
    } else if (m.id === 'drops') {
      this.stage = 'drop';
      this.timer = m.seconds;
      this.timeLimit = m.seconds;
      this.objective = 'Entrega 1 de 3 · ' + this.formatTime(this.timer);
      this.setMarker(m.drops[0], 0x35e6ff);
      if (this.game.police) this.game.police.setWanted(2);
    } else if (m.id === 'warehouse') {
      this.stage = 'clear';
      this.objective = 'Limpia el almacén · 6 rivales';
      var center = new THREE.Vector3(m.warehouse.x, 0, m.warehouse.z);
      this.game.peds.spawnRivals(center, 6);
      this.setMarker(new THREE.Vector3(m.warehouse.x - 30, 0, m.warehouse.z + 24), 0xff4d4d);
      if (this.game.police) this.game.police.setWanted(3);
    }
    if (BS.HUD) BS.HUD.objective(this.objective);
  };

  Missions.prototype.ensureLaRoja = function () {
    if (this.laRoja && !this.laRoja.dead) return this.laRoja;
    var m = CFG.missions[0];
    var car = BS.Vehicles.create('falcon', 0xb01f2a);
    BS.Vehicles.place(car, m.carSpot.x, m.carSpot.z, Math.PI / 2);
    car.mission = true;
    car.name = 'La Roja';
    this.scene.add(car.group);
    this.game.cars.push(car);
    this.laRoja = car;
    this.missionCars.push(car);
    return car;
  };

  Missions.prototype.onLaRojaEntered = function () {
    if (this.stage !== 'steal') return;
    this.stage = 'deliver';
    this.timer = CFG.missions[0].seconds;
    this.timeLimit = this.timer;
    this.objective = 'Lleva La Roja a los muelles · ' + this.formatTime(this.timer);
    this.setMarker(CFG.missions[0].dropoff, 0xffc46b);
    if (BS.HUD) {
      BS.HUD.showCard('Rafa Vela', 'La Roja', 'It is awake. Do not scratch it, do not stop for the lights.');
      BS.HUD.objective(this.objective);
    }
    if (BS.Audio) BS.Audio.ui('mission');
  };

  Missions.prototype.formatTime = function (t) {
    t = Math.max(0, Math.ceil(t));
    var m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  Missions.prototype.complete = function () {
    var m = this.current;
    if (!m) return;
    this.completed++;
    this.index = Math.min(CFG.missions.length, this.index + 1);
    this.game.cash += m.reward;
    if (BS.HUD) {
      BS.HUD.ticker('Trabajo cumplido: ' + m.title + ' · +$' + m.reward.toLocaleString('en-US'));
      BS.HUD.showCard(m.speaker, 'Cumplido', 'Paid. The city remembers who delivers.');
      BS.HUD.cashChanged();
    }
    if (BS.Audio) BS.Audio.ui('success');
    this.setMarker(null);
    this.state = 'idle';
    this.current = null;
    this.cooldown = 3.0;
    this.objective = 'Sin trabajo activo';
    if (this.game.saves) this.game.saves.save(this.game);
  };

  Missions.prototype.fail = function (reason) {
    if (this.state !== 'active') return;
    if (BS.HUD) {
      BS.HUD.ticker(reason || 'El trabajo se ha enfriado');
      BS.HUD.objective('Trabajo perdido · vuelve al marcador');
    }
    this.state = 'idle';
    this.current = null;
    this.cooldown = 4;
    this.objective = 'Sin trabajo activo';
    this.setMarker(null);
  };

  Missions.prototype.onPlayerDown = function () {
    if (this.state === 'active') {
      this.fail('Te han sacado del trabajo');
    }
  };

  Missions.prototype.update = function (dt, game) {
    if (this.state === 'done') {
      this.setMarker(null);
      return;
    }
    var player = game.player;

    // marker pulse and hover
    if (this.markerGroup.visible) {
      this.markerPulse += dt * 2.4;
      var s = 1 + Math.sin(this.markerPulse) * 0.12;
      this.markerRing.scale.set(s, s, 1);
      this.markerRing.rotation.z += dt * 0.6;
      this.markerBeam.material.opacity = 0.12 + (Math.sin(this.markerPulse) * 0.5 + 0.5) * 0.1;
      this.markerGlow.material.opacity = 0.35 + (Math.sin(this.markerPulse) * 0.5 + 0.5) * 0.25;
    }

    if (this.state === 'idle') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.startOffers();
      return;
    }

    if (this.state === 'offer') {
      if (!this.current) return;
      var g = this.current.giver;
      if (Math.hypot(player.pos.x - g.x, player.pos.z - g.z) < 5.0) {
        this.begin();
        if (this.game.saveState) this.game.saveState();
      }
      return;
    }

    if (this.state !== 'active' || !this.current) return;
    var m = this.current;

    if (m.id === 'marina') {
      if (this.stage === 'steal') {
        if (!this.laRoja || this.laRoja.dead) { this.ensureLaRoja(); }
        this.setMarker(this.laRoja.group.position, 0xff6b5a);
        if (player.car === this.laRoja) this.onLaRojaEntered();
      } else if (this.stage === 'deliver') {
        this.timer -= dt;
        this.setMarker(CFG.missions[0].dropoff, 0xffc46b);
        this.objective = (player.car === this.laRoja ? 'Lleva La Roja a los muelles' : 'Recupera La Roja') +
          ' · ' + this.formatTime(this.timer);
        if (this.timer <= 0) { this.fail('Se acabó el tiempo: La Roja se ha perdido'); return; }
        var dx = this.laRoja.group.position.x - CFG.missions[0].dropoff.x;
        var dz = this.laRoja.group.position.z - CFG.missions[0].dropoff.z;
        if (Math.hypot(dx, dz) < 11 && player.car === this.laRoja) this.complete();
      }
    } else if (m.id === 'drops') {
      this.timer -= dt;
      var target = m.drops[Math.min(this.dropIndex, m.drops.length - 1)];
      this.setMarker(target, 0x35e6ff);
      this.objective = 'Entrega ' + (this.dropIndex + 1) + ' de 3 · ' + this.formatTime(this.timer);
      if (this.timer <= 0) { this.fail('Las entregas se han quedado frías'); return; }
      if (game.police && game.police.wanted < 2) {
        this.policeNudge = (this.policeNudge || 0) + dt;
        if (this.policeNudge > 2.5) {
          this.policeNudge = 0;
          game.police.setWanted(2);
          if (BS.HUD) BS.HUD.ticker('La policía sigue peinando el barrio');
        }
      }
      var d2 = Math.hypot(player.pos.x - target.x, player.pos.z - target.z);
      if (d2 < 9) {
        this.dropIndex++;
        game.cash += 500;
        if (BS.HUD) {
          BS.HUD.ticker('Entrega ' + this.dropIndex + ' de 3 · +$500');
          BS.HUD.cashChanged();
        }
        if (BS.Audio) BS.Audio.ui('pickup');
        if (this.dropIndex >= 3) this.complete();
      }
    } else if (m.id === 'warehouse') {
      var alive = game.peds.rivalsAlive();
      this.objective = 'Limpia el almacén · ' + alive + ' rivales';
      if (alive === 0) {
        this.complete();
        if (this.completed >= 3) {
          this.state = 'done';
          this.objective = 'Ciudad libre';
          this.setMarker(null);
          if (BS.HUD) {
            BS.HUD.showCard('El Ruso', 'Epílogo', CFG.epilogue);
            BS.HUD.ticker('Bahía Sol es tuya. Por ahora.');
          }
        }
      }
    }

    if (BS.HUD) BS.HUD.objective(this.objective);
  };

  Missions.prototype.snapshot = function () {
    return { index: this.index, completed: this.completed, state: this.state, stage: this.stage, objective: this.objective };
  };

  Missions.prototype.restore = function (snap) {
    if (!snap) return;
    this.completed = snap.completed || 0;
    this.index = Math.max(0, Math.min(CFG.missions.length, snap.index || 0));
    if (this.index >= CFG.missions.length) {
      this.state = 'done';
      this.objective = 'Ciudad libre';
      this.setMarker(null);
    } else {
      this.setState('offer', this.index);
      if (snap.objective) this.objective = snap.objective;
    }
  };

  BS.Missions = Missions;
})(window.BS);
