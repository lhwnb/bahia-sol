/* Bahía Sol — HUD.
   A DOM overlay for money, stars, bars and objective text, plus two small
   canvases: the round minimap and the speedometer. Everything shown here is
   real state, including the police blips and the mission marker's distance. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var CFG = BS.CFG;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var HUD = {
    init: function (game) {
      this.game = game;
      var ui = document.getElementById('ui');
      var hud = el('div', '');
      hud.id = 'hud';
      hud.innerHTML = [
        '<div class="hud-tl">',
        '  <div id="district">CENTRO</div>',
        '  <div id="street">Av. Sol / Calle 6</div>',
        '  <div id="objective"><span class="tag">TRABAJO</span><span class="txt" id="objective-text">Ciudad libre</span></div>',
        '</div>',
        '<div class="hud-tr">',
        '  <div id="cash">$350</div>',
        '  <div id="stars"></div>',
        '</div>',
        '<div class="hud-bl">',
        '  <div id="minimap-wrap"><canvas id="minimap" width="208" height="208"></canvas><div id="map-n">N</div></div>',
        '  <div class="bars">',
        '    <div class="bar health"><i id="health-fill"></i></div>',
        '    <div class="bar armour"><i id="armour-fill"></i></div>',
        '  </div>',
        '  <div id="weapon">Pistola · <b>72</b></div>',
        '</div>',
        '<div class="hud-br"><canvas id="speedo" width="300" height="300"></canvas></div>',
        '<div id="ticker"></div>',
        '<div id="crosshair"></div>',
        '<div id="vignette"></div>',
        '<div id="damage"></div>'
      ].join('');
      ui.appendChild(hud);
      this.root = hud;
      this.minimap = hud.querySelector('#minimap');
      this.mapCtx = this.minimap.getContext('2d');
      this.speedo = hud.querySelector('#speedo');
      this.speedoCtx = this.speedo.getContext('2d');
      this.starsEl = hud.querySelector('#stars');
      this.cashEl = hud.querySelector('#cash');
      this.districtEl = hud.querySelector('#district');
      this.streetEl = hud.querySelector('#street');
      this.objectiveEl = hud.querySelector('#objective-text');
      this.weaponEl = hud.querySelector('#weapon');
      this.tickerEl = hud.querySelector('#ticker');
      this.healthEl = hud.querySelector('#health-fill');
      this.armourEl = hud.querySelector('#armour-fill');
      this.damageEl = hud.querySelector('#damage');
      this.crosshair = hud.querySelector('#crosshair');
      this.speedoWrap = hud.querySelector('.hud-br');

      var card = el('div', '');
      card.id = 'mission-card';
      card.innerHTML = '<div class="who"></div><div class="job"></div><div class="line"></div>';
      ui.appendChild(card);
      this.card = card;
      this.cardWho = card.querySelector('.who');
      this.cardJob = card.querySelector('.job');
      this.cardLine = card.querySelector('.line');

      var big = el('div', 'hidden');
      big.id = 'big-message';
      ui.appendChild(big);
      this.big = big;

      this.tickerTime = 0;
      this.cardTime = 0;
      this.damageTime = 0;
      this.districtTimer = 0;
      this.lastObjective = '';
      this.wanted = 0;
      this.starsEl.innerHTML = '';
      this.setVisible(false);
      this.wantedChanged();
      this.cashChanged();
      this.weaponChanged();
    },

    setVisible: function (on) {
      if (!this.root) return;
      this.root.classList.toggle('on', !!on);
    },

    ticker: function (text) {
      if (!this.tickerEl) return;
      this.tickerEl.innerHTML = text;
      this.tickerEl.classList.add('on');
      this.tickerTime = CFG.tickerSeconds;
    },

    showCard: function (speaker, title, line) {
      if (!this.card) return;
      this.cardWho.textContent = speaker;
      this.cardJob.textContent = title;
      this.cardLine.textContent = line;
      this.card.classList.add('on');
      this.cardTime = 7.5;
    },

    hideCard: function () {
      if (this.card) this.card.classList.remove('on');
    },

    objective: function (text) {
      if (!this.objectiveEl) return;
      this.lastObjective = text;
      this.objectiveEl.textContent = text;
    },

    cashChanged: function () {
      if (!this.cashEl || !this.game) return;
      this.cashEl.innerHTML = '$' + (this.game.cash || 0).toLocaleString('en-US') +
        ' <span class="small">USD</span>';
    },

    wantedChanged: function () {
      if (!this.starsEl || !this.game || !this.game.police) return;
      var n = this.game.police.wanted;
      var html = '';
      for (var i = 1; i <= 5; i++) html += i <= n ? '<b>★</b>' : '<i>★</i>';
      this.starsEl.innerHTML = html;
    },

    weaponChanged: function () {
      if (!this.weaponEl || !this.game) return;
      var c = this.game.combat;
      if (!c) return;
      var spec = CFG.weapons[c.weapon];
      var ammo = c.weapon === 'fists' ? '—' : c.ammo[c.weapon];
      this.weaponEl.innerHTML = spec.name + ' · <b>' + ammo + '</b>';
    },

    flashDamage: function () {
      if (this.damageEl) {
        this.damageEl.style.opacity = '0.7';
        this.damageTime = 0.35;
      }
    },

    showBig: function (text, sub, seconds) {
      if (!this.big) return;
      this.big.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
      this.big.classList.remove('hidden');
      this.bigTime = seconds || 3;
    },

    hideBig: function () {
      if (this.big) this.big.classList.add('hidden');
      this.bigTime = 0;
    },

    update: function (dt, game) {
      if (!this.root) return;
      this.game = game;
      var player = game.player;

      if (this.tickerTime > 0) {
        this.tickerTime -= dt;
        if (this.tickerTime <= 0) this.tickerEl.classList.remove('on');
      }
      if (this.cardTime > 0) {
        this.cardTime -= dt;
        if (this.cardTime <= 0) this.hideCard();
      }
      if (this.damageTime > 0) {
        this.damageTime -= dt;
        if (this.damageTime <= 0) this.damageEl.style.opacity = '0';
      }
      if (this.bigTime > 0) {
        this.bigTime -= dt;
        if (this.bigTime <= 0) this.hideBig();
      }

      this.districtTimer -= dt;
      if (this.districtTimer <= 0) {
        this.districtTimer = 0.25;
        var d = BS.City.districtAt(player.pos.x, player.pos.z);
        this.districtEl.textContent = d.name.toUpperCase();
        this.streetEl.textContent = BS.City.streetLine(player.pos.x, player.pos.z);
      }

      var hp = Math.max(0, player.health) / player.maxHealth;
      var ap = Math.max(0, player.armour) / 100;
      this.healthEl.style.width = (hp * 100).toFixed(1) + '%';
      this.armourEl.style.width = (ap * 100).toFixed(1) + '%';
      this.healthEl.style.background = hp < 0.3
        ? 'linear-gradient(90deg,#d9483f,#f28a63)'
        : 'linear-gradient(90deg,#6fd18a,#b8e986)';

      if (game.police && this.wanted !== game.police.wanted) {
        this.wanted = game.police.wanted;
        this.wantedChanged();
      }
      if (this.lastCash !== game.cash) {
        this.lastCash = game.cash;
        this.cashChanged();
      }

      var c = game.combat;
      if (c) {
        var spec = CFG.weapons[c.weapon];
        var ammo = c.weapon === 'fists' ? '—' : c.ammo[c.weapon];
        var label = spec.name + ' · <b>' + ammo + '</b>';
        if (this.weaponEl.innerHTML !== label) this.weaponEl.innerHTML = label;
      }

      if (game.missions) {
        var obj = game.missions.objective || 'Ciudad libre';
        if (obj !== this.lastObjective) this.objective(obj);
      }

      this.crosshair.classList.toggle('hide', player.inCar || player.dead);
      this.speedoWrap.style.opacity = player.inCar ? '1' : '0.0';
      this.speedoWrap.style.transition = 'opacity .3s ease';

      this.drawSpeedo(player);
      this.drawMinimap(game);
    },

    drawSpeedo: function (player) {
      var ctx = this.speedoCtx;
      if (!ctx) return;
      var w = 300, h = 300, cx = 150, cy = 156, r = 108;
      ctx.clearRect(0, 0, w, h);
      if (!player.inCar || !player.car) return;
      var speed = Math.abs(player.car.speed) * 3.6;
      var frac = Math.min(1, speed / 190);
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 2.22);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(8,12,18,0.55)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * (0.78 + 1.44 * frac));
      ctx.lineWidth = 8;
      ctx.strokeStyle = frac > 0.82 ? '#ff7d55' : '#ffc46b';
      ctx.stroke();
      // ticks
      for (var i = 0; i <= 8; i++) {
        var a = Math.PI * (0.78 + (1.44 * i) / 8);
        var x1 = cx + Math.cos(a) * (r - 16), y1 = cy + Math.sin(a) * (r - 16);
        var x2 = cx + Math.cos(a) * (r - 6), y2 = cy + Math.sin(a) * (r - 6);
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
      }
      ctx.fillStyle = '#fff7e8';
      ctx.font = '700 46px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(speed)), cx, cy - 2);
      ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,196,107,0.9)';
      ctx.fillText('KM/H', cx, cy + 26);
      ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(player.car.spec.name.toUpperCase(), cx, cy + 52);
    },

    drawMinimap: function (game) {
      var ctx = this.mapCtx;
      if (!ctx) return;
      var W = 208, C = W / 2, scale = 0.8;
      var px = game.player.pos.x, pz = game.player.pos.z;
      var span = W / scale;

      function mx(x) { return C + (x - px) * scale; }
      function my(z) { return C + (z - pz) * scale; }

      ctx.clearRect(0, 0, W, W);
      ctx.fillStyle = '#0b1117';
      ctx.fillRect(0, 0, W, W);

      // sand and water
      ctx.fillStyle = '#2a3340';
      ctx.fillRect(0, 0, W, W);
      // bay
      ctx.fillStyle = '#12222c';
      ctx.fillRect(mx(-700), my(290), 340 * scale, 330 * scale);
      // ocean
      ctx.fillStyle = '#12222c';
      ctx.fillRect(0, my(600), W, W);
      // sand
      ctx.fillStyle = '#3c3a2f';
      ctx.fillRect(mx(-340), my(500), 980 * scale, 100 * scale);

      // blocks, tinted by district
      for (var bi = -5; bi < 5; bi++) {
        for (var bj = -5; bj < 5; bj++) {
          var bx = bi * 120 + 60, bz = bj * 120 + 60;
          if (BJ.inBay(bx, bz)) continue;
          if (bz > 470) continue;
          var x0 = mx(bx - 45), y0 = my(bz - 45);
          if (x0 > W || y0 > W || x0 + 90 * scale < 0 || y0 + 90 * scale < 0) continue;
          var dist = BS.City.districtAt ? BS.City.districtAt(bx, bz) : { id: 'downtown' };
          ctx.fillStyle = dist.id === 'downtown' ? '#2c3846'
            : (dist.id === 'marina' || dist.id === 'costa') ? '#26343c'
            : dist.id === 'industrial' ? '#242b2c' : '#2a3239';
          ctx.fillRect(x0, y0, 90 * scale, 90 * scale);
          ctx.strokeStyle = 'rgba(0,0,0,0.32)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 + 0.5, y0 + 0.5, 90 * scale - 1, 90 * scale - 1);
        }
      }
      // roads: dark casing, asphalt fill, dashed centre line
      var i;
      ctx.strokeStyle = '#0e141a';
      ctx.lineWidth = 21 * scale;
      for (i = -5; i <= 5; i++) {
        var rx0 = mx(i * 120), rz0 = my(i * 120);
        ctx.beginPath(); ctx.moveTo(rx0, 0); ctx.lineTo(rx0, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, rz0); ctx.lineTo(W, rz0); ctx.stroke();
      }
      ctx.strokeStyle = '#404b57';
      ctx.lineWidth = 16 * scale;
      for (i = -5; i <= 5; i++) {
        var rx = mx(i * 120), rz = my(i * 120);
        ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, rz); ctx.lineTo(W, rz); ctx.stroke();
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(245,222,170,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      for (i = -5; i <= 5; i++) {
        var lx = mx(i * 120), lz = my(i * 120);
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, lz); ctx.lineTo(W, lz); ctx.stroke();
      }
      ctx.restore();

      // mission marker
      if (game.missions && game.missions.markerGroup && game.missions.markerGroup.visible) {
        var m = game.missions.markerPos;
        var mmx = mx(m.x), mmy = my(m.z);
        var dist = Math.hypot(m.x - px, m.z - pz);
        var dx = mmx - C, dy = mmy - C;
        var len = Math.hypot(dx, dy);
        var clamped = false;
        if (len > C - 14) {
          var k = (C - 14) / len;
          mmx = C + dx * k; mmy = C + dy * k; clamped = true;
        }
        ctx.save();
        ctx.translate(mmx, mmy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffc46b';
        ctx.shadowColor = 'rgba(255,196,107,0.9)';
        ctx.shadowBlur = 10;
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
        ctx.fillStyle = '#ffe6bb';
        ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(dist) + ' m', mmx, mmy - 10);
      }

      // police blips
      if (game.police) {
        for (i = 0; i < game.police.cruisers.length; i++) {
          var cpos = game.police.cruisers[i].car.group.position;
          var bx2 = C + (cpos.x - px) * scale, by2 = C + (cpos.z - pz) * scale;
          var ddx = bx2 - C, ddy = by2 - C, dl = Math.hypot(ddx, ddy);
          if (dl > C - 8) { bx2 = C + ddx / dl * (C - 8); by2 = C + ddy / dl * (C - 8); }
          ctx.beginPath();
          ctx.arc(bx2, by2, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ff4436';
          ctx.shadowColor = 'rgba(255,60,50,0.9)';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,240,235,0.95)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // player arrow
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(Math.PI - game.player.heading);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fillStyle = '#fff3dd';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();

      // inner rim
      ctx.beginPath();
      ctx.arc(C, C, C - 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // small helper so the minimap can ask the city about water
  var BJ = { inBay: function (x, z) { return x < -360 && z > 300; } };

  BS.HUD = HUD;
  BS.HUD.el = el;
})(window.BS);
