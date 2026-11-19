/* Bahía Sol — sound design.
   No files: an engine drone, a two-tone siren that pans across the stereo field,
   gunshots built from noise and a sine thump, footsteps, surf along the beach,
   horns, crashes and UI beeps. Everything starts on the first user gesture. */
window.BS = window.BS || {};

(function (BS) {
  'use strict';

  var Audio = {
    ctx: null,
    master: null,
    muted: false,
    started: false,
    engineNodes: null,
    sirenNodes: null,
    surfNodes: null,
    noiseBuffer: null
  };

  Audio.init = function () {
    if (this.ctx) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    var ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // reusable noise
    var len = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var seed = BS.makeRng(0xa11d10);
    for (var i = 0; i < len; i++) data[i] = seed() * 2 - 1;
    this.noiseBuffer = buffer;

    this.buildEngine();
    this.buildSiren();
    this.buildSurf();
    this.started = true;
  };

  Audio.ensure = function () {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Audio.buildEngine = function () {
    var ctx = this.ctx;
    var g = ctx.createGain();
    g.gain.value = 0.0;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    filter.Q.value = 1.2;
    var osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 52;
    var osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 78;
    var mix = ctx.createGain();
    mix.gain.value = 0.35;
    osc1.connect(filter);
    osc2.connect(mix);
    mix.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc1.start();
    osc2.start();
    this.engineNodes = { osc1: osc1, osc2: osc2, filter: filter, gain: g };
  };

  Audio.buildSiren = function () {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 760;
    var lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.5;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    var gain = ctx.createGain();
    gain.gain.value = 0;
    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(filter);
    filter.connect(gain);
    if (panner) { gain.connect(panner); panner.connect(this.master); }
    else gain.connect(this.master);
    osc.start();
    lfo.start();
    this.sirenNodes = { osc: osc, lfo: lfo, gain: gain, panner: panner, target: 0 };
  };

  Audio.buildSurf = function () {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    var gain = ctx.createGain();
    gain.gain.value = 0;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    lfo.start();
    this.surfNodes = { gain: gain, lfo: lfo };
  };

  Audio.setMute = function (mute) {
    this.muted = !!mute;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  };

  Audio.toggleMute = function () {
    return this.setMute(!this.muted);
  };

  Audio.setEngine = function (speed, inCar, car) {
    if (!this.engineNodes || !this.ctx) return;
    var n = this.engineNodes;
    var target = inCar ? 0.055 + Math.min(0.05, Math.abs(speed) * 0.0016) : 0;
    n.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    var rpm = 48 + Math.min(150, Math.abs(speed) * 3.4);
    n.osc1.frequency.setTargetAtTime(rpm, this.ctx.currentTime, 0.08);
    n.osc2.frequency.setTargetAtTime(rpm * 1.5, this.ctx.currentTime, 0.08);
    n.filter.frequency.setTargetAtTime(380 + Math.abs(speed) * 12, this.ctx.currentTime, 0.1);
  };

  Audio.setSiren = function (level, pos) {
    if (!this.sirenNodes || !this.ctx) return;
    var n = this.sirenNodes;
    var target = level > 0 ? 0.035 + level * 0.008 : 0;
    n.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.3);
    if (pos && this.listener) {
      var dx = pos.x - this.listener.x;
      var dz = pos.z - this.listener.z;
      var yaw = this.listener.yaw || 0;
      var rightX = -Math.cos(yaw), rightZ = Math.sin(yaw);
      var pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / 60));
      if (n.panner) n.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.2);
    }
  };

  Audio.setListener = function (player) {
    this.listener = { x: player.pos.x, z: player.pos.z, yaw: player.yaw };
    if (this.surfNodes && this.ctx) {
      var beach = Math.max(0, Math.min(1, (player.pos.z - 430) / 150));
      if (player.pos.x < -330 && player.pos.z > 300) beach = Math.max(beach, 0.5);
      this.surfNodes.gain.gain.setTargetAtTime(0.02 + beach * 0.07, this.ctx.currentTime, 0.4);
    }
  };

  Audio.noiseBurst = function (duration, freq, gainAmt, type) {
    if (!this.ctx || !this.noiseBuffer) return;
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = freq;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(gainAmt, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  };

  Audio.gunshot = function (type, pos) {
    if (!this.ctx) return;
    if (type === 'smg') {
      this.noiseBurst(0.12, 2600, 0.22, 'bandpass');
    } else if (type === 'pistol') {
      this.noiseBurst(0.2, 1800, 0.3, 'lowpass');
      var ctx = this.ctx;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.14);
      g.gain.setValueAtTime(0.28, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  };

  Audio.punch = function () {
    this.noiseBurst(0.1, 420, 0.25, 'lowpass');
  };

  Audio.footstep = function (sprint, sand) {
    if (!this.ctx) return;
    this.noiseBurst(sprint ? 0.09 : 0.07, sand ? 900 : 520, sand ? 0.05 : 0.045, 'lowpass');
  };

  Audio.honk = function (pos) {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 310;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);
    osc.connect(filter); filter.connect(g); g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  };

  Audio.crash = function () {
    this.noiseBurst(0.35, 900, 0.25, 'bandpass');
  };

  Audio.ui = function (kind) {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    var freq = 660, dur = 0.08;
    if (kind === 'up' || kind === 'mission') { freq = 520; dur = 0.16; }
    if (kind === 'down' || kind === 'fail') { freq = 300; dur = 0.2; }
    if (kind === 'success') { freq = 880; dur = 0.3; }
    if (kind === 'pickup') { freq = 990; dur = 0.08; }
    if (kind === 'empty') { freq = 180; dur = 0.05; }
    if (kind === 'hurt') { freq = 140; dur = 0.12; }
    if (kind === 'enter' || kind === 'exit') { freq = 420; dur = 0.1; }
    if (kind === 'switch') { freq = 740; dur = 0.05; }
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g); g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  };

  BS.Audio = Audio;
})(window.BS);
