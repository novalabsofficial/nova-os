// Pure color/URL formatting helpers.

export function hexRgb(h) {
  const c = h.replace("#", "");
  return parseInt(c.slice(0, 2), 16) + "," + parseInt(c.slice(2, 4), 16) + "," + parseInt(c.slice(4, 6), 16);
}

export function fill(ac) {
  return "rgba(" + hexRgb(ac) + ",0.16)";
}

export function bdr(ac) {
  return "rgba(" + hexRgb(ac) + ",0.55)";
}

export function isUrl(s) {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || /^[\w-]+\.[\w]{2,}(\/|$)/.test(t);
}
