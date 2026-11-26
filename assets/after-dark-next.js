/*
  After Dark "next class" for the portal member banner.

    class page  [data-ad-next] --tap play--> localStorage.cfNextAfterDark
    portal      a[data-ad-next-banner] <---- saved class, else random

  Per device. Load with defer. Same file in the old theme and the retheme.
*/
(function () {
  const NEXT_KEY = 'cfNextAfterDark';
  const PLAYER = '.main-article-castlefit--video .vimeo-play-btn, .main-article-castlefit--video .vimeo-poster';

  function readNext() {
    try {
      return localStorage.getItem(NEXT_KEY);
    } catch (error) {
      return null;
    }
  }

  // '' = last class of its series: forget, so the banner picks at random.
  function saveNext(url) {
    try {
      if (!url) {
        localStorage.removeItem(NEXT_KEY);
        return;
      }
      localStorage.setItem(NEXT_KEY, url);
    } catch (error) {
      // Storage blocked: the banner stays random.
    }
  }

  // The saved URL must still be a published class, e.g. not renamed since.
  function pointBanner(banner) {
    const classes = (banner.dataset.adClasses || '').split(',').filter(Boolean);
    if (!classes.length) {
      return;
    }

    const saved = readNext();
    if (classes.includes(saved)) {
      banner.href = saved;
      return;
    }

    banner.href = classes[Math.floor(Math.random() * classes.length)];
  }

  function pointBanners() {
    document.querySelectorAll('a[data-ad-next-banner]').forEach(pointBanner);
  }

  // Capture phase: the player's own handlers can't swallow the tap first.
  document.addEventListener('click', (event) => {
    if (!event.target.closest(PLAYER)) {
      return;
    }

    const marker = document.querySelector('[data-ad-next]');
    if (marker) {
      saveNext(marker.dataset.adNext);
    }
  }, true);

  // pageshow covers "back" from a class, which restores the page unchanged.
  window.addEventListener('pageshow', pointBanners);
  pointBanners();
})();
