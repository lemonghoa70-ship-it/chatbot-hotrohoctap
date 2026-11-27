/**
 * Web Audio API Sound Effects for Giáo viên AI Toán THCS
 * Synthesized purely via Web Audio API (no external audio files).
 */
(function (global) {
  const LS_ENABLED = 'trogiang_sound_enabled_v1';
  const LS_VOLUME = 'trogiang_sound_volume_v1';
  const LS_ADMIN_MUTE = 'trogiang_admin_sound_disabled_v1';

  let audioCtx = null;
  let activeNodes = [];
  let soundEnabled = true;
  let soundVolume = 0.4; // Default 40%
  let adminSoundDisabled = false;

  try {
    const savedEn = localStorage.getItem(LS_ENABLED);
    if (savedEn !== null) soundEnabled = savedEn === 'true';
    const savedVol = parseFloat(localStorage.getItem(LS_VOLUME));
    if (!Number.isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) soundVolume = savedVol;
    const savedAdmin = localStorage.getItem(LS_ADMIN_MUTE);
    if (savedAdmin !== null) adminSoundDisabled = savedAdmin === 'true';
  } catch {}

  function canPlay() {
    return soundEnabled && !adminSoundDisabled && soundVolume > 0;
  }

  function ensureContext() {
    const Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function stopActiveSounds() {
    while (activeNodes.length) {
      const node = activeNodes.pop();
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch {}
    }
  }

  function scheduleTone({ freq, endFreq = null, startOffset = 0, duration = 0.08, type = 'sine', gainScale = 1 }) {
    if (!canPlay()) return;
    const ctx = ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const peak = Math.max(0.001, Math.min(0.45, soundVolume * 0.35 * gainScale));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.012, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.015);
    activeNodes.push(osc, gain);
  }

  function playClick() {
    if (!canPlay()) return;
    stopActiveSounds();
    scheduleTone({ freq: 620, endFreq: 420, duration: 0.05, type: 'triangle', gainScale: 0.65 });
  }

  function playGrade(gradeNum) {
    if (!canPlay()) return;
    stopActiveSounds();
    const map = { 6: 392, 7: 440, 8: 493.88, 9: 554.37 };
    const base = map[Number(gradeNum)] || 523.25;
    scheduleTone({ freq: base, endFreq: base * 1.32, duration: 0.095, type: 'sine', gainScale: 0.9 });
  }

  function playLanguage() {
    if (!canPlay()) return;
    stopActiveSounds();
    scheduleTone({ freq: 523.25, startOffset: 0, duration: 0.09, type: 'sine', gainScale: 0.8 });
    scheduleTone({ freq: 783.99, startOffset: 0.075, duration: 0.14, type: 'sine', gainScale: 0.85 });
  }

  function playCorrect() {
    if (!canPlay()) return;
    stopActiveSounds();
    // Cheerful ascending C5 -> E5 bell
    scheduleTone({ freq: 523.25, startOffset: 0, duration: 0.12, type: 'triangle', gainScale: 0.95 });
    scheduleTone({ freq: 659.25, startOffset: 0.1, duration: 0.2, type: 'sine', gainScale: 1.0 });
  }

  function playWrong() {
    if (!canPlay()) return;
    stopActiveSounds();
    // Gentle low soft "boom" (not harsh)
    scheduleTone({ freq: 165, endFreq: 110, startOffset: 0, duration: 0.18, type: 'sine', gainScale: 0.85 });
  }

  function playComplete() {
    if (!canPlay()) return;
    stopActiveSounds();
    // Short 4-note victory melody (~1s): C5 - E5 - G5 - C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      scheduleTone({
        freq,
        startOffset: idx * 0.14,
        duration: idx === 3 ? 0.42 : 0.16,
        type: 'triangle',
        gainScale: idx === 3 ? 1.05 : 0.85
      });
    });
  }

  function playMessage() {
    if (!canPlay()) return;
    stopActiveSounds();
    scheduleTone({ freq: 740, startOffset: 0, duration: 0.09, type: 'sine', gainScale: 0.65 });
    scheduleTone({ freq: 987.77, startOffset: 0.08, duration: 0.14, type: 'sine', gainScale: 0.6 });
  }

  function setSoundEnabled(enabled) {
    soundEnabled = Boolean(enabled);
    try { localStorage.setItem(LS_ENABLED, String(soundEnabled)); } catch {}
    if (!soundEnabled) stopActiveSounds();
  }

  function setSoundVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isNaN(v)) {
      soundVolume = v;
      try { localStorage.setItem(LS_VOLUME, String(soundVolume)); } catch {}
    }
  }

  function setAdminSoundDisabled(disabled) {
    adminSoundDisabled = Boolean(disabled);
    try { localStorage.setItem(LS_ADMIN_MUTE, String(adminSoundDisabled)); } catch {}
    if (adminSoundDisabled) stopActiveSounds();
  }

  function getSoundState() {
    return {
      enabled: soundEnabled,
      volume: soundVolume,
      adminDisabled: adminSoundDisabled,
      effectiveEnabled: canPlay()
    };
  }

  global.MathSounds = {
    playClick,
    playGrade,
    playLanguage,
    playCorrect,
    playWrong,
    playComplete,
    playMessage,
    setSoundEnabled,
    setSoundVolume,
    setAdminSoundDisabled,
    getSoundState
  };

  global.playClick = playClick;
  global.playGrade = playGrade;
  global.playLanguage = playLanguage;
  global.playCorrect = playCorrect;
  global.playWrong = playWrong;
  global.playComplete = playComplete;
  global.playMessage = playMessage;
})(window);
