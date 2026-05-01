/* ============================================================
   ReconKit v2.0 — app.js
   SPA frontend — FastAPI backend at same origin (relative paths)
   ============================================================ */

'use strict';

const API = '';

/* ── DOM refs ────────────────────────────────────────────── */
const boot           = document.getElementById('boot');
const bootLog        = document.getElementById('bootLog');
const appEl          = document.getElementById('app');
const statusDot      = document.getElementById('statusDot');
const statusText     = document.getElementById('statusText');
const toastContainer = document.getElementById('toastContainer');

/* ============================================================
   UTILITIES
   ============================================================ */

function escHtml(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setStatus(state) {
  // state: 'ready' | 'scanning' | 'error'
  statusDot.className = 'status-dot dot-' + state;
  statusText.textContent = state.toUpperCase();
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Export downloaded', 'info');
}

/* ── POST + SSE stream ───────────────────────────────────── */
async function streamSSE(url, body, onEvent) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop(); // keep incomplete chunk
    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message', data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:'))  data  = line.slice(5).trim();
      }
      if (data) {
        try { onEvent(event, JSON.parse(data)); }
        catch (_) { /* malformed JSON — skip */ }
      }
    }
  }
}

/* ============================================================
   BOOT SEQUENCE
   ============================================================ */
const BOOT_LINES = [
  '> INITIALIZING RECONKIT v2.0...',
  '> LOADING INTELLIGENCE MODULES...',
  '> WHOIS ENGINE: READY',
  '> DNS RESOLVER: READY',
  '> USERNAME SWEEP: 57 SITES LOADED',
  '> GEOIP LOOKUP: READY',
  '> OSINT LINK GENERATOR: READY',
  '> ALL SYSTEMS OPERATIONAL',
  '> STARTING TERMINAL...',
];

