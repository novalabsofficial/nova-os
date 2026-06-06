// Point of Sale — v11.0 Phase C. A small register/POS built into Nova OS,
// RESTRICTED to the NovaMod account and anyone NovaMod grants access to (the
// launcher hides it from everyone else — see NovaOS.jsx visibleApps). Tabs:
//   • Register — product grid → cart → charge (cash/card, change calc)
//   • Catalog  — manage products + tax rate
//   • Sales    — today's totals + recent transaction history
//   • Access   — (NovaMod only) grant/revoke which users can see & use the POS
// State is shared across devices via Firestore (lib/pos.js).

import { useState, useEffect, useMemo, useCallback } from "react";
import { FF, FFB } from "../ui/styles.js";
import { getDbUid } from "../lib/db.js";
import { isAdmin } from "../lib/moderation.js";
import {
  fetchCatalog, saveCatalog, fetchSales, recordSale,
  fetchAccessList, grantAccess, revokeAccess, SEED_CATALOG,
} from "../lib/pos.js";

const money = (n) => "$" + (Number(n) || 0).toFixed(2);
const TAX_LS = "nova-pos-tax";
let _pid = 0;
const newId = () => "i" + Date.now().toString(36) + (_pid++).toString(36);

export function PosApp({ AC = "#6366f1", user, showToast }) {
  const myUid = getDbUid();
  const mod = isAdmin(user);

  const [tab, setTab] = useState("register");
  const [catalog, setCatalog] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});                 // { itemId: qty }
  const [taxRate, setTaxRate] = useState(() => Number(localStorage.getItem(TAX_LS) || 0));

  // initial load (+ seed an empty catalog for the owner)
  useEffect(() => {
    let live = true;
    (async () => {
      const [cat, sl] = await Promise.all([fetchCatalog(), fetchSales()]);
      if (!live) return;
      if (cat && cat.length) setCatalog(cat);
      else if (mod) { setCatalog(SEED_CATALOG); saveCatalog(SEED_CATALOG); }
      else setCatalog(cat || []);
      setSales(sl || []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [mod]);

  const persistCatalog = useCallback((next) => { setCatalog(next); saveCatalog(next); }, []);
  const setTax = useCallback((v) => { const n = Math.max(0, Math.min(100, Number(v) || 0)); setTaxRate(n); localStorage.setItem(TAX_LS, String(n)); }, []);

  // ---- cart math -----------------------------------------------------------
  const lines = useMemo(() => Object.entries(cart).map(([id, qty]) => {
    const it = catalog.find(c => c.id === id); if (!it) return null;
    return { ...it, qty, lineTotal: it.price * qty };
  }).filter(Boolean), [cart, catalog]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const tax = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const total = subtotal + tax;
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  const addToCart = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id, q) => setCart(c => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });
  const clearCart = () => setCart({});

  const completeSale = useCallback(async ({ method, paid }) => {
    const sale = {
      id: newId(), at: Date.now(),
      items: lines.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty })),
      subtotal: +subtotal.toFixed(2), tax: +tax.toFixed(2), total: +total.toFixed(2),
      tender: method, paid: +(+paid).toFixed(2), cashier: user || "—",
    };
    setSales(s => [sale, ...s]);     // optimistic
    clearCart();
    const ok = await recordSale(sale);
    showToast?.(ok ? `Sale complete — ${money(sale.total)}` : "Saved locally (sync failed)");
  }, [lines, subtotal, tax, total, user, showToast]);

  const TABS = [
    { id: "register", label: "Register", icon: "🧾" },
    { id: "catalog",  label: "Catalog",  icon: "🏷️" },
    { id: "sales",    label: "Sales",    icon: "📈" },
    ...(mod ? [{ id: "access", label: "Access", icon: "🔑" }] : []),
  ];

  const tabBtn = (on) => ({ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, fontFamily: FFB, fontSize: 13.5, cursor: "pointer", border: "1px solid " + (on ? "transparent" : "var(--nv-border)"), background: on ? AC : "var(--nv-elevated)", color: on ? "#fff" : "var(--nv-text)" });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: FF, color: "var(--nv-text)", background: "var(--nv-surface)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--nv-border)", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: AC, display: "grid", placeItems: "center", fontSize: 16 }}>🛒</div>
        <span style={{ fontFamily: FFB, fontSize: 16 }}>Nova POS</span>
        <span style={{ fontSize: 11.5, color: "var(--nv-text-dim)", border: "1px solid var(--nv-border)", padding: "2px 8px", borderRadius: 999 }}>{mod ? "Owner" : "Cashier"} · {user}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 7 }}>{TABS.map(t => <div key={t.id} style={tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.icon} {t.label}</div>)}</div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? <Center>Loading…</Center>
        : tab === "register" ? (
          <Register catalog={catalog} cart={cart} lines={lines} subtotal={subtotal} tax={tax} total={total} taxRate={taxRate} cartCount={cartCount}
            AC={AC} onAdd={addToCart} onQty={setQty} onClear={clearCart} onCharge={completeSale} mod={mod} />
        ) : tab === "catalog" ? (
          <Catalog catalog={catalog} onSave={persistCatalog} taxRate={taxRate} setTax={setTax} AC={AC} mod={mod} showToast={showToast} />
        ) : tab === "sales" ? (
          <Sales sales={sales} AC={AC} />
        ) : (
          <Access AC={AC} myUid={myUid} owner={user} showToast={showToast} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Register --
function Register({ catalog, cart, lines, subtotal, tax, total, taxRate, cartCount, AC, onAdd, onQty, onClear, onCharge, mod }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [tender, setTender] = useState(null);   // { method, cash }
  const cats = useMemo(() => ["All", ...Array.from(new Set(catalog.map(c => c.category).filter(Boolean)))], [catalog]);
  const shown = catalog.filter(c => (cat === "All" || c.category === cat) && c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* products */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 8, padding: "10px 12px", flexShrink: 0 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" style={{ flex: 1, padding: "8px 11px", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 13.5 }} />
        </div>
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", overflowX: "auto", flexShrink: 0 }}>
          {cats.map(c => <div key={c} onClick={() => setCat(c)} style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12.5, fontFamily: FFB, cursor: "pointer", whiteSpace: "nowrap", color: cat === c ? "#fff" : "var(--nv-text-dim)", background: cat === c ? AC : "transparent", border: "1px solid " + (cat === c ? "transparent" : "var(--nv-border)") }}>{c}</div>)}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "0 12px 14px" }}>
          {shown.length === 0 ? <Center>{catalog.length === 0 ? (mod ? "No products yet — add some in the Catalog tab." : "No products available.") : "No matches."}</Center>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 9 }}>
              {shown.map(it => (
                <div key={it.id} onClick={() => onAdd(it.id)} style={{ cursor: "pointer", borderRadius: 12, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)", padding: "12px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center", userSelect: "none" }}>
                  <div style={{ fontSize: 30, lineHeight: 1 }}>{it.emoji || "📦"}</div>
                  <div style={{ fontFamily: FFB, fontSize: 13, lineHeight: 1.2 }}>{it.name}</div>
                  <div style={{ fontSize: 12.5, color: AC, fontFamily: FFB }}>{money(it.price)}</div>
                </div>
              ))}
            </div>}
        </div>
      </div>

      {/* cart */}
      <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--nv-border)", display: "flex", flexDirection: "column", background: "var(--nv-surface-solid)" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-border)", display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: FFB, fontSize: 15 }}>Cart</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: "var(--nv-text-dim)" }}>{cartCount} item{cartCount === 1 ? "" : "s"}</span>
          <div style={{ flex: 1 }} />
          {cartCount > 0 && <span onClick={onClear} style={{ fontSize: 12, color: "#ef4444", cursor: "pointer" }}>Clear</span>}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
          {lines.length === 0 ? <Center>Tap a product to start a sale.</Center>
          : lines.map(l => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", borderBottom: "1px solid var(--nv-border)" }}>
              <span style={{ fontSize: 18 }}>{l.emoji || "📦"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FFB, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{money(l.price)} ea</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Stepper onClick={() => onQty(l.id, l.qty - 1)}>–</Stepper>
                <span style={{ minWidth: 18, textAlign: "center", fontFamily: FFB, fontSize: 13 }}>{l.qty}</span>
                <Stepper onClick={() => onQty(l.id, l.qty + 1)}>+</Stepper>
              </div>
              <div style={{ width: 54, textAlign: "right", fontFamily: FFB, fontSize: 13 }}>{money(l.lineTotal)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--nv-border)" }}>
          <Row label="Subtotal" value={money(subtotal)} />
          <Row label={`Tax (${taxRate}%)`} value={money(tax)} />
          <Row label="Total" value={money(total)} big />
          <button disabled={lines.length === 0} onClick={() => setTender({ method: "cash", cash: "" })}
            style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 11, border: "none", background: lines.length ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 15, cursor: lines.length ? "pointer" : "default" }}>
            Charge {money(total)}
          </button>
        </div>
      </div>

      {tender && <TenderModal total={total} AC={AC} state={tender} setState={setTender}
        onConfirm={(paid) => { onCharge({ method: tender.method, paid }); setTender(null); }}
        onCancel={() => setTender(null)} />}
    </div>
  );
}

