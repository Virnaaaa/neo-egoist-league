// Ani's Neo Egoist League website: one script for every page.
// Reads data.json (written by the bot every few minutes, website_export.py) and draws the page named
// in <body data-page="...">. No library, no build step.
"use strict";

const PAGES = [["index.html", "Home", "home"], ["teams.html", "Teams", "teams"], ["players.html", "Players", "players"],
  ["market.html", "Market", "market"], ["guide.html", "Guide", "guide"]];
const page = document.body.dataset.page;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = m => { m = +m || 0; return (Math.abs(m - Math.round(m)) < 0.01 ? m.toFixed(0) : m.toFixed(1)) + "M"; };
const signed = m => (m >= 0 ? "+" : "−") + money(Math.abs(m));
const POS = { GK: "Goalkeeper", LM: "Left Mid", RM: "Right Mid", LW: "Left Wing", RW: "Right Wing", CF: "Forward", CM: "Midfielder" };
const KIND = { start: "Start", match: "Match", transfer_in: "Sale", transfer_out: "Signing", fine: "Fine", penalty: "Penalty", admin: "Admin" };

function nyDate(sqlUtc, withTime) {
  if (!sqlUtc) return "";
  const d = new Date(String(sqlUtc).replace(" ", "T") + "Z");
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}
function ago(ts) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 90) return "just now";
  if (s < 3600) return Math.round(s / 60) + " minutes ago";
  if (s < 86400) return Math.round(s / 3600) + " hours ago";
  return Math.round(s / 86400) + " days ago";
}
function initials(n) { return esc(String(n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()); }
function avatar(p) {
  const ini = initials(p.name);
  return p.avatar
    ? `<span class="av"><img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${ini}'"></span>`
    : `<span class="av">${ini}</span>`;
}
function teamVars(t) { return t ? `--c1:${t.colours[0]};--c2:${t.colours[1]}` : ""; }
function crest(t) {
  if (!t) return "";
  const badge = `<span class="badge" style="background:linear-gradient(135deg,${t.colours[0]},${t.colours[1]});color:${t.colours[2]}">${esc(t.short)}</span>`;
  return t.crest ? `<img class="crest" src="crests/${esc(t.crest)}" alt="${esc(t.name)} crest" onerror="this.outerHTML='${badge.replace(/'/g, "&#39;").replace(/"/g, "&quot;")}'">` : badge;
}
function grade(ovr, g) {
  return ovr == null ? `<span class="dim">–</span>` : `<span class="grade g-${esc(g)}">${esc(g)} <small>${ovr}</small></span>`;
}
function role(r) {
  return r === "master" ? `<span class="role master">Master</span>` : r === "newgen" ? `<span class="role newgen">New Gen</span>` : "";
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

// ---- shell: top bar and footer on every page
document.body.insertAdjacentHTML("afterbegin", `
<header class="top"><div class="in">
  <a class="brand" href="index.html"><i></i>Neo Egoist League</a>
  <nav class="links" aria-label="Pages">${PAGES.map(([h, l, k]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
</div></header>`);
document.body.insertAdjacentHTML("beforeend", `
<footer class="site"><div class="in">
  <span>Ani's Neo Egoist League · stats from the Azure Latch bot</span>
  <span id="updated"></span>
</div></footer>`);

// ---- data
// Live data: the bot pushes data.json to the repository's "data" branch (website_export.py). Reading it from
// there means the site itself never has to be rebuilt. Empty = only the data.json next to the pages.
const DATA_URL = document.querySelector('meta[name="league-data"]')?.content || "";
async function load() {
  for (const url of [DATA_URL ? DATA_URL + "?t=" + Math.floor(Date.now() / 60000) : "", "data.json"].filter(Boolean)) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) { /* try the next one */ }
  }
  throw new Error("no data");
}
function standings(D) {
  return [...D.teams].sort((a, b) => b.pts - a.pts || b.sd - a.sd || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
}
function teamOf(D, name) { return D.teams.find(t => t.name === name); }
function windowPill(D) {
  const w = D.window;
  const cls = w.open ? "open" : (w.text.startsWith("MARKET NOT") ? "" : "closed");
  return `<span class="pill ${cls}">${esc(w.text)}</span>`;
}

// ---- pages
const draw = {
  home(D) {
    const rows = standings(D);
    $("#window").innerHTML = windowPill(D);
    $("#table").innerHTML = `<div class="tbl"><table>
      <thead><tr><th>#</th><th>Club</th><th class="num">P</th><th class="num">W</th><th class="num">L</th><th class="num">SD</th><th class="num">GD</th><th class="num">Pts</th><th>Grade</th></tr></thead>
      <tbody>${rows.map((t, i) => `<tr class="${i === 0 && t.p ? "lead" : ""}"><td class="rank">${i + 1}</td>
        <td><a class="who" href="teams.html#${slug(t.name)}" style="color:inherit">${crest(t)}<b>${esc(t.name)}</b></a></td>
        <td class="num">${t.p}</td><td class="num">${t.w}</td><td class="num">${t.l}</td>
        <td class="num">${t.sd > 0 ? "+" : ""}${t.sd}</td><td class="num">${t.gd > 0 ? "+" : ""}${t.gd}</td>
        <td class="num"><b>${t.pts}</b></td><td>${grade(t.ovr, t.grade)}</td></tr>`).join("")}</tbody></table></div>`;
    const top = D.players.filter(p => p.ovr != null).sort((a, b) => b.ovr - a.ovr || b.avg - a.avg).slice(0, 8);
    $("#top").innerHTML = top.length ? `<div class="tbl"><table><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Overall</th></tr></thead><tbody>${
      top.map((p, i) => `<tr class="${i === 0 ? "lead" : ""}"><td class="rank">${i + 1}</td>
        <td><div class="who">${avatar(p)}<div style="min-width:0"><b>${esc(p.name)}</b><div class="dim" style="font-size:12px">${esc(p.team || "No team")}</div></div></div></td>
        <td>${esc(p.pos || "–")}</td><td>${grade(p.ovr, p.grade)}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">No rated players yet</div>`;
    $("#clubs").innerHTML = D.teams.map(t => `<a class="club" href="#${slug(t.name)}" data-team="${esc(t.name)}" style="${teamVars(t)}">
      <div class="top-row">${crest(t)}<div><h4>${esc(t.name)}</h4>${grade(t.ovr, t.grade)}</div></div>
      <div class="stats"><span><b>${t.w}–${t.l}</b>Record</span><span><b>${t.squad}</b>Players</span><span><b>${money(t.balance)}</b>Budget</span></div></a>`).join("");
    $("#results").innerHTML = results(D, 6);
    const open = name => {
      const t = teamOf(D, name); if (!t) return;
      document.querySelectorAll(".club").forEach(c => c.classList.toggle("on", c.dataset.team === name));
      const box = $("#roster"); box.hidden = false; box.innerHTML = rosterBanners(t);
      box.scrollIntoView({ block: "start" });
    };
    $("#clubs").addEventListener("click", e => {
      const c = e.target.closest(".club"); if (!c) return;
      e.preventDefault(); history.replaceState(null, "", "#" + slug(c.dataset.team)); open(c.dataset.team);
    });
    const start = D.teams.find(t => location.hash && slug(t.name) === location.hash.slice(1));
    if (start) open(start.name);
  },

  teams(D) {
    $("#chips").innerHTML = D.teams.map(t => `<a href="#${slug(t.name)}">${crest(t)}${esc(t.name)}</a>`).join("");
    $("#teamlist").innerHTML = D.teams.map(t => `<article class="team" id="${slug(t.name)}" style="${teamVars(t)}">
      <div class="team-head">${crest(t)}<div><h2>${esc(t.name)}</h2>${grade(t.ovr, t.grade)} <span class="dim">team grade</span></div>
        <div class="facts">
          <div class="fact"><b>${t.w}–${t.l}</b><span>Scrims</span></div>
          <div class="fact"><b>${t.squad}/${t.cap}</b><span>Squad</span></div>
          <div class="fact"><b>${money(t.squad_value)}</b><span>Squad value</span></div>
          <div class="fact"><b>${money(t.balance)}</b><span>Budget</span></div>
        </div></div>
      ${t.roster.length ? `<div class="roster">${t.roster.map(card).join("")}</div>` : `<div class="empty">No players yet</div>`}
    </article>`).join("");
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  },

  players(D) {
    const sel = $("#team");
    sel.innerHTML = `<option value="">Every team</option>` + D.teams.map(t => `<option>${esc(t.name)}</option>`).join("") + `<option value="-">No team</option>`;
    const cols = [["name", "Player"], ["team", "Team"], ["pos", "Pos"], ["ovr", "Overall"], ["avg", "Avg rating"],
      ["apps", "Matches"], ["goals", "Goals"], ["assists", "Assists"], ["value", "Value"]];
    let key = "ovr", dir = -1;
    const head = $("#ptable thead tr");
    head.innerHTML = cols.map(([k, l]) => `<th class="${["name", "team", "pos", "ovr"].includes(k) ? "" : "num"}"><button type="button" data-k="${k}">${l}</button></th>`).join("");
    head.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (key === b.dataset.k) dir = -dir; else { key = b.dataset.k; dir = ["name", "team", "pos"].includes(key) ? 1 : -1; }
      render();
    });
    const q = $("#q");
    function render() {
      const t = q.value.trim().toLowerCase(), team = sel.value;
      const list = D.players.filter(p => (!t || (p.name + " " + (p.team || "") + " " + (p.style || "")).toLowerCase().includes(t))
        && (!team || (team === "-" ? !p.team : p.team === team)))
        .sort((a, b) => {
          const x = a[key], y = b[key];
          if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
          return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
        });
      head.querySelectorAll("button").forEach(b => b.dataset.k === key ? b.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending") : b.removeAttribute("aria-sort"));
      $("#ptable tbody").innerHTML = list.map(p => `<tr>
        <td><div class="who">${avatar(p)}<b>${esc(p.name)}</b> ${role(p.role)}</div></td>
        <td>${p.team ? `<a href="teams.html#${slug(p.team)}">${esc(p.team)}</a>` : `<span class="dim">–</span>`}</td>
        <td title="${esc(POS[p.pos] || "")}">${esc(p.pos || "–")}</td><td>${grade(p.ovr, p.grade)}</td>
        <td class="num">${p.avg != null && p.apps ? (+p.avg).toFixed(2) : "–"}</td><td class="num">${p.apps}</td>
        <td class="num">${p.goals}</td><td class="num">${p.assists}</td><td class="num">${p.value != null ? money(p.value) : "–"}</td></tr>`).join("")
        || `<tr><td colspan="9" class="empty">No players match</td></tr>`;
      $("#pcount").textContent = list.length + " of " + D.players.length + " players";
    }
    q.addEventListener("input", render); sel.addEventListener("change", render);
    render();
  },

  market(D) {
    $("#window").innerHTML = windowPill(D);
    const r = D.rules;
    $("#rules").innerHTML = `Every team started with <b>${money(r.start)}</b>. Each official match pays <b>${money(r.win)}</b> to the winner and <b>${money(r.loss)}</b> to the loser, plus bonuses and penalties of up to ±${money(r.bonus_cap)}. A release clause costs ${r.release}× the player's value, and a squad holds up to ${r.squad_cap} players.`;
    const rich = [...D.teams].sort((a, b) => b.balance - a.balance);
    const top = Math.max(1, ...rich.map(t => t.balance));
    $("#bars").innerHTML = rich.map((t, i) => `<div class="bar-row" style="${teamVars(t)}">
      <span class="rank">${i + 1}</span><a class="who" href="teams.html#${slug(t.name)}" style="color:inherit">${crest(t)}<b>${esc(t.name)}</b></a>
      <div class="track"><i style="width:${Math.max(3, Math.max(0, t.balance) / top * 100)}%"></i></div>
      <span class="amt ${t.balance < 0 ? "neg" : ""}">${money(t.balance)}<span class="sm">${t.squad}/${t.cap} players${t.pending ? ` · ${t.pending} deal${t.pending > 1 ? "s" : ""}` : ""}</span></span></div>`).join("");
    const moves = D.teams.flatMap(t => t.money.map(m => ({ ...m, t }))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 14);
    $("#moves").innerHTML = moves.length ? moves.map(m => `<div class="move" style="--c:${m.amount >= 0 ? "var(--green)" : "var(--red)"}">
      <span class="amt ${m.amount >= 0 ? "pos" : "neg"}">${signed(m.amount)}</span><span class="kind">${esc(KIND[m.kind] || m.kind)}</span>
      <span class="mnote"><b>${esc(m.t.name)}</b> · ${esc(m.note || "")}</span><span class="when">${nyDate(m.at)}</span></div>`).join("")
      : `<div class="empty">No money has moved yet</div>`;
    const valued = D.players.filter(p => p.value != null).sort((a, b) => b.value - a.value);
    $("#values").innerHTML = valued.length ? `<div class="tbl"><table><thead><tr><th>Player</th><th>Team</th><th class="num">Value</th><th class="num">Release clause</th></tr></thead><tbody>${
      valued.map(p => `<tr><td><div class="who">${avatar(p)}<b>${esc(p.name)}</b> ${role(p.role)}</div></td><td>${esc(p.team || "–")}</td>
        <td class="num"><b>${money(p.value)}</b></td><td class="num dim">${money(p.value * r.release)}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">No player has been valued yet</div>`;
  },

  guide() {
    const links = [...document.querySelectorAll(".guide nav a")];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".guide main section").forEach(s => io.observe(s));
    const q = $("#q"); if (!q) return;
    let f = "all";
    const apply = () => {
      const t = q.value.trim().toLowerCase(); let n = 0;
      const rows = document.querySelectorAll("#cmds tbody tr");
      rows.forEach(r => { const ok = (f === "all" || r.dataset.w === f) && (!t || r.textContent.toLowerCase().includes(t)); r.hidden = !ok; if (ok) n++; });
      $("#count").textContent = n + " of " + rows.length;
    };
    q.addEventListener("input", apply);
    document.querySelectorAll(".finder button").forEach(b => b.addEventListener("click", () => {
      f = b.dataset.f; document.querySelectorAll(".finder button").forEach(x => x.setAttribute("aria-pressed", x === b)); apply();
    }));
    apply();
  },
};