async function runBoot() {
  for (const line of BOOT_LINES) {
    await new Promise(r => setTimeout(r, 150 + Math.random() * 100));
    const div = document.createElement('div');
    div.className = 'boot-line';
    div.textContent = line;
    bootLog.appendChild(div);
  }
  await new Promise(r => setTimeout(r, 400));
  boot.style.display = 'none';
  appEl.classList.add('app-visible');
  appEl.classList.remove('app-hidden');
  statusDot.className = 'status-dot dot-ready';
  statusText.textContent = 'READY';
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

/* ============================================================
   INPUT FOCUS EFFECTS
   ============================================================ */
function initInputEffects() {
  document.querySelectorAll('.finput').forEach(input => {
    input.addEventListener('focus', () => {
      const wrap = input.closest('.finput-wrap');
      if (wrap) wrap.classList.add('active');
    });
    input.addEventListener('blur', () => {
      const wrap = input.closest('.finput-wrap');
      if (wrap) wrap.classList.remove('active');
    });
  });
}

/* ============================================================
   PEOPLE TAB
   ============================================================ */

let lastPeopleScan = null;

/* ── Build profile from form fields ─────────────────────── */
function getProfile() {
  return {
    full_name:  document.getElementById('fullName').value.trim(),
    usernames:  document.getElementById('usernames').value
                  .split(',').map(s => s.trim()).filter(Boolean),
    email:      document.getElementById('email').value.trim(),
    employer:   document.getElementById('employer').value.trim(),
    location:   document.getElementById('location').value.trim(),
    phone:      document.getElementById('phone').value.trim(),
    aliases:    document.getElementById('aliases').value
                  .split(',').map(s => s.trim()).filter(Boolean),
    age:        document.getElementById('age').value.trim(),
    hobbies:    document.getElementById('hobbies').value.trim(),
    education:  document.getElementById('education').value.trim(),
    is_ctf:     document.getElementById('isCtf').checked,
    ctf_name:   document.getElementById('ctfName').value.trim(),
    unverified_fields: []
  };
}

/* ── Username sweep (shared between People + Username tabs) ─ */
async function runUsernameSweep(username, gridEl, barEl, foundCountEl, checkedCountEl) {
  let found = 0;
  let checked = 0;
  const TOTAL = 57;

  gridEl.innerHTML = '';
  barEl.style.width = '0%';
  foundCountEl.textContent = '0 FOUND';
  checkedCountEl.textContent = '/ 0 CHECKED';

  try {
    await streamSSE(`${API}/api/people/username`, { username }, (event, data) => {
      if (event === 'result' || event === 'message') {
        if (data.site !== undefined) {
          checked++;
          if (data.found) found++;

          const chip = document.createElement('a');
          chip.className = 'chip ' + (data.found ? 'found' : 'not-found');
          chip.href = (data.found && data.url) ? data.url : '#';
          if (data.found && data.url) {
            chip.target = '_blank';
            chip.rel = 'noopener';
          }
          chip.innerHTML = `<span class="chip-dot"></span>${escHtml(data.site)}`;
          gridEl.appendChild(chip);

          const total = data.total || TOTAL;
          barEl.style.width = Math.round((checked / total) * 100) + '%';
          foundCountEl.textContent = found + ' FOUND';
          checkedCountEl.textContent = `/ ${checked} CHECKED`;
        }
      } else if (event === 'done') {
        barEl.style.width = '100%';
        if (data && data.total) {
          checkedCountEl.textContent = `/ ${data.total} CHECKED`;
        }
      }
    });
  } catch (err) {
    console.error('Username sweep error:', err);
    toast('Username sweep failed: ' + err.message, 'error');
  }

  barEl.style.width = '100%';
  return found;
}

/* ── Render intel links from people/search ───────────────── */
function renderSearchLinks(sections) {
  const list    = document.getElementById('searchLinksList');
  const countEl = document.getElementById('linkCount');
  list.innerHTML = '';
  let total = 0;

  // Normalize to flat array of {section, label, url}
  let flat = [];
  if (Array.isArray(sections)) {
    sections.forEach(item => {
      // Each item might be {section, links:[]} or {section, label, url}
      if (Array.isArray(item.links)) {
        item.links.forEach(l => flat.push({ section: item.section, ...l }));
      } else {
        flat.push(item);
      }
    });
  } else if (sections && typeof sections === 'object') {
    for (const [section, links] of Object.entries(sections)) {
      if (Array.isArray(links)) {
        links.forEach(l => flat.push({ section, ...l }));
      }
    }
  }

  flat.forEach(item => {
    const a = document.createElement('a');
    a.className = 'link-card';
    a.href = item.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `
      <span class="link-section-label">${escHtml(item.section || '')}</span>
      <span class="link-label">${escHtml(item.label || item.title || item.url || '')}</span>
      <span class="link-arrow">→</span>
    `;
    list.appendChild(a);
    total++;
  });

  if (countEl) countEl.textContent = `${total} LINKS`;
  return total;
}

/* ── Fallback dork links when scan yields nothing ─────────── */
function renderFallbackDorks(profile) {
  const container = document.getElementById('nrDorks');
  if (!container) return;
  container.innerHTML = '';

  const term = profile.full_name ||
    (profile.usernames && profile.usernames[0]) ||
    profile.email || '';

  if (!term) return;

  const dorks = [
    {
      label: `Google: "${term}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent('"' + term + '"')}`
    },
    {
      label: `Google: "${term}" social profiles`,
      url: `https://www.google.com/search?q=${encodeURIComponent('"' + term + '" site:linkedin.com OR site:twitter.com OR site:facebook.com')}`
    },
    {
      label: `DuckDuckGo: "${term}"`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent('"' + term + '"')}`
    },
    {
      label: `Bing: "${term}"`,
      url: `https://www.bing.com/search?q=${encodeURIComponent('"' + term + '"')}`
    }
  ];

  dorks.forEach(d => {
    const a = document.createElement('a');
    a.className = 'link-card';
    a.href = d.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `<span class="link-label">${escHtml(d.label)}</span><span class="link-arrow">→</span>`;
    container.appendChild(a);
  });
}

