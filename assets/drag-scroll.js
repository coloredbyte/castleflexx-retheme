if (!window.Eurus.loadedScript.has('drag-scroll.js')) {
  window.Eurus.loadedScript.add('drag-scroll.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xDragScroll', () => ({
        isDown: false,
        moved: false,
        startX: 0,
        startScroll: 0,
        init() {
          const el = this.$el;
          const updateScrollable = () => {
            el.classList.toggle('is-scrollable', el.scrollWidth > el.clientWidth);
          };
          updateScrollable();
          if (window.ResizeObserver) {
            new ResizeObserver(updateScrollable).observe(el);
          }

          el.addEventListener('dragstart', (e) => e.preventDefault());
          el.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0 || !el.classList.contains('is-scrollable')) return;
            this.isDown = true;
            this.moved = false;
            this.startX = e.clientX;
            this.startScroll = el.scrollLeft;
          });
          el.addEventListener('pointermove', (e) => {
            if (!this.isDown) return;
            const dx = e.clientX - this.startX;
            if (!this.moved) {
              if (Math.abs(dx) < 5) return;
              this.moved = true;
              el.setPointerCapture(e.pointerId);
              el.classList.add('is-dragging');
              window.getSelection()?.removeAllRanges();
            }
            el.scrollLeft = this.startScroll - dx;
          });
          const end = (e) => {
            if (!this.isDown) return;
            this.isDown = false;
            el.classList.remove('is-dragging');
            if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
          };
          el.addEventListener('pointerup', end);
          el.addEventListener('pointercancel', end);
          el.addEventListener('click', (e) => {
            if (!this.moved) return;
            e.preventDefault();
            e.stopPropagation();
            this.moved = false;
          }, true);
        }
      }));
    });
  });
}
