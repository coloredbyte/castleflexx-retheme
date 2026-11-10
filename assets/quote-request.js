if (!window.Eurus.loadedScript.has('quote-request.js')) {
  window.Eurus.loadedScript.add('quote-request.js');

  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.store('xQuoteRequest', {
        show: false,
        posted: false,
        infoOpen: true,
        sentEmail: '',
        subheading: '',
        groups: [],
        lines: {},
        errors: {},
        messages: {},
        collapsed: {},
        storageKey: 'eurus:quote-request:form',
        submitted: false,

        init() {
          try {
            this.submitted = sessionStorage.getItem(this.storageKey + ':submitted') === 'true';
            sessionStorage.removeItem(this.storageKey + ':submitted');
          } catch (error) {
            this.submitted = false;
          }
        },

        setMessages(messages) {
          this.messages = messages || {};
          // The popup renders on idle, so the first open can reach setLines() before this runs.
          this.revalidate();
        },
        message(key, quantity) {
          return String(this.messages[key] || '').replace('[quantity]', quantity);
        },

        linesFromCart(json) {
          return xParseJSON(json) || [];
        },

        linesFromProductSection(sectionId, json) {
          const entries = Object.entries(xParseJSON(json) || {});
          if (entries.length === 0) return [];
          const selectedId = document.getElementById('product-form-' + sectionId)?.querySelector('[name="id"]')?.value;
          const qtyInput = document.getElementById('Quantity-' + sectionId)
            || document.getElementById('Quantity-atc-' + sectionId);
          const qty = parseInt(qtyInput?.value) || 1;
          return entries.map(([id, line]) => ({
            ...line,
            qty: id == selectedId ? qty : (parseInt(line.min) > 0 ? parseInt(line.min) : 1)
          }));
        },

        open(detail = {}) {
          this.posted = detail.posted === true;
          this.sentEmail = this.posted ? this.savedForm()['contact[email]'] || '' : '';
          this.subheading = detail.subheading || '';
          this.setLines(detail.lines || []);
          this.infoOpen = detail.afterSubmit === true || window.xViewport.innerWidth >= 1024;
          if (detail.buttonId) {
            Alpine.store('xModal').setActiveElement(detail.buttonId);
          }
          this.show = true;
          Alpine.store('xPopup').open = true;
        },
        openAfterSubmit(posted) {
          if (!this.submitted) return;
          this.submitted = false;
          this.open({ posted: posted, afterSubmit: true });
        },
        sentText(html) {
          const email = String(this.sentEmail).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
          return String(html).replace('[email]', email);
        },
        close() {
          this.show = false;
          Alpine.store('xModal').removeFocus();
          Alpine.store('xPopup').close();
        },
        setLines(lines) {
          const groups = [];
          const groupIndex = {};
          this.lines = {};
          this.errors = {};
          this.collapsed = {};
          (lines || []).forEach((line) => {
            if (!line || line.variantId == null) return;
            this.lines[line.variantId] = parseInt(line.qty) || 0;
            const key = line.productId != null ? line.productId : line.productTitle;
            if (groupIndex[key] === undefined) {
              groupIndex[key] = groups.length;
              groups.push({
                productId: key,
                title: line.productTitle,
                image: line.image,
                lines: []
              });
            }
            groups[groupIndex[key]].lines.push({
              variantId: line.variantId,
              title: line.productTitle,
              variant: line.variantTitle,
              sku: line.sku,
              image: line.image,
              status: line.status,
              statusColor: line.statusColor,
              qtyRule: line.qtyRule,
              min: parseInt(line.min) > 0 ? parseInt(line.min) : 1,
              step: parseInt(line.step) > 0 ? parseInt(line.step) : 1,
              max: parseInt(line.max) >= 0 ? parseInt(line.max) : null,
              price: line.price || 0,
              priceBreaks: line.priceBreaks || [],
              priceHidden: line.priceHidden === true
            });
          });
          groups.forEach((group) => {
            group.singleVariant = group.lines.length == 1 && !group.lines[0].variant;
          });
          this.groups = groups;
          this.revalidate();
        },
        toggleInfo() {
          this.infoOpen = !this.infoOpen;
        },
        toggleGroup(productId) {
          this.collapsed[productId] = !this.collapsed[productId];
        },
        isCollapsed(productId) {
          return !!this.collapsed[productId];
        },

        rawQty(line) {
          return parseInt(this.lines[line.variantId]) || 0;
        },
        qtyOf(line) {
          return this.errorOf(line) ? 0 : this.rawQty(line);
        },
        errorOf(line) {
          return this.errors[line.variantId] || '';
        },
        revalidate() {
          this.groups.forEach((group) => {
            group.lines.forEach((line) => {
              this.errors[line.variantId] = this.validate(line, this.rawQty(line));
            });
          });
        },
        validate(line, qty) {
          if (qty <= 0) return '';
          if (line.min > 1 && qty < line.min) return this.message('min', line.min);
          if (line.step > 1 && (qty - line.min) % line.step !== 0) return this.message('step', line.step);
          if (line.max != null && qty > line.max) return this.message('max', line.max);
          return '';
        },
        setQty(line, qty) {
          const next = qty > 0 ? qty : 0;
          this.lines[line.variantId] = next;
          this.errors[line.variantId] = this.validate(line, next);
        },
        resetQty(line) {
          this.setQty(line, 0);
        },
        stepQty(line, direction) {
          const current = this.rawQty(line);
          if (direction > 0) {
            this.setQty(line, current <= 0 ? line.min : current + line.step);
            return;
          }
          const next = current - line.step;
          this.setQty(line, next < line.min ? 0 : next);
        },
        onInputQty(line, el) {
          if (el.value === '') return;
          const qty = parseInt(el.value);
          this.lines[line.variantId] = qty > 0 ? qty : 0;
          if (this.errorOf(line) && !this.validate(line, this.rawQty(line))) {
            this.errors[line.variantId] = '';
          }
        },
        onChangeQty(line, el) {
          const qty = parseInt(el.value) || 0;
          this.setQty(line, qty);
          el.value = this.rawQty(line);
        },
        unitPrice(line) {
          const qty = this.qtyOf(line);
          let price = line.price;
          line.priceBreaks.forEach((tier) => {
            if (qty >= tier.min) price = tier.price;
          });
          return price;
        },
        lineTotal(line) {
          return this.qtyOf(line) * this.unitPrice(line);
        },
        groupHasPrice(group) {
          return group.lines.some((line) => !line.priceHidden);
        },
        get hasPrice() {
          return this.groups.some((group) => this.groupHasPrice(group));
        },
        get hasErrors() {
          return this.groups.some((group) => group.lines.some((line) => this.errorOf(line)));
        },
        groupTotal(group) {
          return group.lines.reduce((total, line) => total + this.lineTotal(line), 0);
        },
        get totalUnits() {
          return this.groups.reduce(
            (total, group) => total + group.lines.reduce((units, line) => units + this.qtyOf(line), 0),
            0
          );
        },
        get totalPrice() {
          return this.groups.reduce((total, group) => total + this.groupTotal(group), 0);
        },
        get totalProductCount() {
          return this.groups.length;
        },
        get selectedProductCount() {
          return this.groups.filter((group) => group.lines.some((line) => this.qtyOf(line) > 0)).length;
        },

        buildFields(container) {
          if (!container) return;
          container.innerHTML = '';

          let productCount = 0;
          let variantCount = 0;
          let unitCount = 0;

          this.groups.forEach((group) => {
            const lines = group.lines.filter((line) => this.qtyOf(line) > 0);
            if (lines.length === 0) return;

            productCount += 1;
            variantCount += lines.length;
            unitCount += lines.reduce((total, line) => total + this.qtyOf(line), 0);

            const value = [group.title].concat(lines.map((line) => {
              const parts = [`SKU: ${line.sku || '—'}`];
              if (line.variant) parts.push(line.variant);
              parts.push(`Quantity: ${this.qtyOf(line)}`);
              return parts.join(' | ');
            })).join('\n');
            container.appendChild(this.hiddenField(`contact[Product ${productCount}]`, value));
          });

          container.appendChild(this.hiddenField(
            'contact[Quote Summary]',
            `${productCount} products | ${variantCount} variants | ${unitCount} units`
          ));
        },
        submit(form, container) {
          this.buildFields(container);
          this.rememberForm(form);
        },
        savedForm() {
          try {
            return xParseJSON(sessionStorage.getItem(this.storageKey)) || {};
          } catch (error) {
            return {};
          }
        },
        rememberForm(form) {
          if (!form) return;
          const values = {};
          form.querySelectorAll('[name^="contact["]').forEach((field) => {
            if (field.type == 'hidden' && field.name != 'contact[email]') return;
            values[field.name] = field.type == 'checkbox' ? (field.checked ? field.value : '') : field.value;
          });
          try {
            sessionStorage.setItem(this.storageKey, JSON.stringify(values));
            sessionStorage.setItem(this.storageKey + ':submitted', 'true');
          } catch (error) {
            console.warn('[Eurus] Could not keep the quote request form values.', error);
          }
        },
        hiddenField(name, value) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.setAttribute('aria-hidden', 'true');
          input.name = name;
          input.value = value;
          return input;
        }
      });
    });

    document.addEventListener('eurus:quote-request:open', (event) => {
      if (typeof Alpine == 'undefined' || !Alpine.store('xQuoteRequest')) return;
      Alpine.store('xQuoteRequest').open(event.detail);
    });
  });
}
