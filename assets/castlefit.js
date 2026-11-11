/*
  CastleFit / After Dark class pages. Ported from the old theme's built
  app.js (no source in that repo) and enavi-custom.js.

  State lives in localStorage, per device:
    favorites        -> ["<article id>", ...]
    completedVideos  -> ["video-<article id>", ...]

  Modules, each a no-op when its markup is absent:
    vimeo      tap-to-load player, at most one per page
    favorites  star buttons on cards and the article page
    nativeVideo  cards that play a Shopify-hosted file (legacy fallback)
    articleRail  completion checkboxes + category progress
    classHeader  menu toggle, "Complete and Continue"
    blogFilters  tag panel toggle
    favoritesPage  renders starred classes from window.castlefitArticles
*/
(function () {
  const FAVORITES_KEY = 'favorites';
  const COMPLETED_KEY = 'completedVideos';
  const MOBILE_MAX_WIDTH = 991;
  const OPEN_CLASS = 'menu-container--open';

  function readList(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      return [];
    }
  }

  function writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (error) {
      // Private mode or storage blocked: state just won't persist.
    }
  }

  function addTo(key, value) {
    const list = readList(key);
    if (list.includes(value)) {
      return;
    }
    list.push(value);
    writeList(key, list);
  }

  function removeFrom(key, value) {
    writeList(key, readList(key).filter((item) => item !== value));
  }

  /* ---------- vimeo ----------
     Tap-to-load: a card shows only its poster until played. The portal
     lists ~200 classes; mounting a Vimeo player per card exhausted memory
     and decoders on Android tablets and crashed iPhone tabs.

       tap play -> clone placeholder iframe -> src + autoplay -> play
       tap another card -> previous clone removed, placeholder restored
  */
  function initVimeo() {
    const START_TIMEOUT_MS = 3000;
    const AUTOPLAY_PARAM = '&autoplay=1';

    // { container, placeholder, frame, player } of the loaded card.
    let active = null;

    function setCover(container, visible) {
      container.querySelector('.vimeo-play-btn')?.classList.toggle('hidden', !visible);
      container.querySelector('.vimeo-poster')?.classList.toggle('hidden', !visible);
    }

    // Removing the clone ends its browsing context, freeing the decoder.
    function unloadActive() {
      if (!active) {
        return;
      }
      active.frame.replaceWith(active.placeholder);
      setCover(active.container, true);
      active = null;
    }

    function loadPlayer(container) {
      const placeholder = container.querySelector('iframe[data-src]');
      if (!placeholder) {
        return;
      }

      unloadActive();

      const frame = placeholder.cloneNode();
      frame.removeAttribute('data-src');
      frame.src = placeholder.dataset.src + AUTOPLAY_PARAM;
      placeholder.replaceWith(frame);

      // Without the SDK, fall back to Vimeo's own controls.
      if (!window.Vimeo) {
        active = { container, placeholder, frame, player: null };
        setCover(container, false);
        return;
      }

      const player = new Vimeo.Player(frame);
      active = { container, placeholder, frame, player };

      // Android WebView may block scripted playback without a tap inside
      // the iframe. If nothing starts, uncover Vimeo's own play button.
      let started = false;
      setTimeout(() => {
        if (!started && active?.player === player) {
          setCover(container, false);
        }
      }, START_TIMEOUT_MS);

      player.on('play', () => {
        started = true;
        setCover(container, false);
      });
      player.on('pause', () => setCover(container, true));
      player.on('ended', () => setCover(container, true));

      player.play().catch(() => {});
    }

    // Delegated, so cards injected later work too. A poster wrapped in a
    // link navigates to the class instead.
    document.addEventListener('click', (event) => {
      const target = event.target.closest('.vimeo-play-btn, .vimeo-poster');
      if (!target || target.closest('a')) {
        return;
      }

      const container = target.closest('.vimeo-wrapper');
      if (!container) {
        return;
      }

      if (active?.container === container) {
        active.player?.play().catch(() => {});
        return;
      }

      loadPlayer(container);
    });
  }

  /* ---------- favorites ----------
     Labels come from the button (Favourite button block settings).
  */
  const FAVORITED_TEXT = 'Favorited';
  const UNFAVORITED_TEXT = 'Add to favorites';

  function paintFavorite(button, isFavorite) {
    button.classList.toggle('active', isFavorite);
    button.setAttribute('aria-pressed', String(isFavorite));

    const text = button.querySelector('.castlefit--favorites_text');
    if (!text) {
      return;
    }

    const on = button.dataset.labelOn || FAVORITED_TEXT;
    const off = button.dataset.labelOff || UNFAVORITED_TEXT;
    text.textContent = isFavorite ? on : off;
  }

  function initFavorites() {
    const favorites = readList(FAVORITES_KEY);

    document.querySelectorAll('[data-castlefit-favorites]').forEach((button) => {
      paintFavorite(button, favorites.includes(button.dataset.castlefitFavorites));
    });

    // Delegated: favourites page cards are rendered after this runs.
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-castlefit-favorites]');
      if (!button) {
        return;
      }

      const id = button.dataset.castlefitFavorites;
      const isFavorite = readList(FAVORITES_KEY).includes(id);

      if (isFavorite) {
        removeFrom(FAVORITES_KEY, id);
      } else {
        addTo(FAVORITES_KEY, id);
      }
      paintFavorite(button, !isFavorite);

      // On the favourites page an unstarred class leaves the list.
      if (isFavorite && button.closest('.main-favorites-castlefit--container')) {
        button.closest('.castlefit--media_card')?.remove();
      }
    });
  }

  /* ---------- nativeVideo ----------
     Shopify-hosted file cards: one plays at a time; finishing marks the
     class completed, replaying clears it.
  */
  let playingVideo = null;

  function bindNativeCard(card) {
    const media = card.querySelector('.castlefit--media');
    const video = card.querySelector('.castlefit--video');
    const button = card.querySelector('.castlefit--play_button');
    const badge = card.querySelector('.castlefit--badge');
    if (!media || !video || !button || !badge) {
      return;
    }

    const videoId = card.dataset.videoid;

    function setCompleted(isCompleted) {
      media.classList.toggle('video--complete', isCompleted);
      badge.classList.toggle('hidden', !isCompleted);
    }

    function stop(target) {
      target.pause();
      target.controls = false;
      target.closest('.castlefit--media')?.querySelector('.castlefit--play_button')?.classList.remove('hidden');
    }

    setCompleted(readList(COMPLETED_KEY).includes(videoId));

    button.addEventListener('click', () => {
      if (!video.paused) {
        stop(video);
        playingVideo = null;
        return;
      }

      if (playingVideo && playingVideo !== video) {
        stop(playingVideo);
      }
      video.controls = true;
      button.classList.add('hidden');
      video.play().catch(() => {
        button.classList.remove('hidden');
      });
      playingVideo = video;
    });

    video.addEventListener('play', () => {
      if (!media.classList.contains('video--complete')) {
        return;
      }
      setCompleted(false);
      removeFrom(COMPLETED_KEY, videoId);
    });

    video.addEventListener('ended', () => {
      stop(video);
      setCompleted(true);
      addTo(COMPLETED_KEY, videoId);
      playingVideo = null;
    });
  }

  function initNativeVideo() {
    document.querySelectorAll('.castlefit--media_card').forEach(bindNativeCard);
  }

  /* ---------- articleRail ----------
     Checkboxes in the rail mark classes done. Progress counts only the
     classes listed in this category, e.g. "3 / 12 Complete".
  */
  function initArticleRail() {
    if (!document.querySelector('.main-article-castlefit--wrapper')) {
      return;
    }

    const summary = document.querySelector('.castlefit-video--videos-completed');
    const doneText = document.querySelector('.castlefit-video--video-size-completed');
    const bar = document.querySelector('.castlefit-video--videos-completed-progress-bar');
    const inputs = Array.from(document.querySelectorAll('.main-article-castlefit--related-articles-checkbox input'));
    const total = Number(summary?.dataset.totalVideos) || inputs.length;
    const listedIds = inputs.map((input) => input.dataset.videoId);

    function render() {
      const done = readList(COMPLETED_KEY).filter((id) => listedIds.includes(id)).length;
      if (doneText) {
        doneText.textContent = String(done);
      }
      if (bar) {
        bar.style.width = `${total > 0 ? (done / total) * 100 : 0}%`;
      }
    }

    const completed = readList(COMPLETED_KEY);
    inputs.forEach((input) => {
      const id = input.dataset.videoId;
      input.checked = completed.includes(id);
      input.setAttribute('aria-label', `Mark ${input.closest('li')?.querySelector('a')?.textContent.trim() || 'class'} complete`);

      input.addEventListener('change', () => {
        if (input.checked) {
          addTo(COMPLETED_KEY, id);
        } else {
          removeFrom(COMPLETED_KEY, id);
        }
        render();
      });
    });

    render();
  }

  /* ---------- classHeader ---------- */
  function initClassHeader() {
    const header = document.querySelector('.castlefit-article-header--wrapper');
    if (!header) {
      return;
    }

    const article = document.querySelector('.main-article-castlefit--wrapper');
    const toggle = header.querySelector('.castlefit-article-header--menu-button');
    const label = header.querySelector('.castlefit-article-header--menu-text');
    const complete = header.querySelector('.castlefit-article-header--complete-video');
    const hideText = toggle?.dataset.openLabel || 'Hide Menu';
    const showText = toggle?.dataset.closedLabel || 'Menu';

    // Class list switched off in the class section: nothing to toggle.
    if (toggle && !document.querySelector('.main-article-castlefit--menu-container')) {
      toggle.hidden = true;
    }

    function setOpen(isOpen) {
      header.classList.toggle(OPEN_CLASS, isOpen);
      article?.classList.toggle(OPEN_CLASS, isOpen);
      toggle?.setAttribute('aria-expanded', String(isOpen));
      if (label) {
        label.textContent = isOpen ? hideText : showText;
      }
    }

    toggle?.addEventListener('click', () => {
      setOpen(!header.classList.contains(OPEN_CLASS));
    });

    // "Complete and Continue" ticks the current class before navigating.
    complete?.addEventListener('click', () => {
      const box = document.getElementById(`checkbox-${complete.dataset.currentArticle}`);
      if (box && !box.checked) {
        box.click();
      }
    });

    // Small screens start with the rail collapsed so the video leads.
    if (window.innerWidth <= MOBILE_MAX_WIDTH) {
      setOpen(false);
    }
  }

  /* ---------- blogFilters ---------- */
  function initBlogFilters() {
    const button = document.querySelector('.main-blog-castlefit--filters-button');
    const panel = document.querySelector('.main-blog-castlefit--tags');
    if (!button || !panel) {
      return;
    }

    const openText = button.textContent.trim();
    const closeText = button.dataset.openLabel || 'Close Filters';

    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const isHidden = panel.classList.toggle('hidden');
      panel.setAttribute('aria-hidden', String(isHidden));
      button.setAttribute('aria-expanded', String(!isHidden));
      button.textContent = isHidden ? openText : closeText;
    });
  }

  /* ---------- favoritesPage ---------- */
  const STAR_SVG = '<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.549 2.92664C11.8483 2.00537 13.1517 2.00538 13.451 2.92664L14.9699 7.60055C15.1038 8.01254 15.4877 8.29148 15.9209 8.29149L20.8354 8.29168C21.8041 8.29172 22.2068 9.53127 21.4232 10.1007L17.4474 12.9895C17.0969 13.2441 16.9503 13.6955 17.0841 14.1075L18.6026 18.7815C18.9019 19.7028 17.8475 20.4689 17.0638 19.8995L13.0878 17.011C12.7373 16.7564 12.2627 16.7564 11.9122 17.011L7.93622 19.8995C7.15252 20.4689 6.0981 19.7028 6.3974 18.7815L7.91589 14.1075C8.04974 13.6955 7.90309 13.2441 7.55263 12.9895L3.57683 10.1007C2.79317 9.53127 3.19592 8.29172 4.16461 8.29168L9.07911 8.29149C9.51231 8.29148 9.89623 8.01254 10.0301 7.60055L11.549 2.92664Z" stroke="#3E4044" stroke-width="2"/></svg>';
  const PLAY_SVG = '<svg aria-hidden="true" width="33" height="32" viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16.4964" cy="16.0001" r="9.43392" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M16.5031 28.7999C23.5724 28.7999 29.3031 23.0692 29.3031 16C29.3031 8.93071 23.5724 3.19995 16.5031 3.19995C9.43388 3.19995 3.70312 8.93071 3.70312 16C3.70312 23.0692 9.43388 28.7999 16.5031 28.7999ZM15.7906 11.4687C15.2997 11.1414 14.6684 11.1108 14.1482 11.3893C13.6279 11.6677 13.3031 12.2099 13.3031 12.8V19.2C13.3031 19.79 13.6279 20.3322 14.1482 20.6106C14.6684 20.8891 15.2997 20.8585 15.7906 20.5312L20.5906 17.3312C21.0358 17.0345 21.3031 16.5349 21.3031 16C21.3031 15.465 21.0358 14.9654 20.5906 14.6687L15.7906 11.4687Z" fill="#3E4044"/></svg>';
  const CHECK_SVG = '<svg width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden="true"><path d="M4.25 10.25L7.25 13.25L14.75 5.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  }

  // Card settings from the favourites section, e.g. data-show-length="false".
  function cardFlags(container) {
    const shown = (name) => container.dataset[name] !== 'false';
    return {
      length: shown('showLength'),
      description: shown('showDescription'),
      equipment: shown('showEquipment'),
    };
  }

  // Same markup as snippets/castlefit-video-card.liquid (Vimeo branch).
  function favoriteCard(item, show) {
    const card = document.createElement('div');
    card.className = 'castlefit castlefit--media_card';
    card.dataset.videoid = item.videoId;

    const title = escapeHtml(item.title);
    const poster = item.image
      ? `<img src="${escapeHtml(item.image)}" class="vimeo-poster absolute inset-0 w-full h-full object-cover rounded-[8px] z-10" alt="" loading="lazy">`
      : '';
    const player = item.vimeoSrc
      ? `<div class="relative vimeo-wrapper">${poster}<iframe data-src="${escapeHtml(item.vimeoSrc)}" class="h-full w-full rounded-[8px]" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen title="${title}"></iframe><button type="button" class="vimeo-play-btn" aria-label="Play video | ${title}">${PLAY_SVG}</button></div>`
      : `<a href="${escapeHtml(item.url)}" class="vimeo-wrapper">${poster}</a>`;

    card.innerHTML = `
      <div class="castlefit--media">
        <div class="castlefit--badge hidden">${CHECK_SVG} Completed</div>
        ${player}
      </div>
      <div class="castlefit--content">
        <div class="castlefit--info-top">
          ${show.length ? `<p class="castlefit--media_length">${escapeHtml(item.duration)}</p>` : ''}
          <button class="castlefit--favorites active" aria-pressed="true" aria-label="Remove from favorites" data-castlefit-favorites="${escapeHtml(item.id)}">${STAR_SVG}</button>
        </div>
        <div class="castlefit--info-bottom">
          <a href="${escapeHtml(item.url)}" class="castlefit--article_url"><p class="castlefit--title">${title}</p></a>
          ${show.description ? `<p class="castlefit--description">${escapeHtml(item.content)}</p>` : ''}
          ${show.equipment ? `<p class="castlefit--equipment">${escapeHtml(item.equipment_needed)}</p>` : ''}
        </div>
      </div>`;

    if (readList(COMPLETED_KEY).includes(item.videoId)) {
      card.querySelector('.castlefit--badge').classList.remove('hidden');
    }
    return card;
  }

  function initFavoritesPage() {
    const container = document.querySelector('.main-favorites-castlefit--container');
    if (!container) {
      return;
    }

    const articles = window.castlefitArticles || [];
    const show = cardFlags(container);
    readList(FAVORITES_KEY).forEach((id) => {
      const item = articles.find((article) => article.id === id);
      if (item) {
        container.appendChild(favoriteCard(item, show));
      }
    });
  }

  function init() {
    initFavoritesPage();
    initVimeo();
    initFavorites();
    initNativeVideo();
    initArticleRail();
    initClassHeader();
    initBlogFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