function card(p) {
  const pos = p.pos ? `${esc(p.pos)} · ${esc(POS[p.pos] || "")}` : "No matches yet";
  return `<div class="card ${p.role}${p.card ? " has-card" : ""}" ${p.card ? `data-key="${esc(p.id)}" data-v="${esc(p.card)}" tabindex="0" role="button" aria-label="${esc(p.name)}: player card"` : ""}>
    <div class="head">${avatar(p)}<div class="nm"><b>${esc(p.name)}</b><small>${pos}</small></div>
      <div class="ovr ${p.grade ? "g-" + esc(p.grade) : "dim"}">${p.ovr ?? "–"}<small>${p.grade ? esc(p.grade) + " · OVR" : "OVR"}</small></div></div>
    <div>${role(p.role)}</div>
    <dl><div><dt>Avg</dt><dd>${p.apps ? (+p.avg).toFixed(2) : "–"}</dd></div><div><dt>Matches</dt><dd>${p.apps}</dd></div>
      <div><dt>Value</dt><dd>${p.value != null ? money(p.value) : "–"}</dd></div></dl></div>`;
}

// ---- team roster as hanging banners (like /team view): Master and New Gen tall on the left, everyone
// else in a grid whose banners get smaller as the squad grows
const BANNER = { "S+": "#e6b325", S: "#e6b325", A: "#7aa2ff", B: "#7aa2ff", C: "#6ee78c", D: "#fad63c", E: "#fa963c", F: "#c882ff", G: "#aaaab9" };
function banner(p, big) {
  const col = p.role === "master" ? "#e6b325" : p.role === "newgen" ? "#22c55e" : (BANNER[p.grade] || "#7a7f99");
  if (!p.name) return `<div class="ban ${big ? "big" : ""} open" style="--bc:${col}"><b class="b-open">OPEN</b><span class="b-lab">${p.role === "master" ? "Master" : "New Gen"} spot</span></div>`;
  const val = p.value != null ? money(p.value) : "–";
  const tag = big ? (p.role === "master" ? `<span class="b-tag box">Master</span>` : `<span class="b-tag">New Gen</span>`) : "";
  const attrs = p.card ? `data-key="${esc(p.id)}" data-v="${esc(p.card)}" role="button" tabindex="0" aria-label="${esc(p.name)}: player card"` : "";
  return `<div class="ban ${big ? "big" : ""} ${p.card ? "has-card" : ""}" style="--bc:${col}" ${attrs}>
    <span class="b-pos">${esc(p.pos || "–")}</span>
    <span class="b-ovr">${p.ovr ?? "–"}<small>/110</small></span>
    <span class="b-pic">${p.avatar ? `<img src="${esc(p.avatar)}" alt="" onerror="this.remove()">` : ""}<i>${initials(p.name)}</i></span>
    <span class="b-name">${esc(p.name)}</span>${tag}
    <span class="b-stats"><span>AVG<b>${p.apps ? (+p.avg).toFixed(2) : "–"}</b></span><span>MATCHES<b>${p.apps}</b></span><span>VALUE<b>${val}</b></span></span>
    <span class="b-grade">${esc(p.grade || "–")}</span></div>`;
}
function rosterBanners(t) {
  const lead = ["master", "newgen"].map(r => t.roster.find(p => p.role === r) || { role: r });
  const rest = t.roster.filter(p => p.role !== "master" && p.role !== "newgen");
  const cols = rest.length <= 8 ? 4 : rest.length <= 10 ? 5 : rest.length <= 12 ? 6 : 7;
  return `<div class="rost" style="${teamVars(t)}">
    <div class="rost-head">${crest(t)}<div><h3>${esc(t.name)}</h3><span class="dim">Roster · ${t.squad} player${t.squad === 1 ? "" : "s"} · ${t.w}–${t.l}</span></div>
      <div class="rost-grade"><span>Team grade</span>${t.ovr != null ? `<b class="g-${esc(t.grade)}">${esc(t.grade)} ${t.ovr}</b>` : "<b>–</b>"}</div></div>
    <div class="rost-body">
      <div class="leaders">${lead.map(p => banner(p, true)).join("")}</div>
      ${rest.length ? `<div class="bgrid" style="--cols:${cols}">${rest.map(p => banner(p, false)).join("")}</div>` : `<div class="empty bgrid-empty">No other players yet</div>`}
    </div>
    <p class="dim rost-foot">Click a player to see their card and skill sheet.</p></div>`;
}

