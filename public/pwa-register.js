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

  // If the first song click happened before the YouTube IFrame finished
  // loading, its programmatic play request can be classified as autoplay.
  // A real tap on Play is a genuine user gesture, so retry directly in that
  // event path.
  window.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest('#mini-play, #np-play, .play-big')) return;
    try {
      if (typeof Player !== 'undefined' && Player.yt && Player.ready) {
        Player.yt.playVideo();
      }
    } catch (_) {}
  }, true);

  // Surface YouTube's explicit autoplay failure instead of silently leaving
  // the player paused.
  const attachYouTubeDiagnostics = () => {
    try {
      if (typeof Player === 'undefined' || !Player.yt || !Player.ready) return false;
      if (Player.yt.__yukiDiagnosticsAttached) return true;
      Player.yt.__yukiDiagnosticsAttached = true;
      Player.yt.addEventListener('onAutoplayBlocked', () => {
        try {
          if (typeof toast === 'function') toast('Tap Play again to start playback');
        } catch (_) {}
      });
      return true;
    } catch (_) {
      return false;
    }
  };

  window.addEventListener('load', () => {
    const timer = setInterval(() => {
      if (attachYouTubeDiagnostics()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 15000);
  });
})();
