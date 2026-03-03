/**
 * Patch for tuner.coffee: fixes crash when transitioning away from tuner face.
 *
 * Root cause: tuner.coffee's Display.init adds a global 'resize' listener that is
 * NEVER removed. When we switch faces, layout changes trigger 'resize', the handler
 * runs and accesses DOM that React has removed -> null.classList -> TypeError.
 *
 * This patch: (1) intercepts addEventListener to capture the tuner's resize handler,
 * (2) wraps Tuner() so we know when init runs, (3) patches destroy to remove the
 * resize listener, (4) guards Display.update against missing DOM.
 */
(function () {
  var capturedResizeHandler = null;
  var target = typeof window !== 'undefined' ? window : null;
  if (!target) return;

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
    target.Tuner.Display.update = function (buffer, pitch, cents) {
      if (target.__tunerDisplayDestroyed) return;
      if (!document.body) return;
      var container = document.querySelector('.tuner');
      if (!container || !document.body.contains(container)) return;
      origUpdate.call(target.Tuner.Display, buffer, pitch, cents);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchTuner);
  } else {
    patchTuner();
  }
})();
