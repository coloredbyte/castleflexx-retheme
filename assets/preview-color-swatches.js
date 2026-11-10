if (!window.Eurus.loadedScript.has('preview-color-swatches.js')) {
  window.Eurus.loadedScript.add('preview-color-swatches.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xProductCard', (
        sectionId,
        productUrl,
        productId,
        enableB2B
      ) => ({
        enableB2B: enableB2B,
        isSelect: false,
        productId: productId,
        showOptions: false,
        loadingProductEls: '',
        init() {
          document.addEventListener(`eurus:product-card-variant-select:updated:${sectionId}:${productUrl}`, (e) => {
            this.checkVariantSelected();
            this.loadingProductEls = '';
          });
        },
        checkVariantSelected() {
          const fieldset = [...document.querySelectorAll(`#variant-update-${sectionId} fieldset`)];
          if(fieldset.findIndex(item => !item.querySelector("input:checked")) == "-1") {
            this.isSelect = true;
          }
        },
        toggleOptions() {
          this.showOptions = !this.showOptions;
          if (!this.showOptions) this.syncOptions();
        },
        syncOptions() {
          const card = this.$el.closest('.card-product');
          const popup = Array.from(card.querySelectorAll('.choose-options')).find((node) => node.querySelector('.x-variants-data-js'));
          Alpine.store('xQuickView').syncCardSelection(card, popup);
        }
      }));
    })
  });
}    