function TenderModal({ total, AC, state, setState, onConfirm, onCancel }) {
  const cashNum = Number(state.cash) || 0;
  const change = cashNum - total;
  const quick = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].filter((v, i, a) => a.indexOf(v) === i);
  const canCash = state.method === "cash" ? cashNum >= total : true;
  return (
    <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 340, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 16, padding: 18, fontFamily: FF }}>
        <div style={{ fontFamily: FFB, fontSize: 17, marginBottom: 4 }}>Take payment</div>
        <div style={{ fontSize: 13, color: "var(--nv-text-dim)", marginBottom: 14 }}>Amount due <b style={{ color: "var(--nv-text)" }}>{money(total)}</b></div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["cash", "card"].map(m => (
            <div key={m} onClick={() => setState(s => ({ ...s, method: m }))} style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: 10, cursor: "pointer", fontFamily: FFB, fontSize: 13.5, textTransform: "capitalize", border: "1px solid " + (state.method === m ? "transparent" : "var(--nv-border)"), background: state.method === m ? AC : "var(--nv-elevated)", color: state.method === m ? "#fff" : "var(--nv-text)" }}>{m === "cash" ? "💵 Cash" : "💳 Card"}</div>
          ))}
        </div>
        {state.method === "cash" && (
          <div style={{ marginBottom: 14 }}>
            <input autoFocus type="number" inputMode="decimal" value={state.cash} onChange={e => setState(s => ({ ...s, cash: e.target.value }))} placeholder="Cash received"
              style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 16, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {quick.map(v => <div key={v} onClick={() => setState(s => ({ ...s, cash: String(v.toFixed(2)) }))} style={{ padding: "5px 11px", borderRadius: 999, border: "1px solid var(--nv-border)", fontSize: 12.5, fontFamily: FFB, cursor: "pointer", color: "var(--nv-text)" }}>{money(v)}</div>)}
            </div>
            {cashNum > 0 && <div style={{ marginTop: 10, fontFamily: FFB, fontSize: 14, color: change >= 0 ? "#22c55e" : "#ef4444" }}>{change >= 0 ? `Change ${money(change)}` : `${money(-change)} short`}</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button disabled={!canCash} onClick={() => onConfirm(state.method === "cash" ? cashNum : total)} style={{ flex: 1.4, padding: "11px", borderRadius: 10, border: "none", background: canCash ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 14, cursor: canCash ? "pointer" : "default" }}>Complete sale</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Catalog --
function Catalog({ catalog, onSave, taxRate, setTax, AC, mod, showToast }) {
  const [draft, setDraft] = useState(null);   // editing/new item
  const blank = () => ({ id: newId(), name: "", price: "", emoji: "📦", category: "" });

  const commit = () => {
    if (!draft.name.trim()) { showToast?.("Name required"); return; }
    const item = { ...draft, name: draft.name.trim(), price: Number(draft.price) || 0, category: (draft.category || "").trim() };
    const exists = catalog.some(c => c.id === item.id);
    onSave(exists ? catalog.map(c => c.id === item.id ? item : c) : [...catalog, item]);
    setDraft(null);
  };
  const del = (id) => onSave(catalog.filter(c => c.id !== id));

  const fld = { padding: "9px 11px", borderRadius: 9, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 13.5, boxSizing: "border-box" };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "14px 16px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FFB, fontSize: 17 }}>Products</div>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12.5, color: "var(--nv-text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
          Tax rate
          <input type="number" value={taxRate} onChange={e => setTax(e.target.value)} disabled={!mod} style={{ ...fld, width: 70, padding: "6px 8px" }} /> %
        </label>
        {mod && <button onClick={() => setDraft(blank())} style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontSize: 13.5, cursor: "pointer" }}>+ Add product</button>}
      </div>

      {!mod && <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", marginBottom: 10 }}>Only the owner can edit the catalog.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {catalog.map(it => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
            <span style={{ fontSize: 24 }}>{it.emoji || "📦"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FFB, fontSize: 14 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>{it.category || "Uncategorized"}</div>
            </div>
            <div style={{ fontFamily: FFB, fontSize: 14, color: AC }}>{money(it.price)}</div>
            {mod && <>
              <span onClick={() => setDraft({ ...it, price: String(it.price) })} style={{ cursor: "pointer", fontSize: 12.5, color: "var(--nv-text-dim)" }}>Edit</span>
              <span onClick={() => del(it.id)} style={{ cursor: "pointer", fontSize: 12.5, color: "#ef4444" }}>Delete</span>
            </>}
          </div>
        ))}
        {catalog.length === 0 && <Center>No products yet.</Center>}
      </div>

      {draft && (
        <div onClick={() => setDraft(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 340, background: "var(--nv-surface-solid)", border: "1px solid var(--nv-border)", borderRadius: 16, padding: 18, fontFamily: FF, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: FFB, fontSize: 16 }}>{catalog.some(c => c.id === draft.id) ? "Edit product" : "New product"}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={draft.emoji} onChange={e => setDraft(d => ({ ...d, emoji: e.target.value.slice(0, 2) }))} placeholder="📦" style={{ ...fld, width: 52, textAlign: "center", fontSize: 20 }} />
              <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Product name" style={{ ...fld, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="number" inputMode="decimal" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} placeholder="Price" style={{ ...fld, flex: 1 }} />
              <input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} placeholder="Category" style={{ ...fld, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => setDraft(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FFB, fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
              <button onClick={commit} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: AC, color: "#fff", fontFamily: FFB, fontSize: 13.5, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- Sales --
function Sales({ sales, AC }) {
  const startToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const today = sales.filter(s => s.at >= startToday);
  const todayTotal = today.reduce((s, x) => s + (x.total || 0), 0);
  const allTotal = sales.reduce((s, x) => s + (x.total || 0), 0);

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "14px 16px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Stat label="Today's sales" value={money(todayTotal)} sub={`${today.length} transaction${today.length === 1 ? "" : "s"}`} AC={AC} />
        <Stat label="All-time" value={money(allTotal)} sub={`${sales.length} transaction${sales.length === 1 ? "" : "s"}`} />
      </div>
      <div style={{ fontFamily: FFB, fontSize: 14, marginBottom: 8 }}>Recent transactions</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {sales.length === 0 ? <Center>No sales recorded yet.</Center>
        : sales.map(s => (
          <div key={s.id} style={{ padding: "10px 13px", borderRadius: 11, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FFB, fontSize: 15 }}>{money(s.total)}</span>
              <span style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 999, background: "var(--nv-elevated)", color: "var(--nv-text-dim)" }}>{s.tender === "cash" ? "💵 Cash" : "💳 Card"}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--nv-text-dim)" }}>{new Date(s.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)", marginTop: 4 }}>
              {(s.items || []).map(i => `${i.qty}× ${i.name}`).join(", ")} · {s.cashier}
              {s.tender === "cash" && typeof s.paid === "number" && s.paid > s.total ? ` · change ${money(s.paid - s.total)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Access --
function Access({ AC, owner, showToast }) {
  const [list, setList] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchAccessList().then(l => setList(l || [])); }, []);

  const add = async () => {
    const u = name.trim(); if (!u || busy) return; setBusy(true);
    const next = await grantAccess(u); setList(next); setName(""); setBusy(false);
    showToast?.(`Granted POS access to @${u.toLowerCase()}`);
  };
  const remove = async (u) => { setBusy(true); const next = await revokeAccess(u); setList(next); setBusy(false); showToast?.(`Removed @${u}`); };

  const fld = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-elevated)", color: "var(--nv-text)", fontFamily: FF, fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: "16px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontFamily: FFB, fontSize: 17, marginBottom: 4 }}>POS access</div>
      <div style={{ fontSize: 13, color: "var(--nv-text-dim)", lineHeight: 1.5, marginBottom: 16 }}>
        The Point of Sale app is hidden from everyone by default. You ({owner}) always have access. Add a Nova username below to make the app appear on their account too — they'll see it next time they sign in.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Nova username" style={{ ...fld, flex: 1 }} />
        <button onClick={add} disabled={!name.trim() || busy} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: name.trim() ? AC : "var(--nv-border)", color: "#fff", fontFamily: FFB, fontSize: 14, cursor: name.trim() ? "pointer" : "default" }}>Grant</button>
      </div>
      <div style={{ fontFamily: FFB, fontSize: 13.5, marginBottom: 8 }}>Granted users</div>
      {list === null ? <Center>Loading…</Center>
      : list.length === 0 ? <div style={{ fontSize: 13, color: "var(--nv-text-dim)" }}>No one else has access yet.</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {list.map(u => (
            <div key={u} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: AC, color: "#fff", display: "grid", placeItems: "center", fontFamily: FFB, fontSize: 13 }}>{u[0]?.toUpperCase()}</span>
              <span style={{ flex: 1, fontFamily: FFB, fontSize: 13.5 }}>@{u}</span>
              <span onClick={() => remove(u)} style={{ cursor: "pointer", fontSize: 12.5, color: "#ef4444" }}>Revoke</span>
            </div>
          ))}
        </div>}
    </div>
  );
}

// ----------------------------------------------------------------- helpers --
function Stepper({ children, onClick }) {
  return <span onClick={onClick} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--nv-border)", display: "grid", placeItems: "center", cursor: "pointer", fontFamily: FFB, fontSize: 14, userSelect: "none", background: "var(--nv-elevated)" }}>{children}</span>;
}
function Row({ label, value, big }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: big ? "6px 0 2px" : "2px 0", fontFamily: big ? FFB : FF, fontSize: big ? 17 : 13, color: big ? "var(--nv-text)" : "var(--nv-text-dim)" }}><span>{label}</span><span style={big ? {} : { color: "var(--nv-text)" }}>{value}</span></div>;
}
function Stat({ label, value, sub, AC }) {
  return <div style={{ flex: 1, minWidth: 150, padding: "14px 16px", borderRadius: 14, border: "1px solid var(--nv-border)", background: "var(--nv-surface-solid)" }}>
    <div style={{ fontSize: 12.5, color: "var(--nv-text-dim)" }}>{label}</div>
    <div style={{ fontFamily: FFB, fontSize: 26, color: AC || "var(--nv-text)", margin: "2px 0" }}>{value}</div>
    <div style={{ fontSize: 12, color: "var(--nv-text-dim)" }}>{sub}</div>
  </div>;
}
function Center({ children }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100%", minHeight: 120, color: "var(--nv-text-dim)", fontFamily: FF, fontSize: 13.5, textAlign: "center", padding: 24 }}>{children}</div>;
}
