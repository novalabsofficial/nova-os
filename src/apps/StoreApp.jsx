import { useState, useEffect } from "react";
import { FF, FFB, FFM, INP, SEC, DEFAULT_AC } from "../ui/styles.js";
import { fill, bdr, hexRgb } from "../lib/format.js";
import { STORE_CATALOG, STORE_META, STORE_FEATURED, NOVA_VERSION } from "../ui/constants.js";
import { StoreBrandIcon, NovaLogo } from "../ui/icons.jsx";
import { autoModerate, isAdmin, isPubliclyVisible } from "../lib/moderation.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "../firebase.js";
import { getDbUid } from "../lib/db.js";
import { openExternalUrl } from "../lib/openUrl.js";

// ─────────────────────────────────────────────────────────────────────────
// v8.4 — Nova Store, full revamp.
//
// The old Store was a flat tabbed grid of cards with inline Clearbit logos —
// functional but visually "miles behind a real OS" (the brief). This rebuild
// borrows the structure of the Google Play / App Store experience:
//
//   • Home: a featured hero carousel + horizontal category "shelves".
//   • Games / Apps: category-filtered browse grids.
//   • Search: a unified result set across the curated catalog AND community.
//   • App detail page: gradient hero, big icon, developer + tagline, rating
//     summary with a 5-bar histogram, install/open, and — new in 8.4 —
//     written reviews (a star-picker + textarea composer, plus a feed of
//     everyone's reviews).
//   • Community / Submit / Moderation: kept, restyled to match.
//
// Reviews piggyback on the existing nova_ratings collection: one doc per
// user per app (id `<appId>_<username>`), now carrying an optional `text`.
// The same realtime snapshot that powers star aggregates also yields the
// review feed and the histogram — no extra reads.
// ─────────────────────────────────────────────────────────────────────────

// Combined catalog metadata for any app (curated OR community).
function metaFor(app, ac) {
  const m = STORE_META[app.id];
  if (m) return m;
  return {
    developer: app.submitter ? "@" + app.submitter : "Community",
    tagline: "",
    accent: ac,
  };
}

function relTime(ts) {
  if (!ts) return "";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 2592000) return Math.floor(s / 86400) + "d ago";
  return new Date(ts).toLocaleDateString();
}

const EMPTY_RATING = { avg: 0, count: 0, mine: 0, myText: "", hist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, reviews: [] };

// ── Read-only star row (display) ────────────────────────────────────────
function StarRow({ value, size = 13, gap = 1 }) {
  const v = Math.round(value);
  return (
    <span style={{ display: "inline-flex", gap, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ fontSize: size, color: s <= v ? "#ffc83d" : "rgba(255,255,255,0.16)" }}>★</span>
      ))}
    </span>
  );
}

// ── Avatar bubble (first letter of a username on an accent disc) ──────────
function Avatar({ name, ac, size = 30 }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: fill(ac), border: "1px solid " + bdr(ac),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FFB, fontWeight: 700, fontSize: size * 0.42, color: ac,
    }}>{letter}</div>
  );
}

