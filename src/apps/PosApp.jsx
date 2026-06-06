// Point of Sale — v11.0 (remastered). A full-screen register that takes over the
// Nova OS UI (launched as a kiosk overlay from NovaOS; "Close POS" calls onExit).
//
// Flow: open → store sign-in (per-store username/password) → register / items /
// revenue. Each store owns its catalog (items with image, price, purchase cost,
// stock), sales ledger and running revenue/profit totals. Adding to a cart draws
// down available stock; completing a sale decrements real stock and rolls the
// revenue/profit numbers. Card payments are RECORD-ONLY (a pure web app can't talk
// to a physical Square reader — that needs a native app or a backend + Terminal API).
//
// The Nova-OS launcher gate (who can even open this app) is separate and lives in
// NovaOS.jsx; NovaMod manages that allowlist from the admin panel on the sign-in
// screen here.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FF, FFB } from "../ui/styles.js";
import { getDbUid } from "../lib/db.js";
import { isAdmin } from "../lib/moderation.js";
import {
  createStore, loginStore, saveItems, saveTaxRate, commitSale,
  fetchAccessList, grantAccess, revokeAccess,
} from "../lib/pos.js";

const money = (n) => "$" + (Number(n) || 0).toFixed(2);
const LS_LAST = "nova-pos-last-store";
let _pid = 0;
const newId = () => "i" + Date.now().toString(36) + (_pid++).toString(36);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

