if (!window.Eurus.loadedScript.has('shop-by-attribute.js')) {
  window.Eurus.loadedScript.add('shop-by-attribute.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xShopByAttribute', (sectionId, pageParam, initialTab) => ({
        currentTab: initialTab,
        renderedTab: initialTab,
        get loading() {
          return this.currentTab !== this.renderedTab;
        },
        panels: {},
        requests: {},
        setup() {
          if (this.panels[initialTab]) return;
          const panel = this.$refs.panel.querySelector(`#x-fc-${sectionId}-${initialTab}`);
          if (!panel) return;
          panel.dataset.sbaReady = 'true';
          this.panels[initialTab] = panel;
        },
        isCached(index) {
          return Boolean(this.panels[index]);
        },
        prefetch(index) {
          if (this.isCached(index)) return Promise.resolve();
          if (this.requests[index]) return this.requests[index];

          const url = `${window.location.pathname}?section_id=${sectionId}&${pageParam}=${index}`;
          this.requests[index] = fetch(url)
            .then((response) => {
              if (!response.ok) throw new Error(`Shop by attribute tab ${index}: ${response.status}`);
              return response.text();
            })
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, 'text/html');
              const panel = html.getElementById(`x-fc-${sectionId}-${index}`);
              if (!panel) throw new Error(`Shop by attribute tab ${index}: panel not found`);
              this.panels[index] = panel;
            })
            .finally(() => {
              delete this.requests[index];
            });
          return this.requests[index];
        },
        select(index) {
          this.setup();
          this.currentTab = index;
          if (index === this.renderedTab) return;
          if (this.isCached(index)) {
            this.render(index);
            return;
          }

          this.prefetch(index)
            .then(() => {
              if (this.currentTab === index) this.render(index);
            })
            .catch((error) => {
              console.error(error);
              if (this.currentTab === index) this.currentTab = this.renderedTab;
            });
        },
        render(index) {
          const slot = this.$refs.panel;
          const panel = this.panels[index];

          if (panel.dataset.sbaReady) {
            Alpine.mutateDom(() => slot.replaceChildren(panel));
            this.renderedTab = index;
            this.refreshSlider(panel);
            return;
          }

          Alpine.mutateDom(() => slot.replaceChildren());
          panel.dataset.sbaReady = 'true';
          slot.appendChild(panel);
          this.renderedTab = index;
        },
        refreshSlider(panel) {
          const slider = panel.querySelector('[id^="x-collection-"]');
          if (slider && slider.splide) slider.splide.refresh();
        },
        restoreTabRoles(el) {
          el.removeAttribute('aria-roledescription');
          el.querySelectorAll('.splide__slide').forEach((slide) => {
            slide.setAttribute('role', 'presentation');
            ['aria-roledescription', 'aria-label', 'aria-hidden'].forEach((attr) => slide.removeAttribute(attr));
          });
        },
        scrollIntoView(element) {
          const slider = element.closest('.splide');
          if (!slider || !slider.splide) return;
          const target = slider.splide.Components.Slides.get().find((item) => item.slide.contains(element));
          if (target) slider.splide.go(target.index);
        }
      }));
    });
  });
}
