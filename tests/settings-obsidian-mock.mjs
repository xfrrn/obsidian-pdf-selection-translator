// Minimal DOM-backed Obsidian components for settings interaction tests.
export class Notice { constructor(message) { Notice.messages.push(message); } static messages = []; }
export class Setting {
  constructor(parent) {
    this.row = parent.createDiv(); this.label = this.row.createEl('label'); this.description = this.row.createEl('p');
  }
  setName(value) { this.label.textContent = value; this.name = value; return this; }
  setDesc(value) { this.description.textContent = value; return this; }
  setHeading() { return this; }
  control(tag, type) {
    const el = this.row.createEl(tag); if (type) el.type = type;
    el.setAttribute('aria-label', this.name ?? ''); return el;
  }
  addText(callback) {
    const el = this.control('input', 'text');
    const api = { inputEl: el, setPlaceholder(v) { el.placeholder = v; return api; }, setValue(v) { el.value = v; return api; }, getValue() { return el.value; }, onChange(fn) { el.addEventListener('input', () => fn(el.value)); return api; } };
    callback(api); return this;
  }
  addDropdown(callback) {
    const el = this.control('select');
    const api = { selectEl: el, addOption(v, label) { const o = el.ownerDocument.createElement('option'); o.value = v; o.textContent = label; el.append(o); return api; }, addOptions(values) { for (const [v, label] of Object.entries(values)) api.addOption(v, label); return api; }, setValue(v) { el.value = v; return api; }, onChange(fn) { el.addEventListener('change', () => fn(el.value)); return api; } };
    callback(api); return this;
  }
  addToggle(callback) {
    const el = this.control('input', 'checkbox');
    const api = { setValue(v) { el.checked = v; return api; }, onChange(fn) { el.addEventListener('change', () => fn(el.checked)); return api; } }; callback(api); return this;
  }
  addSlider(callback) {
    const el = this.control('input', 'range');
    const api = { setLimits(min, max, step) { Object.assign(el, { min, max, step }); return api; }, setValue(v) { el.value = String(v); return api; }, onChange(fn) { el.addEventListener('change', () => fn(Number(el.value))); return api; } }; callback(api); return this;
  }
  addButton(callback) {
    const el = this.row.createEl('button');
    const api = { setButtonText(v) { el.textContent = v; return api; }, setDisabled(v) { el.disabled = v; return api; }, setCta() { return api; }, onClick(fn) { el.addEventListener('click', fn); return api; } }; callback(api); return this;
  }
}