// downscale an uploaded image to a small JPEG dataURL (keeps the store doc light)
function downscale(file, max = 200, q = 0.62) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL("image/jpeg", q)); } catch { res(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

export function PosApp({ AC = "#6366f1", user, showToast, onExit }) {
  const [store, setStore] = useState(null);
  if (!store) return <StoreAuth AC={AC} user={user} showToast={showToast} onExit={onExit} onAuthed={setStore} />;
  return <Shell AC={AC} user={user} showToast={showToast} onExit={onExit} store={store} setStore={setStore} />;
}

// ───────────────────────────────────────────────────────────── sign-in ─────
function StoreAuth({ AC, user, showToast, onExit, onAuthed }) {
  const [mode, setMode] = useState("signin");          // signin | create
  const [u, setU] = useState(() => localStorage.getItem(LS_LAST) || "");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const mod = isAdmin(user);

  const go = async () => {
    setErr(""); if (busy) return;
    if (!u.trim() || !pw) { setErr("Enter a username and password."); return; }
    setBusy(true);
    if (mode === "create") {
      if (pw !== pw2) { setErr("Passwords don't match."); setBusy(false); return; }
      const r = await createStore({ name, username: u, password: pw, byUid: getDbUid() });
      if (r.error) { setErr(r.error); setBusy(false); return; }
      localStorage.setItem(LS_LAST, r.store.username); showToast?.("Store created"); onAuthed(r.store);
    } else {
      const r = await loginStore({ username: u, password: pw });
      if (r.error) { setErr(r.error); setBusy(false); return; }
      localStorage.setItem(LS_LAST, r.store.username); onAuthed(r.store);
    }
  };

  const fld = { width: "100%", padding: "12px 13px", borderRadius: 11, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 15, boxSizing: "border-box" };

  return (
    <div style={{ position: "relative", height: "100%", width: "100%", display: "grid", placeItems: "center", fontFamily: FF, color: "var(--nv-text)", background: "radial-gradient(1200px 600px at 50% -10%, " + AC + "22, transparent), var(--nv-surface)" }}>
      <button onClick={onExit} style={closeBtn}>✕ Close POS</button>
      <div style={{ width: 360, maxWidth: "90vw" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 60, height: 60, borderRadius: 17, background: AC, display: "grid", placeItems: "center", fontSize: 32, margin: "0 auto 12px", boxShadow: "0 12px 30px " + AC + "55" }}>🛒</div>
          <div style={{ fontFamily: FFB, fontSize: 24 }}>Nova POS</div>
          <div style={{ fontSize: 13, color: "var(--nv-text-dim)", marginTop: 2 }}>{mode === "create" ? "Set up a new store" : "Sign in to your store"}</div>
        </div>

        <div style={{ display: "flex", gap: 6, background: "var(--nv-elevated)", padding: 4, borderRadius: 12, marginBottom: 16 }}>
          {["signin", "create"].map(m => (
            <div key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, textAlign: "center", padding: "8px", borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontSize: 13.5, background: mode === m ? AC : "transparent", color: mode === m ? "#fff" : "var(--nv-text-dim)" }}>{m === "signin" ? "Sign in" : "Create store"}</div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "create" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Store name (e.g. Corner Café)" style={fld} />}
          <input value={u} onChange={e => setU(e.target.value)} placeholder="Store username" autoCapitalize="none" style={fld} />
          <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="Password" onKeyDown={e => e.key === "Enter" && mode === "signin" && go()} style={fld} />
          {mode === "create" && <input value={pw2} onChange={e => setPw2(e.target.value)} type="password" placeholder="Confirm password" onKeyDown={e => e.key === "Enter" && go()} style={fld} />}
          {err && <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center" }}>{err}</div>}
          <button onClick={go} disabled={busy} style={{ marginTop: 4, padding: "13px", borderRadius: 12, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontSize: 15.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Please wait…" : mode === "create" ? "Create store" : "Sign in"}
          </button>
        </div>

        {mod && (
          <div style={{ marginTop: 22, borderTop: "1px solid var(--nv-border)", paddingTop: 14 }}>
            <div onClick={() => setAdminOpen(o => !o)} style={{ fontSize: 12.5, color: "var(--nv-text-dim)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ transform: adminOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span> Admin · who can open POS in Nova OS
            </div>
            {adminOpen && <AccessAdmin AC={AC} showToast={showToast} />}
          </div>
        )}
      </div>
    </div>
  );
}

// NovaMod-only: manage which Nova accounts can even see/open the POS app.
function AccessAdmin({ AC, showToast }) {
  const [list, setList] = useState(null);
  const [name, setName] = useState("");
  useEffect(() => { fetchAccessList().then(l => setList(l || [])); }, []);
  const add = async () => { const u = name.trim(); if (!u) return; setList(await grantAccess(u)); setName(""); showToast?.(`Granted POS access to @${u.toLowerCase()}`); };
  const rm = async (u) => { setList(await revokeAccess(u)); showToast?.(`Removed @${u}`); };
  const fld = { flex: 1, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 13 };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: "var(--nv-text-dim)", marginBottom: 8, lineHeight: 1.4 }}>The POS app is hidden from regular Nova users. Add a Nova username to make the app visible on their account (you, NovaMod, always have it).</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Nova username" style={fld} />
        <button onClick={add} style={{ padding: "8px 13px", borderRadius: 9, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontSize: 13, cursor: "pointer" }}>Grant</button>
      </div>
      {list === null ? null : list.length === 0 ? <div style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>No one else has access.</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{list.map(x => <span key={x} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 999, background: "var(--nv-elevated)", fontSize: 12.5 }}>@{x}<span onClick={() => rm(x)} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span></span>)}</div>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── shell ───────
function Shell({ AC, user, showToast, onExit, store, setStore }) {
  const [tab, setTab] = useState("register");
  const items = store.items || [];

  const persistItems = useCallback((nextItems) => {
    setStore(s => ({ ...s, items: nextItems }));
    saveItems(store.id, nextItems);
  }, [store.id, setStore]);

  const setTax = useCallback((rate) => {
    const r = Math.max(0, Math.min(100, Number(rate) || 0));
    setStore(s => ({ ...s, taxRate: r })); saveTaxRate(store.id, r);
  }, [store.id, setStore]);

  const onSale = useCallback(async (sale, nextItems) => {
    // optimistic local roll of the ledger + totals
    setStore(s => {
      const a = s.agg || {};
      return {
        ...s, items: nextItems, sales: [sale, ...(s.sales || [])].slice(0, 200),
        agg: {
          revenue: (a.revenue || 0) + sale.revenue, cost: (a.cost || 0) + sale.cost,
          profit: (a.profit || 0) + sale.profit, tax: (a.tax || 0) + sale.tax,
          gross: (a.gross || 0) + sale.total, count: (a.count || 0) + 1,
        },
      };
    });
    const ok = await commitSale(store.id, { items: nextItems, sale });
    showToast?.(ok ? `Sale complete — ${money(sale.total)}` : "Saved locally (sync failed)");
  }, [store.id, setStore, showToast]);

  const TABS = [{ id: "register", label: "Register", icon: "🧾" }, { id: "items", label: "Items", icon: "🏷️" }, { id: "revenue", label: "Revenue", icon: "📈" }];
  const tabBtn = (on) => ({ display: "flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 10, fontFamily: FFB, fontSize: 13.5, cursor: "pointer", border: "1px solid " + (on ? "transparent" : "var(--nv-border)"), background: on ? AC : "var(--nv-elevated)", color: on ? "#fff" : "var(--nv-text)" });
  const signOut = () => { setStore(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", fontFamily: FF, color: "var(--nv-text)", background: "var(--nv-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: AC, display: "grid", placeItems: "center", fontSize: 17 }}>🛒</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FFB, fontSize: 16, lineHeight: 1.1 }}>{store.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>@{store.username} · cashier {user}</div>
        </div>
        <div style={{ display: "flex", gap: 7, marginLeft: 14 }}>{TABS.map(t => <div key={t.id} style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.icon} {t.label}</div>)}</div>
        <div style={{ flex: 1 }} />
        <button onClick={signOut} style={{ ...closeBtn, position: "static", background: "var(--nv-elevated)", color: "var(--nv-text)", border: "1px solid var(--nv-border)" }}>Sign out</button>
        <button onClick={onExit} style={{ ...closeBtn, position: "static" }}>✕ Close POS</button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "register" && <Register AC={AC} items={items} taxRate={store.taxRate || 0} onSale={onSale} showToast={showToast} />}
        {tab === "items" && <Items AC={AC} items={items} taxRate={store.taxRate || 0} setTax={setTax} onChange={persistItems} showToast={showToast} />}
        {tab === "revenue" && <Revenue AC={AC} agg={store.agg || {}} sales={store.sales || []} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────── register ─────
function Register({ AC, items, taxRate, onSale, showToast }) {
  const [cart, setCart] = useState({});          // { itemId: qty }
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [tender, setTender] = useState(null);    // { method, cash }

  const cats = useMemo(() => ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))], [items]);
  const shown = items.filter(i => (cat === "All" || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase()));
  const avail = (it) => (it.stock ?? 0) - (cart[it.id] || 0);

  const add = (it) => { if (avail(it) <= 0) { showToast?.("Out of stock"); return; } setCart(c => ({ ...c, [it.id]: (c[it.id] || 0) + 1 })); };
  const setQty = (id, qty) => setCart(c => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  const cancel = () => setCart({});

  const lines = useMemo(() => Object.entries(cart).map(([id, qty]) => {
    const it = items.find(x => x.id === id); if (!it) return null;
    return { id, name: it.name, price: it.price || 0, cost: it.cost || 0, emoji: it.img ? null : "📦", img: it.img, qty, lineTotal: (it.price || 0) * qty };
  }).filter(Boolean), [cart, items]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const count = Object.values(cart).reduce((s, n) => s + n, 0);

  const complete = ({ method, paid }) => {
    const cogs = lines.reduce((s, l) => s + l.cost * l.qty, 0);
    const sale = {
      id: newId(), at: Date.now(), tender: method, paid: +(+paid).toFixed(2), cashier: "",
      lines: lines.map(l => ({ id: l.id, name: l.name, price: l.price, cost: l.cost, qty: l.qty })),
      subtotal: +subtotal.toFixed(2), tax: +tax.toFixed(2), total: +total.toFixed(2),
      revenue: +subtotal.toFixed(2), cost: +cogs.toFixed(2), profit: +(subtotal - cogs).toFixed(2),
    };
    const nextItems = items.map(it => cart[it.id] ? { ...it, stock: Math.max(0, (it.stock ?? 0) - cart[it.id]) } : it);
    onSale(sale, nextItems);
    setCart({}); setTender(null);
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 8, padding: "12px 14px 8px", flexShrink: 0 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 6, padding: "0 14px 10px", overflowX: "auto", flexShrink: 0 }}>
          {cats.map(c => <div key={c} onClick={() => setCat(c)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontFamily: FFB, cursor: "pointer", whiteSpace: "nowrap", color: cat === c ? "#fff" : "var(--nv-text-dim)", background: cat === c ? AC : "transparent", border: "1px solid " + (cat === c ? "transparent" : "var(--nv-border)") }}>{c}</div>)}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "0 14px 16px" }}>
          {items.length === 0 ? <Center>No products yet — add some in the <b>Items</b> tab.</Center>
            : shown.length === 0 ? <Center>No matches.</Center>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))", gap: 11 }}>
                  {shown.map(it => {
                    const a = avail(it); const out = a <= 0;
                    return (
                      <div key={it.id} onClick={() => add(it)} style={{ cursor: out ? "default" : "pointer", borderRadius: 14, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)", overflow: "hidden", opacity: out ? 0.55 : 1, userSelect: "none" }}>
                        <div style={{ height: 80, background: "var(--nv-elevated)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                          {it.img ? <img src={it.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 34 }}>📦</span>}
                        </div>
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{ fontFamily: FFB, fontSize: 13, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                            <span style={{ fontFamily: FFB, fontSize: 13, color: AC }}>{money(it.price)}</span>
                            <span style={{ fontSize: 11, color: out ? "#ef4444" : "var(--nv-text-dim)" }}>{out ? "Out" : a + " left"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>}
        </div>
      </div>

      {/* cart */}
      <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--nv-border)", display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)" }}>
        <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--nv-border)", display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: FFB, fontSize: 16 }}>Cart</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: "var(--nv-text-dim)" }}>{count} item{count === 1 ? "" : "s"}</span>
          <div style={{ flex: 1 }} />
          {count > 0 && <button onClick={cancel} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid var(--nv-border)", background: "transparent", color: "#ef4444", fontFamily: FFB, fontSize: 12, cursor: "pointer" }}>Cancel cart</button>}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
          {lines.length === 0 ? <Center>Tap a product to start a sale.</Center>
            : lines.map(l => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 4px", borderBottom: "1px solid var(--nv-border)" }}>
                {l.img ? <img src={l.img} alt="" style={{ width: 30, height: 30, borderRadius: 7, objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>📦</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FFB, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{money(l.price)} ea</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Stepper onClick={() => setQty(l.id, l.qty - 1)}>–</Stepper>
                  <span style={{ minWidth: 18, textAlign: "center", fontFamily: FFB, fontSize: 13 }}>{l.qty}</span>
                  <Stepper onClick={() => setQty(l.id, l.qty + 1)}>+</Stepper>
                </div>
                <div style={{ width: 50, textAlign: "right", fontFamily: FFB, fontSize: 13 }}>{money(l.lineTotal)}</div>
                <span onClick={() => setQty(l.id, 0)} title="Remove" style={{ cursor: "pointer", color: "var(--nv-text-dim)", fontSize: 15, padding: "0 2px" }}>✕</span>
              </div>
            ))}
        </div>
        <div style={{ padding: "13px 15px", borderTop: "1px solid var(--nv-border)" }}>
          <Row label="Subtotal" value={money(subtotal)} />
          <Row label={`Tax (${taxRate}%)`} value={money(tax)} />
          <Row label="Total" value={money(total)} big />
          <button disabled={!lines.length} onClick={() => setTender({ method: "cash", cash: "" })}
            style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 12, border: "none", background: lines.length ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 16, cursor: lines.length ? "pointer" : "default" }}>
            Charge {money(total)}
          </button>
        </div>
      </div>

      {tender && <TenderModal AC={AC} total={total} state={tender} setState={setTender} onCancel={() => setTender(null)} onConfirm={complete} />}
    </div>
  );
}

function TenderModal({ AC, total, state, setState, onCancel, onConfirm }) {
  const cashNum = Number(state.cash) || 0;
  const change = cashNum - total;
  const quick = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].filter((v, i, a) => a.indexOf(v) === i);
  const ok = state.method === "card" || cashNum >= total;
  const downRef = useRef(false);   // only dismiss if the press STARTED on the backdrop
  return (
    <div onPointerDown={e => { downRef.current = e.target === e.currentTarget; }}
         onClick={e => { if (downRef.current && e.target === e.currentTarget) onCancel(); }}
         style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", zIndex: 30 }}>
      <div onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ width: 360, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 18, padding: 20, fontFamily: FF }}>
        <div style={{ fontFamily: FFB, fontSize: 18 }}>Take payment</div>
        <div style={{ fontSize: 13.5, color: "var(--nv-text-dim)", marginBottom: 16 }}>Amount due <b style={{ color: "var(--nv-text)" }}>{money(total)}</b></div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["cash", "card"].map(m => <div key={m} onClick={() => setState(s => ({ ...s, method: m }))} style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 11, cursor: "pointer", fontFamily: FFB, fontSize: 14, border: "1px solid " + (state.method === m ? "transparent" : "var(--nv-border)"), background: state.method === m ? AC : "var(--nv-elevated)", color: state.method === m ? "#fff" : "var(--nv-text)" }}>{m === "cash" ? "💵 Cash" : "💳 Card"}</div>)}
        </div>
        {state.method === "cash" ? (
          <div style={{ marginBottom: 16 }}>
            <input autoFocus type="number" inputMode="decimal" value={state.cash} onChange={e => setState(s => ({ ...s, cash: e.target.value }))} placeholder="Cash received"
              style={{ width: "100%", padding: "12px 13px", borderRadius: 11, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 17, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{quick.map(v => <div key={v} onClick={() => setState(s => ({ ...s, cash: v.toFixed(2) }))} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--nv-border)", fontSize: 12.5, fontFamily: FFB, cursor: "pointer" }}>{money(v)}</div>)}</div>
            {cashNum > 0 && <div style={{ marginTop: 11, fontFamily: FFB, fontSize: 15, color: change >= 0 ? "#22c55e" : "#ef4444" }}>{change >= 0 ? `Change ${money(change)}` : `${money(-change)} short`}</div>}
          </div>
        ) : (
          <div style={{ marginBottom: 16, padding: "11px 13px", borderRadius: 11, background: "var(--nv-elevated)", fontSize: 12.5, color: "var(--nv-text-dim)", lineHeight: 1.45 }}>
            Records the sale for your books. This build can't charge a physical card reader — that needs a real payment processor.
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 11, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button disabled={!ok} onClick={() => onConfirm({ method: state.method, paid: state.method === "cash" ? cashNum : total })} style={{ flex: 1.4, padding: "12px", borderRadius: 11, border: "none", background: ok ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 14, cursor: ok ? "pointer" : "default" }}>Complete sale</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── items ─────
function Items({ AC, items, taxRate, setTax, onChange, showToast }) {
  const [draft, setDraft] = useState(null);
  const blank = () => ({ id: newId(), name: "", price: "", cost: "", stock: "", category: "", img: null });

  const adjustStock = (id, delta) => onChange(items.map(it => it.id === id ? { ...it, stock: Math.max(0, (it.stock ?? 0) + delta) } : it));
  const del = (id) => onChange(items.filter(i => i.id !== id));
  const commit = () => {
    if (!draft.name.trim()) { showToast?.("Name required"); return; }
    const item = { ...draft, name: draft.name.trim(), price: Number(draft.price) || 0, cost: Number(draft.cost) || 0, stock: Math.max(0, Math.round(Number(draft.stock) || 0)), category: (draft.category || "").trim() };
    const exists = items.some(i => i.id === item.id);
    onChange(exists ? items.map(i => i.id === item.id ? item : i) : [...items, item]);
    setDraft(null);
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px 18px", maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FFB, fontSize: 18 }}>Products</div>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12.5, color: "var(--nv-text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
          Tax <input type="number" value={taxRate} onChange={e => setTax(e.target.value)} style={{ width: 64, padding: "7px 9px", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 13 }} /> %
        </label>
        <button onClick={() => setDraft(blank())} style={{ padding: "9px 15px", borderRadius: 10, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontSize: 14, cursor: "pointer" }}>+ Add item</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map(it => {
          const margin = (it.price || 0) - (it.cost || 0);
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 13, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: "var(--nv-elevated)", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                {it.img ? <img src={it.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>📦</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FFB, fontSize: 14.5 }}>{it.name}</div>
                <div style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>{money(it.price)} · cost {money(it.cost)} · <span style={{ color: margin >= 0 ? "#16a34a" : "#ef4444" }}>{margin >= 0 ? "+" : ""}{money(margin)} margin</span>{it.category ? " · " + it.category : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Stepper onClick={() => adjustStock(it.id, -1)}>–</Stepper>
                <div style={{ minWidth: 44, textAlign: "center" }}>
                  <div style={{ fontFamily: FFB, fontSize: 15, color: (it.stock ?? 0) <= 0 ? "#ef4444" : "var(--nv-text)" }}>{it.stock ?? 0}</div>
                  <div style={{ fontSize: 10, color: "var(--nv-text-dim)" }}>in stock</div>
                </div>
                <Stepper onClick={() => adjustStock(it.id, 1)}>+</Stepper>
              </div>
              <span onClick={() => setDraft({ ...it, price: String(it.price ?? ""), cost: String(it.cost ?? ""), stock: String(it.stock ?? "") })} style={{ cursor: "pointer", fontSize: 12.5, color: "var(--nv-text-dim)" }}>Edit</span>
              <span onClick={() => del(it.id)} style={{ cursor: "pointer", fontSize: 12.5, color: "#ef4444" }}>Delete</span>
            </div>
          );
        })}
        {items.length === 0 && <Center>No products yet. Click <b>+ Add item</b> to build your catalog.</Center>}
      </div>

      {draft && <ItemEditor AC={AC} draft={draft} setDraft={setDraft} onSave={commit} exists={items.some(i => i.id === draft.id)} showToast={showToast} />}
    </div>
  );
}

function ItemEditor({ AC, draft, setDraft, onSave, exists, showToast }) {
  const fileRef = useRef(null);
  const downRef = useRef(false);   // only dismiss if the press STARTED on the backdrop
  const close = () => setDraft(null);
  const fld = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 14, boxSizing: "border-box", width: "100%" };
  const pickImg = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await downscale(f);
    if (url) setDraft(d => ({ ...d, img: url })); else showToast?.("Couldn't read that image");
  };
  return (
    <div onPointerDown={e => { downRef.current = e.target === e.currentTarget; }}
         onClick={e => { if (downRef.current && e.target === e.currentTarget) close(); }}
         style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", zIndex: 30 }}>
      <div onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ width: 380, maxWidth: "92vw", background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 18, padding: 20, fontFamily: FF, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FFB, fontSize: 17 }}>{exists ? "Edit item" : "New item"}</div>
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <div onClick={() => fileRef.current?.click()} style={{ width: 70, height: 70, borderRadius: 13, background: "var(--nv-elevated)", border: "1px dashed var(--nv-border)", display: "grid", placeItems: "center", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
            {draft.img ? <img src={draft.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 11, color: "var(--nv-text-dim)", textAlign: "center" }}>Add<br />image</span>}
          </div>
          <div style={{ flex: 1 }}>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Item name" autoFocus style={{ ...fld, fontFamily: FFB }} />
            {draft.img && <div onClick={() => setDraft(d => ({ ...d, img: null }))} style={{ fontSize: 12, color: "#ef4444", marginTop: 6, cursor: "pointer" }}>Remove image</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImg} style={{ display: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ flex: 1, fontSize: 11.5, color: "var(--nv-text-dim)" }}>Price<input type="number" inputMode="decimal" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} placeholder="0.00" style={{ ...fld, marginTop: 3 }} /></label>
          <label style={{ flex: 1, fontSize: 11.5, color: "var(--nv-text-dim)" }}>Purchase cost<input type="number" inputMode="decimal" value={draft.cost} onChange={e => setDraft(d => ({ ...d, cost: e.target.value }))} placeholder="0.00" style={{ ...fld, marginTop: 3 }} /></label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ flex: 1, fontSize: 11.5, color: "var(--nv-text-dim)" }}>Stock<input type="number" inputMode="numeric" value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} placeholder="0" style={{ ...fld, marginTop: 3 }} /></label>
          <label style={{ flex: 1, fontSize: 11.5, color: "var(--nv-text-dim)" }}>Category<input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} placeholder="optional" style={{ ...fld, marginTop: 3 }} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <button onClick={() => setDraft(null)} style={{ flex: 1, padding: "11px", borderRadius: 11, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={onSave} style={{ flex: 1, padding: "11px", borderRadius: 11, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontSize: 14, cursor: "pointer" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────── revenue ────
function Revenue({ AC, agg, sales }) {
  const today = useMemo(() => { const t = startOfToday(); return (sales || []).filter(s => s.at >= t); }, [sales]);
  const tRev = today.reduce((s, x) => s + (x.revenue || 0), 0);
  const tProfit = today.reduce((s, x) => s + (x.profit || 0), 0);

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px 18px", maxWidth: 880, margin: "0 auto" }}>
      <div style={{ fontFamily: FFB, fontSize: 18, marginBottom: 12 }}>Revenue & profit</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 11, marginBottom: 16 }}>
        <Stat label="Total revenue" value={money(agg.revenue)} sub="Pre-tax sales" AC={AC} big />
        <Stat label="Total profit" value={money(agg.profit)} sub="Revenue − cost of goods" color="#16a34a" big />
        <Stat label="Cost of goods" value={money(agg.cost)} sub="What you paid for sold stock" />
        <Stat label="Tax collected" value={money(agg.tax)} sub="Set aside for remittance" />
        <Stat label="Gross collected" value={money(agg.gross)} sub="Incl. tax" />
        <Stat label="Transactions" value={String(agg.count || 0)} sub="Completed sales" />
      </div>

      <div style={{ display: "flex", gap: 11, marginBottom: 18, flexWrap: "wrap" }}>
        <Stat label="Today's revenue" value={money(tRev)} sub={`${today.length} sale${today.length === 1 ? "" : "s"} today`} AC={AC} />
        <Stat label="Today's profit" value={money(tProfit)} sub="So far today" color="#16a34a" />
      </div>

      <div style={{ fontFamily: FFB, fontSize: 14.5, marginBottom: 8 }}>Recent transactions</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(!sales || sales.length === 0) ? <Center>No sales recorded yet.</Center>
          : sales.map(s => (
            <div key={s.id} style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontFamily: FFB, fontSize: 15.5 }}>{money(s.total)}</span>
                <span style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 999, background: "var(--nv-elevated)", color: "var(--nv-text-dim)" }}>{s.tender === "cash" ? "💵 Cash" : "💳 Card"}</span>
                <span style={{ fontSize: 12, color: "#16a34a", fontFamily: FFB }}>+{money(s.profit)} profit</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{new Date(s.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", marginTop: 4 }}>{(s.lines || []).map(l => `${l.qty}× ${l.name}`).join(", ")}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────── helpers ────
const closeBtn = { position: "absolute", top: 16, right: 16, padding: "8px 14px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontFamily: FFB, fontSize: 13, cursor: "pointer" };
function Stepper({ children, onClick }) {
  return <span onClick={onClick} style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid var(--nv-border)", display: "grid", placeItems: "center", cursor: "pointer", fontFamily: FFB, fontSize: 15, userSelect: "none", background: "var(--nv-elevated)" }}>{children}</span>;
}
function Row({ label, value, big }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: big ? "7px 0 2px" : "2px 0", fontFamily: big ? FFB : FF, fontSize: big ? 18 : 13, color: big ? "var(--nv-text)" : "var(--nv-text-dim)" }}><span>{label}</span><span style={big ? {} : { color: "var(--nv-text)" }}>{value}</span></div>;
}
function Stat({ label, value, sub, AC, color, big }) {
  return <div style={{ flex: 1, minWidth: 150, padding: "15px 17px", borderRadius: 15, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
    <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)" }}>{label}</div>
    <div style={{ fontFamily: FFB, fontSize: big ? 28 : 23, color: color || AC || "var(--nv-text)", margin: "3px 0" }}>{value}</div>
    <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{sub}</div>
  </div>;
}
function Center({ children }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100%", minHeight: 140, color: "var(--nv-text-dim)", fontFamily: FF, fontSize: 14, textAlign: "center", padding: 26 }}>{children}</div>;
}
