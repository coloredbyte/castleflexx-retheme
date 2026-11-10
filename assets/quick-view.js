requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xQuickView', {
      sectionId: window.xQuickView.sectionId,
      enabled: window.xQuickView.enabled,
      buttonLabel: window.xQuickView.buttonLabel,
      show_atc_button: window.xQuickView.show_atc_button,
      btn_atc_bottom: window.xQuickView.atc_btn_bottom,
      atc_btn_image_desktop: window.xQuickView.atc_btn_image_desktop,
      show: false,
      loading: false,
      currentVariant: '',
      cachedResults: [],
      cachedfetch: [],
      loadingUrls: [],
      loadedChooseOptions: [],
      loadedChooseOptionsID: [],
      selected: false,
      loadingChooseOption: false,
      openPopupMobile: false,
      isMiniCart: false,
      hideViewDetail: false,
      hideQuantity: false,
      bundleTarget: '',
      bundleButtonLabel: '',
      bundleAddedLabel: '',
      bundleAddedIds: [],
      bundleStepFull: false,
      bundleChooseOptionLabel: '',
      resetOptionsTimeout: null,
      buttonQuickView: "",
      chooseOptionCard: null,
      applyBundleLabel() {
        if (!this.bundleTarget || !this.bundleButtonLabel) return;

        requestAnimationFrame(() => {
          const content = document.getElementById('quickview-product-content');
          const buttonEl = content?.querySelector('.add_to_cart_button');
          if (!buttonEl) return;
          const textEl = buttonEl.querySelector('.x-atc-text');
          if (!textEl) return;
          const textNode = Array.from(textEl.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
          if (!textNode) return;

          const variantId = (document.getElementById('product-form-' + this.sectionId) || content).querySelector('input[name="id"]')?.value;
          if (buttonEl.hasAttribute('disabled')) {
            if (this.bundleChooseOptionLabel && buttonEl.dataset.available === 'true') {
              textNode.textContent = this.bundleChooseOptionLabel;
            }
            return;
          }

          if (this.bundleStepFull) {
            buttonEl.setAttribute('disabled', 'disabled');
            textNode.textContent = this.bundleButtonLabel;
            return;
          }

          if (this.bundleAddedLabel && variantId && this.bundleAddedIds.some((id) => id == variantId)) {
            buttonEl.setAttribute('disabled', 'disabled');
            textNode.textContent = this.bundleAddedLabel;
            return;
          }

          textNode.textContent = this.bundleButtonLabel;
        });
      },
      addListener() {
        document.addEventListener('eurus:cart:items-changed', () => {
          this.cachedResults = [];
        });
        document.addEventListener(`eurus:product-page-variant-select:updated:${this.sectionId}`, () => {
          this.applyBundleLabel();
        });
      },
      showBtn(enable, showATCButton, textBtn) {
        this.enabled = enable;
        this.buttonLabel = textBtn;
        this.show_atc_button = showATCButton;
      },
      load(url, el, optionId) {
        this.loading = true;

        requestAnimationFrame(() => {
          setTimeout(() => { 
            if (this.buttonQuickView == '') {
              this.buttonQuickView = el;
            }
            let variant = document.getElementById('current-variant-' + optionId)?.innerText;
            let productUrl = variant?`${url}?variant=${variant}&section_id=${this.sectionId}`:`${url}?section_id=${this.sectionId}`;
            productUrl = productUrl.replace(/\s+/g, '');
            
            if (this.cachedResults[productUrl]) {
              document.getElementById('quickview-product-content').innerHTML = this.cachedResults[productUrl];
              this.loading = false;
              this.applyBundleLabel();
              return true;
            }
            
            if (this.cachedfetch[productUrl]) {
              return true;
            }

            this.cachedfetch[productUrl] = true;
            fetch(productUrl)
              .then(reponse => {
                return reponse.text();
              })
              .then((response) => {
                const parser = new DOMParser();
                const content = parser.parseFromString(response,'text/html').getElementById("quickview-product-content").innerHTML;
                document.getElementById('quickview-product-content').innerHTML = content;
                this.cachedResults[productUrl] = content;
                this.applyBundleLabel();
                document.dispatchEvent(new CustomEvent("eurus:quickview:loaded", {
                  detail: {
                    productUrl: url
                  }
                }));
              })
              .finally(() => {
                this.loading = false;
                this.cachedfetch[productUrl] = false;
              })

            return true;
          }, 0)
        });
      },
      async loadChooseOptions(url, el, optionId, index) {
        setTimeout(async () => {
          let urlProduct = `${url}?section_id=choose-option&page=${index}`;
          
          let destinationElm = document.getElementById('choose-options-' + optionId)?.querySelector('.choose-options');
          let destinationElmMobile = document.getElementById('choose-options-mobile');
          let loadingEl = document.getElementById('choose-options-' + optionId)?.querySelector('.icon-loading');
          
          if (this.loadedChooseOptions[urlProduct]) {
            if (window.xViewport.innerWidth > 767) {
              if (!el.closest('.card-product').querySelector('#choose-options-' + optionId)?.querySelector('.choose-options-content')) {
                destinationElm && (destinationElm.innerHTML = this.loadedChooseOptions[urlProduct]);
                destinationElmMobile && (destinationElmMobile.innerHTML = '');  
              }
              if (destinationElm) {
                if (destinationElm.querySelector(".add_to_cart_button")) {
                  destinationElm.querySelector(".add_to_cart_button").style.display="block";
                }
                if (destinationElm.querySelector(".label-btn-quickview")) {
                  destinationElm.querySelector(".label-btn-quickview").style.display="none";
                }
              }
            } else {
              if (!el.closest('.card-product').querySelector('#choose-options-mobile')) {
                destinationElmMobile && (destinationElmMobile.innerHTML = this.loadedChooseOptions[urlProduct]);
                destinationElm && (destinationElm.innerHTML = '');
              }
              if (destinationElmMobile) {
                if (destinationElmMobile.querySelector(".add_to_cart_button")) {
                  destinationElmMobile.querySelector(".add_to_cart_button").style.display="block";
                }
                if (destinationElmMobile.querySelector(".label-btn-quickview")) {
                  destinationElmMobile.querySelector(".label-btn-quickview").style.display="none";
                }
              }
            }
            requestAnimationFrame(() => {
              this.syncChooseOptionSelection(el.closest('.card-product'), window.xViewport.innerWidth > 767 ? destinationElm : destinationElmMobile);
            });
            return true;
          }
          
          try {
            if (loadingEl) {
              loadingEl.classList.remove('hidden');
            }
            this.loadingChooseOption = true;
            if (!this.loadingUrls.includes(urlProduct)) {
              this.loadingUrls.push(urlProduct);
              await fetch(urlProduct).then((response) => response.text()).then((content) => {
                const parser = new DOMParser();
                const parsedContent = parser.parseFromString(content, 'text/html').getElementById("choose-options-content").innerHTML;
                
                if (parsedContent) {
                  if (window.xViewport.innerWidth > 767) {
                    destinationElmMobile && (destinationElmMobile.innerHTML = '');
                    destinationElm && (destinationElm.innerHTML = parsedContent);
                  } else {
                    destinationElmMobile && (destinationElmMobile.innerHTML = parsedContent);
                    destinationElm && (destinationElm.innerHTML = '');
                  }
                  this.loadedChooseOptions[urlProduct] = parsedContent;
                }
                if (loadingEl) {
                  loadingEl.classList.add('hidden');
                }  
              }).finally(() => {
                const index = this.loadingUrls.indexOf(urlProduct);
                if (index !== -1) this.loadingUrls.splice(index, 1);  
                if (window.xViewport.innerWidth > 767) {
                  if (destinationElm) {
                    if (destinationElm.querySelector(".add_to_cart_button")) {
                      destinationElm.querySelector(".add_to_cart_button").style.display="block";
                    }
                    if (destinationElm.querySelector(".label-btn-quickview")) {
                      destinationElm.querySelector(".label-btn-quickview").style.display="none";
                    }
                  }
                } else {
                  if (destinationElmMobile) {
                    if (destinationElmMobile.querySelector(".add_to_cart_button")) {
                      destinationElmMobile.querySelector(".add_to_cart_button").style.display="block";
                    }
                    if (destinationElmMobile.querySelector(".label-btn-quickview")) {
                      destinationElmMobile.querySelector(".label-btn-quickview").style.display="none";
                    }
                  }
                }
                requestAnimationFrame(() => {
                  this.syncChooseOptionSelection(el.closest('.card-product'), window.xViewport.innerWidth > 767 ? destinationElm : destinationElmMobile);
                });
                document.dispatchEvent(new CustomEvent("eurus:quickview:loaded", {
                  detail: {
                    productUrl: url
                  }
                }));  
              });
            }
            this.loadingChooseOption = false;
          } catch (error) {
            console.log(error);
          }
        }, 0)
      },
      reportProductView() {
        const fire = () => {
          if (!this.show) return;
          const element = document.getElementById('QuickViewProductViewEvent');
          if (!element || element.dataset.viewReported) return;
          if (typeof element.dispatchViewEvent !== 'function') return;
          element.dataset.viewReported = 'true';
          element.dispatchViewEvent();
        };

        if (!this.loading) {
          fire();
          return;
        }

        const waitForContent = Alpine.effect(() => {
          if (this.loading) return;
          Alpine.release(waitForContent);
          fire();
        });
      },

      open(isMiniCart = false, options = {}) {
        clearTimeout(this.resetOptionsTimeout);
        this.show = true;
        this.reportProductView();
        this.isMiniCart = isMiniCart;
        this.hideViewDetail = options.hideViewDetail || false;
        this.hideQuantity = options.hideQuantity || false;
        this.bundleTarget = options.bundleTarget || '';
        this.bundleButtonLabel = options.bundleButtonLabel || '';
        this.bundleAddedLabel = options.bundleAddedLabel || '';
        this.bundleAddedIds = options.bundleAddedIds || [];
        this.bundleStepFull = options.bundleStepFull || false;
        this.bundleChooseOptionLabel = options.bundleChooseOptionLabel || '';
        this.applyBundleLabel();
        Alpine.store('xPopup').open = true;
        document.dispatchEvent(new CustomEvent("eurus:quickview:open"));
      },
      close() {
        this.show = false;
        this.buttonQuickView = '';
        clearTimeout(this.resetOptionsTimeout);
        this.resetOptionsTimeout = setTimeout(() => {
          this.hideViewDetail = false;
          this.hideQuantity = false;
          this.bundleTarget = '';
          this.bundleButtonLabel = '';
          this.bundleAddedLabel = '';
          this.bundleAddedIds = [];
          this.bundleStepFull = false;
          this.bundleChooseOptionLabel = '';
        }, 500);
        if(!Alpine.store('xMiniCart').open) {
          Alpine.store('xPopup').close();
        }
      },
      focusQuickView(quickView, btnClose) {
        if ( !this.selected ) { 
          Alpine.store('xFocusElement').trapFocus(quickView, btnClose);
        }
      },
      removeFocusQuickView() {
        if ( !this.selected ) { 
          const elementActive = document.getElementById("button_quickview");
          Alpine.store('xFocusElement').removeTrapFocus(elementActive);
        }
      },
      closePopupMobile() {
        this.openPopupMobile = false;
        this.syncCardSelection(this.chooseOptionCard, document.getElementById('choose-options-mobile'));
      },
      showChooseOption(id, el) {
        const isDesktop = window.xViewport.innerWidth > 767;
        this.openPopupMobile = true;
        const product = el.closest(".card-product");
        this.chooseOptionCard = product;
        const destinationElm = document.getElementById('choose-options-' + id)?.querySelector('.choose-options') || product.querySelector('.choose-options');
        const destinationElmMobile = document.getElementById('choose-options-mobile');
        const addToCartBtn = destinationElm?.querySelector('.add_to_cart_button');
        const iconAddToCartBtn = destinationElm?.querySelector('.label-btn-quickview');
        const addToCartBtnMobile = destinationElmMobile?.querySelector('.add_to_cart_button');
        const iconAddToCartBtnMobile = destinationElmMobile?.querySelector('.label-btn-quickview');

        if(addToCartBtn && iconAddToCartBtn && isDesktop){
          addToCartBtn.style.display="block"
          iconAddToCartBtn.style.display="none"
        }else if(addToCartBtnMobile && iconAddToCartBtnMobile){
          addToCartBtnMobile.style.display="block"
          iconAddToCartBtnMobile.style.display="none"
        }
        requestAnimationFrame(() => {
          this.syncChooseOptionSelection(product, isDesktop ? destinationElm : destinationElmMobile);
        });
        document.dispatchEvent(new CustomEvent("eurus:quickview:open"));
      },
      syncChooseOptionSelection(cardEl, destinationEl) {
        if (!cardEl || !destinationEl) return;
        const sourceEl = Array.from(cardEl.querySelectorAll('.x-variants-data-js')).find((node) => !node.closest('.choose-options'));
        const targetEl = destinationEl.querySelector('.x-variants-data-js');
        if (!sourceEl || !targetEl) return;

        const selectedIds = Array.from(sourceEl.querySelectorAll('select option[selected][value], fieldset input:checked'))
          .map((node) => node.dataset.optionValueId)
          .filter(Boolean);
        const selectionKey = selectedIds.join(',');
        if (selectionKey === '' || targetEl.dataset.cardSelection === selectionKey) return;
        targetEl.dataset.cardSelection = selectionKey;

        let changedEl = null;
        selectedIds.forEach((optionValueId) => {
          const match = targetEl.querySelector(`input[data-option-value-id="${CSS.escape(optionValueId)}"], option[data-option-value-id="${CSS.escape(optionValueId)}"]`);
          if (!match) return;
          if (match.tagName === 'OPTION') {
            const select = match.closest('select');
            if (!select || match.selected && match.hasAttribute('selected')) return;
            Array.from(select.options).forEach((option) => option.removeAttribute('selected'));
            match.setAttribute('selected', 'selected');
            match.selected = true;
            changedEl = select;
          } else {
            if (match.checked) return;
            match.checked = true;
            changedEl = match;
          }
        });

        changedEl && changedEl.dispatchEvent(new Event('change', { bubbles: true }));
      },
      syncCardSelection(cardEl, popupEl) {
        if (!cardEl || !popupEl || !cardEl.isConnected) return;
        const sourceEl = popupEl.querySelector('.x-variants-data-js');
        const targetEl = Array.from(cardEl.querySelectorAll('.x-variants-data-js')).find((node) => !node.closest('.choose-options'));
        if (!sourceEl || !targetEl) return;

        let changedEl = null;
        sourceEl.querySelectorAll('select option:checked, fieldset input:checked').forEach((selected) => {
          const optionValueId = selected.dataset.optionValueId;
          let match = optionValueId
            ? targetEl.querySelector(`input[data-option-value-id="${CSS.escape(optionValueId)}"], option[data-option-value-id="${CSS.escape(optionValueId)}"]`)
            : null;
          if (!match) {
            const optionTitle = selected.closest('[data-option-title]')?.dataset.optionTitle;
            const group = optionTitle && Array.from(targetEl.querySelectorAll('[data-option-title]')).find((node) => node.dataset.optionTitle === optionTitle);
            match = group ? Array.from(group.querySelectorAll('input[type="radio"], option')).find((node) => node.value === selected.value) : null;
          }
          if (!match) return;
          if (match.tagName === 'OPTION') {
            const select = match.closest('select');
            if (match.selected && match.hasAttribute('selected')) return;
            Array.from(select.options).forEach((option) => option.removeAttribute('selected'));
            match.setAttribute('selected', 'selected');
            match.selected = true;
            changedEl = select;
          } else {
            if (match.checked) return;
            match.checked = true;
            changedEl = match;
          }
        });

        if (!changedEl) return;
        Alpine.$data(targetEl).productSelectMuted = true;
        changedEl.dispatchEvent(new Event('change', { bubbles: true }));
      },
      clickInsideQuickView(evt, $el) {
        if(this.isMiniCart) {
          evt.stopPropagation();
          this.show = false;
          Alpine.store('xPopup').close();
        }
      },
      clickInsideContentQuickView(evt) {
        evt.stopPropagation();
      }
    });
  });
});