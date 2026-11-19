/* Bahía Sol — persistence.
   One localStorage key holds cash, mission progress, where you were standing,
   your heat and your guns. Anything that fails (private mode, a file:// origin
   with storage disabled) degrades to an in-memory slot instead of throwing. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var KEY = 'bahia-sol-save-v1';
  var memory = null;

  var Saves = {
    key: KEY,

    available: function () {
      try {
        var t = '__bs_test__';
        window.localStorage.setItem(t, '1');
        window.localStorage.removeItem(t);
        return true;
      } catch (e) {
        return false;
      }
    },

    save: function (game) {
      if (!game || !game.player) return null;
      var data = {
        version: 1,
        cash: game.cash,
        wanted: game.police ? game.police.wanted : 0,
        player: {
          x: game.player.pos.x,
          z: game.player.pos.z,
          health: game.player.health,
          armour: game.player.armour
        },
        missions: game.missions ? game.missions.snapshot() : null,
        weapon: game.combat ? game.combat.weapon : 'pistol',
        ammo: game.combat ? { pistol: game.combat.ammo.pistol, smg: game.combat.ammo.smg } : null,
        savedAt: game.time || 0
      };
      memory = data;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { /* memory slot already holds it */ }
      return data;
    },

    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* fall through */ }
      return memory;
    },

    has: function () {
      return !!this.load();
    },

    clear: function () {
      memory = null;
      try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },

    apply: function (game, data) {
      if (!data) return false;
      game.cash = data.cash || 0;
      if (data.player) {
        game.player.setPosition(data.player.x, data.player.z, game.player.heading);
        game.player.health = Math.max(20, Math.min(game.player.maxHealth, data.player.health || game.player.maxHealth));
        game.player.armour = Math.max(0, Math.min(100, data.player.armour || 0));
        game.player.dead = false;
      }
      if (data.missions && game.missions) game.missions.restore(data.missions);
      if (data.ammo && game.combat) {
        game.combat.ammo.pistol = data.ammo.pistol;
        game.combat.ammo.smg = data.ammo.smg;
        if (data.weapon) game.combat.select(data.weapon);
      }
      if (game.police) game.police.setWanted(data.wanted || 0);
      if (BS.HUD) {
        BS.HUD.cashChanged();
        BS.HUD.wantedChanged();
        BS.HUD.weaponChanged();
      }
      return true;
    }
  };

  BS.Saves = Saves;
})(window.BS);
