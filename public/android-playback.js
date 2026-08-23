/* Yuki Music Android bridge + playback diagnostics.
 * The official YouTube IFrame API controls its own adaptive bitrate selection;
 * this layer never tries to force a deprecated quality value.
 */
(() => {
  const android = () => window.YukiAndroid;
  let lastState = null;
  let lastVideoId = null;
  let bufferingSince = 0;
  let bufferToastAt = 0;

  function callAndroid(method, ...args) {
    try {
      const bridge = android();
      if (bridge && typeof bridge[method] === 'function') bridge[method](...args);
    } catch (_) {}
  }

  function syncNative(state) {
    if (typeof Player === 'undefined') return;
    const song = Player.current;
    if (!song || !song.videoId) return;
    const playing = state === 1;
    const paused = state === 2 || state === 5;
    if (!playing && !paused) return;
    callAndroid('updatePlayback',
      String(song.title || ''),
      String(song.artist || song.subtitle || ''),
      String(song.thumbnail || ''),
      playing
    );
  }

  function handleState(state) {
    const song = typeof Player !== 'undefined' ? Player.current : null;
    const videoId = song && song.videoId;
    if (videoId && videoId !== lastVideoId) {
      lastVideoId = videoId;
      lastState = null;
      bufferingSince = 0;
    }

    if (state === 3) {
      if (!bufferingSince) bufferingSince = Date.now();
    } else if (state === 1) {
      if (bufferingSince) {
        const ms = Date.now() - bufferingSince;
        bufferingSince = 0;
        if (ms >= 700 && Date.now() - bufferToastAt > 10000) {
          bufferToastAt = Date.now();
          try { toast(`Network buffering · ${ms} ms`); } catch (_) {}
        }
      }
    } else if (state !== lastState) {
      bufferingSince = 0;
    }

    if (state !== lastState) {
      lastState = state;
      syncNative(state);
    }
  }

  window.__yukiAndroidControl = (command) => {
    try {
      if (typeof Player === 'undefined' || !Player.yt || !Player.ready) return;
      if (command === 'play') Player.yt.playVideo();
      else if (command === 'pause') Player.yt.pauseVideo();
      else if (command === 'next') nextTrack(false);
      else if (command === 'prev') prevTrack();
      else if (command === 'stop') {
        Player.yt.stopVideo();
        callAndroid('stopPlayback');
      }
    } catch (_) {}
  };

  // The old custom quality control is misleading: YouTube removed support for
  // forcing playback quality in the IFrame API. Keep the UI safe and adaptive.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('#np-quality') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    target.classList.remove('on');
    const label = target.querySelector('span');
    if (label) label.textContent = 'Auto';
    target.title = 'YouTube adaptive quality';
    try { toast('YouTube adaptive quality is automatic'); } catch (_) {}
  }, true);

  function init() {
    const quality = document.querySelector('#np-quality');
    if (quality) {
      quality.classList.remove('on');
      const label = quality.querySelector('span');
      if (label) label.textContent = 'Auto';
      quality.title = 'YouTube adaptive quality';
    }

    setInterval(() => {
      try {
        if (!Player || !Player.yt || !Player.ready || !Player.current) return;
        const state = Player.yt.getPlayerState();
        handleState(state);
      } catch (_) {}
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