// ---- pop-up: the player's /rating card and skill sheet, drawn by the bot
const CARD_BASE = DATA_URL ? DATA_URL.replace(/data\.json$/, "") : "";
function showCard(el) {
  const key = el.dataset.key, v = el.dataset.v, name = el.getAttribute("aria-label")?.replace(/: player card$/, "") || "";
  let m = $("#cardpop");
  if (!m) {
    document.body.insertAdjacentHTML("beforeend", `<div id="cardpop" class="pop" role="dialog" aria-modal="true" aria-labelledby="pop-title" hidden>
      <div class="pop-box"><div class="pop-top"><b id="pop-title"></b>
        <div class="pop-tabs"><button type="button" data-l="card" aria-pressed="true">Player card</button><button type="button" data-l="sheet" aria-pressed="false">Skill sheet</button></div>
        <button type="button" class="pop-x" aria-label="Close">✕</button></div>
        <div class="pop-img"><img alt=""><p class="pop-msg" hidden>This card isn't available yet. The bot draws it within a few minutes of a player's first match.</p></div></div></div>`);
    m = $("#cardpop");
    m.addEventListener("click", e => {
      if (e.target === m || e.target.closest(".pop-x")) return hideCard();
      const b = e.target.closest(".pop-tabs button"); if (b) setLayout(b.dataset.l);
    });
    $("img", m).addEventListener("error", () => { $("img", m).hidden = true; $(".pop-msg", m).hidden = false; });
    $("img", m).addEventListener("load", () => { $("img", m).hidden = false; $(".pop-msg", m).hidden = true; });
  }
  m.dataset.key = key; m.dataset.v = v;
  $("#pop-title").textContent = name;
  m.hidden = false; document.body.style.overflow = "hidden";
  setLayout("card");
  $(".pop-x", m).focus();
}
function setLayout(l) {
  const m = $("#cardpop");
  m.querySelectorAll(".pop-tabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.l === l));
  const img = $("img", m);
  img.alt = $("#pop-title").textContent + (l === "card" ? " player card" : " skill sheet");
  img.src = `${CARD_BASE}cards/${m.dataset.key}-${l}.webp?v=${encodeURIComponent(m.dataset.v)}`;
}
function hideCard() { const m = $("#cardpop"); if (m) { m.hidden = true; $("img", m).removeAttribute("src"); } document.body.style.overflow = ""; }
document.addEventListener("click", e => { const el = e.target.closest(".has-card"); if (el) showCard(el); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") hideCard();
  const el = e.target.closest?.(".has-card");
  if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showCard(el); }
});

