/**
 * Polyfill for legacy navigator.getUserMedia.
 * Tauri uses WebKit on macOS, which only supports navigator.mediaDevices.getUserMedia.
 * tuner.coffee expects the old navigator.getUserMedia API.
 */
(function() {
  if (navigator.getUserMedia) return; // Already exists
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  navigator.getUserMedia = function(constraints, success, error) {
    navigator.mediaDevices.getUserMedia(constraints).then(success).catch(error || function() {});
  };
})();
