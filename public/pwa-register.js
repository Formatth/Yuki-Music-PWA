(() => {
  // Keep the PWA shell installable and updateable.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => registration.update().catch(() => {}))
        .catch((error) => console.warn('[Yuki Music] Service worker registration failed:', error));
    });
  }

  // YouTube's embedded player needs explicit autoplay permission and a
  // referrer policy in some WebView environments. The IFrame API creates the
  // iframe dynamically, so apply these attributes as soon as it appears.
  const hardenYouTubeIframe = () => {
    document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]').forEach((frame) => {
      frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; web-share');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    });
  };

  const observer = new MutationObserver(hardenYouTubeIframe);
  window.addEventListener('DOMContentLoaded', () => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(meta);
    hardenYouTubeIframe();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  // YouTube exposes dedicated events when scripted playback is blocked or
  // when the embedded player itself rejects a video. Keep these diagnostics
  // visible instead of silently failing.
  const attachYouTubeDiagnostics = () => {
    try {
      if (typeof Player === 'undefined' || !Player.yt || !Player.ready) return false;
      if (Player.yt.__yukiDiagnosticsAttached) return true;
      Player.yt.__yukiDiagnosticsAttached = true;
      Player._yukiAutoplayBlocked = false;
      Player.yt.addEventListener('onAutoplayBlocked', () => {
        Player._yukiAutoplayBlocked = true;
        try {
          if (typeof toast === 'function') toast('Tap Play again to start playback');
        } catch (_) {}
      });
      Player.yt.addEventListener('onError', (event) => {
        try {
          if (typeof toast === 'function') toast(`YouTube playback error ${event.data}`);
        } catch (_) {}
      });
      return true;
    } catch (_) {
      return false;
    }
  };

  // This listener runs in the same trusted click event as the Play button.
  // It is only active after YouTube explicitly reported an autoplay block, so
  // it cannot interfere with normal pause/play behaviour.
  window.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest('#mini-play, #np-play, .play-big')) return;
    try {
      if (typeof Player !== 'undefined' && Player._yukiAutoplayBlocked && Player.yt && Player.ready) {
        Player._yukiAutoplayBlocked = false;
        Player.yt.playVideo();
      }
    } catch (_) {}
  }, true);

  window.addEventListener('load', () => {
    const timer = setInterval(() => {
      if (attachYouTubeDiagnostics()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 15000);
  });
})();