// ── Vertical app tile (used in Home shelves) ──────────────────────────────
function AppTile({ app, ratings, ac, onOpen }) {
  const r = ratings[app.id] || EMPTY_RATING;
  const meta = metaFor(app, ac);
  return (
    <div className="sc" onClick={() => onOpen(app)} style={{
      width: 132, flexShrink: 0, cursor: "pointer", borderRadius: 14, padding: 12,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
    }}>
      <StoreBrandIcon app={app} size={62} />
      <div style={{ width: "100%" }}>
        <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 12.5, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{meta.developer}</div>
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <StarRow value={r.count ? r.avg : 0} size={11} />
          <span style={{ fontSize: 9, fontFamily: FFM, color: "rgba(255,255,255,0.35)" }}>{r.count ? r.avg.toFixed(1) : "New"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Featured hero banner (used at the top of Home) ────────────────────────
function FeaturedCard({ app, ac, onOpen }) {
  const meta = metaFor(app, ac);
  const rgb = hexRgb(meta.accent);
  return (
    <div className="ws" onClick={() => onOpen(app)} style={{
      width: 300, flexShrink: 0, cursor: "pointer", borderRadius: 18, padding: "20px 20px 18px",
      background: `linear-gradient(135deg, rgba(${rgb},0.55), rgba(${rgb},0.12))`,
      border: "1px solid rgba(255,255,255,0.12)", position: "relative", overflow: "hidden",
      boxShadow: "0 8px 26px rgba(0,0,0,0.35)",
    }}>
      <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", marginBottom: 14 }}>Featured</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <StoreBrandIcon app={app} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 18, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.35, marginTop: 2 }}>{meta.tagline || app.desc}</div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 20, background: "rgba(255,255,255,0.92)", color: "#111", fontFamily: FFB, fontWeight: 700, fontSize: 12 }}>View</div>
    </div>
  );
}

// ── Browse / search grid card ─────────────────────────────────────────────
function GridCard({ app, ratings, ac, isIn, onOpen, toggleInstall, currentUser, onDeleteApp }) {
  const r = ratings[app.id] || EMPTY_RATING;
  const meta = metaFor(app, ac);
  const canDelete = typeof app.submitter === "string" && app.submitter.length > 0 && app.submitter === currentUser;
  return (
    <div className="sc" onClick={() => onOpen(app)} style={{
      cursor: "pointer", padding: 14, borderRadius: 14,
      background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)",
      display: "flex", flexDirection: "column", gap: 11,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <StoreBrandIcon app={app} size={50} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13.5, color: "rgba(255,255,255,0.94)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{meta.developer}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
            <StarRow value={r.count ? r.avg : 0} size={11} />
            <span style={{ fontSize: 9.5, fontFamily: FFM, color: "rgba(255,255,255,0.35)" }}>{r.count ? r.avg.toFixed(1) + " (" + r.count + ")" : "No ratings"}</span>
          </div>
        </div>
        {canDelete && (
          <button className="dl" onClick={(e) => { e.stopPropagation(); onDeleteApp(app); }} title="Remove your submission" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.35)", fontSize: 13, padding: "2px 5px", flexShrink: 0 }}>🗑</button>
        )}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>{app.desc}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={(e) => { e.stopPropagation(); toggleInstall(app.id); }} style={{ flex: 1, padding: "7px", borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, background: isIn ? "rgba(255,80,80,0.1)" : "rgba(255,255,255,0.07)", border: "1px solid " + (isIn ? "rgba(255,80,80,0.3)" : "rgba(255,255,255,0.12)"), color: isIn ? "rgba(255,130,130,0.9)" : "rgba(255,255,255,0.7)" }}>{isIn ? "Remove" : "Add"}</button>
        <button onClick={(e) => { e.stopPropagation(); openExternalUrl(app.url); }} style={{ flex: 1, padding: "7px", borderRadius: 9, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 11.5, background: fill(ac), border: "1px solid " + bdr(ac), color: ac }}>Open ↗</button>
      </div>
    </div>
  );
}

// ── A horizontal "shelf" of tiles with a heading ──────────────────────────
function Shelf({ title, apps, ratings, ac, onOpen }) {
  if (!apps.length) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.92)", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
        {apps.map(a => <AppTile key={a.id} app={a} ratings={ratings} ac={ac} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

// ── App detail page (with reviews) ────────────────────────────────────────
function AppDetail({ app, ratings, ac, isIn, user, onBack, toggleInstall, rateAndReview, currentUser, onDeleteApp, canModerate, onDeleteReview }) {
  const r = ratings[app.id] || EMPTY_RATING;
  const meta = metaFor(app, ac);
  const rgb = hexRgb(meta.accent);
  const [stars, setStars] = useState(r.mine || 0);
  const [hoverStar, setHoverStar] = useState(0);
  const [text, setText] = useState(r.myText || "");
  const [saving, setSaving] = useState(false);
  // Reseed the composer when navigating to a different app.
  useEffect(() => { setStars(r.mine || 0); setText(r.myText || ""); /* eslint-disable-next-line */ }, [app.id]);

  const canDelete = typeof app.submitter === "string" && app.submitter.length > 0 && app.submitter === currentUser;
  const total = r.count || 0;
  const maxBar = Math.max(1, ...[1, 2, 3, 4, 5].map(s => r.hist[s] || 0));

  async function save() {
    if (!stars) return;
    setSaving(true);
    await rateAndReview(app.id, stars, text);
    setSaving(false);
  }

  return (
    <div style={{ animation: "boot-in 0.25s ease both" }}>
      {/* Back */}
      <button onClick={onBack} className="lt" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.55)", padding: "2px 0", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back</button>

      {/* Hero */}
      <div style={{ borderRadius: 18, padding: 22, marginBottom: 18, position: "relative", overflow: "hidden", background: `linear-gradient(140deg, rgba(${rgb},0.4), rgba(${rgb},0.06))`, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <StoreBrandIcon app={app} size={92} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 26, color: "#fff", lineHeight: 1.1 }}>{app.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{meta.developer}</div>
            {meta.tagline && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{meta.tagline}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <StarRow value={total ? r.avg : 0} size={15} />
                <span style={{ fontFamily: FFM, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{total ? r.avg.toFixed(1) + " · " + total + (total === 1 ? " rating" : " ratings") : "No ratings yet"}</span>
              </div>
              <span style={{ fontSize: 10, fontFamily: FFM, padding: "2px 9px", borderRadius: 20, background: app.newTab ? "rgba(255,180,0,0.14)" : "rgba(79,200,100,0.14)", border: "1px solid " + (app.newTab ? "rgba(255,180,0,0.32)" : "rgba(79,200,100,0.32)"), color: app.newTab ? "rgba(255,200,80,0.95)" : "rgba(120,225,140,0.95)" }}>{app.badge || (app.newTab ? "↗ New Tab" : "✓ In-App")}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{app.cat}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => openExternalUrl(app.url)} style={{ padding: "10px 26px", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13.5, background: "#fff", color: "#111", border: "none" }}>Open ↗</button>
          <button onClick={() => toggleInstall(app.id)} style={{ padding: "10px 22px", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13.5, background: isIn ? "rgba(255,80,80,0.12)" : "rgba(255,255,255,0.1)", border: "1px solid " + (isIn ? "rgba(255,80,80,0.35)" : "rgba(255,255,255,0.18)"), color: isIn ? "rgba(255,140,140,0.95)" : "#fff" }}>{isIn ? "Remove from Desktop" : "+ Add to Desktop"}</button>
          {canDelete && <button onClick={() => onDeleteApp(app)} style={{ padding: "10px 16px", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 13, background: "none", border: "1px solid rgba(255,80,80,0.3)", color: "rgba(255,120,120,0.8)" }}>🗑 Remove</button>}
        </div>
      </div>

      {/* About */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...SEC, marginBottom: 8 }}>About</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{app.desc}</div>
      </div>

      {/* Ratings & reviews */}
      <div style={{ ...SEC, marginBottom: 12 }}>Ratings &amp; Reviews</div>
      <div style={{ display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ textAlign: "center", minWidth: 92 }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 46, color: "#fff", lineHeight: 1 }}>{total ? r.avg.toFixed(1) : "–"}</div>
          <div style={{ marginTop: 6 }}><StarRow value={total ? r.avg : 0} size={14} /></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{total} {total === 1 ? "rating" : "ratings"}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 4 }}>
          {[5, 4, 3, 2, 1].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontFamily: FFM, color: "rgba(255,255,255,0.4)", width: 8 }}>{s}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ width: ((r.hist[s] || 0) / maxBar * 100) + "%", height: "100%", background: "#ffc83d", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 18 }}>
        <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 10 }}>{r.mine ? "Edit your review" : "Write a review"}</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <span key={s} onClick={() => setStars(s)} onMouseEnter={() => setHoverStar(s)} onMouseLeave={() => setHoverStar(0)}
              style={{ cursor: "pointer", fontSize: 28, lineHeight: 1, transition: "color 0.1s,transform 0.1s", color: s <= (hoverStar || stars) ? "#ffc83d" : "rgba(255,255,255,0.18)" }}>★</span>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value.slice(0, 1000))} placeholder="Share what you think about this app… (optional)" style={{ ...INP, minHeight: 70 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: FFM }}>{text.length}/1000</span>
          <button onClick={save} disabled={!stars || saving} style={{ padding: "8px 20px", borderRadius: 10, cursor: stars && !saving ? "pointer" : "default", fontFamily: FFB, fontWeight: 700, fontSize: 12.5, background: fill(ac), border: "1px solid " + bdr(ac), color: ac, opacity: stars && !saving ? 1 : 0.4 }}>{saving ? "Posting…" : r.mine ? "Update review" : "Post review"}</button>
        </div>
      </div>

      {/* Review feed */}
      {r.reviews.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontStyle: "italic", padding: "8px 0 24px" }}>No written reviews yet — be the first to share your thoughts.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>
        {r.reviews.map((rv, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <Avatar name={rv.user} ac={ac} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>@{rv.user}{rv.user === user && <span style={{ fontSize: 10, color: ac, marginLeft: 5 }}>you</span>}</span>
                <StarRow value={rv.rating} size={11} />
                <span style={{ fontSize: 10, fontFamily: FFM, color: "rgba(255,255,255,0.3)" }}>{relTime(rv.ts)}</span>
                {canModerate && <button onClick={() => onDeleteReview(app.id, rv.user)} title="Delete review (moderator)" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(255,90,90,0.6)", fontSize: 12, padding: "0 2px" }}>🗑</button>}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.55, marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rv.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoreApp({ user, data, updateData, showToast, AC }) {
  const ac = AC || DEFAULT_AC;
  const [view, setView] = useState("home"); // home | games | apps | community | submit | moderation
  const [detail, setDetail] = useState(null); // selected app object, or null
  const [search, setSearch] = useState("");
  const [appsCat, setAppsCat] = useState("All"); // sub-filter inside the "Apps" view
  const [ratings, setRatings] = useState({});
  const [commApps, setCommApps] = useState([]);
  const [loadingComm, setLoadingComm] = useState(true);
  const [sName, setSName] = useState(""); const [sUrl, setSUrl] = useState("");
  const [sDesc, setSDesc] = useState(""); const [sCat, setSCat] = useState("Tools");
  const [sIcon, setSIcon] = useState("🚀"); const [submitting, setSubmitting] = useState(false);
  const [sIconImg, setSIconImg] = useState(null); // v9.0: uploaded custom logo (base64) or null
  const installed = data?.installedApps || [];

  // v9.0 — let submitters upload their own logo instead of an emoji. Downsample
  // to a 128² cover-cropped JPEG (~5–15 KB base64) so it fits comfortably in the
  // app's Firestore doc — no Firebase Storage needed.
  function handleIconUpload(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { showToast("Image too large (max 8MB)"); return; }
    const rd = new FileReader();
    rd.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const S = 128, c = document.createElement("canvas"); c.width = S; c.height = S;
        const ctx = c.getContext("2d");
        const scale = Math.max(S / img.width, S / img.height);   // cover-crop to square
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
        setSIconImg(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => showToast("Couldn't load image");
      img.src = ev.target.result;
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  }

  // ── Realtime ratings + reviews aggregation ──────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(firestoreDb, "nova_ratings"), snap => {
      const agg = {};
      snap.docs.forEach(d => {
        const r = d.data();
        if (typeof r.rating !== "number") return;
        if (!agg[r.appId]) agg[r.appId] = { total: 0, count: 0, mine: 0, myText: "", hist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, reviews: [] };
        const a = agg[r.appId];
        a.total += r.rating; a.count++;
        const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
        a.hist[rounded] = (a.hist[rounded] || 0) + 1;
        if (r.user === user) { a.mine = r.rating; a.myText = r.text || ""; }
        if (r.text && r.text.trim()) a.reviews.push({ user: r.user, rating: r.rating, text: r.text, ts: r.ts });
      });
      const out = {};
      Object.entries(agg).forEach(([id, v]) => {
        v.reviews.sort((x, y) => (y.ts || 0) - (x.ts || 0));
        out[id] = { avg: v.total / v.count, count: v.count, mine: v.mine, myText: v.myText, hist: v.hist, reviews: v.reviews };
      });
      setRatings(out);
    }, () => {});
    return () => unsub();
  }, [user]);

  // ── Realtime community apps ──────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(firestoreDb, "nova_user_apps"), orderBy("ts", "desc"), limit(60));
    const unsub = onSnapshot(q, snap => { setCommApps(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingComm(false); }, () => setLoadingComm(false));
    return () => unsub();
  }, []);

  // ── Writes ───────────────────────────────────────────────────────────────
  async function rateAndReview(appId, rating, text) {
    try {
      // merge:true so changing stars never wipes an existing written review
      // (and vice-versa). Trim/clamp the review to the rule's 1000-char limit.
      const payload = { appId, user, uid: getDbUid(), rating, ts: Date.now() };
      const t = (text || "").trim();
      if (t) payload.text = t.slice(0, 1000); else payload.text = "";
      await setDoc(doc(firestoreDb, "nova_ratings", appId + "_" + user), payload, { merge: true });
      showToast(t ? "Review posted ✓" : "Rated " + rating + "★ ✓");
    } catch { showToast("Couldn't save — try again"); }
  }

  // v9.0 — moderators can remove a review that violates the rules. Deletes the
  // user's rating doc (stars + text); the Firestore rule permits mod deletes.
  async function deleteReview(appId, reviewUser) {
    if (!isAdmin(user)) return;
    if (!window.confirm("Delete @" + reviewUser + "'s review? This removes their rating and text.")) return;
    try {
      await deleteDoc(doc(firestoreDb, "nova_ratings", appId + "_" + reviewUser));
      showToast("Review removed ✓");
    } catch { showToast("Couldn't delete review"); }
  }

  async function submitApp() {
    const name = sName.trim(), desc = sDesc.trim();
    let url = sUrl.trim();
    if (!name || !url || !desc) { showToast("All fields required"); return; }
    if (!url.startsWith("http")) url = "https://" + url;
    setSubmitting(true);
    const autoFlags = autoModerate({ name, desc, url });
    try {
      await addDoc(collection(firestoreDb, "nova_user_apps"), {
        name, url, desc, cat: sCat, icon: sIcon, iconImg: sIconImg || null, submitter: user, submitterUid: getDbUid(), ts: Date.now(),
        newTab: true, badge: "↗ New Tab",
        status: "pending", autoFlags, reviewedBy: null, reviewedAt: null, rejectReason: null,
      });
      showToast(autoFlags.length > 0 ? "Submitted — flagged for review ⚠" : "Submitted — pending admin review ✓");
      setSName(""); setSUrl(""); setSDesc(""); setSIcon("🚀"); setSIconImg(null); setView("community");
    } catch { showToast("Submission failed"); }
    setSubmitting(false);
  }
  async function approveApp(app) {
    if (!isAdmin(user)) return;
    try { await updateDoc(doc(firestoreDb, "nova_user_apps", app.id), { status: "approved", reviewedBy: user, reviewedAt: Date.now() }); showToast("Approved \"" + app.name + "\" ✓"); }
    catch { showToast("Approve failed"); }
  }
  async function rejectApp(app) {
    if (!isAdmin(user)) return;
    const reason = window.prompt("Reject \"" + app.name + "\" — optional reason (visible to submitter):", "");
    if (reason === null) return;
    try { await updateDoc(doc(firestoreDb, "nova_user_apps", app.id), { status: "rejected", rejectReason: reason || null, reviewedBy: user, reviewedAt: Date.now() }); showToast("Rejected \"" + app.name + "\""); }
    catch { showToast("Reject failed"); }
  }
  function toggleInstall(appId) {
    const isIn = installed.includes(appId);
    updateData(p => ({ ...p, installedApps: isIn ? p.installedApps.filter(id => id !== appId) : [...(p.installedApps || []), appId] }));
    showToast(isIn ? "App removed" : "Added to desktop ✓");
  }
  async function deleteApp(app) {
    if (!app?.id) { showToast("Missing app id"); return; }
    let fresh;
    try {
      const snap = await getDoc(doc(firestoreDb, "nova_user_apps", app.id));
      if (!snap.exists()) { showToast("App already removed"); return; }
      fresh = snap.data();
    } catch { showToast("Couldn't verify owner — try again"); return; }
    if (!fresh.submitter || fresh.submitter !== user) { showToast("Only @" + (fresh.submitter || "the submitter") + " can delete this app"); return; }
    if (!window.confirm("Remove \"" + (fresh.name || app.name) + "\" from the store? This can't be undone.")) return;
    try { await deleteDoc(doc(firestoreDb, "nova_user_apps", app.id)); showToast("App removed from store ✓"); if (detail && detail.id === app.id) setDetail(null); }
    catch { showToast("Delete failed"); }
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const matches = a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.desc || "").toLowerCase().includes(q);
  };
  const visibleComm = commApps.filter(a => isPubliclyVisible(a));
  const games = STORE_CATALOG.filter(a => a.cat === "Games");
  const nonGames = STORE_CATALOG.filter(a => a.cat !== "Games");
  const featured = STORE_FEATURED.map(id => STORE_CATALOG.find(a => a.id === id)).filter(Boolean);
  const modQueue = commApps.filter(a => a.status === "pending");
  const mySubmissions = commApps.filter(a => a.submitter === user && a.status && a.status !== "approved");
  const userIsAdmin = isAdmin(user);
  const searching = search.trim().length > 0;
  const searchResults = searching ? [...STORE_CATALOG.filter(matches), ...visibleComm.filter(matches)] : [];

  const openDetail = (app) => { setDetail(app); };
  const goCategory = (c) => { setSearch(""); if (c === "Games") { setView("games"); } else { setAppsCat(c); setView("apps"); } };
  const cardProps = { ratings, ac, currentUser: user, onOpen: openDetail, toggleInstall, onDeleteApp: deleteApp };

  // Colorful category tiles for the bottom of Home (fills the page out + aids
  // navigation, the way the App Store / Play surface "Top Categories").
  const homeCats = [
    { cat: "Games", emoji: "🎮", color: "#f43f5e" },
    { cat: "Media", emoji: "🎬", color: "#a855f7" },
    { cat: "Tools", emoji: "🛠️", color: "#06b6d4" },
    { cat: "Social", emoji: "💬", color: "#3b82f6" },
    { cat: "News", emoji: "📰", color: "#f59e0b" },
  ].map(c => ({ ...c, count: STORE_CATALOG.filter(a => a.cat === c.cat).length }));

  const navItems = [
    ["home", "Home"],
    ["games", "Games"],
    ["apps", "Apps"],
    ["community", "Community" + (visibleComm.length ? " (" + visibleComm.length + ")" : "")],
    ["submit", "Submit"],
    ...(userIsAdmin ? [["moderation", "Moderation" + (modQueue.length ? " (" + modQueue.length + ")" : "")]] : []),
  ];

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 };

  return (
    <div style={{ width: "100%", fontFamily: FF }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <NovaLogo size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 20, color: "#fff", lineHeight: 1 }}>Nova Store</div>
          <div style={{ fontSize: 10, fontFamily: FFM, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>v{NOVA_VERSION}</div>
        </div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps, games and more…" style={{ ...INP, marginBottom: 14 }} />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      {!detail && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {navItems.map(([id, lbl]) => (
            <button key={id} onClick={() => { setView(id); setSearch(""); }} style={{
              padding: "7px 15px", borderRadius: 20, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 12.5,
              background: view === id && !searching ? fill(ac) : "rgba(255,255,255,0.05)",
              border: "1px solid " + (view === id && !searching ? bdr(ac) : "rgba(255,255,255,0.09)"),
              color: view === id && !searching ? ac : "rgba(255,255,255,0.55)", transition: "all 0.14s", whiteSpace: "nowrap",
            }}>{lbl}</button>
          ))}
        </div>
      )}

      {/* ── Detail page takes over the content area ─────────────────────── */}
      {detail && (
        <AppDetail app={detail} ratings={ratings} ac={ac} isIn={installed.includes(detail.id)} user={user}
          onBack={() => setDetail(null)} toggleInstall={toggleInstall} rateAndReview={rateAndReview}
          currentUser={user} onDeleteApp={deleteApp} canModerate={userIsAdmin} onDeleteReview={deleteReview} />
      )}

      {/* ── Search results (overrides the active view) ──────────────────── */}
      {!detail && searching && (
        <>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.9)", marginBottom: 12 }}>{searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{search.trim()}”</div>
          {searchResults.length === 0 && <div style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Nothing matched. Try another search.</div>}
          <div style={gridStyle}>
            {searchResults.map(app => <GridCard key={app.id} app={app} isIn={installed.includes(app.id)} {...cardProps} />)}
          </div>
        </>
      )}

      {/* ── Home ────────────────────────────────────────────────────────── */}
      {!detail && !searching && view === "home" && (
        <>
          {featured.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
                {featured.map(a => <FeaturedCard key={a.id} app={a} ac={ac} onOpen={openDetail} />)}
              </div>
            </div>
          )}
          <Shelf title="Top Games" apps={games} ratings={ratings} ac={ac} onOpen={openDetail} />
          <Shelf title="Essential Apps" apps={STORE_CATALOG.filter(a => a.cat === "Tools" || a.cat === "Media")} ratings={ratings} ac={ac} onOpen={openDetail} />
          <Shelf title="Social & News" apps={STORE_CATALOG.filter(a => a.cat === "Social" || a.cat === "News")} ratings={ratings} ac={ac} onOpen={openDetail} />
          {visibleComm.length > 0 && <Shelf title="From the Community" apps={visibleComm} ratings={ratings} ac={ac} onOpen={openDetail} />}

          {/* Browse by category */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.92)", marginBottom: 10 }}>Browse by Category</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {homeCats.map(c => {
                const rgb = hexRgb(c.color);
                return (
                  <button key={c.cat} onClick={() => goCategory(c.cat)} className="ws" style={{
                    flex: "1 1 130px", minWidth: 130, textAlign: "left", cursor: "pointer", padding: "14px 16px", borderRadius: 14,
                    background: `linear-gradient(135deg, rgba(${rgb},0.5), rgba(${rgb},0.14))`, border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{c.emoji}</div>
                    <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff" }}>{c.cat}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 }}>{c.count} app{c.count === 1 ? "" : "s"}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit call-to-action */}
          <div style={{ borderRadius: 16, padding: "20px 22px", marginBottom: 8, background: `linear-gradient(135deg, ${fill(ac)}, rgba(255,255,255,0.02))`, border: "1px solid " + bdr(ac), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 16, color: "#fff" }}>Built something cool? 🚀</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>Share your web app with the whole Nova community.</div>
            </div>
            <button onClick={() => { setSearch(""); setView("submit"); }} style={{ padding: "10px 22px", borderRadius: 22, cursor: "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", background: "#fff", color: "#111", border: "none" }}>Submit an app →</button>
          </div>
        </>
      )}

      {/* ── Games ───────────────────────────────────────────────────────── */}
      {!detail && !searching && view === "games" && (
        <div style={gridStyle}>
          {games.map(app => <GridCard key={app.id} app={app} isIn={installed.includes(app.id)} {...cardProps} />)}
        </div>
      )}

      {/* ── Apps (non-games, with sub-category chips) ───────────────────── */}
      {!detail && !searching && view === "apps" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["All", "Media", "Tools", "Social", "News"].map(c => (
              <button key={c} onClick={() => setAppsCat(c)} style={{ padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, background: appsCat === c ? fill(ac) : "rgba(255,255,255,0.05)", border: "1px solid " + (appsCat === c ? bdr(ac) : "rgba(255,255,255,0.09)"), color: appsCat === c ? ac : "rgba(255,255,255,0.5)" }}>{c}</button>
            ))}
          </div>
          <div style={gridStyle}>
            {nonGames.filter(a => appsCat === "All" || a.cat === appsCat).map(app => <GridCard key={app.id} app={app} isIn={installed.includes(app.id)} {...cardProps} />)}
          </div>
        </>
      )}

      {/* ── Community ───────────────────────────────────────────────────── */}
      {!detail && !searching && view === "community" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>Apps submitted by Nova users</span>
            <button onClick={() => setView("submit")} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11.5, background: fill(ac), border: "1px solid " + bdr(ac), color: ac }}>+ Submit App</button>
          </div>
          {mySubmissions.length > 0 && (
            <div style={{ marginBottom: 16, padding: "11px 13px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
              <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, letterSpacing: 0.5 }}>YOUR SUBMISSIONS</div>
              {mySubmissions.map(a => {
                const isPending = a.status === "pending";
                const badgeColor = isPending ? "#ffcc44" : "#ff7878";
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    <span style={{ fontFamily: FFM, fontSize: 10, padding: "1px 7px", borderRadius: 4, background: "rgba(" + hexRgb(badgeColor) + ",0.15)", border: "1px solid " + badgeColor, color: badgeColor }}>{isPending ? "Pending review" : "Rejected"}</span>
                    {!isPending && a.rejectReason && <span style={{ fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>"{a.rejectReason}"</span>}
                  </div>
                );
              })}
            </div>
          )}
          {loadingComm && <div style={{ textAlign: "center", padding: "36px 0" }}><div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: ac, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div>}
          {!loadingComm && visibleComm.length === 0 && <div style={{ color: "rgba(255,255,255,0.18)", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No community apps yet — be the first! 🚀</div>}
          <div style={gridStyle}>
            {visibleComm.map(app => <GridCard key={app.id} app={app} isIn={installed.includes(app.id)} {...cardProps} />)}
          </div>
        </>
      )}

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      {!detail && !searching && view === "submit" && (
        <div style={{ maxWidth: 470 }}>
          <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 17, color: "#fff", marginBottom: 4 }}>Submit Your App</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.35)", marginBottom: 18 }}>Share any web app or website with the Nova community. Submissions appear in the Community tab after a quick review.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ ...SEC, marginBottom: 0 }}>Icon</label>
                {sIconImg ? (
                  <div style={{ position: "relative", width: 56, height: 56 }}>
                    <img src={sIconImg} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }} />
                    <button onClick={() => setSIconImg(null)} title="Remove logo" style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "rgba(255,80,80,0.92)", border: "none", cursor: "pointer", color: "#fff", fontSize: 11, lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                ) : (
                  <input value={sIcon} onChange={e => setSIcon(e.target.value)} maxLength={2} style={{ ...INP, width: 56, textAlign: "center", fontSize: 22, padding: "6px 4px" }} />
                )}
                <label style={{ fontSize: 9, color: ac, cursor: "pointer", fontFamily: FFB, fontWeight: 600, textAlign: "center", marginTop: 1 }}>
                  {sIconImg ? "Change" : "↑ Upload logo"}
                  <input type="file" accept="image/*" onChange={handleIconUpload} style={{ display: "none" }} />
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <label style={{ ...SEC, marginBottom: 0 }}>App Name</label>
                <input value={sName} onChange={e => setSName(e.target.value)} placeholder="My Cool App" style={INP} maxLength={50} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ ...SEC, marginBottom: 0 }}>URL</label>
              <input value={sUrl} onChange={e => setSUrl(e.target.value)} placeholder="https://myapp.com" style={INP} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ ...SEC, marginBottom: 0 }}>Description</label>
              <textarea value={sDesc} onChange={e => setSDesc(e.target.value)} placeholder="What does your app do?" style={{ ...INP, minHeight: 66 }} maxLength={200} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ ...SEC, marginBottom: 0 }}>Category</label>
              <select value={sCat} onChange={e => setSCat(e.target.value)} style={{ ...INP, cursor: "pointer" }}>
                {["Games", "Media", "Tools", "Social", "News", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={submitApp} disabled={submitting || !sName.trim() || !sUrl.trim() || !sDesc.trim()}
              style={{ padding: "11px", borderRadius: 10, cursor: submitting ? "default" : "pointer", fontFamily: FFB, fontWeight: 700, fontSize: 13, background: fill(ac), border: "1px solid " + bdr(ac), color: ac, opacity: submitting || !sName.trim() || !sUrl.trim() || !sDesc.trim() ? 0.4 : 1 }}>
              {submitting ? "Submitting…" : "Submit App →"}
            </button>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Submissions are public and visible to all Nova OS users. Keep it appropriate.</div>
          </div>
        </div>
      )}

      {/* ── Moderation (admins only) ────────────────────────────────────── */}
      {!detail && !searching && view === "moderation" && userIsAdmin && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: FFB, fontWeight: 700, fontSize: 14, color: "#fff" }}>🛡 Moderation Queue</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{modQueue.length} app{modQueue.length === 1 ? "" : "s"} awaiting review · red flags from auto-filter need extra attention</div>
          </div>
          {modQueue.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Queue is empty — nothing to review 🎉</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {modQueue.map(app => (
              <div key={app.id} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flexShrink: 0 }}><StoreBrandIcon app={app} size={40}/></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FFB, fontWeight: 600, fontSize: 13, color: "#fff" }}>{app.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>by @{app.submitter || "unknown"} · {app.cat || "Uncategorized"}</div>
                    <a href={app.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontFamily: FFM, color: ac, textDecoration: "none", marginTop: 3, display: "inline-block", wordBreak: "break-all" }}>{app.url}</a>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.5 }}>{app.desc}</div>
                    {app.autoFlags && app.autoFlags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {app.autoFlags.map((f, i) => (
                          <span key={i} style={{ fontSize: 10, fontFamily: FFM, padding: "2px 7px", borderRadius: 4, background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.4)", color: "#ff9898" }}>⚠ {f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 11, justifyContent: "flex-end" }}>
                  <button onClick={() => rejectApp(app)} style={{ padding: "6px 14px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.35)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "rgba(255,130,130,0.95)" }}>✕ Reject</button>
                  <button onClick={() => approveApp(app)} style={{ padding: "6px 14px", background: "rgba(76,239,144,0.1)", border: "1px solid rgba(76,239,144,0.4)", borderRadius: 6, cursor: "pointer", fontFamily: FFB, fontWeight: 600, fontSize: 11, color: "#4cef90" }}>✓ Approve</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
