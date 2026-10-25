// Claude Usage Limits: reads your own usage from claude.ai (same page, your own login) and shows it above the chat box.
// Nothing is sent anywhere else. Uses claude.ai's internal /api/organizations/<id>/usage, which Anthropic does not
// document and may change.
(() => {
  'use strict';
  const API = '/api/organizations', ID = 'cul-bar', EVERY_MS = 60_000;
  const ROWS = [['five_hour', 'Session (5h)'], ['seven_day', 'Weekly'], ['seven_day_opus', 'Weekly Opus'], ['seven_day_sonnet', 'Weekly Sonnet']];
  let org = null, data = null, err = null, isMin = false;
  try { isMin = localStorage.getItem('cul-min') === '1'; } catch {}

  const getJSON = async (u) => { const r = await fetch(u, { credentials: 'include' }); if (!r.ok) throw new Error(r.status); return r.json(); };
  async function load() {
    try {
      if (!org) {
        const orgs = await getJSON(API);
        const pick = (orgs || []).find((o) => (o.capabilities || []).includes('chat')) || (orgs || [])[0];
        org = pick && pick.uuid;
        if (!org) throw new Error('no organization');
      }
      data = await getJSON(`${API}/${org}/usage`); err = null;
    } catch (e) { org = null; err = String(e.message || e); }
    render();
  }

  const pct = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const left = (iso) => {
    const m = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`;
  };
  const when = (iso) => {
    const t = new Date(iso), same = t.toDateString() === new Date().toDateString();
    const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return same ? time : `${t.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  };

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function build() {
    const bar = el('div'); bar.id = ID; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
    return bar;
  }

  function render() {
    const bar = document.getElementById(ID) || build();
    bar.replaceChildren(); bar.classList.toggle('cul-min', isMin);
    if (err && !data) { bar.append(el('span', 'cul-txt', `Usage limits unavailable (${err}). Open claude.ai/settings/usage.`)); }
    else if (!data) { bar.append(el('span', 'cul-txt', 'Loading usage limits…')); }
    else {
      for (const [key, name] of ROWS) {
        const b = data[key]; if (!b || b.utilization == null) continue;
        const p = pct(b.utilization), row = el('div', 'cul-row'), track = el('div', 'cul-track'), fill = el('div', 'cul-fill' + (p >= 90 ? ' bad' : p >= 75 ? ' warn' : ''));
        fill.style.width = p + '%'; track.append(fill);
        row.append(el('span', 'cul-name', name), track, el('span', 'cul-pct', Math.round(p) + '%'));
        if (b.resets_at) row.append(el('span', 'cul-txt', `resets ${when(b.resets_at)} (in ${left(b.resets_at)})`));
        row.title = `${name}: ${Math.round(p)}% used` + (b.resets_at ? `, resets ${new Date(b.resets_at).toLocaleString()}` : '');
        bar.append(row);
      }
    }
    const btn = el('button', null, isMin ? 'More' : 'Less'); btn.type = 'button';
    btn.setAttribute('aria-label', isMin ? 'Show all usage limits' : 'Show only the session limit');
    btn.onclick = () => { isMin = !isMin; try { localStorage.setItem('cul-min', isMin ? '1' : '0'); } catch {} render(); };
    bar.append(btn);
    place(bar);
  }

  // Above the chat box when we can find it; otherwise a small floating card bottom-right.
  function place(bar) {
    const input = document.querySelector('[contenteditable="true"]');
    const box = input && (input.closest('fieldset') || input.closest('form'));
    if (box && box.parentElement) {
      bar.classList.remove('cul-float');
      if (bar.nextElementSibling !== box) box.parentElement.insertBefore(bar, box);
    } else {
      bar.classList.add('cul-float');
      if (bar.parentElement !== document.body) document.body.append(bar);
    }
  }

  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; const b = document.getElementById(ID); if (b) place(b); else render(); }); })
    .observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden) load(); }, EVERY_MS);
  setInterval(render, 30_000); // keep the countdown fresh between fetches
  load();
})();