/* ── Main scan handler ───────────────────────────────────── */
async function handleScan() {
  const profile = getProfile();

  const hasData = profile.full_name || profile.usernames.length ||
    profile.email || profile.employer || profile.location ||
    profile.phone || profile.aliases.length || profile.age ||
    profile.hobbies || profile.education;

  if (!hasData) {
    toast('Enter at least one field to scan', 'error');
    return;
  }

  // Show results container, hide sub-sections
  const peopleResults = document.getElementById('peopleResults');
  peopleResults.classList.remove('hidden');
  peopleResults.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('usernameResults').classList.add('hidden');
  document.getElementById('noResultsMsg').classList.add('hidden');
  document.getElementById('searchLinksSection').classList.add('hidden');
  document.getElementById('usernameGrid').innerHTML = '';
  document.getElementById('searchLinksList').innerHTML = '';

  setStatus('scanning');
  lastPeopleScan = { profile, sweepResults: null, links: null };

  let sweepFound = 0;
  let linksTotal = 0;

  // Run sweep + people search in parallel
  const tasks = [];

  if (profile.usernames.length > 0) {
    document.getElementById('usernameResults').classList.remove('hidden');
    const sweepTask = runUsernameSweep(
      profile.usernames[0],
      document.getElementById('usernameGrid'),
      document.getElementById('scanBar'),
      document.getElementById('foundCount'),
      document.getElementById('checkedCount')
    ).then(n => {
      sweepFound = n;
      lastPeopleScan.sweepResults = { username: profile.usernames[0], found: n };
    });
    tasks.push(sweepTask);
  }

  const searchTask = (async () => {
    try {
      const res = await fetch(`${API}/api/people/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Normalize — API might return {sections:[...]}, {links:[...]}, or array
      const raw = data.sections || data.links || data;
      linksTotal = renderSearchLinks(raw);
      lastPeopleScan.links = raw;

      if (linksTotal > 0) {
        document.getElementById('searchLinksSection').classList.remove('hidden');
      }
    } catch (err) {
      console.error('People search error:', err);
      toast('Intel link fetch failed: ' + err.message, 'error');
    }
  })();
  tasks.push(searchTask);

  await Promise.all(tasks);

  setStatus('ready');

  // Show no-results fallback if nothing came back
  if (sweepFound === 0 && linksTotal === 0) {
    document.getElementById('noResultsMsg').classList.remove('hidden');
    renderFallbackDorks(profile);
  }
}

function initPeopleTab() {
  document.getElementById('btnScan').addEventListener('click', handleScan);

  // Enter key on any people input triggers scan
  document.querySelectorAll('#tab-people .finput').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleScan();
    });
  });

  document.getElementById('btnNewScan').addEventListener('click', () => {
    document.getElementById('peopleResults').classList.add('hidden');
    document.getElementById('usernameResults').classList.add('hidden');
    document.getElementById('noResultsMsg').classList.add('hidden');
    document.getElementById('searchLinksSection').classList.add('hidden');
    document.getElementById('usernameGrid').innerHTML = '';
    document.getElementById('searchLinksList').innerHTML = '';
    lastPeopleScan = null;
    setStatus('ready');
  });

  document.getElementById('btnClearPeople').addEventListener('click', () => {
    [
      'fullName', 'usernames', 'email', 'employer', 'location', 'phone',
      'aliases', 'age', 'hobbies', 'education', 'ctfName'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('isCtf').checked = false;
  });

  document.getElementById('btnExportPeople').addEventListener('click', () => {
    if (!lastPeopleScan) {
      toast('No scan data to export', 'error');
      return;
    }
    downloadJSON(lastPeopleScan, 'reconkit-people-scan.json');
  });
}

/* ============================================================
   NETWORKS TAB
   ============================================================ */

let lastNetScan = null;
let loadingInterval = null;

const NET_LOADING_MSGS = [
  'INITIALIZING SCAN...',
  'RESOLVING TARGET...',
  'QUERYING WHOIS...',
  'RUNNING DNS LOOKUP...',
  'GEOLOCATING...',
  'CHECKING SHODAN...',
  'SCANNING VIRUSTOTAL...',
  'ENUMERATING SUBDOMAINS...',
  'AGGREGATING RESULTS...',
];

function startLoadingAnim() {
  const loadingLine = document.getElementById('loadingLine');
  let idx = 0;
  loadingLine.textContent = NET_LOADING_MSGS[0];
  loadingInterval = setInterval(() => {
    idx = (idx + 1) % NET_LOADING_MSGS.length;
    loadingLine.textContent = NET_LOADING_MSGS[idx];
  }, 1100);
}

function stopLoadingAnim() {
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
}

/* ── Build a simple key/value table ─────────────────────── */
function buildTable(rows) {
  if (!rows || rows.length === 0) return '<div class="no-data">No data</div>';
  const trs = rows
    .filter(([, v]) => v != null && v !== '' && v !== '—')
    .map(([k, v]) =>
      `<tr>
        <td class="td-key">${escHtml(k)}</td>
        <td class="td-val">${escHtml(String(v))}</td>
      </tr>`
    ).join('');
  return trs ? `<table class="data-table"><tbody>${trs}</tbody></table>` : '<div class="no-data">No data</div>';
}

/* ── Render a single network module card ─────────────────── */
function renderNetCard(module, data) {
  const card  = document.getElementById(`card-${module}`);
  const badge = document.getElementById(`badge-${module}`);
  const body  = document.getElementById(`body-${module}`);
  if (!card) return;

  card.classList.remove('hidden');

  if (data.error) {
    badge.textContent = 'ERROR';
    badge.className = 'card-badge badge-error';
    body.innerHTML = `<div class="error-text">⚠ ${escHtml(data.error)}</div>`;
    return;
  }

  badge.className = 'card-badge badge-ok';

  switch (module) {

    case 'geoip': {
      badge.textContent = data.country || 'OK';
      const loc = data.loc
        ? data.loc
        : (data.lat && data.lon ? `${data.lat}, ${data.lon}` : null);
      body.innerHTML = buildTable([
        ['Country',  data.country],
        ['Region',   data.region || data.regionName],
        ['City',     data.city],
        ['Org',      data.org],
        ['ISP',      data.isp],
        ['Timezone', data.timezone],
        ['Lat / Lon', loc],
      ]);
      break;
    }

    case 'whois': {
      badge.textContent = 'OK';
      const created  = Array.isArray(data.creation_date)   ? data.creation_date[0]   : data.creation_date   || data.created;
      const expires  = Array.isArray(data.expiration_date) ? data.expiration_date[0] : data.expiration_date || data.expires;
      body.innerHTML = buildTable([
        ['Registrar', data.registrar],
        ['Created',   created],
        ['Expires',   expires],
        ['Org',       data.org],
        ['Country',   data.country],
        ['DNSSEC',    data.dnssec],
      ]);
      break;
    }

    case 'dns': {
      const records = data.records || data;
      let html = '';
      if (typeof records === 'object' && !Array.isArray(records)) {
        for (const [type, vals] of Object.entries(records)) {
          if (!vals) continue;
          const entries = Array.isArray(vals) ? vals : [vals];
          if (!entries.length) continue;
          html += `<div class="dns-group">
            <div class="dns-type">${escHtml(type)}</div>
            ${entries.map(v => `<div class="dns-val">${escHtml(String(v))}</div>`).join('')}
          </div>`;
        }
      } else if (Array.isArray(records)) {
        records.forEach(r => {
          html += `<div class="dns-group">
            <div class="dns-type">${escHtml(r.type || 'RR')}</div>
            <div class="dns-val">${escHtml(r.value || r.data || JSON.stringify(r))}</div>
          </div>`;
        });
      }
      badge.textContent = 'OK';
      body.innerHTML = html || '<div class="no-data">No records returned</div>';
      break;
    }

    case 'shodan': {
      const ports  = data.ports  || [];
      const vulns  = data.vulns  || [];
      let html = buildTable([
        ['Org',  data.org],
        ['ISP',  data.isp],
        ['OS',   data.os],
      ]);
      if (ports.length) {
        html += `<div class="dns-group">
          <div class="dns-type">OPEN PORTS</div>
          <div class="dns-val">${ports.map(p => `<span class="port-badge">${escHtml(String(p))}</span>`).join(' ')}</div>
        </div>`;
      }
      if (vulns.length) {
        html += `<div class="dns-group">
          <div class="dns-type" style="color:var(--red,#f55)">CVEs</div>
          ${vulns.map(v => `<div class="dns-val" style="color:var(--red,#f55)">${escHtml(String(v))}</div>`).join('')}
        </div>`;
      }
      badge.textContent = vulns.length ? `${vulns.length} CVEs` : (ports.length ? `${ports.length} PORTS` : 'OK');
      badge.className   = vulns.length ? 'card-badge badge-error' : 'card-badge badge-ok';
      body.innerHTML = html || '<div class="no-data">No Shodan data — add SHODAN_API_KEY</div>';
      break;
    }

    case 'virustotal': {
      const pos    = data.positives ?? data.malicious ?? 0;
      const total  = data.total ?? null;
      const cats   = data.categories ? Object.values(data.categories).join(', ') : null;
      badge.textContent = pos > 0 ? `${pos} DETECTIONS` : 'CLEAN';
      badge.className   = pos > 0 ? 'card-badge badge-error' : 'card-badge badge-ok';
      body.innerHTML = buildTable([
        ['Positives',     total !== null ? `${pos} / ${total}` : String(pos)],
        ['Categories',    cats],
        ['Reputation',    data.reputation != null ? String(data.reputation) : null],
        ['Last Analysis', data.last_analysis_date || data.scan_date],
      ]);
      break;
    }

    case 'subdomains': {
      const subs = data.subdomains || data.domains || (Array.isArray(data) ? data : []);
      if (subs.length) {
        body.innerHTML = `<div class="chips-grid">` +
          subs.map(s =>
            `<span class="chip found"><span class="chip-dot"></span>${escHtml(String(s))}</span>`
          ).join('') + `</div>`;
        badge.textContent = `${subs.length} FOUND`;
      } else {
        body.innerHTML = '<div class="no-data">No subdomains found</div>';
        badge.textContent = 'NONE';
        badge.className = 'card-badge badge-warn';
      }
      break;
    }

    default: {
      badge.textContent = 'OK';
      body.innerHTML = `<pre class="raw-pre">${escHtml(JSON.stringify(data, null, 2))}</pre>`;
    }
  }
}

/* ── Net scan handler ────────────────────────────────────── */
async function handleNetScan() {
  const rawTarget = document.getElementById('netTarget').value.trim();
  if (!rawTarget) {
    toast('Enter a target IP or domain', 'error');
    return;
  }
  // Strip protocol/trailing slash for display
  const target = rawTarget.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const enabledMods = Array.from(
    document.querySelectorAll('.mod-toggle input[data-mod]')
  ).filter(cb => cb.checked).map(cb => cb.dataset.mod);

  // Reset all cards
  ['geoip', 'whois', 'dns', 'shodan', 'virustotal', 'subdomains'].forEach(m => {
    const card = document.getElementById(`card-${m}`);
    const body = document.getElementById(`body-${m}`);
    if (card) card.classList.add('hidden');
    if (body) body.innerHTML = '';
  });

  document.getElementById('netLoading').classList.remove('hidden');
  document.getElementById('netResults').classList.add('hidden');
  setStatus('scanning');
  startLoadingAnim();

  try {
    const res = await fetch(`${API}/api/networks/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, modules: enabledMods })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    stopLoadingAnim();
    document.getElementById('netLoading').classList.add('hidden');
    document.getElementById('netResults').classList.remove('hidden');

    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(target);
    const typeLabel = isIp ? 'IPv4 ADDRESS' : 'DOMAIN';
    document.getElementById('targetBar').innerHTML =
      `> SCANNING TARGET: <strong>${escHtml(target)}</strong> — ${typeLabel}`;

    // Results may be nested under .results or top-level keys
    const modules = data.results || data;
    for (const mod of enabledMods) {
      if (modules[mod] !== undefined) {
        renderNetCard(mod, modules[mod]);
      }
    }

    lastNetScan = { target, results: modules };
    setStatus('ready');
    toast(`Scan complete: ${target}`, 'info');

  } catch (err) {
    stopLoadingAnim();
    document.getElementById('netLoading').classList.add('hidden');
    console.error('Network scan error:', err);
    toast('Scan failed: ' + err.message, 'error');
    setStatus('error');
  }
}

function resetNetworksTab() {
  document.getElementById('netTarget').value = '';
  document.getElementById('netResults').classList.add('hidden');
  document.getElementById('netLoading').classList.add('hidden');
  ['geoip', 'whois', 'dns', 'shodan', 'virustotal', 'subdomains'].forEach(m => {
    const card = document.getElementById(`card-${m}`);
    const body = document.getElementById(`body-${m}`);
    if (card) card.classList.add('hidden');
    if (body) body.innerHTML = '';
  });
  lastNetScan = null;
  setStatus('ready');
}

function initNetworksTab() {
  document.getElementById('btnNetScan').addEventListener('click', handleNetScan);
  document.getElementById('netTarget').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleNetScan();
  });
  document.getElementById('btnClearNet').addEventListener('click', resetNetworksTab);
  document.getElementById('btnExportNet').addEventListener('click', () => {
    if (!lastNetScan) { toast('No scan data to export', 'error'); return; }
    downloadJSON(lastNetScan, 'reconkit-network-scan.json');
  });
}

