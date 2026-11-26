// Ani's Neo Egoist League website: one script for every page.
// Reads data.json (written by the bot every few minutes, website_export.py) and draws the page named
// in <body data-page="...">. No library, no build step.
"use strict";

const PAGES = [["index.html", "Home", "home"], ["teams.html", "Teams", "teams"], ["players.html", "Players", "players"],
  ["market.html", "Market", "market"], ["traits.html", "Traits", "traits"], ["guide.html", "Guide", "guide"]];
const page = document.body.dataset.page;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = m => { m = +m || 0; return (Math.abs(m - Math.round(m)) < 0.01 ? m.toFixed(0) : m.toFixed(1)) + "M"; };
const signed = m => (m >= 0 ? "+" : "−") + money(Math.abs(m));
const POS = { GK: "Goalkeeper", LM: "Left Mid", RM: "Right Mid", LW: "Left Wing", RW: "Right Wing", CF: "Forward", CM: "Midfielder" };
const KIND = { start: "Start", match: "Match", transfer_in: "Sale", transfer_out: "Signing", fine: "Fine", penalty: "Penalty", admin: "Admin", fortune: "Card", event: "Event", bounty: "Bounty" };

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
    if (D.week && D.week.event) { const p = $("#evpill"); p.hidden = false; p.textContent = "🌍 " + D.week.event; }
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
    $("#album").innerHTML = album(D);
    $("#teamlist").innerHTML = D.teams.map(t => `<article class="team" id="${slug(t.name)}" style="${teamVars(t)}">
      <div class="team-head">${crest(t)}<div><h2>${esc(t.name)}</h2>${grade(t.ovr, t.grade)} <span class="dim">team grade</span></div>
        <div class="facts">
          <div class="fact"><b>${t.w}–${t.l}</b><span>Scrims</span></div>
          <div class="fact"><b>${t.cap ? t.squad + "/" + t.cap : t.squad}</b><span>${t.cap ? "Squad" : "Players"}</span></div>
          <div class="fact"><b>${money(t.squad_value)}</b><span>Squad value</span></div>
          <div class="fact"><b>${money(t.balance)}</b><span>Budget</span></div>
        </div></div>
      ${t.roster.length ? roster(t.roster) : `<div class="empty">No players yet</div>`}
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
      const list = D.players.filter(p => (!t || (p.name + " " + (p.team || "") + " " + (p.style || "") + " " + (p.traits || []).map(x => x[0]).join(" ")).toLowerCase().includes(t))
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

  traits(D) {
    const T = D.traits;
    if (!T) { $("#tlist").innerHTML = `<div class="empty">Traits aren't in the league data yet</div>`; $("#style").innerHTML = ""; return; }
    const CAT = Object.fromEntries(T.categories.map(c => [c.key, c]));
    const byKey = Object.fromEntries(D.players.map(p => [p.id, p]));
    const who = {};                                   // trait name -> players who have it
    D.players.forEach(p => (p.traits || []).forEach(([n]) => (who[n] = who[n] || []).push(p)));
    $("#trules").innerHTML = `Traits are earned from match stats and show on a player's <code>/rating</code> card. Players need <b>${T.min_matches} matches</b> first. "Averages … per match" means their total divided by every match they played.`;
    $("#style-rules").innerHTML = `One holder each: the best player of each main style (<b>${T.style_min_matches}+ matches</b>, highest average rating). A style needs <b>${T.style_min_mains}+ players</b> maining it before its trait exists. At <b>${T.evolve_matches}+ matches</b> and a <b>${(+T.evolve_avg).toFixed(1)}+ average</b> the title evolves.`;
    const gold = CAT.style ? CAT.style.colour : "#d6ac4a";
    $("#style").innerHTML = T.style.map(s => {
      const h = s.holder ? byKey[s.holder] : null;
      const state = h ? (s.is_evolved ? "Evolved" : "Held") : s.mains >= T.style_min_mains ? "Open" : "Locked";
      const body = h
        ? `<div class="who">${avatar(h)}<div><b>${esc(h.name)}</b><small>${esc(h.team || "No team")} · ${(+s.avg).toFixed(2)} avg</small></div></div>`
        : s.mains >= T.style_min_mains
          ? `<p class="dim">No ${esc(s.style)} main has ${T.style_min_matches} matches yet</p>`
          : `<p class="dim">Unlocks when ${T.style_min_mains} players main ${esc(s.style)} (${s.mains}/${T.style_min_mains})</p>`;
      return `<article class="st ${state.toLowerCase()}" style="--tc:${gold}">
        <div class="st-top"><span class="eyebrow">${esc(s.style)}</span><span class="st-state">${state}</span></div>
        <h3>${esc(h && s.title ? s.title : s.name)}</h3>
        <p class="st-evo">${s.is_evolved ? `Evolved from ${esc(s.name)}` : `Evolves into <b>${esc(s.evolved)}</b>`}</p>
        ${body}</article>`;
    }).join("");
    let cat = "all";
    const cats = $("#tcats");
    cats.innerHTML = [["all", "All"], ...T.categories.filter(c => c.key !== "style").map(c => [c.key, c.name])]
      .map(([k, l]) => `<button type="button" data-c="${k}" aria-pressed="${k === cat}">${esc(l)}</button>`).join("");
    cats.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      cat = b.dataset.c; cats.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); render();
    });
    const q = $("#tq");
    function render() {
      const t = q.value.trim().toLowerCase();
      const list = T.list.filter(x => (cat === "all" || x.cat === cat) && (!t || (x.name + " " + x.desc + " " +
        (who[x.name] || []).map(p => p.name).join(" ")).toLowerCase().includes(t)));
      $("#tlist").innerHTML = list.map(x => {
        const c = CAT[x.cat] || { name: x.cat, colour: "#4f8cff" }, ps = who[x.name] || [];
        return `<article class="tr" style="--tc:${c.colour}">
          <div class="st-top"><span class="eyebrow">${esc(c.name)}</span><span class="tr-n">${ps.length ? ps.length + " player" + (ps.length > 1 ? "s" : "") : "Nobody yet"}</span></div>
          <h3>${esc(x.name)}</h3><p>${esc(x.desc)}</p>
          ${ps.length ? `<div class="tr-who">${ps.slice(0, 12).map(p => `<span title="${esc(p.name)}${p.team ? " · " + esc(p.team) : ""}">${avatar(p)}</span>`).join("")}${ps.length > 12 ? `<span class="more">+${ps.length - 12}</span>` : ""}</div>` : ""}
        </article>`;
      }).join("") || `<div class="empty">No traits match</div>`;
      $("#tcount").textContent = list.length + " of " + T.list.length + " traits";
    }
    q.addEventListener("input", render);
    render();
  },

  market(D) {
    $("#window").innerHTML = windowPill(D);
    const W = D.week;
    if (W && (W.event || W.cards.length || W.bounties.length)) {
      $("#week-sec").hidden = false;
      const RAR = { common: ["Common", "#9aa0b4"], rare: ["Rare", "#5b8cff"], legendary: ["Legendary", "#e6b325"], cursed: ["Cursed", "#ff4d5e"] };
      const drawn = new Set(W.cards.map(c => c.team));
      const waiting = D.teams.filter(t => !drawn.has(t.name));
      $("#week").innerHTML = `<div class="wk">
        ${W.event ? `<div class="wk-event"><span class="eyebrow">League event</span><h3>🌍 ${esc(W.event)}</h3><p>${esc(W.text || "")}</p></div>` : ""}
        <div class="wk-cards"><span class="eyebrow">Fortune cards</span>
          ${W.cards.map(c => { const t = teamOf(D, c.team), r = RAR[c.rarity] || RAR.common;
            return `<div class="fcard" style="--rc:${r[1]};${teamVars(t)}">${crest(t)}<div><b>${esc(c.card)}</b><small>${esc(c.team)} · ${r[0]}</small><span class="fres">${esc(c.result)}</span></div></div>`; }).join("")}
          ${waiting.length ? `<p class="dim wk-wait">Not drawn yet: ${waiting.map(t => esc(t.name)).join(", ")}</p>` : ""}
        </div>
        ${W.bounties.length ? `<div class="wk-bounty"><span class="eyebrow">Wanted</span>${W.bounties.map(b => `<div class="wanted">${avatar({ name: b.player, avatar: b.avatar })}
          <div><b>${esc(b.player)}</b><small>${esc(b.team)} · ${b.sponsor ? "Sponsor bounty" : b.by ? "Paid by " + esc(b.by) : "League bounty"}${b.reason ? " · " + esc(b.reason) : ""}</small>
          <small>Beat ${esc(b.team)} with ${esc(b.player)} held scoreless${b.until ? " · until " + esc(b.until) : ""}${b.claimed ? " · <b class=\"pos\">claimed</b>" : ""}</small></div>
          <span class="amt">+${money(b.amount)}</span></div>`).join("")}</div>` : ""}
      </div>`;
    }
    const r = D.rules;
    $("#rules").innerHTML = `Every team started with <b>${money(r.start)}</b>. Each official match pays <b>${money(r.win)}</b> to the winner and <b>${money(r.loss)}</b> to the loser, plus bonuses and penalties of up to ±${money(r.bonus_cap)}. A release clause costs ${r.release}× the player's value${r.squad_cap ? `, and a squad holds up to ${r.squad_cap} players` : ". There's no limit on squad size"}.`;
    const rich = [...D.teams].sort((a, b) => b.balance - a.balance);
    const top = Math.max(1, ...rich.map(t => t.balance));
    $("#bars").innerHTML = rich.map((t, i) => `<div class="bar-row" style="${teamVars(t)}">
      <span class="rank">${i + 1}</span><a class="who" href="teams.html#${slug(t.name)}" style="color:inherit">${crest(t)}<b>${esc(t.name)}</b></a>
      <div class="track"><i style="width:${Math.max(3, Math.max(0, t.balance) / top * 100)}%"></i></div>
      <span class="amt ${t.balance < 0 ? "neg" : ""}">${money(t.balance)}<span class="sm">${t.cap ? t.squad + "/" + t.cap : t.squad} players${t.pending ? ` · ${t.pending} deal${t.pending > 1 ? "s" : ""}` : ""}</span></span></div>`).join("");
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

// the Master and New Gen get their own row of bigger cards on top, everyone else below
function roster(list) {
  const lead = ["master", "newgen"].map(r => list.find(p => p.role === r)).filter(Boolean);
  const rest = list.filter(p => !lead.includes(p));
  return (lead.length ? `<div class="roster-lead">${lead.map(card).join("")}</div>` : "")
    + (rest.length ? `<div class="roster${lead.length ? " under" : ""}">${rest.map(card).join("")}</div>` : "");
}

// a roster player as a small foil trading card (same look as the club album above it):
// club colours for players, gold frame for the Master, green for the New Gen
function card(p) {
  const tag = p.role === "master" ? `<span class="pc-tag m">MASTER</span>` : p.role === "newgen" ? `<span class="pc-tag g">NEW GEN</span>` : "";
  const attrs = p.card ? `data-key="${esc(p.id)}" data-v="${esc(p.card)}" tabindex="0" role="button" aria-label="${esc(p.name)}: player card"` : "";
  return `<div class="pc ${p.role || ""}${p.card ? " has-card" : ""}${p.apps ? "" : " new"}" ${attrs}>
    <div class="pc-card"><div class="pc-in">
      <div class="pc-art">
        <span class="pc-ovr ${p.grade ? "g-" + esc(p.grade) : "none"}"><b>${p.ovr ?? "–"}</b><small>${p.grade ? esc(p.grade) : "OVR"}</small></span>
        ${p.pos ? `<span class="pc-pos">${esc(p.pos)}</span>` : ""}
        ${avatar(p)}${tag}
      </div>
      <div class="pc-name"><span>${esc(p.name)}</span></div>
      <div class="pc-sub">${p.pos ? esc(POS[p.pos] || p.pos) : "No matches yet"}</div>
      <div class="pc-stats"><span><b>${p.apps ? (+p.avg).toFixed(2) : "–"}</b>AVG</span><span><b>${p.apps}</b>MATCHES</span><span><b>${p.value != null ? money(p.value) : "–"}</b>VALUE</span></div>
      <i class="pc-sheen"></i>
    </div></div></div>`;
}

// ---- the club album, like /team view in Discord (team_views.render_album): foil trading cards in one row,
// the best club in the middle and bigger, 2nd on its left, 3rd on its right, and so on outwards
const ALBUM_TITLE = "THE FIVE CLUBS";   // same fixed text as the bot: change it when a team joins
function album(D) {
  const ranked = [...D.teams].sort((a, b) => (a.ovr == null) - (b.ovr == null) || (b.ovr || 0) - (a.ovr || 0) || a.name.localeCompare(b.name));
  const row = [];
  ranked.forEach((t, i) => i % 2 ? row.unshift(t) : row.push(t));
  const card = t => {
    const i = ranked.indexOf(t), rank = t.ovr != null ? i + 1 : null;
    const master = t.roster.find(p => p.role === "master"), gen = t.roster.find(p => p.role === "newgen");
    const code = `<b class="fc-code">${esc(t.short)}</b>`;
    const art = t.crest ? `<img src="crests/${esc(t.crest)}" alt="" onerror="this.outerHTML='${code.replace(/"/g, "&quot;")}'">` : code;
    const who = (lab, cls, p) => `<div class="fc-role"><span class="${cls}">${lab}</span><em class="${p ? "" : "open"}">${p ? esc(p.name) : "Open"}</em></div>`;
    return `<a class="fc${i === 0 ? " lead" : ""}" href="#${slug(t.name)}" style="${teamVars(t)};--ink:${t.colours[2]};--o:${i}" aria-label="${esc(t.name)}: full roster">
      <div class="fc-card"><div class="fc-in">
        <div class="fc-art">${art}<span class="fc-rank">#${rank ?? "–"}</span><span class="fc-grade g-${esc(t.grade || "")}">${esc(t.grade || "–")}</span></div>
        <div class="fc-name"><span>${esc(t.name)}</span></div>
        <div class="fc-ovr">${t.ovr != null ? "TEAM OVR " + t.ovr : "NO GRADE YET"}</div>
        <div class="fc-stats"><span><b>${t.w}-${t.l}</b>RECORD</span><span><b>${t.squad}</b>PLAYERS</span><span><b>${t.squad_value ? +(+t.squad_value).toFixed(1) : "–"}</b>VALUE M</span></div>
        ${who("MASTER", "m", master)}${who("NEW GEN", "g", gen)}
        <i class="fc-sheen"></i>
      </div></div></a>`;
  };
  return `<div class="album-head"><h2>${ALBUM_TITLE}</h2><p>Ani's Neo Egoist League · Team collection</p></div>
    <div class="album-row">${row.map(card).join("")}</div>
    <p class="album-foot"><span class="dt">#1 in the middle · click a club for its full roster</span><span class="ph">#1 on top · tap a club for its full roster</span></p>`;
}

// ---- team roster as hanging banners (like /team view): Master and New Gen tall on the left, everyone
// else in a grid whose banners get smaller as the squad grows
const BANNER = { "S+": "#e6b325", S: "#e6b325", A: "#7aa2ff", B: "#7aa2ff", C: "#6ee78c", D: "#fad63c", E: "#fa963c", F: "#c882ff", G: "#aaaab9" };
function banner(p, big, delay = 0) {
  const d = `;--d:${delay.toFixed(2)}s`;
  const col = p.role === "master" ? "#e6b325" : p.role === "newgen" ? "#22c55e" : (BANNER[p.grade] || "#7a7f99");
  if (!p.name) return `<div class="ban ${big ? "big" : ""} open" style="--bc:${col}${d}"><b class="b-open">OPEN</b><span class="b-lab">${p.role === "master" ? "Master" : "New Gen"} spot</span></div>`;
  const val = p.value != null ? money(p.value) : "–";
  const tag = big ? (p.role === "master" ? `<span class="b-tag box">Master</span>` : `<span class="b-tag">New Gen</span>`) : "";
  const attrs = p.card ? `data-key="${esc(p.id)}" data-v="${esc(p.card)}" role="button" tabindex="0" aria-label="${esc(p.name)}: player card"` : "";
  return `<div class="ban ${big ? "big" : ""} ${p.card ? "has-card" : ""}" style="--bc:${col}${d}" ${attrs}>
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
      <div class="leaders">${lead.map((p, i) => banner(p, true, i * .09)).join("")}</div>
      ${rest.length ? `<div class="bgrid" style="--cols:${cols}">${rest.map((p, i) => banner(p, false, .18 + Math.min(i, 16) * .05)).join("")}</div>` : `<div class="empty bgrid-empty">No other players yet</div>`}
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
    $("img", m).addEventListener("load", () => { $("img", m).hidden = false; $(".pop-msg", m).hidden = true; $("img", m).classList.remove("swap"); });
    $("img", m).addEventListener("error", () => $("img", m).classList.remove("swap"));
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
  const src = `${CARD_BASE}cards/${m.dataset.key}-${l}.webp?v=${encodeURIComponent(m.dataset.v)}`;
  if (!MOTION || !img.getAttribute("src")) { img.src = src; return; }
  img.classList.add("swap");
  setTimeout(() => { img.onload = () => { img.classList.remove("swap"); img.onload = null; }; img.src = src; }, 160);
}
function hideCard() {
  const m = $("#cardpop"); if (!m || m.hidden) return;
  const done = () => { m.classList.remove("closing"); m.hidden = true; $("img", m).removeAttribute("src"); document.body.style.overflow = ""; };
  if (!MOTION) return done();
  m.classList.add("closing"); setTimeout(done, 170);
}
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

// ---- motion: scroll reveal with a stagger, and numbers that count up. Off when the visitor asks for reduced motion.
const MOTION = !matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window;
const REVEAL = ".fc, .album-head, section > h2, section > .sub, .club, .pc, .res, .bar-row, .move, .fcard, .wanted, .box, .tbl tbody tr, .wk-event, .chips a";
const COUNT = ".club .stats b, .fact b, .bar-row .amt, .wanted .amt, .pc-ovr b, .rost-grade b, td.num b";
const seen = new WeakSet();
const io = MOTION ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  e.target.classList.add("in");
  e.target.querySelectorAll?.(COUNT).forEach(countUp);
  if (e.target.matches(COUNT)) countUp(e.target);
}), { rootMargin: "0px 0px -4% 0px", threshold: 0 }) : null;
function countUp(el) {
  if (seen.has(el)) return; seen.add(el);
  const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue));
  if (!node) return;
  const m = node.nodeValue.match(/^(\D*?)(-?\d+(?:\.\d+)?)(\D*)$/);   // one number only ("3–1" records are left alone)
  if (!m) return;
  const end = parseFloat(m[2]), dec = (m[2].split(".")[1] || "").length, t0 = performance.now(), dur = 900;
  if (!end) return;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), v = end * (1 - Math.pow(1 - k, 3));
    node.nodeValue = m[1] + v.toFixed(dec) + m[3];
    if (k < 1) requestAnimationFrame(step); else node.nodeValue = m[1] + m[2] + m[3];
  };
  requestAnimationFrame(step);
}
function reveal(root = document) {
  if (!MOTION) return;
  const els = [...root.querySelectorAll(REVEAL)].filter(el => !el.classList.contains("rv"));
  const idx = new Map();
  els.forEach(el => {
    const i = idx.get(el.parentNode) || 0; idx.set(el.parentNode, i + 1);
    el.style.setProperty("--d", Math.min(i, 12) * .05 + "s");
    el.classList.add("rv"); io.observe(el);
  });
  root.querySelectorAll?.(".track i").forEach((el, i) => el.style.setProperty("--d", .1 + Math.min(i, 12) * .06 + "s"));
  root.querySelectorAll?.(".rost " + COUNT.split(", ").join(", .rost ")).forEach(countUp);
}
if (MOTION) new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length)) reveal(); })
  .observe(document.body, { childList: true, subtree: true });

(async () => {
  reveal();
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
