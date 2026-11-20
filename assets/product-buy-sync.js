/*
  Bottom-of-page buy sections (product-buy-box, product-buy-cards) drive
  the main product form instead of keeping their own cart logic. One form
  means one source of truth for size, upsell, region gating and stock:

    buy section ──click size──▶ main variant radio ──▶ eurus:variant:change ─┐
    buy section ──pick option─▶ main upsell radio  ──▶ cf:upsell:change ─────┤
    buy section ──CTA─────────▶ main add-to-cart button                      │
         ▲───────────────────────── re-render selected state ◀───────────────┘
*/
(() => {
  if (window.cfBuySync) {
    return;
  }

  const UPSELL_INPUT = 'input[name="properties[_upsell]"]';

  // Main PDP form, e.g. product-form-template--123__main (not sticky/quick view).
  const mainForm = () => document.querySelector('form[id^="product-form-"][id$="__main"]');

  const sectionId = () => mainForm()?.id.replace('product-form-', '');

  const atcButton = () => document.getElementById(`x-atc-button-${sectionId()}`);

  // Radios that post with the main form, wherever they sit on the page.
  const formRadios = (selector) => {
    const form = mainForm();
    if (!form) {
      return [];
    }

    return [...document.querySelectorAll(`${selector}[form="${form.id}"]`)];
  };

  const clickRadio = (radio) => {
    if (!radio || radio.checked) {
      return;
    }

    radio.click();
  };

  // e.g. selectOption('Large'): the variant picker radio with that value.
  const selectOption = (value) => {
    clickRadio(formRadios('input[type="radio"]').find((radio) => radio.value === value && !radio.matches(UPSELL_INPUT)));
  };

  // true = device + upsell, false = device only.
  const chooseBundle = (bundle) => {
    clickRadio(formRadios(UPSELL_INPUT).find((radio) => (radio.value !== '') === bundle));
  };

  const isBundle = () => formRadios(UPSELL_INPUT).some((radio) => radio.checked && radio.value !== '');

  const submit = () => {
    const button = atcButton();
    if (!button || button.disabled) {
      return;
    }

    button.click();
  };

  // Calls back whenever the main button changes (variant, stock, price).
  const watchButton = (callback) => {
    const button = atcButton();
    if (!button) {
      return;
    }

    new MutationObserver(() => callback(button)).observe(button, {
      attributes: true,
      childList: true,
      subtree: true
    });
    callback(button);
  };

  window.cfBuySync = { selectOption, chooseBundle, isBundle, submit, watchButton };
})();