/* ============================================================
   USERNAME TAB (standalone sweep)
   ============================================================ */
function initUsernameTab() {
  document.getElementById('btnSweep').addEventListener('click', handleSweep);
  document.getElementById('sweepUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSweep();
  });
}

async function handleSweep() {
  const username = document.getElementById('sweepUsername').value.trim();
  if (!username) {
    toast('Enter a username to sweep', 'error');
    return;
  }

  document.getElementById('sweepResults').classList.remove('hidden');
  setStatus('scanning');

  await runUsernameSweep(
    username,
    document.getElementById('sweepGrid'),
    document.getElementById('sweepBar'),
    document.getElementById('sweepFoundCount'),
    document.getElementById('sweepCheckedCount')
  );

  setStatus('ready');
}

/* ============================================================
   APIs TAB
   ============================================================ */
const APIS = [
  {
    name: 'Shodan',
    dot: 'free',
    tier: 'FREE TIER',
    tierClass: 'free',
    desc: 'Internet-wide port scanner. Powers the Shodan card in Networks tab.',
    envKey: 'SHODAN_API_KEY',
    steps: [
      'Go to shodan.io and create a free account',
      'Visit account.shodan.io — copy your API key',
      'Add to your .env file: SHODAN_API_KEY=your_key_here',
      'Restart the server — Shodan results will now populate'
    ]
  },
  {
    name: 'VirusTotal',
    dot: 'free',
    tier: 'FREE TIER',
    tierClass: 'free',
    desc: 'Multi-engine malware scanner for domains, IPs, and URLs.',
    envKey: 'VIRUSTOTAL_API_KEY',
    steps: [
      'Go to virustotal.com and create a free account',
      'Click your avatar → API Key — copy the key',
      'Add to your .env: VIRUSTOTAL_API_KEY=your_key_here',
      'Restart the server'
    ]
  },
  {
    name: 'Hunter.io',
    dot: 'partial',
    tier: 'FREE TIER',
    tierClass: 'partial',
    desc: 'Email finder and verifier. Used in the People tab email intel links.',
    envKey: 'HUNTER_API_KEY',
    steps: [
      'Go to hunter.io and create a free account (25 searches/mo)',
      'Dashboard → API → copy your API key',
      'Add to .env: HUNTER_API_KEY=your_key_here'
    ]
  },
  {
    name: 'ipinfo.io',
    dot: 'free',
    tier: 'FREE TIER',
    tierClass: 'free',
    desc: 'GeoIP lookups for the Networks tab. Works without a key (rate-limited).',
    envKey: 'IPINFO_TOKEN',
    steps: [
      'Visit ipinfo.io and create a free account',
      'Copy your access token from the dashboard',
      'Add to .env: IPINFO_TOKEN=your_token — removes rate limits'
    ]
  },
];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function renderApiCards() {
  const list = document.getElementById('apiList');
  if (!list) return;
  list.innerHTML = '';

  APIS.forEach(api => {
    const card = document.createElement('div');
    card.className = 'api-card';
    card.id = 'api-' + slugify(api.name);

    const stepsHtml = api.steps.map((step, i) =>
      `<div class="api-step">
        <span class="api-step-num">${i + 1}.</span>
        <span>${escHtml(step)}</span>
      </div>`
    ).join('');

    card.innerHTML = `
      <div class="api-card-head">
        <span class="api-dot ${escHtml(api.dot)}"></span>
        <span class="api-name">${escHtml(api.name)}</span>
        <span class="api-tier ${escHtml(api.tierClass)}">${escHtml(api.tier)}</span>
      </div>
      <div class="api-body">
        <p>${escHtml(api.desc)}</p>
        <div class="api-steps">${stepsHtml}</div>
        <div class="api-env-key">${escHtml(api.envKey)}</div>
      </div>
    `;

    card.querySelector('.api-card-head').addEventListener('click', () => {
      card.classList.toggle('open');
    });

    list.appendChild(card);
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initInputEffects();
  initPeopleTab();
  initNetworksTab();
  initUsernameTab();
  renderApiCards();
  runBoot();
});