function results(D, n) {
  const list = D.results.slice(0, n);
  if (!list.length) return `<div class="empty">No matches yet</div>`;
  return `<div class="results">${list.map(m => {
    const h = teamOf(D, m.home), a = teamOf(D, m.away), hw = m.home_sets > m.away_sets;
    const side = (t, name, cls) => `${t ? crest(t) : ""}<span>${esc(name)}</span>`;
    return `<div class="res">
      <div class="side ${hw ? "win" : "lose"}">${side(h, m.home)}</div>
      <div class="score">${m.home_sets}–${m.away_sets}<small>${m.home_goals}–${m.away_goals} goals</small></div>
      <div class="side away ${hw ? "lose" : "win"}"><span>${esc(m.away)}</span>${a ? crest(a) : ""}</div>
      <div class="foot"><span>${m.type === "scrim" ? "🏆 Scrim" : "🤝 Friendly"} · ${nyDate(m.at)}</span>${m.potm ? `<span>⭐ ${esc(m.potm.name)} ${(+m.potm.rating).toFixed(1)}</span>` : ""}</div></div>`;
  }).join("")}</div>`;
}

(async () => {
  if (page === "guide") { draw.guide(); }
  try {
    const D = await load();
    $("#updated").textContent = "Updated " + ago(D.updated);
    if (page !== "guide") draw[page](D);
  } catch (e) {
    if (page !== "guide") {
      const m = $("main");
      if (m) m.insertAdjacentHTML("afterbegin", `<div class="note"><b>Couldn't load the league data.</b> The site reads data.json, which the bot updates every few minutes. Try again shortly.</div>`);
    }
  }
})();
