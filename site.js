// Ani's Neo Egoist League website: one script for every page.
// Reads data.json (written by the bot every few minutes, website_export.py) and draws the page named
// in <body data-page="...">. No library, no build step.
"use strict";

const PAGES = [["index.html", "Home", "home"], ["fixtures.html", "Fixtures", "fixtures"], ["matches.html", "Matches", "matches"],
  ["teams.html", "Teams", "teams"], ["players.html", "Players", "players"], ["market.html", "Market", "market"],
  ["traits.html", "Traits", "traits"], ["news.html", "News", "news"], ["records.html", "Records", "records"], ["guide.html", "Guide", "guide"]];
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
      <thead><tr><th>#</th><th>Club</th><th class="num">P</th><th class="num">W</th><th class="num">L</th><th class="num">SD</th><th class="num">GD</th><th class="num">Pts</th><th>Form</th><th>Grade</th></tr></thead>
      <tbody>${rows.map((t, i) => `<tr class="${i === 0 && t.p ? "lead" : ""}"><td class="rank">${i + 1}</td>
        <td><a class="who" href="teams.html#${slug(t.name)}" style="color:inherit">${crest(t)}<b>${esc(t.name)}</b></a></td>
        <td class="num">${t.p}</td><td class="num">${t.w}</td><td class="num">${t.l}</td>
        <td class="num">${t.sd > 0 ? "+" : ""}${t.sd}</td><td class="num">${t.gd > 0 ? "+" : ""}${t.gd}</td>
        <td class="num"><b>${t.pts}</b></td><td>${formDots(D, t.name)}</td><td>${grade(t.ovr, t.grade)}</td></tr>`).join("")}</tbody></table></div>`;
    const nx = (D.fixtures || []).find(f => f.kickoff + 2 * 3600 > Date.now() / 1000 && !f.result);
    if (nx) { const p = $("#nextpill"); p.hidden = false; p.innerHTML = `⚽ Next: ${esc(nx.home)} vs ${esc(nx.away)} · <span data-ko="${nx.kickoff}">${until(nx.kickoff)}</span>`; tick(); }
    const top = D.players.filter(p => p.ovr != null).sort((a, b) => b.ovr - a.ovr || b.avg - a.avg).slice(0, 8);
    $("#top").innerHTML = top.length ? `<div class="tbl"><table><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Overall</th></tr></thead><tbody>${
      top.map((p, i) => `<tr class="${i === 0 ? "lead" : ""}"><td class="rank">${i + 1}</td>
        <td><div class="who">${avatar(p)}<div style="min-width:0"><b>${pLink(p, esc(p.name))}</b><div class="dim" style="font-size:12px">${esc(p.team || "No team")}</div></div></div></td>
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
        <td><div class="who">${avatar(p)}<b>${pLink(p, esc(p.name))}</b> ${role(p.role)}</div></td>
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
    const T = D.traits, main = $("#tc-main"), rail = $("#tc-rail");
    if (!T) { main.innerHTML = `<div class="empty">Traits aren't in the league data yet</div>`; return; }
    const CAT = Object.fromEntries(T.categories.map(c => [c.key, c]));
    const byKey = Object.fromEntries(D.players.map(p => [p.id, p]));
    const who = {};                                   // trait name -> players who have it
    D.players.forEach(p => (p.traits || []).forEach(([n, c]) => { if (c !== "style") (who[n] = who[n] || []).push(p); }));
    const short = { attack: "ATT", passing: "PAS", dribbling: "DRI", defending: "DEF", goalkeeping: "GOA", mentality: "REP", style: "STY" };
    const GOLD = "#f5c442", BLUE = "#60a5fa", ORANGE = "#fb923c", RED = "#ef4444";
    $("#trules").innerHTML = `Traits are earned from match stats and show on a player's <code>/rating</code> card (players need <b>${T.min_matches} matches</b> first). Pick a category on the left, or pick a player to see their own progress.`;

    // one entry per trait, the same shape for stat traits and style traits
    const items = T.list.map(x => ({ key: x.name, name: x.name, cat: x.cat, desc: x.desc, players: who[x.name] || [] }));
    T.style.forEach(s => {
      const h = s.holder ? byKey[s.holder] : null;
      items.push({ key: "S:" + s.style, name: h && s.title ? s.title : s.name, cat: "style", style: s, holder: h, players: h ? [h] : [],
        state: h ? (s.is_evolved ? "evolved" : "held") : s.mains >= T.style_min_mains ? "open" : "locked",
        desc: `${s.style} style. ${s.is_evolved ? `Evolved from ${s.name}.` : `Evolves into ${s.evolved} at ${T.evolve_matches}+ matches and a ${(+T.evolve_avg).toFixed(1)}+ average.`}` });
    });
    const keys = T.categories.map(c => c.key);
    const people = D.players.filter(p => p.tp).sort((a, b) => a.name.localeCompare(b.name));
    let cur = { k: "overview", p: null };

    // a player's view of one trait: [code, frac, why] (e earned, p progress, g gate, b blocked, n no data, x n/a, o other)
    const tpOf = (p, e) => (p && p.tp && p.tp[e.key]) || ["x", null, "Not tracked"];
    const applies = c => c !== "x" && c !== "o";
    function stat(k, p) {
      const es = items.filter(e => e.cat === k);
      if (!p) return { total: es.length, have: es.filter(e => e.players.length).length };
      const cs = es.map(e => tpOf(p, e)[0]);
      return { total: cs.filter(applies).length, have: cs.filter(c => c === "e").length };
    }
    function totals(p) { return keys.reduce((a, k) => { const s = stat(k, p); a.total += s.total; a.have += s.have; return a; }, { total: 0, have: 0 }); }

    const seg = (n, of, col) => `<span class="tc-seg">${Array.from({ length: of }, (_, i) => `<i style="${i < n ? `background:${col}` : ""}"></i>`).join("")}</span>`;
    const bar = (f, col) => `<span class="tc-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:${col}"></i></span>`;
    const emblem = (name, col, on) => `<span class="tc-emb${on ? " on" : ""}" style="--ec:${col}">${esc((name.replace(/^the /i, "")[0] || "?").toUpperCase())}</span>`;
    const avatars = ps => ps.length ? `<span class="tc-who">${ps.slice(0, 10).map(p => `<span title="${esc(p.name)}${p.team ? " · " + esc(p.team) : ""}">${avatar(p)}</span>`).join("")}${ps.length > 10 ? `<em>+${ps.length - 10}</em>` : ""}</span>` : "";

    function drawRail() {
      const p = cur.p, s0 = cur.k;
      rail.innerHTML = `<div class="tc-brand">TRAITS</div>
        <label class="tc-pick"><span>PLAYER</span><select id="tc-player" aria-label="Show a player's traits">
          <option value="">Everyone (the league)</option>
          ${people.map(x => `<option value="${esc(x.id)}"${p && p.id === x.id ? " selected" : ""}>${esc(x.name)}${x.team ? " · " + esc(x.team) : ""}</option>`).join("")}
        </select></label>
        <button type="button" class="tc-ov${s0 === "overview" ? " sel" : ""}" data-k="overview">OVERVIEW</button>` +
        keys.map(k => { const c = CAT[k], s = stat(k, p);
          return `<button type="button" class="tc-cat${s0 === k ? " sel" : ""}${p && !s.total ? " off" : ""}" data-k="${k}" style="--cc:${c.colour}">
            <span class="tc-cn">${esc(c.name.toUpperCase())}</span><span class="tc-cc">${p && !s.total ? "N/A" : s.have + "/" + s.total}</span>${seg(s.have, Math.min(s.total || 1, 20), c.colour)}</button>`; }).join("");
      $("#tc-player").addEventListener("change", ev => go(cur.k, ev.target.value || null));
    }

    function module(e) {
      const c = CAT[e.cat], col = c.colour, p = cur.p, s = e.style, h = e.holder;
      let word, cls = "", extra = "";
      if (p) {
        const [code, frac, why] = tpOf(p, e);
        const st = e.cat === "style";
        word = { e: st && s && s.is_evolved && h && h.id === p.id ? "EVOLVED" : "EARNED", p: `IN PROGRESS ${Math.round((frac || 0) * 100)}%`,
          g: "MATCH GATE", b: st ? "HELD BY ANOTHER" : "BLOCKED", n: st ? "LOCKED" : "NO DATA YET",
          x: st ? "OTHER STYLE" : "NOT FOR THIS ROLE", o: "OTHER STYLE" }[code];
        cls = code === "e" ? "on" : applies(code) ? { p: "prog", g: "gate", b: "blk" }[code] || "" : "na";
        if (code === "p" || code === "g") extra = bar(frac || 0, code === "g" ? ORANGE : BLUE);
        if (why && code !== "x") extra += `<p class="tc-why ${code === "b" ? "bad" : ""}">&gt; ${esc(why)}</p>`;
        if (st && h && code !== "e" && code !== "x") extra += `<p class="tc-why on">&gt; Holder: ${esc(h.name)} · ${(+s.avg).toFixed(2)} avg</p>`;
      } else if (e.cat === "style") {
        word = { evolved: "EVOLVED", held: "HELD", open: "OPEN", locked: "LOCKED" }[e.state];
        cls = e.state === "evolved" || e.state === "held" ? "on" : e.state === "locked" ? "na" : "";
        extra = h ? `<p class="tc-why on">&gt; ${esc(h.name)} · ${esc(h.team || "No team")} · ${(+s.avg).toFixed(2)} avg</p>`
          : s.mains >= T.style_min_mains ? `<p class="tc-why">&gt; No ${esc(s.style)} main has ${T.style_min_matches} matches yet</p>`
          : `<p class="tc-why">&gt; Unlocks when ${T.style_min_mains} players main ${esc(s.style)} (${s.mains}/${T.style_min_mains})</p>`;
      } else { const n = e.players.length; word = n ? `EARNED BY ${n}` : "NOBODY YET"; cls = n ? "on" : ""; }
      return `<article class="tc-mod ${cls}" style="--mc:${col}"><div class="tc-in">
        <div class="tc-head"><span class="tc-mark"></span>${emblem(e.name, col, cls === "on")}<h3>${esc(e.name.toUpperCase())}</h3><span class="tc-word">${word}</span></div>
        <p class="tc-desc">${esc(e.desc)}</p>${extra}${e.cat === "style" || (p && cls !== "on") ? "" : avatars(e.players)}</div></article>`;
    }

    function top(title) {
      const p = cur.p, t = totals(p);
      if (!p) return `<div class="tc-top"><div><div class="tc-kick">TACTICAL CONSOLE · ${esc(title)}</div><div class="tc-title">${esc((D.league || "Neo Egoist League").toUpperCase())}</div>
        <div class="tc-meta">THE WHOLE LEAGUE · ${D.players.length} PLAYERS</div></div>
        <div class="tc-score"><b>${t.have} / ${t.total}</b><small>TRAITS HELD IN THE LEAGUE</small></div></div>`;
      const held = items.find(e => e.cat === "style" && tpOf(p, e)[0] === "e");
      return `<div class="tc-top"><div><div class="tc-kick">TACTICAL CONSOLE · ${esc(title)}</div>
        <div class="tc-title tc-pl">${avatar(p)}<span>${esc(p.name.toUpperCase())}</span></div>
        <div class="tc-meta">${esc((p.team || "No team").toUpperCase())} · ${p.apps} MATCH${p.apps === 1 ? "" : "ES"}${p.pos ? " · " + esc(p.pos) : ""}${p.style ? " · " + esc(p.style.toUpperCase()) : ""}</div>
        ${held ? `<div class="tc-meta" style="color:${CAT.style.colour}">STYLE TRAIT · ${esc(held.name.toUpperCase())}</div>` : ""}</div>
        <div class="tc-score"><b>${t.have} / ${t.total}</b><small>EARNED / APPLICABLE</small></div></div>`;
    }

    function ring(p) {
      const R = 120, C = 2 * Math.PI * R, n = keys.length, gap = 10, t = totals(p);
      const arcs = keys.map((k, i) => { const s = stat(k, p), col = CAT[k].colour, len = C / n - gap;
        const rot = -90 + i * 360 / n + (gap / C) * 180, lab = (-90 + (i + .5) * 360 / n) * Math.PI / 180;
        return `<circle r="${R}" cx="160" cy="160" fill="none" stroke="#182234" stroke-width="30" stroke-dasharray="${len} ${C}" transform="rotate(${rot} 160 160)"/>
          ${s.have && s.total ? `<circle r="${R}" cx="160" cy="160" fill="none" stroke="${col}" stroke-width="30" stroke-dasharray="${len * s.have / s.total} ${C}" transform="rotate(${rot} 160 160)" class="tc-arc"/>` : ""}
          <text x="${160 + (R + 32) * Math.cos(lab)}" y="${160 + (R + 32) * Math.sin(lab)}" fill="${s.total ? col : "#46506a"}" class="tc-al">${short[k]}</text>`; }).join("");
      const sub = p ? `OF ${t.total} APPLICABLE` : `OF ${t.total} TRAITS HELD`;
      const mono = p ? `${items.length} traits in game` : `${D.players.filter(x => (x.traits || []).length).length} players with a trait`;
      return `<svg viewBox="-20 -20 360 360" role="img" aria-label="${t.have} ${sub.toLowerCase()}">${arcs}
        <text x="160" y="170" class="tc-big">${t.have}</text><text x="160" y="212" class="tc-sub">${sub}</text><text x="160" y="236" class="tc-mono">${mono}</text></svg>`;
    }

    function overview() {
      const p = cur.p;
      if (p) {
        const gate = p.apps < T.min_matches;
        const next = items.filter(e => ["p", "g"].includes(tpOf(p, e)[0]))
          .sort((a, b) => (tpOf(p, a)[0] === "g" ? 0 : 1) - (tpOf(p, b)[0] === "g" ? 0 : 1) || (tpOf(p, b)[1] || 0) - (tpOf(p, a)[1] || 0)).slice(0, 4);
        return top("OVERVIEW") + `<div class="tc-ov-grid"><div class="tc-ring">${ring(p)}
            <div class="tc-gate" style="--mc:${gate ? ORANGE : "#3cc88c"}"><div class="tc-in"><div class="tc-head"><h3 style="color:${gate ? ORANGE : "#3cc88c"}">MATCH GATE</h3><span class="tc-word" style="color:${gate ? ORANGE : "#3cc88c"}">${gate ? "LOCKED" : "CLEARED"}</span></div>
              ${seg(Math.min(p.apps, T.min_matches), T.min_matches, gate ? ORANGE : "#3cc88c")}<p class="tc-desc">${Math.min(p.apps, T.min_matches)}/${T.min_matches} matches${gate ? " · traits unlock at " + T.min_matches : ""}</p></div></div></div>
          <div><div class="tc-sec"><span>NEXT OBJECTIVES</span><small>progress = weakest requirement</small></div>
            ${next.length ? next.map(module).join("") : `<div class="tc-mod"><div class="tc-in"><h3>NOTHING IN PROGRESS</h3><p class="tc-desc">Every trait that fits is earned, or there's no data yet.</p></div></div>`}</div></div>`;
      }
      const most = items.filter(e => e.cat !== "style" && e.players.length).sort((a, b) => b.players.length - a.players.length).slice(0, 4);
      const held = T.style.filter(s => s.holder).length;
      return top("OVERVIEW") + `<div class="tc-ov-grid"><div class="tc-ring">${ring(null)}
          <div class="tc-gate"><div class="tc-in"><div class="tc-head"><h3 style="color:${CAT.style.colour}">STYLE TRAITS</h3><span class="tc-word" style="color:${CAT.style.colour}">${held}/20 HELD</span></div>
            ${seg(held, 20, CAT.style.colour)}<p class="tc-desc">One holder per style · ${T.style_min_mains}+ mains to unlock · evolves at ${T.evolve_matches}+ matches and ${(+T.evolve_avg).toFixed(1)}+ avg</p></div></div></div>
        <div><div class="tc-sec"><span>MOST HELD TRAITS</span><small>pick a player to see their progress</small></div>
          ${most.length ? most.map(module).join("") : `<div class="tc-mod"><div class="tc-in"><h3>NO TRAITS EARNED YET</h3><p class="tc-desc">Players need ${T.min_matches} matches before any trait shows.</p></div></div>`}</div></div>`;
    }

    function category(k) {
      return top(CAT[k].name.toUpperCase()) + `<div class="tc-filter"><input id="tc-q" type="search" placeholder="${cur.p ? "Search a trait" : "Search a trait or a player"}" aria-label="Search traits"></div><div class="tc-list" id="tc-list"></div>`;
    }

    function go(k, pid) {
      if (k !== "overview" && !CAT[k]) k = "overview";
      cur = { k, p: pid ? byKey[pid] || null : null };
      if (cur.p && !cur.p.tp) cur.p = null;
      drawRail();
      main.innerHTML = k === "overview" ? overview() : category(k);
      if (k !== "overview") {
        const q = $("#tc-q"), list = $("#tc-list");
        const order = { e: 0, p: 1, g: 2, b: 3, n: 4, o: 5, x: 6 };
        const fill = () => {
          const t = q.value.trim().toLowerCase();
          let es = items.filter(e => e.cat === k && (!t || (e.name + " " + e.desc + " " + e.players.map(x => x.name).join(" ")).toLowerCase().includes(t)));
          if (cur.p) es = es.sort((a, b) => order[tpOf(cur.p, a)[0]] - order[tpOf(cur.p, b)[0]] || (tpOf(cur.p, b)[1] || 0) - (tpOf(cur.p, a)[1] || 0));
          list.innerHTML = es.map(module).join("") || `<div class="empty">No traits match</div>`;
        };
        q.addEventListener("input", fill); fill();
      }
      const h = "#" + k + (cur.p ? "/p-" + cur.p.id : "");
      if (location.hash !== h) history.replaceState(null, "", h);
    }
    const parse = () => { const [k, p] = location.hash.slice(1).split("/p-"); return [k || "overview", p || null]; };
    rail.addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (b) { go(b.dataset.k, cur.p && cur.p.id); if (innerWidth < 760) rail.scrollIntoView({ block: "start" }); } });
    addEventListener("hashchange", () => go(...parse()));
    go(...parse());
  },

  fixtures(D) {
    const FX = D.fixtures || [];
    if (!FX.length) { $("#fx").innerHTML = `<div class="empty">No fixtures on the schedule yet</div>`; }
    const weeks = [...new Set(FX.map(f => f.week))];
    const now = Date.now() / 1000;
    const upcoming = FX.find(f => f.kickoff + 2 * 3600 > now);
    let wk = +((location.hash.match(/^#w(\d+)/) || [])[1]) || (upcoming ? upcoming.week : weeks[weeks.length - 1]);
    const tabs = $("#wk-tabs");
    const drawWeek = () => {
      tabs.innerHTML = weeks.map(w => `<button type="button" data-w="${w}" aria-pressed="${w === wk}">Week ${w}</button>`).join("");
      const days = ["FRIDAY", "SATURDAY", "SUNDAY"].map(d => [d, FX.filter(f => f.week === wk && f.day === d)]).filter(([, l]) => l.length);
      $("#fx").innerHTML = days.map(([d, list]) => `<div class="fx-day"><div class="fx-dh"><b>${d}</b><span>${esc(new Date(list[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }))} · all times EST</span></div>
        ${list.map(fixtureCard.bind(null, D)).join("")}</div>`).join("") || `<div class="empty">No matches this week</div>`;
    };
    tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; wk = +b.dataset.w; history.replaceState(null, "", "#w" + wk); drawWeek(); });
    drawWeek();
    const sel = $("#cal-team");
    sel.innerHTML = `<option value="">Every match</option>` + D.teams.map(t => `<option>${esc(t.name)}</option>`).join("");
    $("#cal-btn").addEventListener("click", () => downloadIcs(FX, sel.value));
    const P = D.predictions || [], pts = D.points || { exact: 3, right: 1 };
    $("#prules").innerHTML = `Use <code>/predict pick</code> in Discord before kick-off. <b>${pts.exact} points${pts.ec ? ` + ${pts.ec.exact} EC` : ""}</b> for the exact score in sets, <b>${pts.right} point${pts.ec ? ` + ${pts.ec.winner} EC` : ""}</b> for the right winner. <code>/predict table</code> shows this table in Discord.`;
    $("#ptab").innerHTML = P.length ? `<div class="tbl"><table><thead><tr><th>#</th><th>Predictor</th><th class="num">Points</th><th class="num">Exact</th><th class="num">Winners</th><th class="num">Picks</th></tr></thead><tbody>${
      P.map((p, i) => `<tr class="${i === 0 && p.pts ? "lead" : ""}"><td class="rank">${i + 1}</td><td><div class="who">${avatar(p)}<b>${esc(p.name)}</b></div></td>
        <td class="num"><b>${p.pts}</b></td><td class="num">${p.exact}</td><td class="num">${p.right}/${p.played}</td><td class="num">${p.n}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">Nobody has predicted yet. Be the first with <code>/predict pick</code></div>`;
    tick();
  },

  matches(D) {
    const M = (D.matches || []).slice().reverse();
    // form guide + head to head
    $("#form").innerHTML = `<div class="tbl"><table><thead><tr><th>Club</th><th>Last 5 official</th></tr></thead><tbody>${
      standings(D).map(t => `<tr><td><span class="who">${crest(t)}<b>${esc(t.short || t.name)}</b></span></td><td>${formDots(D, t.name)}</td></tr>`).join("")}</tbody></table></div>`;
    const a = $("#h2h-a"), b = $("#h2h-b");
    const opts = D.teams.map(t => `<option>${esc(t.name)}</option>`).join("");
    a.innerHTML = opts; b.innerHTML = opts; if (D.teams[1]) b.value = D.teams[1].name;
    const h2h = () => {
      const x = a.value, y = b.value;
      if (x === y) { $("#h2h").innerHTML = `<p class="dim">Pick two different clubs.</p>`; return; }
      const ms = M.filter(m => m.type === "scrim" && [m.home, m.away].includes(x) && [m.home, m.away].includes(y));
      const wx = ms.filter(m => winner(m) === x).length, wy = ms.filter(m => winner(m) === y).length;
      const sx = ms.reduce((s, m) => s + (m.home === x ? sets(m)[0] : sets(m)[1]), 0), sy = ms.reduce((s, m) => s + (m.home === y ? sets(m)[0] : sets(m)[1]), 0);
      const tx = teamOf(D, x), ty = teamOf(D, y);
      $("#h2h").innerHTML = `<div class="h2h-score"><span>${crest(tx)}<b>${wx}</b></span><small>${ms.length} official match${ms.length === 1 ? "" : "es"}<br>sets ${sx}–${sy}</small><span><b>${wy}</b>${crest(ty)}</span></div>
        ${ms.slice(0, 5).map(m => `<a class="h2h-row" href="#m-${m.id}"><span>${esc(m.home)} <b>${sets(m)[0]}–${sets(m)[1]}</b> ${esc(m.away)}</span><small>${nyDate(m.at)}</small></a>`).join("") || `<p class="dim">They haven't met yet.</p>`}`;
    };
    a.addEventListener("change", h2h); b.addEventListener("change", h2h); h2h();
    // the list
    const ft = $("#mf-team"), fy = $("#mf-type");
    ft.innerHTML = `<option value="">Every club</option>` + opts;
    const list = () => {
      const t = ft.value, y = fy.value;
      const ms = M.filter(m => (!t || m.home === t || m.away === t) && (!y || m.type === y));
      $("#mlist").innerHTML = ms.length ? `<div class="results">${ms.map(m => matchTile(D, m)).join("")}</div>` : `<div class="empty">No matches yet</div>`;
    };
    ft.addEventListener("change", list); fy.addEventListener("change", list); list();
    const show = () => {
      const id = +((location.hash.match(/^#m-(\d+)/) || [])[1]);
      const m = id && M.find(x => x.id === id), box = $("#mdetail");
      $("#mbrowse").hidden = !!m; box.hidden = !m;
      if (m) { box.innerHTML = matchDetail(D, m); scrollTo({ top: 0 }); }
    };
    addEventListener("hashchange", show); show();
  },

  player(D) {
    const people = D.players.filter(p => p.apps || p.team).sort((a, b) => a.name.localeCompare(b.name));
    const s1 = $("#pp-sel"), s2 = $("#pp-cmp");
    s1.innerHTML = people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.team ? " · " + esc(p.team) : ""}</option>`).join("");
    s2.innerHTML = `<option value="">Nobody</option>` + s1.innerHTML;
    const byId = Object.fromEntries(D.players.map(p => [p.id, p]));
    const MID = Object.fromEntries((D.matches || []).map(m => [m.id, m]));
    const go = () => {
      const [a, b] = location.hash.slice(1).split("/vs-");
      const p = byId[a] || people.find(x => x.apps) || people[0], q = b ? byId[b] : null;
      if (!p) { $("#pp").innerHTML = `<div class="empty">No players yet</div>`; return; }
      s1.value = p.id; s2.value = q ? q.id : "";
      $("#pp").innerHTML = profile(D, p, q, MID);
    };
    const set = () => { const h = "#" + s1.value + (s2.value && s2.value !== s1.value ? "/vs-" + s2.value : ""); if (location.hash !== h) location.hash = h; else go(); };
    s1.addEventListener("change", set); s2.addEventListener("change", set);
    addEventListener("hashchange", go); go();
  },

  news(D) {
    const N = D.news || [];
    const KINDS = { poster: "Matchday posters", fortune: "Fortune Edition", quote: "Mixed zone quotes", totw: "Team of the Week", awards: "Season awards" };
    let f = "";
    const chips = $("#nchips");
    const have = Object.keys(KINDS).filter(k => N.some(n => n.kind === k));
    chips.innerHTML = [["", "Everything"], ...have.map(k => [k, KINDS[k]])].map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === f}">${esc(l)}</button>`).join("");
    const paint = () => {
      const list = N.filter(n => !f || n.kind === f);
      $("#ngrid").innerHTML = list.length ? list.map((n, i) => `<button type="button" class="news" data-i="${N.indexOf(n)}">
          <img src="${CARD_BASE}${esc(n.file)}" alt="${esc(n.title)}" loading="lazy" ${n.w ? `width="${n.w}" height="${n.h}"` : ""}>
          <span><b>${esc(n.title)}</b><small>${esc(KINDS[n.kind] || n.kind)} · ${new Date(n.at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></span></button>`).join("")
        : `<div class="empty">Nothing here yet. Everything the bot posts on the league server (posters, Fortune pages, quote cards, Team of the Week) shows up here.</div>`;
    };
    chips.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; f = b.dataset.k; chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); paint(); });
    $("#ngrid").addEventListener("click", e => {
      const b = e.target.closest(".news"); if (!b) return;
      const n = N[+b.dataset.i];
      document.body.insertAdjacentHTML("beforeend", `<div class="pop" id="newspop" role="dialog" aria-modal="true" aria-label="${esc(n.title)}"><div class="pop-box"><div class="pop-top"><b>${esc(n.title)}</b><button type="button" class="pop-x" aria-label="Close">✕</button></div><div class="pop-img"><img src="${CARD_BASE}${esc(n.file)}" alt="${esc(n.title)}"></div></div></div>`);
      const m = $("#newspop"); document.body.style.overflow = "hidden"; $(".pop-x", m).focus();
      const close = () => { m.remove(); document.body.style.overflow = ""; b.focus(); };
      m.addEventListener("click", ev => { if (ev.target === m || ev.target.closest(".pop-x")) close(); });
      m.addEventListener("keydown", ev => { if (ev.key === "Escape") close(); });
    });
    paint();
  },

  records(D) {
    const byId = Object.fromEntries(D.players.map(p => [p.id, p]));
    const M = (D.matches || []).filter(m => m.type === "scrim");
    const rec = [];
    const rows = M.flatMap(m => m.players.map(r => ({ ...r, m })));
    const top = (arr, key) => arr.reduce((b, x) => (b == null || key(x) > key(b) ? x : b), null);
    const r1 = top(rows, r => r.rating);
    if (r1) rec.push(["Highest match rating", (+r1.rating).toFixed(2), r1, r1.m]);
    const r2 = top(rows.filter(r => r.g), r => r.g);
    if (r2) rec.push(["Most goals in a match", r2.g, r2, r2.m]);
    const r3 = top(rows.filter(r => r.a), r => r.a);
    if (r3) rec.push(["Most assists in a match", r3.a, r3, r3.m]);
    const r4 = top(rows.filter(r => r.sv), r => r.sv);
    if (r4) rec.push(["Most saves in a match", r4.sv, r4, r4.m]);
    const big = top(M, m => Math.abs(sets(m)[0] - sets(m)[1]) * 100 + Math.abs(m.hg - m.ag));
    if (big) rec.push(["Biggest win", `${sets(big)[0]}–${sets(big)[1]}`, { name: winner(big) }, big]);
    const goals = top(M, m => m.hg + m.ag);
    if (goals) rec.push(["Highest-scoring match", `${goals.hg + goals.ag} goals`, { name: `${goals.home} v ${goals.away}` }, goals]);
    const comeback = M.filter(m => m.tags.includes("remontada_won")).pop();
    if (comeback) rec.push(["Latest remontada", `${Math.max(...sets(comeback))}–${Math.min(...sets(comeback))}`, { name: winner(comeback) }, comeback]);
    const motm = {}, hat = {};
    M.forEach(m => { if (m.players[0]) motm[m.players[0].id] = (motm[m.players[0].id] || 0) + 1; m.players.forEach(r => { if (r.g >= 3) hat[r.id] = (hat[r.id] || 0) + 1; }); });
    const most = (o, lab, unit) => { const k = Object.keys(o).sort((a, b) => o[b] - o[a])[0]; if (k) rec.push([lab, `${o[k]} ${unit}${o[k] === 1 ? "" : "s"}`, byId[k] || { name: "Former player" }, null]); };
    most(motm, "Most Man of the Match", "time"); most(hat, "Most hat-tricks", "hat-trick");
    let streak = null;                                   // longest run of official wins
    D.teams.forEach(t => { let run = 0; M.forEach(m => { if (![m.home, m.away].includes(t.name)) return; run = winner(m) === t.name ? run + 1 : 0; if (!streak || run > streak.n) streak = { n: run, t: t.name }; }); });
    if (streak && streak.n > 1) rec.push(["Longest win streak", `${streak.n} wins`, { name: streak.t }, null]);
    $("#recs").innerHTML = rec.length ? rec.map(([l, v, who, m]) => `<article class="rec"><span class="eyebrow">${esc(l)}</span><b>${esc(v)}</b>
        <p>${who.id ? pLink(who, esc(who.name)) : esc(who.name || "")}${m ? ` · <a href="matches.html#m-${m.id}">${esc(m.home)} v ${esc(m.away)}</a>` : ""}</p></article>`).join("")
      : `<div class="empty">Records start with the first official match</div>`;

    const TW = D.totw || [];
    const twBox = $("#totw");
    if (!TW.length) twBox.innerHTML = `<div class="empty">The first Team of the Week comes out on the Monday after week 1</div>`;
    else {
      let i = TW.length - 1;
      const drawTw = () => {
        const t = TW[i];
        twBox.innerHTML = `<div class="tw-head"><div class="seg">${TW.map((x, k) => `<button type="button" data-k="${k}" aria-pressed="${k === i}">Week ${esc(x.week)}</button>`).join("")}</div>
          ${byId[t.potw] ? `<p>👑 Player of the Week: ${pLink(byId[t.potw], `<b>${esc(byId[t.potw].name)}</b>`)}</p>` : ""}</div>
          <div class="pitch">${t.players.map(p => { const q = byId[p.id] || { name: "Former player" }, tm = teamOf(D, p.team);
            return `<div class="tw tw-${esc(p.pos)}${p.id === t.potw ? " potw" : ""}" style="${teamVars(tm)}">${pLink({ id: p.id }, avatar(q))}<b>${esc(q.name)}</b><small>${esc(p.pos)} · ${esc(p.team || "")}</small><span class="tw-r">${(+p.avg).toFixed(1)}</span></div>`; }).join("")}</div>`;
      };
      twBox.addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (b) { i = +b.dataset.k; drawTw(); } });
      drawTw();
    }
    const AW = D.awards || [];
    $("#awards").innerHTML = AW.length ? AW.slice().reverse().map(s => `<article class="aw"><h3>${esc(s.title)}</h3>${s.awards.map(a => `<div class="aw-row"><span class="aw-e">${esc(a.emoji)}</span><span><small>${esc(a.award)}</small><b>${a.team ? esc(a.team) : pLink(byId[a.id] || { id: a.id }, esc((byId[a.id] || { name: "Former player" }).name))}</b></span><em>${esc(a.value)}</em></div>`).join("")}</article>`).join("")
      : `<div class="empty">Season awards are handed out at the end of the season</div>`;
    const SH = D.style_history || [], cur = Object.fromEntries((D.traits ? D.traits.style : []).map(s => [s.style, s.holder]));
    const styles = [...new Set(SH.map(h => h.style))].sort();
    $("#hof").innerHTML = styles.length ? styles.map(st => `<article class="hof"><span class="eyebrow">${esc(st)}</span>${SH.filter(h => h.style === st).map(h => {
        const p = byId[h.id] || { name: "Former player" }, now = cur[st] === h.id && h === SH.filter(x => x.style === st).pop();
        return `<div class="hof-row${now ? " now" : ""}">${avatar(p)}<span><b>${pLink({ id: h.id }, esc(p.name))}</b><small>${esc(h.title)}${h.evolved ? " · evolved" : ""}</small></span><em>${now ? "Holder" : new Date(h.at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</em></div>`; }).join("")}</article>`).join("")
      : `<div class="empty">No style trait has been held yet</div>`;
  },

  market(D) {
    $("#window").innerHTML = windowPill(D);
    $("#mchart").innerHTML = moneyChart(D);
    const TR = (D.transfers || []).slice().reverse();
    $("#transfers").innerHTML = TR.length ? TR.map(x => `<div class="move" style="--c:var(--accent)"><span class="amt">${x.amount ? money(x.amount) : "Free"}</span>
      <span class="kind">${esc({ buy: "Transfer", release: "Release clause", swap: "Swap" }[x.kind] || x.kind)}</span>
      <span class="mnote">${pLink({ id: x.id }, `<b>${esc(x.player)}</b>`)}${x.player2 ? ` ⇄ <b>${esc(x.player2)}</b>` : ""} · ${esc(x.frm)} → ${esc(x.to)}</span>
      <span class="when">${x.at ? new Date(x.at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span></div>`).join("")
      : `<div class="empty">No transfers yet. They show here once a deal is done</div>`;
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
      <div class="foot"><span>${m.type === "scrim" ? "🏆 Scrim" : "🤝 Friendly"} · ${nyDate(m.at)} · <a href="matches.html#m-${m.id}">Match page</a></span>${m.potm ? `<span>⭐ ${esc(m.potm.name)} ${(+m.potm.rating).toFixed(1)}</span>` : ""}</div></div>`;
  }).join("")}</div>`;
}


// ---- fixtures, matches and players (league_hub.py / website_export._hub)
const TAGS = { remontada_won: "🔥 Remontada", lost_close: "😮‍💨 Down to the wire", big_win: "🧹 Clean sweep", remontada_failed: "💔 Comeback fell short" };
function clock12(h) { const H = Math.floor(h), hh = H > 12 ? H - 12 : H; return hh + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0"); }
function pLink(p, inner) { return p && p.id ? `<a class="plink" href="player.html#${esc(p.id)}">${inner}</a>` : inner; }
function sets(m) { return m.hs != null && m.as_ != null ? [m.hs, m.as_] : [+(m.hg > m.ag), +(m.ag > m.hg)]; }
function winner(m) { const [a, b] = sets(m); return a > b ? m.home : b > a ? m.away : null; }
function formOf(D, team, n = 5) {
  return (D.matches || []).filter(m => m.type === "scrim" && (m.home === team || m.away === team)).slice(-n).map(m => winner(m) === team ? "W" : "L");
}
function formDots(D, team) {
  const f = formOf(D, team);
  return f.length ? `<span class="form" aria-label="Last ${f.length}: ${f.join(" ")}">${f.map(x => `<i class="${x}">${x}</i>`).join("")}</span>` : `<span class="dim">–</span>`;
}
function until(ts) {
  const s = ts - Date.now() / 1000;
  if (s < -2 * 3600) return "";
  if (s <= 0) return "LIVE";
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return "in " + (d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${Math.floor(s % 60)}s`);
}
function tick() {
  document.querySelectorAll("[data-ko]").forEach(el => { const t = until(+el.dataset.ko); el.textContent = t; el.classList.toggle("live", t === "LIVE"); });
}
setInterval(() => { if (document.querySelector("[data-ko]")) tick(); }, 1000);
function fixtureCard(D, f) {
  const h = teamOf(D, f.home), a = teamOf(D, f.away), r = f.result;
  const pct = f.picks ? Math.round(f.picks_home / f.picks * 100) : 50;
  const mid = r ? `<a class="fx-score" href="matches.html#m-${r.match_id}">${r.home_sets}–${r.away_sets}<small>Full time</small></a>`
    : `<div class="fx-score up"><span>${clock12(f.hour)}<small>PM EST</small></span><em data-ko="${f.kickoff}">${until(f.kickoff)}</em></div>`;
  const win = r ? (r.home_sets > r.away_sets ? f.home : f.away) : null;
  return `<article class="fx" style="--h1:${h ? h.colours[0] : "#333"};--a1:${a ? a.colours[0] : "#333"}">
    <div class="fx-side ${win && win !== f.home ? "lose" : ""}">${crest(h)}<b>${esc(f.home)}</b>${formDots(D, f.home)}</div>
    ${mid}
    <div class="fx-side away ${win && win !== f.away ? "lose" : ""}">${crest(a)}<b>${esc(f.away)}</b>${formDots(D, f.away)}</div>
    <div class="fx-pred">${f.picks ? `<div class="fx-bar" role="img" aria-label="${pct}% of ${f.picks} predictions back ${esc(f.home)}"><i style="width:${pct}%"></i></div>
      <small><span>${pct}% ${esc(h ? h.short : f.home)}</span><span>🔮 ${f.picks} prediction${f.picks === 1 ? "" : "s"}</span><span>${100 - pct}% ${esc(a ? a.short : f.away)}</span></small>`
      : `<small class="dim"><span>${r ? "No predictions on this one" : "No predictions yet. Make yours with <code>/predict pick</code>"}</span></small>`}</div>
  </article>`;
}
function downloadIcs(FX, team) {
  const now = Date.now() / 1000;
  const z = ts => new Date(ts * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = FX.filter(f => f.kickoff > now - 3600 && (!team || f.home === team || f.away === team)).map(f => [
    "BEGIN:VEVENT", `UID:${f.key}-${slug(f.home)}-${slug(f.away)}@neo-egoist-league`, `DTSTAMP:${z(now)}`, `DTSTART:${z(f.kickoff)}`, `DTEND:${z(f.kickoff + 5400)}`,
    `SUMMARY:${f.home} vs ${f.away}`, `DESCRIPTION:Ani's Neo Egoist League · week ${f.week}. Predict the score with /predict pick.`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${f.home} vs ${f.away} in 30 minutes`, "END:VALARM", "END:VEVENT"].join("\r\n"));
  if (!ev.length) { alert("No upcoming matches" + (team ? " for " + team : "") + " on the schedule yet."); return; }
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Neo Egoist League//Fixtures//EN", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = (team ? slug(team) : "neo-egoist-league") + "-fixtures.ics";
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function matchTile(D, m) {
  const h = teamOf(D, m.home), a = teamOf(D, m.away), [x, y] = sets(m), top = m.players[0];
  return `<a class="res" href="#m-${m.id}">
    <div class="side ${x > y ? "win" : "lose"}">${h ? crest(h) : ""}<span>${esc(m.home)}</span></div>
    <div class="score">${x}–${y}<small>${m.hg}–${m.ag} goals</small></div>
    <div class="side away ${y > x ? "win" : "lose"}"><span>${esc(m.away)}</span>${a ? crest(a) : ""}</div>
    <div class="foot"><span>${m.type === "scrim" ? "🏆 Scrim" : "🤝 Friendly"} · ${nyDate(m.at)}${m.tags.filter(t => TAGS[t]).slice(0, 1).map(t => " · " + TAGS[t]).join("")}</span>${top ? `<span>⭐ ${esc(top.name)} ${(+top.rating).toFixed(1)}</span>` : ""}</div></a>`;
}
function matchDetail(D, m) {
  const h = teamOf(D, m.home), a = teamOf(D, m.away), [x, y] = sets(m);
  const st = (m.sets || "").split(/\s+/).filter(Boolean);
  const side = s => m.players.filter(p => p.side === s);
  const top = m.players[0];
  const lineup = (s, t) => `<div class="md-team" style="${teamVars(t)}"><h3>${t ? crest(t) : ""}${esc(s === "home" ? m.home : m.away)}</h3>${side(s).map(p => `<div class="md-p${top && p.id === top.id ? " motm" : ""}">
      ${pLink(p, `<span class="md-n">${esc(p.name)}</span>`)}<small>${esc(p.pos || "")}${p.style ? " · " + esc(p.style) : ""}</small>
      <span class="md-st">${p.g ? `⚽${p.g > 1 ? p.g : ""} ` : ""}${p.a ? `🅰️${p.a > 1 ? p.a : ""} ` : ""}${p.sv ? `🧤${p.sv}` : ""}</span>
      <span class="md-bar"><i style="width:${Math.min(100, p.rating * 10)}%"></i></span><b>${(+p.rating).toFixed(1)}</b></div>`).join("") || `<p class="dim">No stats entered</p>`}</div>`;
  return `<a class="back" href="#">← Every match</a>
    <div class="md-board" style="--h1:${h ? h.colours[0] : "#333"};--a1:${a ? a.colours[0] : "#333"}">
      <div class="md-side">${crest(h)}<b>${esc(m.home)}</b>${formDots(D, m.home)}</div>
      <div class="md-score"><span class="eyebrow">${m.type === "scrim" ? "Official match" : "Friendly"} · ${nyDate(m.at, true)}</span><b>${x}<i>–</i>${y}</b><small>${m.hg}–${m.ag} goals</small></div>
      <div class="md-side">${crest(a)}<b>${esc(m.away)}</b>${formDots(D, m.away)}</div>
    </div>
    ${st.length ? `<div class="md-sets">${st.map((s, i) => { const [p, q] = s.split("-").map(Number); return `<span class="${p > q ? "h" : "a"}"><small>Set ${i + 1}</small>${esc(s)}</span>`; }).join("")}</div>` : ""}
    ${m.tags.filter(t => TAGS[t]).length ? `<div class="md-tags">${[...new Set(m.tags.filter(t => TAGS[t]).map(t => TAGS[t]))].map(t => `<span>${t}</span>`).join("")}</div>` : ""}
    <div class="md-awards">${top ? `<div><span class="eyebrow">Man of the Match</span>${pLink(top, `<b>${esc(top.name)}</b>`)} <small>${(+top.rating).toFixed(2)}</small></div>` : ""}
      ${m.fan ? `<div><span class="eyebrow">Fans' Man of the Match</span>${pLink(m.fan, `<b>${esc(m.fan.name)}</b>`)} <small>${m.fan.votes} of ${m.fan.of} votes</small></div>` : ""}</div>
    <div class="md-lineups">${lineup("home", h)}${lineup("away", a)}</div>`;
}
function chart(series) {                                       // series: [{name, col, pts: [[label, rating, official]]}]
  const W = 760, H = 250, L = 34, R = 12, T = 14, B = 26;
  const n = Math.max(...series.map(s => s.pts.length), 2);
  const all = series.flatMap(s => s.pts.map(p => p[1]));
  const lo = Math.max(0, Math.floor(Math.min(4, ...all))), hi = Math.ceil(Math.max(10, ...all));
  const X = i => L + (W - L - R) * (n === 1 ? .5 : i / (n - 1)), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let g = "";
  for (let v = lo; v <= hi; v += 2) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="ch-g"/><text x="${L - 8}" y="${Y(v) + 4}" class="ch-l" text-anchor="end">${v}</text>`;
  const lines = series.map(s => s.pts.length ? `<polyline fill="none" stroke="${s.col}" stroke-width="2.5" stroke-linejoin="round" points="${s.pts.map((p, i) => `${X(i)},${Y(p[1])}`).join(" ")}"/>
    ${s.pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p[1])}" r="4.5" fill="${p[2] ? s.col : "var(--bg)"}" stroke="${s.col}" stroke-width="2"><title>${esc(s.name)} · ${esc(p[0])}: ${(+p[1]).toFixed(2)}${p[2] ? "" : " (friendly)"}</title></circle>`).join("")}` : "").join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating in each match">${g}${lines}<text x="${L}" y="${H - 6}" class="ch-l">first match</text><text x="${W - R}" y="${H - 6}" class="ch-l" text-anchor="end">latest</text></svg>`;
}
function profile(D, p, q, MID) {
  const t = teamOf(D, p.team), cols = ["var(--accent)", "var(--gold)"];
  const label = (r, who) => { const m = MID[r[0]]; return m ? `${m.home} v ${m.away}` : "match " + r[0]; };
  const ser = [p, q].filter(Boolean).map((x, i) => ({ name: x.name, col: cols[i], pts: (x.hist || []).slice(-30).map(r => [label(r), r[1], r[2]]) }));
  const tiles = [["Overall", x => x.ovr ?? "–"], ["Avg rating", x => x.apps ? (+x.avg).toFixed(2) : "–"], ["Matches", x => x.apps], ["Goals", x => x.goals],
    ["Assists", x => x.assists], ["Key passes", x => x.key_passes], ["Saves", x => x.saves], ["Man of the Match", x => x.potm], ["Value", x => x.value != null ? money(x.value) : "–"]];
  const num = v => parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0;
  const traits = (p.traits || []).map(([n, c]) => ({ n, c, at: (p.seen || {})[n] })).sort((a, b) => (b.at || 0) - (a.at || 0));
  const CAT = D.traits ? Object.fromEntries(D.traits.categories.map(c => [c.key, c.colour])) : {};
  const recent = (p.hist || []).slice(-8).reverse().map(r => { const m = MID[r[0]]; if (!m) return "";
    const mine = m.players.find(x => x.id === p.id), us = mine && mine.side === "home" ? m.home : m.away, w = winner(m) === us;
    return `<a class="pm" href="matches.html#m-${m.id}"><i class="${w ? "W" : "L"}">${w ? "W" : "L"}</i><span>${esc(m.home)} <b>${sets(m)[0]}–${sets(m)[1]}</b> ${esc(m.away)}<small>${nyDate(m.at)}${r[2] ? "" : " · friendly"}${r[3] ? ` · ⚽${r[3]}` : ""}${r[4] ? ` · 🅰️${r[4]}` : ""}</small></span><b>${(+r[1]).toFixed(1)}</b></a>`; }).join("");
  return `<div class="pp-head" style="${teamVars(t)}">
      <div class="pp-id">${avatar(p)}<div><h2>${esc(p.name)} ${role(p.role)}</h2><p>${t ? crest(t) + " " + esc(t.name) : "No team"}${p.pos ? " · " + esc(POS[p.pos] || p.pos) : ""}${p.style ? " · " + esc(p.style) + " main" : ""}</p></div></div>
      <div class="pp-act">${grade(p.ovr, p.grade)}${p.card ? `<button type="button" class="btn has-card" data-key="${esc(p.id)}" data-v="${esc(p.card)}" aria-label="${esc(p.name)}: player card">View /rating card</button>` : ""}
        <a class="btn ghost" href="traits.html#overview/p-${esc(p.id)}">Trait progress</a></div></div>
    ${q ? `<div class="pp-vs"><span style="color:var(--accent)">● ${esc(p.name)}</span><span style="color:var(--gold)">● ${esc(q.name)}</span></div>` : ""}
    <div class="pp-tiles">${tiles.map(([l, f]) => { const a = f(p), b = q ? f(q) : null, lead = q ? (num(a) > num(b) ? "a" : num(b) > num(a) ? "b" : "") : "";
      return `<div class="pp-tile"><small>${l}</small><b class="${lead === "a" ? "lead" : ""}">${a}</b>${q ? `<b class="vs ${lead === "b" ? "lead" : ""}">${b}</b>` : ""}</div>`; }).join("")}</div>
    <section class="pp-sec"><h2>Rating, match by match</h2><p class="sub">Filled dots are official matches, hollow ones friendlies. ${q ? "" : "Pick someone under “Compare with” to draw a second line."}</p>
      ${ser.some(s => s.pts.length) ? chart(ser) : `<div class="empty">No rated matches yet</div>`}</section>
    <div class="split"><section class="pp-sec"><h2>Recent matches</h2>${recent || `<div class="empty">No matches yet</div>`}</section>
      <section class="pp-sec"><h2>Traits</h2><p class="sub">Newest first. Dates start from Nov 26, 2026, when the site began tracking them.</p>${traits.length ? `<div class="tl">${traits.map(x => `<div class="tl-i" style="--tc:${CAT[x.c] || "var(--accent)"}"><b>${esc(x.n)}</b><small>${x.at ? "Earned " + new Date(x.at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Earned before Nov 26, 2026"}</small></div>`).join("")}</div>` : `<div class="empty">No traits yet. <a href="traits.html#overview/p-${esc(p.id)}">See what's close</a></div>`}</section></div>`;
}
function moneyChart(D) {
  const H = D.money_history || {}, W = 760, Hh = 260, L = 46, R = 14, T = 14, B = 26;
  const ser = D.teams.map(t => ({ t, pts: (H[t.name] || []).map(([at, v]) => [new Date(String(at).replace(" ", "T") + "Z").getTime(), v]) })).filter(s => s.pts.length);
  const xs = ser.flatMap(s => s.pts.map(p => p[0])), ys = ser.flatMap(s => s.pts.map(p => p[1]));
  if (!xs.length) return `<div class="empty">No money has moved yet</div>`;
  const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1), lo = Math.min(0, ...ys), hi = Math.max(...ys, 1);
  const X = v => L + (W - L - R) * (v - x0) / (x1 - x0), Y = v => T + (Hh - T - B) * (1 - (v - lo) / (hi - lo));
  const step = Math.max(10, Math.ceil((hi - lo) / 5 / 10) * 10);
  let g = "";
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="ch-g"/><text x="${L - 8}" y="${Y(v) + 4}" class="ch-l" text-anchor="end">${v}M</text>`;
  const lines = ser.map(s => { const pts = [...s.pts, [x1, s.pts[s.pts.length - 1][1]]];
    return `<polyline fill="none" stroke="${s.t.colours[0]}" stroke-width="2.5" points="${pts.map(([a, b], i) => (i ? `${X(a)},${Y(pts[i - 1][1])} ` : "") + `${X(a)},${Y(b)}`).join(" ")}"><title>${esc(s.t.name)}</title></polyline>`; }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Each club's budget over time">${g}${lines}</svg>
    <div class="legend">${ser.map(s => `<span><i style="background:${s.t.colours[0]}"></i>${esc(s.t.name)} ${money(s.t.balance)}</span>`).join("")}</div>`;
}

// ---- motion: scroll reveal with a stagger, and numbers that count up. Off when the visitor asks for reduced motion.
const MOTION = !matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window;
const REVEAL = ".fc, .album-head, section > h2, section > .sub, .club, .pc, .res, .bar-row, .move, .fcard, .wanted, .box, .tbl tbody tr, .wk-event, .chips a, .fx, .rec, .news, .aw, .hof, .pp-tile";
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
