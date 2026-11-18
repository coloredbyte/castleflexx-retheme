// assets/choose-your-device.js
// Carousel dots for sections/choose-your-device.liquid. The scrolling, snapping and
// next-card peek are pure CSS (assets/choose-your-device.css) - this file only renders
// the dots and keeps them in sync with the scroll position, so the carousel still works
// when JS is unavailable. The dots container stays empty in that case and the CSS keeps
// it hidden via :not(:empty).
(function () {
  function init(root) {
    const track = root.querySelector('[data-cyd-track]');
    const dots = root.querySelector('[data-cyd-dots]');
    // childElementCount guards against a second init on theme-editor re-render.
    if (!track || !dots || dots.childElementCount) return;

    const cards = Array.prototype.slice.call(track.querySelectorAll('.cyd-card'));
    if (cards.length < 2) return;

    const labelTemplate = dots.dataset.dotLabel || 'Go to device __i__';

    cards.forEach(function (card, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cyd__dot';
      dot.setAttribute('aria-label', labelTemplate.replace('__i__', i + 1));
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', function () {
        card.scrollIntoView({ inline: 'start', block: 'nearest' });
      });
      dots.appendChild(dot);
    });

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          const active = cards.indexOf(entry.target);
          cards.forEach(function (_, i) {
            dots.children[i].setAttribute('aria-current', i === active ? 'true' : 'false');
          });
        });
      },
      { root: track, threshold: 0.6 }
    );

    cards.forEach(function (card) {
      observer.observe(card);
    });
  }

  function initAll(scope) {
    (scope || document).querySelectorAll('.cyd').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
    });
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
