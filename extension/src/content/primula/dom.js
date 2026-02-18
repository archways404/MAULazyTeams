export function hasNyRad() {
  return !!document.querySelector('input[type="submit"][value="Ny rad"].button.wide');
}

export function getAnchorSelect() {
  return document.querySelector('select[title="Typ av ersättning"]');
}

export function findDateInputs() {
  return Array.from(
    document.querySelectorAll('input[type="text"][title="Datum"].kalender'),
  );
}

export function findHoursInputs() {
  return Array.from(
    document.querySelectorAll('input[type="text"][title="Antal timmar"]'),
  );
}

export function findCompTypeSelects() {
  return Array.from(document.querySelectorAll('select[title="Typ av ersättning"]'));
}

export function findAllNyRadButtons() {
  return Array.from(
    document.querySelectorAll('input[type="submit"][value="Ny rad"].button.wide'),
  );
}

export function findNyRadButtonLast() {
  const all = findAllNyRadButtons();
  return all.length ? all[all.length - 1] : null;
}

export function scrollIntoViewSafe(el) {
  try {
    el?.scrollIntoView?.({ block: "center", inline: "nearest" });
  } catch {}
}

export function setInputValue(el, value) {
  scrollIntoViewSafe(el);
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}

export function setSelectValue(el, value) {
  scrollIntoViewSafe(el);
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
}
