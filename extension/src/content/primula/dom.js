export function hasNyRad() {
  return !!document.querySelector('input[type="submit"].button.wide[value="Ny rad"]');
}

export function getAnchorSelect() {
  return document.querySelector(
    'select[title="Utfört arbete (välj)"], select[name="falt[7].valueString"]'
  );
}

export function findDateInputs() {
  return Array.from(
    document.querySelectorAll('input[type="text"].kalender[title^="Datum"]')
  );
}

export function findHoursInputs() {
  return Array.from(
    document.querySelectorAll('input[type="text"][title^="Antal timmar"]')
  );
}

export function findCompTypeSelects() {
  return Array.from(
    document.querySelectorAll(
      'select[title="Utfört arbete (välj)"], select[name="falt[7].valueString"]'
    )
  );
}

export function findAllNyRadButtons() {
  return Array.from(
    document.querySelectorAll('input[type="submit"].button.wide[value="Ny rad"]')
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
