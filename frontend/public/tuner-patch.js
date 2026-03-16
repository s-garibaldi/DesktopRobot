/**
 * Patch for tuner.coffee: fixes crash when transitioning away from tuner face,
 * and adds temporal smoothing for more stable tuning.
 *
 * Crash fix: tuner.coffee's Display.init adds a global 'resize' listener that is
 * NEVER removed. This patch removes it on destroy and guards against missing DOM.
 *
 * Robustness: professional chromatic tuner behavior based on:
 * - Onset locking: fast lock on attack (best SNR) when coming from silence
 * - High-note responsiveness: high strings decay in ~1s, need faster switch (6 vs 40)
 * - Adaptive null clearing: clear faster after high notes (decay quicker)
 * - Frequency-dependent thresholds throughout
 */
(function () {
  var capturedResizeHandler = null;
  var target = typeof window !== 'undefined' ? window : null;
  if (!target) return;

  var origSetInterval = target.setInterval.bind(target);
  var tunerInitDeadline = 0;
  target.setInterval = function (fn, delay) {
    var isTunerProcess = target.Tuner && target.Tuner.PitchDetection && fn === target.Tuner.PitchDetection.process;
    if (delay === 100 && isTunerProcess && tunerInitDeadline > Date.now()) {
      delay = 50;  /* 20 updates/sec for smoother high-string tracking */
    }
    return origSetInterval(fn, delay);
  };

  var origAddEventListener = target.addEventListener.bind(target);
  target.addEventListener = function (type, fn, opts) {
    if (type === 'resize' && target.__tunerInitInProgress) {
      var wrapper = function () {
        if (target.__tunerDisplayDestroyed) return;
        fn.apply(this, arguments);
      };
      capturedResizeHandler = wrapper;
      return origAddEventListener(type, wrapper, opts);
    }
    return origAddEventListener(type, fn, opts);
  };

  function patchTuner() {
    if (!target.Tuner || !target.Tuner.Display) {
      setTimeout(patchTuner, 10);
      return;
    }

    var origTuner = target.Tuner;
    function tunerWrapper(sel, theme) {
      target.__tunerDisplayDestroyed = false;
      target.__tunerInitInProgress = true;
      tunerInitDeadline = Date.now() + 3000;  /* Catch async setInterval(100) in getUserMedia callback */
      if (typeof target.__tunerPatchReset === 'function') {
        target.__tunerPatchReset();
      }
      try {
        return origTuner(sel, theme);
      } finally {
        target.__tunerInitInProgress = false;
      }
    }
    tunerWrapper.destroy = origTuner.destroy;
    for (var k in origTuner) {
      if (Object.prototype.hasOwnProperty.call(origTuner, k)) {
        tunerWrapper[k] = origTuner[k];
      }
    }
    target.Tuner = tunerWrapper;

    var origDestroy = target.Tuner.Display.destroy;
    target.Tuner.Display.destroy = function () {
      target.__tunerDisplayDestroyed = true;
      if (capturedResizeHandler) {
        target.removeEventListener('resize', capturedResizeHandler);
        capturedResizeHandler = null;
      }
      origDestroy.call(target.Tuner.Display);
    };

    var origTunerDestroy = target.Tuner.destroy;
    target.Tuner.destroy = function () {
      target.__tunerDisplayDestroyed = true;
      if (capturedResizeHandler) {
        target.removeEventListener('resize', capturedResizeHandler);
        capturedResizeHandler = null;
      }
      try {
        origTunerDestroy.call(target.Tuner);
      } catch (err) {
      }
    };

    var origUpdate = target.Tuner.Display.update;
    var pitchHistory = [];
    /* Professional chromatic tuner parameters (tuner updates ~10/sec) */
    var REQUIRED_CONSISTENCY = 5;       /* low notes: 5 consistent samples for robust lock */
    var REQUIRED_CONSISTENCY_HIGH = 3;  /* B & high E: 3 samples (balance responsiveness + accuracy) */
    var REQUIRED_CONSISTENCY_ONSET = 2; /* onset lock: capture attack immediately */
    var REQUIRED_SWITCH = 25;           /* low→low: ~2.5s to switch */
    var REQUIRED_SWITCH_HIGH = 4;       /* B & high E: switch faster */
    var NULLS_TO_CLEAR = 8;
    var NULLS_TO_CLEAR_HIGH = 4;
    var CENTS_TOLERANCE = 28;           /* tighter = more accurate when locked */
    var CENTS_TOLERANCE_HIGH = 70;
    var CENTS_TOLERANCE_E4 = 90;        /* high E: FFT resolution poorest at ~330Hz */
    var CENTS_TOLERANCE_TOP2 = 85;      /* B3 & E4: top two strings need widest tolerance */
    var MAX_HISTORY = 10;               /* keep more samples for better averaging */
    function isHighPitch(pitchStr) {
      if (!pitchStr) return false;
      var octave = parseInt(pitchStr.replace(/\D/g, '').slice(-1), 10);
      return !isNaN(octave) && octave >= 3;
    }
    function isE4OrHigher(pitchStr) {
      if (!pitchStr) return false;
      var octave = parseInt(pitchStr.replace(/\D/g, '').slice(-1), 10);
      return !isNaN(octave) && octave >= 4;
    }
    function isTopTwoStrings(pitchStr) {
      return pitchStr === 'B3' || pitchStr === 'E4' || pitchStr === 'B4' || pitchStr === 'E5';
    }
    function noteNameOnly(pitchStr) {
      return pitchStr ? pitchStr.replace(/\d/g, '') : '';  /* "E4" -> "E", "B3" -> "B" */
    }
    /* Guitar: when detector gives harmonic only (E5, B4), show fundamental (E4, B3) - cents stay same */
    var HARMONIC_TO_FUNDAMENTAL = { 'E5': 'E4', 'B4': 'B3', 'G4': 'G3', 'D4': 'D3', 'A3': 'A2', 'E3': 'E2' };
    var displayedCents = 0;
    var lastDisplayedPitch = null;
    var lastDisplayedCents = 0;
    var switchCandidateCount = 0;
    var nullCount = 0;
    var CENTS_LERP = 0.12;  /* Slower lerp for smoother, more stable dial */
    var CENTS_MEDIAN_WINDOW = 7;  /* Larger window for better outlier rejection */

    target.__tunerPatchReset = function () {
      pitchHistory = [];
      displayedCents = 0;
      lastDisplayedPitch = null;
      lastDisplayedCents = 0;
      switchCandidateCount = 0;
      nullCount = 0;
    };

    function medianCents(arr) {
      if (!arr || arr.length === 0) return 0;
      var sorted = arr.slice().map(function (p) { return p.cents; }).sort(function (a, b) { return a - b; });
      var mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    /* Trimmed mean: drop top/bottom 25% to reject outliers, then average */
    function trimmedMeanCents(arr) {
      if (!arr || arr.length === 0) return 0;
      var sorted = arr.slice().map(function (p) { return p.cents; }).sort(function (a, b) { return a - b; });
      var drop = Math.max(0, Math.floor(sorted.length * 0.25));
      var trimmed = sorted.slice(drop, sorted.length - drop);
      if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
      var sum = 0;
      for (var t = 0; t < trimmed.length; t++) sum += trimmed[t];
      return sum / trimmed.length;
    }

    target.Tuner.Display.update = function (buffer, pitch, cents) {
      if (target.__tunerDisplayDestroyed) return;
      if (!document.body) return;
      var container = document.querySelector('.tuner');
      if (!container || !document.body.contains(container)) return;

      if (pitch == null || cents == null) {
        nullCount++;
        pitchHistory = [];
        var nullsNeeded = lastDisplayedPitch && isHighPitch(lastDisplayedPitch)
          ? NULLS_TO_CLEAR_HIGH
          : NULLS_TO_CLEAR;
        if (nullCount >= nullsNeeded) {
          lastDisplayedPitch = null;
          displayedCents = 0;
          switchCandidateCount = 0;
          origUpdate.call(target.Tuner.Display, buffer, null, null);
        } else if (lastDisplayedPitch != null) {
          origUpdate.call(target.Tuner.Display, buffer, lastDisplayedPitch, lastDisplayedCents);
        }
        return;
      }
      nullCount = 0;

      pitchHistory.push({ pitch: pitch, cents: cents });
      if (pitchHistory.length > MAX_HISTORY) {
        pitchHistory.shift();
      }

      var showPitch = null;
      var showCents = null;
      var first = pitchHistory[0];
      var highNote = first && isHighPitch(first.pitch);
      /* Onset fast-lock: when coming from silence, lock on attack immediately */
      var requiredLen = lastDisplayedPitch === null
        ? REQUIRED_CONSISTENCY_ONSET
        : (highNote ? REQUIRED_CONSISTENCY_HIGH : REQUIRED_CONSISTENCY);
      var centsTol = highNote ? CENTS_TOLERANCE_HIGH : CENTS_TOLERANCE;
      /* B & high E: need fewer samples to lock (decay fast, hardest to detect) */
      var isTopTwoRange = first && isTopTwoStrings(first.pitch);
      if (isTopTwoRange && requiredLen > 2) requiredLen = 2;
      if (pitchHistory.length >= requiredLen) {
        var allSameNote = pitchHistory.every(function (p) {
          return p.pitch === first.pitch;
        });
        /* High strings: detector often flips E4/E5 or B3/B4 (harmonic); always prefer fundamental */
        var usePitch = first.pitch;
        if (highNote && !allSameNote) {
          var byPitch = {};
          for (var k = 0; k < pitchHistory.length; k++) {
            var pp = pitchHistory[k].pitch;
            byPitch[pp] = (byPitch[pp] || 0) + 1;
          }
          /* Check for octave-doubling (E4+E5, B3+B4): prefer lower octave even with 1 reading */
          var best = null;
          for (var pk in byPitch) {
            var base = noteNameOnly(pk);
            var oct = parseInt(pk.replace(/\D/g, '').slice(-1), 10);
            var upperPitch = base + (oct + 1);  /* e.g. E4 -> E5 */
            if (byPitch[upperPitch]) {
              /* We have both X_n and X_n+1 - prefer fundamental (lower octave) */
              if (byPitch[pk] >= 1) {
                best = pk;
                break;
              }
            }
          }
          if (best == null) {
            var bestOct = 999, bestCount = 0;
            for (var pk2 in byPitch) {
              var oct2 = parseInt(pk2.replace(/\D/g, '').slice(-1), 10);
              if (byPitch[pk2] >= Math.min(2, requiredLen) && (oct2 < bestOct || (oct2 === bestOct && byPitch[pk2] > bestCount))) {
                bestOct = oct2;
                best = pk2;
                bestCount = byPitch[pk2];
              }
            }
          }
          if (best != null) {
            usePitch = best;
            allSameNote = true;
          }
        }
        var centsRange = 0;
        if (allSameNote) {
          var relevant = pitchHistory.filter(function (p) { return p.pitch === usePitch; });
          var minC = relevant[0].cents, maxC = relevant[0].cents;
          for (var i = 1; i < relevant.length; i++) {
            var c = relevant[i].cents;
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
          }
          centsRange = maxC - minC;
        }
        /* B3 & E4: top two strings get widest tolerance; E4+ also gets E4-level */
        var effectiveCentsTol = (usePitch && isTopTwoStrings(usePitch)) ? CENTS_TOLERANCE_TOP2
          : (usePitch && isE4OrHigher(usePitch)) ? CENTS_TOLERANCE_E4 : centsTol;
        if (allSameNote && centsRange <= effectiveCentsTol) {
          /* When detector gives only harmonic (E5, B4), map to fundamental - cents are identical */
          showPitch = HARMONIC_TO_FUNDAMENTAL[usePitch] || usePitch;
          var forCents = relevant || pitchHistory;
          /* Use trimmed mean when 7+ samples (rejects outliers); median for 5-6; mean for fewer */
          var windowed = forCents.slice(-CENTS_MEDIAN_WINDOW);
          if (windowed.length >= 7) {
            showCents = trimmedMeanCents(windowed);
          } else if (windowed.length >= 5) {
            showCents = medianCents(windowed);
          } else {
            var sumCents = 0;
            for (var j = 0; j < windowed.length; j++) {
              sumCents += windowed[j].cents;
            }
            showCents = windowed.length ? sumCents / windowed.length : 0;
          }
        }
      }

      if (showPitch != null) {
        var isNewNote = lastDisplayedPitch === null;
        var isDifferentNote = lastDisplayedPitch !== null && lastDisplayedPitch !== showPitch;

        var holdingPreviousNote = false;
        if (isDifferentNote) {
          var requiredSwitch = isHighPitch(showPitch) ? REQUIRED_SWITCH_HIGH : REQUIRED_SWITCH;
          switchCandidateCount++;
          if (switchCandidateCount < requiredSwitch) {
            holdingPreviousNote = true;
            showPitch = lastDisplayedPitch;
            showCents = lastDisplayedCents;
          } else {
            switchCandidateCount = 0;
          }
        } else {
          switchCandidateCount = 0;
        }

        if (!holdingPreviousNote) {
          if (lastDisplayedPitch === null) {
            displayedCents = showCents;
          } else {
            displayedCents = displayedCents + (showCents - displayedCents) * CENTS_LERP;
          }
        }
        var pitchChanged = lastDisplayedPitch !== null && lastDisplayedPitch !== showPitch;
        lastDisplayedPitch = showPitch;
        lastDisplayedCents = showCents;

        if (pitchChanged) {
          var tunerEl = document.querySelector('.tuner');
          if (tunerEl) tunerEl.classList.add('note-changing');
          origUpdate.call(target.Tuner.Display, buffer, showPitch, displayedCents);
          if (tunerEl) {
            setTimeout(function () {
              if (target.__tunerDisplayDestroyed || !tunerEl.parentNode) return;
              tunerEl.classList.remove('note-changing');
            }, 100);
          }
        } else {
          origUpdate.call(target.Tuner.Display, buffer, showPitch, displayedCents);
        }
      } else {
        origUpdate.call(target.Tuner.Display, buffer, null, null);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchTuner);
  } else {
    patchTuner();
  }
})();
