/* ============================================================
   ARAM BOUND — create-build.js
   Loads Data Dragon items, renders icon paths with hover names,
   and manages main + alternate build paths.
   ============================================================ */

'use strict';

const DDRAGON_VERSION = '14.8.1';
const ITEM_DATA_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`;

const MAX_ITEMS_PER_PATH = 6;

/** @type {Record<string, { name: string, icon: string }>} */
let itemCatalog = {};
/** @type {{ name: string, id: string }[]} */
let itemSearchList = [];

/**
 * @param {string} itemId
 * @returns {string}
 */
function itemIconUrl(itemId) {
  const meta = itemCatalog[itemId];
  if (meta && meta.icon) return meta.icon;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

/**
 * @param {object} raw
 * @returns {boolean}
 */
function includeItemInCatalog(raw) {
  if (!raw || !raw.gold || !raw.gold.purchasable) return false;
  if (raw.hideFromAll) return false;
  if (raw.requiredChampion) return false;
  if (raw.requiredAlly) return false;
  const total = raw.gold.total;
  if (typeof total !== 'number' || total <= 0) return false;
  const name = raw.name || '';
  if (/^Enchantment:/i.test(name)) return false;
  return true;
}

async function loadItemCatalog() {
  const res = await fetch(ITEM_DATA_URL);
  if (!res.ok) throw new Error('Could not load item data');
  const json = await res.json();
  const data = json.data || {};
  itemCatalog = {};
  itemSearchList = [];

  Object.keys(data).forEach((id) => {
    const raw = data[id];
    if (!includeItemInCatalog(raw)) return;
    const imgFile = raw.image && raw.image.full ? raw.image.full : `${id}.png`;
    const icon = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${imgFile}`;
    const name = String(raw.name).replace(/<[^>]+>/g, '').trim();
    itemCatalog[id] = { name, icon };
    itemSearchList.push({ id, name });
  });

  itemSearchList.sort((a, b) => a.name.localeCompare(b.name));
  const seenNames = new Set();
  itemSearchList = itemSearchList.filter((row) => {
    const key = row.name.toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
}

const pathsState = {
  main: { items: [] },
  /** @type {{ uid: string, items: string[] }[]} */
  alternates: [],
};

let altUid = 0;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * @param {string} query
 * @returns {{ id: string, name: string }[]}
 */
function filterItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return itemSearchList.slice(0, 40);
  const out = [];
  for (let i = 0; i < itemSearchList.length && out.length < 50; i++) {
    const row = itemSearchList[i];
    if (row.name.toLowerCase().includes(q)) out.push(row);
  }
  return out;
}

// ============================================================
//  AUGMENT POOL (from mayhem-augment-pool.json)
// ============================================================

/** @type {{ silver: { name: string, tier: string, icon: string }[], gold: { name: string, tier: string, icon: string }[], prismatic: { name: string, tier: string, icon: string }[] } | null} */
let augmentPoolByTier = null;

const AUGMENT_POOL_URL = 'js/mayhem-augment-pool.json';

async function loadAugmentPool() {
  const res = await fetch(AUGMENT_POOL_URL);
  if (!res.ok) throw new Error('augment pool');
  /** @type {{ name: string, tier: string, icon: string }[]} */
  const rows = await res.json();
  augmentPoolByTier = { silver: [], gold: [], prismatic: [] };
  rows.forEach((r) => {
    const t = r.tier;
    if (t === 'silver') augmentPoolByTier.silver.push(r);
    else if (t === 'gold') augmentPoolByTier.gold.push(r);
    else if (t === 'prismatic') augmentPoolByTier.prismatic.push(r);
  });
  augmentPoolByTier.silver.sort((a, b) => a.name.localeCompare(b.name));
  augmentPoolByTier.gold.sort((a, b) => a.name.localeCompare(b.name));
  augmentPoolByTier.prismatic.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Icon URL for the selected augment. Prefer JSON pool lookup — some browsers
 * do not preserve `data-*` on `<option>`; lazy+hidden preview imgs can also
 * block loading until we set eager and unhide after load.
 * @param {HTMLSelectElement} select
 * @param {string} augmentName
 * @returns {string}
 */
function resolveAugmentIconUrl(select, augmentName) {
  const group = select.closest('.create-augment-group');
  const tier = group && group.getAttribute('data-tier');
  const t = tier === 'gold' || tier === 'prismatic' ? tier : 'silver';
  const pool = augmentPoolByTier && augmentPoolByTier[t];
  if (pool && augmentName) {
    const row = pool.find((r) => r.name === augmentName);
    if (row && row.icon) return row.icon;
  }
  const opt = select.selectedOptions[0];
  return (opt && opt.getAttribute('data-icon')) || '';
}

const MAX_BIS_MARKS = 4;

/** @type {string[]} Order keys like "prismatic:0" — reflects check order for BiS strip on detail */
let bisChaseKeyOrder = [];

function updateBisCountHint() {
  const n = document.getElementById('create-bis-count-num');
  if (n) n.textContent = String(bisChaseKeyOrder.length);
  const cap = document.getElementById('create-bis-cap-note');
  if (cap) cap.hidden = bisChaseKeyOrder.length < MAX_BIS_MARKS;
}

function refreshBisCardVisual(card) {
  if (!card) return;
  const cb = card.querySelector('.create-augment-bis-cb');
  if (!cb) return;
  card.classList.toggle('create-augment-card--bis', cb.checked);
}

/**
 * Clear BiS if augment selection is cleared.
 * @param {HTMLElement | null} card
 */
function syncBisWhenAugmentCleared(card) {
  if (!card) return;
  const cb = card.querySelector('.create-augment-bis-cb');
  const sel = card.querySelector('.create-augment-select');
  if (!cb || !sel) return;
  const key = cb.getAttribute('data-bis-key');
  if (!key) return;
  const hasAug = sel.value && sel.value.trim();
  if (!hasAug) {
    if (cb.checked) {
      cb.checked = false;
      bisChaseKeyOrder = bisChaseKeyOrder.filter((k) => k !== key);
      updateBisCountHint();
    }
  }
  refreshBisCardVisual(card);
}

function initAugmentBisCheckboxes() {
  document.querySelectorAll('.create-augment-bis-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      const key = cb.getAttribute('data-bis-key');
      const card = cb.closest('.create-augment-card');
      const sel = card && card.querySelector('.create-augment-select');
      const hasAug = sel && sel.value && sel.value.trim();
      if (cb.checked) {
        if (!hasAug) {
          cb.checked = false;
          return;
        }
        if (bisChaseKeyOrder.indexOf(key) === -1) {
          if (bisChaseKeyOrder.length >= MAX_BIS_MARKS) {
            cb.checked = false;
            return;
          }
          bisChaseKeyOrder.push(key);
        }
      } else {
        bisChaseKeyOrder = bisChaseKeyOrder.filter((k) => k !== key);
      }
      refreshBisCardVisual(card);
      updateBisCountHint();
      syncPublishedPreview();
    });
  });
  updateBisCountHint();
}

/**
 * @param {HTMLSelectElement} select
 */
function applyAugmentSelection(select) {
  const card = select.closest('.create-augment-card');
  if (!card) return;
  const nameEl = card.querySelector('[data-role="name"]');
  const iconImg = card.querySelector('[data-role="icon-img"]');
  const iconFb = card.querySelector('[data-role="icon-fallback"]');
  const value = select.value;
  if (!nameEl || !iconImg || !iconFb) return;

  if (!value) {
    nameEl.textContent = select.getAttribute('data-placeholder') || 'Choose an augment…';
    iconImg.removeAttribute('src');
    iconImg.alt = '';
    iconImg.hidden = true;
    iconFb.hidden = false;
    syncBisWhenAugmentCleared(card);
    return;
  }

  nameEl.textContent = value;
  const iconUrl = resolveAugmentIconUrl(select, value);
  if (!iconUrl) {
    iconImg.hidden = true;
    iconFb.hidden = false;
    syncBisWhenAugmentCleared(card);
    return;
  }

  iconImg.alt = value;
  iconImg.onerror = () => {
    iconImg.removeAttribute('src');
    iconImg.alt = '';
    iconImg.hidden = true;
    iconFb.hidden = false;
    iconImg.onerror = null;
  };
  iconImg.onload = () => {
    iconImg.hidden = false;
    iconFb.hidden = true;
  };
  iconImg.loading = 'eager';
  iconImg.src = iconUrl;
  if (iconImg.complete && iconImg.naturalWidth > 0) {
    iconImg.hidden = false;
    iconFb.hidden = true;
  }
  syncBisWhenAugmentCleared(card);
  syncPublishedPreview();
}


function initAugmentSection() {
  const gridRoot = document.getElementById('create-augments');
  const err = document.getElementById('create-augments-error');
  if (!gridRoot) return;

  loadAugmentPool()
    .then(() => {
      /** @type {NodeListOf<HTMLElement>} */
      const groups = gridRoot.querySelectorAll('.create-augment-group');
      groups.forEach((group) => {
        const tier = group.getAttribute('data-tier');
        /** @type {'silver'|'gold'|'prismatic'} */
        const t = tier === 'gold' || tier === 'prismatic' ? tier : 'silver';
        const pool = augmentPoolByTier && augmentPoolByTier[t] ? augmentPoolByTier[t] : [];
        /** @type {NodeListOf<HTMLSelectElement>} */
        const selects = group.querySelectorAll('.create-augment-select');
        selects.forEach((sel) => {
          if (!sel.getAttribute('data-placeholder')) {
            const card = sel.closest('.create-augment-card');
            const nameEl = card && card.querySelector('[data-role="name"]');
            if (nameEl) sel.setAttribute('data-placeholder', nameEl.textContent || '');
          }
          pool.forEach((row) => {
            const opt = document.createElement('option');
            opt.value = row.name;
            opt.textContent = row.name;
            if (row.icon) opt.setAttribute('data-icon', row.icon);
            sel.appendChild(opt);
          });
          sel.addEventListener('change', () => applyAugmentSelection(sel));
        });
      });
      initAugmentBisCheckboxes();
      syncPublishedPreview();
    })
    .catch(() => {
      if (err) {
        err.hidden = false;
        err.textContent = 'Could not load augment list (mayhem-augment-pool.json). Check your connection and refresh.';
      }
    });
}

/**
 * @param {string[]} items
 * @param {string} pathKey
 */
function renderItemRow(items, pathKey) {
  const parts = [];
  items.forEach((id, idx) => {
    const meta = itemCatalog[id];
    const name = meta ? meta.name : `Item ${id}`;
    const icon = itemIconUrl(id);
    if (idx > 0) {
      parts.push('<span class="bd-item-icon-arrow" aria-hidden="true">→</span>');
    }
    parts.push(`
      <div class="create-item-slot-wrap">
        <div class="bd-item-icon-slot">
          <img src="${escapeHtml(icon)}" alt="" width="60" height="60" loading="lazy" class="bd-item-preview-img" onerror="this.classList.add('bd-icon-err');" />
          <span class="bd-item-icon-name">${escapeHtml(name)}</span>
        </div>
        <button type="button" class="create-item-remove" data-path="${escapeHtml(pathKey)}" data-idx="${idx}" aria-label="Remove ${escapeHtml(name)}">×</button>
      </div>
    `);
  });

  if (items.length < MAX_ITEMS_PER_PATH) {
    if (items.length > 0) {
      parts.push('<span class="bd-item-icon-arrow bd-item-icon-arrow--dim" aria-hidden="true">→</span>');
    }
    parts.push(`
      <div class="create-item-slot create-item-slot--empty" aria-hidden="true">
        <span class="create-item-placeholder">+</span>
      </div>
    `);
  }

  return `<div class="create-item-row bd-item-icon-row" role="group" aria-label="Item build order">${parts.join('')}</div>`;
}

/**
 * Reads augment grid + BiS order — shared by submit payload and published preview.
 * @returns {{ augmentPicks: { prismatic: object[], gold: object[], silver: object[] }, bisChaseRefs: string[], bisChasePicks: object[] }}
 */
function collectAugmentPayloadFromForm() {
  /** @type {{ prismatic: { name: string, icon: string }[], gold: { name: string, icon: string }[], silver: { name: string, icon: string }[] }} */
  const augmentPicks = { prismatic: [], gold: [], silver: [] };
  document.querySelectorAll('.create-augment-group').forEach((group) => {
    const tier = group.getAttribute('data-tier');
    if (!tier || !augmentPicks[tier]) return;
    group.querySelectorAll('.create-augment-select').forEach((sel) => {
      const v = (sel.value || '').trim();
      if (!v) {
        augmentPicks[tier].push({ name: '', icon: '' });
        return;
      }
      const icon = resolveAugmentIconUrl(/** @type {HTMLSelectElement} */ (sel), v);
      augmentPicks[tier].push({ name: v, icon: icon || '' });
    });
  });

  const bisChaseRefs = bisChaseKeyOrder.slice(0, MAX_BIS_MARKS);
  const bisChasePicks = bisChaseRefs
    .map((key) => {
      const parts = key.split(':');
      const tier = parts[0];
      const idx = parseInt(parts[1], 10);
      const pick = augmentPicks[tier] && augmentPicks[tier][idx];
      if (!pick || !pick.name) return null;
      return {
        name: pick.name,
        icon: pick.icon || '',
        tier,
        slotIndex: idx,
      };
    })
    .filter(Boolean);

  return { augmentPicks, bisChaseRefs, bisChasePicks };
}

/**
 * Fallback strip when no BiS boxes are checked (matches build-detail helper).
 * @param {{ prismatic: object[], gold: object[], silver: object[] }} picks
 */
function computeBisChaseFourFromAugmentPicks(picks) {
  if (!picks) return [];
  const attempts = [
    ['prismatic', 0], ['gold', 0], ['silver', 0], ['prismatic', 1],
    ['gold', 1], ['silver', 1], ['silver', 2], ['gold', 2],
  ];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < attempts.length && out.length < 4; i++) {
    const tier = attempts[i][0];
    const idx = attempts[i][1];
    const arr = picks[tier];
    if (!arr || !arr[idx] || !arr[idx].name) continue;
    const name = arr[idx].name;
    if (seen.has(name)) continue;
    seen.add(name);
    const slotPrefix = { prismatic: 'P', gold: 'G', silver: 'S' };
    out.push({
      name,
      icon: arr[idx].icon || '',
      tier,
      slotLabel: (slotPrefix[tier] || '?') + (idx + 1),
    });
  }
  return out;
}

/** Mirrors build-detail rendering for core items + augments (live on create page). */
function syncPublishedPreview() {
  const itemsEl = document.getElementById('create-preview-items-path');
  const emptyEl = document.getElementById('create-preview-items-empty');
  const noteEl = document.getElementById('create-preview-items-note');
  const useEl = document.getElementById('create-preview-core-usecase');
  const bisHost = document.getElementById('create-preview-bis-chase');
  const tiersRoot = document.getElementById('create-preview-aug-tiers');
  if (!itemsEl || !tiersRoot) return;

  const ids = pathsState.main.items;
  if (!ids.length) {
    itemsEl.innerHTML = '';
    itemsEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
  } else {
    if (emptyEl) emptyEl.hidden = true;
    itemsEl.hidden = false;
    const row = document.createElement('div');
    row.className = 'bd-item-icon-row';
    ids.forEach((id, i) => {
      if (i > 0) {
        const ar = document.createElement('span');
        ar.className = 'bd-item-icon-arrow';
        ar.setAttribute('aria-hidden', 'true');
        ar.textContent = '→';
        row.appendChild(ar);
      }
      const meta = itemCatalog[id];
      const name = meta ? meta.name : `Item ${id}`;
      const slot = document.createElement('div');
      slot.className = 'bd-item-icon-slot';
      const img = document.createElement('img');
      img.src = itemIconUrl(id);
      img.alt = '';
      img.width = 60;
      img.height = 60;
      img.onerror = () => img.classList.add('bd-icon-err');
      const nm = document.createElement('span');
      nm.className = 'bd-item-icon-name';
      nm.textContent = name;
      slot.appendChild(img);
      slot.appendChild(nm);
      row.appendChild(slot);
    });
    itemsEl.innerHTML = '';
    itemsEl.appendChild(row);
  }

  const mainHost = document.querySelector('.create-path-block[data-path-key="main"]');
  const mainNotes = (mainHost?.querySelector('input[name="main_notes"]')?.value || '').trim();
  const mainUsecase = (mainHost?.querySelector('textarea[name="main_usecase"]')?.value || '').trim();
  if (noteEl) {
    noteEl.textContent = mainNotes;
    noteEl.hidden = !mainNotes;
  }
  if (useEl) {
    useEl.textContent = mainUsecase;
    useEl.hidden = !mainUsecase;
  }

  const { augmentPicks, bisChaseRefs, bisChasePicks } = collectAugmentPayloadFromForm();
  const bisRefSet = new Set(bisChaseRefs);

  if (bisHost) {
    /** @type {{ name: string, icon: string, slotLabel: string }[]} */
    let chase = [];
    if (bisChasePicks && bisChasePicks.length) {
      const tierLetter = { prismatic: 'P', gold: 'G', silver: 'S' };
      bisChasePicks.forEach((p, idx) => {
        if (!p || !p.name) return;
        const sl =
          p.tier != null && p.slotIndex != null && tierLetter[p.tier]
            ? tierLetter[p.tier] + (p.slotIndex + 1)
            : `BiS ${idx + 1}`;
        chase.push({ name: p.name, icon: p.icon || '', slotLabel: sl });
      });
    } else {
      chase = computeBisChaseFourFromAugmentPicks(augmentPicks).map((c) => ({
        name: c.name,
        icon: c.icon,
        slotLabel: c.slotLabel,
      }));
    }

    if (chase.length) {
      bisHost.hidden = false;
      bisHost.innerHTML = '<div class="bd-aug-bis-chase-head">★ Top 4 BiS to chase</div>';
      const row = document.createElement('div');
      row.className = 'bd-aug-bis-chase-row';
      chase.forEach((c) => {
        const slot = document.createElement('div');
        slot.className = 'bd-aug-bis-chase-pick';
        const sl = document.createElement('span');
        sl.className = 'bd-aug-bis-chase-sl';
        sl.textContent = c.slotLabel;
        const img = document.createElement('img');
        img.className = 'bd-aug-bis-chase-icon';
        if (c.icon) {
          img.src = c.icon;
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          img.loading = 'eager';
          img.decoding = 'async';
          img.onerror = () => img.classList.add('bd-icon-err');
        } else {
          img.classList.add('bd-icon-err');
          img.removeAttribute('src');
        }
        const nm = document.createElement('span');
        nm.className = 'bd-aug-bis-chase-name';
        nm.textContent = c.name;
        slot.appendChild(sl);
        slot.appendChild(img);
        slot.appendChild(nm);
        row.appendChild(slot);
      });
      bisHost.appendChild(row);
    } else {
      bisHost.hidden = true;
      bisHost.innerHTML = '';
    }
  }

  const SLOT_PREFIX = { prismatic: 'P', gold: 'G', silver: 'S' };
  const tierMeta = [
    { key: 'prismatic', label: 'Top 4 Prismatic', badge: 'tier-prismatic' },
    { key: 'gold', label: 'Top 4 Gold', badge: 'tier-gold' },
    { key: 'silver', label: 'Top 4 Silver', badge: 'tier-silver' },
  ];
  tiersRoot.innerHTML = '';
  tierMeta.forEach((meta) => {
    const key = meta.key;
    const picks = augmentPicks[key];
    if (!picks || !picks.length) return;
    const tier = document.createElement('div');
    tier.className = 'bd-aug-tier';
    tier.innerHTML = `<div class="bd-aug-tier-head"><span class="bd-aug-tier-badge ${meta.badge}">${escapeHtml(meta.label)}</span></div>`;
    const picksRow = document.createElement('div');
    picksRow.className = 'bd-aug-picks';
    picks.forEach((p, idx) => {
      const empty = !p.name;
      const slotKey = `${key}:${idx}`;
      const slot = document.createElement('div');
      slot.className =
        'bd-aug-pick bd-aug-pick--tall' +
        (empty ? ' bd-aug-pick--empty' : '') +
        (bisRefSet.has(slotKey) ? ' bd-aug-pick--bis' : '');
      const lab = document.createElement('span');
      lab.className = 'bd-aug-slot-label';
      lab.textContent = (SLOT_PREFIX[key] || '?') + (idx + 1);
      if (bisRefSet.has(slotKey)) {
        const bisBadge = document.createElement('span');
        bisBadge.className = 'bd-aug-pick-bis-badge';
        bisBadge.setAttribute('aria-label', 'Marked as BiS');
        bisBadge.textContent = 'BiS';
        slot.appendChild(bisBadge);
      }
      const img = document.createElement('img');
      img.className = 'bd-aug-pick-icon';
      if (!empty && p.icon) {
        img.src = p.icon;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.loading = 'eager';
        img.decoding = 'async';
        img.onerror = () => img.classList.add('bd-icon-err');
      } else {
        img.classList.add('bd-icon-err');
        img.removeAttribute('src');
      }
      const nm = document.createElement('span');
      nm.className = 'bd-aug-pick-name';
      nm.textContent = empty ? '—' : p.name;
      slot.appendChild(lab);
      slot.appendChild(img);
      slot.appendChild(nm);
      picksRow.appendChild(slot);
    });
    tier.appendChild(picksRow);
    tiersRoot.appendChild(tier);
  });
}

/**
 * @param {string} pathKey
 */
function bindRowButtons(pathKey, container) {
  container.querySelectorAll('.create-item-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const pk = btn.getAttribute('data-path');
      removeItemAt(pk, idx);
    });
  });
}

/**
 * @param {string} pathKey
 * @param {number} idx
 */
function removeItemAt(pathKey, idx) {
  if (pathKey === 'main') {
    pathsState.main.items.splice(idx, 1);
  } else {
    const block = pathsState.alternates.find((a) => a.uid === pathKey);
    if (block) block.items.splice(idx, 1);
  }
  refreshPathDom(pathKey);
}

/**
 * @param {string} pathKey
 * @param {string} itemId
 */
function addItemToPath(pathKey, itemId) {
  let list;
  if (pathKey === 'main') list = pathsState.main.items;
  else {
    const block = pathsState.alternates.find((a) => a.uid === pathKey);
    if (!block) return;
    list = block.items;
  }
  if (list.length >= MAX_ITEMS_PER_PATH) return;
  if (list.includes(itemId)) return;
  list.push(itemId);
  refreshPathDom(pathKey);
}

/**
 * @param {string} pathKey
 */
function refreshPathDom(pathKey) {
  const host = document.querySelector(`.create-path-block[data-path-key="${CSS.escape(pathKey)}"]`);
  if (!host) return;
  const rowEl = host.querySelector('.create-item-row-host');
  if (!rowEl) return;

  const list = pathKey === 'main'
    ? pathsState.main.items
    : (pathsState.alternates.find((a) => a.uid === pathKey) || { items: [] }).items;

  rowEl.innerHTML = renderItemRow(list, pathKey);
  bindRowButtons(pathKey, rowEl);
  syncPublishedPreview();
}

function wireSearch(pathKey) {
  const host = document.querySelector(`.create-path-block[data-path-key="${CSS.escape(pathKey)}"]`);
  if (!host) return;

  const input = host.querySelector('.create-item-search-input');
  const listEl = host.querySelector('.create-item-search-results');
  if (!input || !listEl) return;

  function renderResults() {
    const rows = filterItems(input.value);
    listEl.innerHTML = rows
      .map((r) => {
        const icon = itemIconUrl(r.id);
        return `
          <button type="button" class="create-search-hit" data-id="${escapeHtml(r.id)}">
            <img src="${escapeHtml(icon)}" alt="" width="32" height="32" loading="lazy" />
            <span>${escapeHtml(r.name)}</span>
          </button>
        `;
      })
      .join('');
    listEl.hidden = rows.length === 0;
  }

  input.addEventListener('input', () => renderResults());
  input.addEventListener('focus', () => renderResults());

  listEl.addEventListener('click', (e) => {
    const hit = e.target.closest('.create-search-hit');
    if (!hit) return;
    const id = hit.getAttribute('data-id');
    if (id) {
      addItemToPath(pathKey, id);
      input.value = '';
      listEl.innerHTML = '';
      listEl.hidden = true;
    }
  });
}

function initCreateSearchCloseOnOutsideClick() {
  if (initCreateSearchCloseOnOutsideClick.done) return;
  initCreateSearchCloseOnOutsideClick.done = true;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.create-item-search-results').forEach((listEl) => {
      if (listEl.hidden) return;
      const pathHost = listEl.closest('.create-path-block');
      const champHost = listEl.closest('.create-champ-search-host');
      const host = pathHost || champHost;
      if (host && !host.contains(e.target)) listEl.hidden = true;
    });
  });
}

/** Full roster from `js/champions-data.js` (load before this script on create.html). */
function getCreateFormChampions() {
  return typeof ARAM_CHAMPIONS !== 'undefined' ? ARAM_CHAMPIONS : [];
}

function getChampionMetaById(id) {
  if (!id) return null;
  if (typeof ARAM_CHAMPIONS_BY_ID !== 'undefined' && ARAM_CHAMPIONS_BY_ID[id]) {
    return ARAM_CHAMPIONS_BY_ID[id];
  }
  return getCreateFormChampions().find((c) => c.id === id) || null;
}

function isCreateChampionSelected() {
  const id = (document.getElementById('createChampionId')?.value || '').trim();
  return Boolean(id && getChampionMetaById(id));
}

function isCreateBuildTagSelected() {
  const roleSlug = (document.getElementById('createRoleTag')?.value || '').trim();
  const playSlug = (document.getElementById('createPlaystyleTag')?.value || '').trim();
  if (!roleSlug) return false;
  if (typeof ARAM_BUILD_TAG_BY_SLUG === 'undefined') return true;
  if (!ARAM_BUILD_TAG_BY_SLUG[roleSlug]) return false;
  if (!playSlug) return true;
  return Boolean(ARAM_BUILD_TAG_BY_SLUG[playSlug]);
}

function syncCreateSubmitBuildButton() {
  const btn = document.getElementById('createSubmitBuildBtn');
  if (!btn) return;
  const ok = isCreateChampionSelected() && isCreateBuildTagSelected();
  btn.disabled = !ok;
  if (!isCreateChampionSelected()) {
    btn.title = 'Choose a champion before naming your build';
  } else if (!isCreateBuildTagSelected()) {
    btn.title = 'Choose a class role for your build';
  } else {
    btn.title = 'Your build will be submitted after naming';
  }
}

function initCreateTagSelects() {
  const roleSel = document.getElementById('createRoleTag');
  const playSel = document.getElementById('createPlaystyleTag');
  if (!roleSel || !playSel || typeof ARAM_ROLE_TAG_LIST === 'undefined' || typeof ARAM_PLAYSTYLE_TAG_LIST === 'undefined') return;

  ARAM_ROLE_TAG_LIST.forEach(({ slug, label }) => {
    const o = document.createElement('option');
    o.value = slug;
    o.textContent = label;
    roleSel.appendChild(o);
  });
  ARAM_PLAYSTYLE_TAG_LIST.forEach(({ slug, label }) => {
    const o = document.createElement('option');
    o.value = slug;
    o.textContent = label;
    playSel.appendChild(o);
  });

  roleSel.addEventListener('change', () => syncCreateSubmitBuildButton());
  playSel.addEventListener('change', () => syncCreateSubmitBuildButton());
}

/** Same art as the client; wiki Special:FilePath URLs often 404 for spell PNGs. */
const DDRAGON_SPELL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell`;
const CREATE_SUMMONER_ICON = {
  snowball: `${DDRAGON_SPELL}/SummonerSnowball.png`,
  clarity: `${DDRAGON_SPELL}/SummonerMana.png`,
  ignite: `${DDRAGON_SPELL}/SummonerDot.png`,
  flash: `${DDRAGON_SPELL}/SummonerFlash.png`,
  ghost: `${DDRAGON_SPELL}/SummonerHaste.png`,
  heal: `${DDRAGON_SPELL}/SummonerHeal.png`,
  cleanse: `${DDRAGON_SPELL}/SummonerBoost.png`,
};

const YOUTUBE_NOCOOKIE_EMBED = 'https://www.youtube-nocookie.com/embed/';
const YT_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

/**
 * Strict allowlist: only youtu.be / youtube.com / m.youtube.com / youtube-nocookie.com.
 * @param {string} raw
 * @returns {string | null} 11-character video id
 */
function parseYoutubeVideoIdFromUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let urlString = trimmed;
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const seg = url.pathname.split('/').filter(Boolean)[0];
    return seg && YT_VIDEO_ID_RE.test(seg) ? seg : null;
  }

  if (url.pathname === '/watch' || url.pathname === '/watch/') {
    const v = url.searchParams.get('v');
    return v && YT_VIDEO_ID_RE.test(v) ? v : null;
  }

  if (url.pathname.startsWith('/embed/')) {
    const seg = url.pathname.slice('/embed/'.length).split('/')[0];
    return seg && YT_VIDEO_ID_RE.test(seg) ? seg : null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'shorts' && parts[1]) {
    return YT_VIDEO_ID_RE.test(parts[1]) ? parts[1] : null;
  }
  if (parts[0] === 'live' && parts[1]) {
    return YT_VIDEO_ID_RE.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

/**
 * @param {string} videoId
 * @param {number | null} startSec
 * @param {number | null} endSec
 * @returns {string}
 */
function buildYoutubeNoCookieEmbedSrc(videoId, startSec, endSec) {
  const base = `${YOUTUBE_NOCOOKIE_EMBED}${encodeURIComponent(videoId)}`;
  const p = new URLSearchParams();
  p.set('rel', '0');
  if (startSec != null && startSec >= 0 && Number.isFinite(startSec)) {
    p.set('start', String(Math.floor(startSec)));
  }
  if (endSec != null && endSec > 0 && Number.isFinite(endSec)) {
    p.set('end', String(Math.floor(endSec)));
  }
  return `${base}?${p.toString()}`;
}

/**
 * @param {{
 *   urlIn: HTMLInputElement,
 *   startIn: HTMLInputElement | null,
 *   endIn: HTMLInputElement | null,
 *   hidId: HTMLInputElement,
 *   hidStart: HTMLInputElement,
 *   hidEnd: HTMLInputElement,
 *   err: HTMLElement,
 *   wrap: HTMLElement,
 *   iframe: HTMLIFrameElement,
 *   clearBtn: HTMLButtonElement | null,
 * }} slot
 * @returns {(() => void) | null}
 */
function wireYoutubeHighlightSlot(slot) {
  const { urlIn, startIn, endIn, hidId, hidStart, hidEnd, err, wrap, iframe, clearBtn } = slot;
  if (!urlIn || !hidId || !hidStart || !hidEnd || !iframe || !err || !wrap) return null;

  let debounceTimer = 0;

  function showError(msg) {
    err.textContent = msg;
    err.hidden = !msg;
  }

  /**
   * @param {HTMLInputElement | null} el
   * @returns {null | number | NaN}
   */
  function parseOptionalSec(el) {
    if (!el) return null;
    const v = el.value.trim();
    if (v === '') return null;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return n;
  }

  function sync() {
    const raw = urlIn.value.trim();
    showError('');

    if (!raw) {
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }

    const vid = parseYoutubeVideoIdFromUrl(raw);
    if (!vid) {
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      showError(
        'Only YouTube links from youtube.com, m.youtube.com, youtu.be, or youtube-nocookie.com are accepted (watch, embed, Shorts, or Live).'
      );
      return;
    }

    const startSec = parseOptionalSec(startIn);
    const endSec = parseOptionalSec(endIn);
    if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
      showError('Start and end must be whole seconds ≥ 0, or left blank.');
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (endSec != null && startSec == null) {
      showError('Set a start time (seconds) when you set an end time.');
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (startSec != null && endSec != null && endSec <= startSec) {
      showError('End time must be greater than start time.');
      hidId.value = '';
      hidStart.value = '';
      hidEnd.value = '';
      iframe.removeAttribute('src');
      wrap.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      return;
    }

    hidId.value = vid;
    hidStart.value = startSec != null ? String(startSec) : '';
    hidEnd.value = endSec != null ? String(endSec) : '';

    iframe.src = buildYoutubeNoCookieEmbedSrc(vid, startSec, endSec);
    wrap.hidden = false;
    if (clearBtn) clearBtn.hidden = false;
  }

  function scheduleSync(delayMs) {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(sync, delayMs);
  }

  urlIn.addEventListener('input', () => scheduleSync(400));
  urlIn.addEventListener('blur', sync);
  if (startIn) {
    startIn.addEventListener('input', () => scheduleSync(200));
    startIn.addEventListener('blur', sync);
  }
  if (endIn) {
    endIn.addEventListener('input', () => scheduleSync(200));
    endIn.addEventListener('blur', sync);
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      urlIn.value = '';
      if (startIn) startIn.value = '';
      if (endIn) endIn.value = '';
      sync();
    });
  }

  return () => {
    window.clearTimeout(debounceTimer);
    sync();
  };
}

function initYoutubeHighlightSection() {
  /** @type {(() => void)[]} */
  const syncFns = [];

  const slots = [
    {
      urlIn: document.getElementById('youtubeEarlyUrlInput'),
      startIn: document.getElementById('youtubeEarlyStartInput'),
      endIn: document.getElementById('youtubeEarlyEndInput'),
      hidId: document.getElementById('youtubeEarlyVideoId'),
      hidStart: document.getElementById('youtubeEarlyStartSec'),
      hidEnd: document.getElementById('youtubeEarlyEndSec'),
      err: document.getElementById('create-youtube-error-early'),
      wrap: document.getElementById('youtubeEarlyPreviewWrap'),
      iframe: document.getElementById('youtubeEarlyIframe'),
      clearBtn: document.getElementById('youtubeEarlyClear'),
    },
    {
      urlIn: document.getElementById('youtubeMidUrlInput'),
      startIn: document.getElementById('youtubeMidStartInput'),
      endIn: document.getElementById('youtubeMidEndInput'),
      hidId: document.getElementById('youtubeMidVideoId'),
      hidStart: document.getElementById('youtubeMidStartSec'),
      hidEnd: document.getElementById('youtubeMidEndSec'),
      err: document.getElementById('create-youtube-error-mid'),
      wrap: document.getElementById('youtubeMidPreviewWrap'),
      iframe: document.getElementById('youtubeMidIframe'),
      clearBtn: document.getElementById('youtubeMidClear'),
    },
    {
      urlIn: document.getElementById('youtubeLateUrlInput'),
      startIn: document.getElementById('youtubeLateStartInput'),
      endIn: document.getElementById('youtubeLateEndInput'),
      hidId: document.getElementById('youtubeLateVideoId'),
      hidStart: document.getElementById('youtubeLateStartSec'),
      hidEnd: document.getElementById('youtubeLateEndSec'),
      err: document.getElementById('create-youtube-error-late'),
      wrap: document.getElementById('youtubeLatePreviewWrap'),
      iframe: document.getElementById('youtubeLateIframe'),
      clearBtn: document.getElementById('youtubeLateClear'),
    },
  ];

  slots.forEach((s) => {
    const fn = wireYoutubeHighlightSlot(s);
    if (fn) syncFns.push(fn);
  });

  const form = document.getElementById('createBuildForm');
  if (form && syncFns.length) {
    /** @type {{ _youtubeSyncFns?: (() => void)[] }} */
    const f = form;
    f._youtubeSyncFns = syncFns;
    form.addEventListener('submit', () => {
      syncFns.forEach((fn) => fn());
    });
  }
}

/**
 * @param {string} query
 */
function filterCreateFormChampions(query) {
  const list = getCreateFormChampions();
  const q = query.trim().toLowerCase();
  if (!q) return list.slice();
  return list.filter((c) => c.name.toLowerCase().includes(q));
}

/**
 * @param {HTMLSelectElement} selectEl
 * @param {HTMLImageElement} imgEl
 */
function updateCreateSummonerPreview(selectEl, imgEl) {
  const key = selectEl.value;
  const url = key ? CREATE_SUMMONER_ICON[/** @type {keyof typeof CREATE_SUMMONER_ICON} */ (key)] : '';
  imgEl.onerror = () => {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.hidden = true;
    imgEl.onerror = null;
  };
  if (!url) {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.hidden = true;
    return;
  }
  imgEl.alt = (selectEl.selectedOptions[0] && selectEl.selectedOptions[0].textContent.trim()) || '';
  imgEl.onload = () => {
    imgEl.hidden = false;
    imgEl.onload = null;
  };
  imgEl.loading = 'eager';
  imgEl.src = url;
  if (imgEl.complete && imgEl.naturalWidth > 0) imgEl.hidden = false;
}

function initCreateLoadoutSection() {
  const input = document.getElementById('createChampSearchInput');
  const results = document.getElementById('createChampSearchResults');
  const hiddenChamp = document.getElementById('createChampionId');
  const summaryEl = document.getElementById('createChampSummary');
  const searchWrap = document.getElementById('createChampSearchWrap');
  const selectedImg = document.getElementById('createChampSelectedImg');
  const selectedName = document.getElementById('createChampSelectedName');
  const loadoutRoot = document.getElementById('create-loadout');
  if (!input || !results || !hiddenChamp || !summaryEl || !searchWrap || !selectedImg || !selectedName) {
    return;
  }

  function setResultsOpen(open) {
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderChampResults() {
    const rows = filterCreateFormChampions(input.value);
    results.innerHTML = rows
      .map(
        (c) => `
          <button type="button" class="create-search-hit" data-id="${escapeHtml(c.id)}" role="option">
            <img src="${escapeHtml(c.icon)}" alt="" width="32" height="32" loading="lazy" />
            <span>${escapeHtml(c.name)}</span>
          </button>
        `
      )
      .join('');
    const show = rows.length > 0;
    results.hidden = !show;
    setResultsOpen(show);
  }

  /**
   * @param {string} id
   */
  function applyChampionChoice(id) {
    const c = getChampionMetaById(id);
    if (!c) return;
    hiddenChamp.value = c.id;
    selectedImg.src = c.icon;
    selectedImg.alt = c.name;
    selectedName.textContent = c.name;
    selectedImg.removeAttribute('hidden');
    summaryEl.removeAttribute('hidden');
    searchWrap.setAttribute('hidden', '');
    input.value = '';
    results.innerHTML = '';
    results.hidden = true;
    setResultsOpen(false);
    syncCreateSubmitBuildButton();
  }

  function clearChampion() {
    hiddenChamp.value = '';
    summaryEl.setAttribute('hidden', '');
    searchWrap.removeAttribute('hidden');
    /* Keep portrait + alt text until a new champion is chosen (no empty placeholder). */
    input.value = '';
    results.innerHTML = '';
    results.hidden = true;
    setResultsOpen(false);
    syncCreateSubmitBuildButton();
  }

  input.addEventListener('input', () => renderChampResults());
  input.addEventListener('focus', () => renderChampResults());

  results.addEventListener('click', (e) => {
    const hit = e.target.closest('.create-search-hit');
    if (!hit) return;
    const id = hit.getAttribute('data-id');
    if (id) applyChampionChoice(id);
  });

  if (loadoutRoot) {
    loadoutRoot.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('#createChampClear');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      clearChampion();
    });
  }

  const s1 = document.getElementById('createSummoner1');
  const s2 = document.getElementById('createSummoner2');
  const i1 = document.getElementById('createSummoner1Img');
  const i2 = document.getElementById('createSummoner2Img');
  if (s1 && i1) {
    s1.addEventListener('change', () => updateCreateSummonerPreview(s1, i1));
    updateCreateSummonerPreview(s1, i1);
  }
  if (s2 && i2) {
    s2.addEventListener('change', () => updateCreateSummonerPreview(s2, i2));
    updateCreateSummonerPreview(s2, i2);
  }

  syncCreateSubmitBuildButton();
}

function renderAlternateBlocks() {
  const wrap = document.getElementById('create-alt-paths');
  if (!wrap) return;

  wrap.innerHTML = pathsState.alternates
    .map((block) => {
      const pk = block.uid;
      const list = block.items;
      return `
        <div class="create-path-block create-path-block--alt" data-path-key="${escapeHtml(pk)}">
          <div class="create-path-alt-head">
            <span class="bd-subsection-title">Alternate path</span>
            <button type="button" class="btn btn-ghost btn-sm create-alt-remove" data-uid="${escapeHtml(pk)}">Remove</button>
          </div>
          <label class="create-field">
            <span class="create-field-label">Short label</span>
            <input type="text" class="create-input create-alt-path-label" placeholder="e.g. vs heavy tanks, pure ranged comp" maxlength="120" />
          </label>
          <label class="create-field">
            <span class="create-field-label">When to use this path</span>
            <textarea class="create-textarea create-alt-path-usecase" rows="3" placeholder="Explain the enemy team patterns or game states where this item order shines instead of your core path."></textarea>
          </label>
          <label class="create-field">
            <span class="create-field-label">Situational notes (optional)</span>
            <input type="text" class="create-input create-alt-path-notes" placeholder="e.g. swap Void Staff earlier against double-tank frontlines" />
          </label>
          <div class="bd-subsection-title" style="margin-top:8px;">Items</div>
          <div class="create-item-row-host">${renderItemRow(list, pk)}</div>
          <div class="create-item-search">
            <input type="text" class="create-item-search-input" placeholder="Search items by name…" autocomplete="off" aria-label="Search items to add" />
            <div class="create-item-search-results" hidden></div>
          </div>
        </div>
      `;
    })
    .join('');

  pathsState.alternates.forEach((block) => {
    const host = wrap.querySelector(`.create-path-block[data-path-key="${CSS.escape(block.uid)}"]`);
    if (host) {
      const rowEl = host.querySelector('.create-item-row-host');
      if (rowEl) bindRowButtons(block.uid, rowEl);
      wireSearch(block.uid);
    }
  });

  wrap.querySelectorAll('.create-alt-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-uid');
      pathsState.alternates = pathsState.alternates.filter((a) => a.uid !== uid);
      renderAlternateBlocks();
    });
  });
  syncPublishedPreview();
}

function initCreateBuildPage() {
  initCreateSearchCloseOnOutsideClick();
  initAugmentSection();
  initCreateTagSelects();
  initCreateLoadoutSection();
  initYoutubeHighlightSection();
  initCreateSubmitNameDialog();

  const mainHost = document.querySelector('.create-path-block[data-path-key="main"]');
  if (!mainHost) return;

  loadItemCatalog()
    .then(() => {
      const rowEl = mainHost.querySelector('.create-item-row-host');
      if (rowEl) {
        rowEl.innerHTML = renderItemRow(pathsState.main.items, 'main');
        bindRowButtons('main', rowEl);
      }
      wireSearch('main');
      const addAltBtn = document.getElementById('addAltPath');
      if (addAltBtn) addAltBtn.disabled = false;
      const mu = mainHost.querySelector('textarea[name="main_usecase"]');
      const mn = mainHost.querySelector('input[name="main_notes"]');
      if (mu) mu.addEventListener('input', syncPublishedPreview);
      if (mn) mn.addEventListener('input', syncPublishedPreview);
      syncPublishedPreview();
    })
    .catch(() => {
      const err = document.getElementById('create-items-error');
      if (err) {
        err.hidden = false;
        err.textContent = 'Could not load item icons. Check your connection and refresh.';
      }
    });

  const addAltBtn = document.getElementById('addAltPath');
  if (addAltBtn) {
    addAltBtn.addEventListener('click', () => {
      const uid = `alt-${++altUid}`;
      pathsState.alternates.push({ uid, items: [] });
      renderAlternateBlocks();
    });
  }
}

/* ============================================================
   BUILD PERSISTENCE — localStorage helpers
   Key: 'arambound_user_builds'  → object keyed by build id
============================================================ */

/** @returns {Record<string, object>} */
function loadUserBuilds() {
  try {
    return JSON.parse(localStorage.getItem('arambound_user_builds') || '{}');
  } catch {
    return {};
  }
}

/**
 * @param {string} id
 * @param {object} build
 */
function saveUserBuild(id, build) {
  const all = loadUserBuilds();
  all[id] = build;
  try {
    localStorage.setItem('arambound_user_builds', JSON.stringify(all));
  } catch (e) {
    console.error('Could not save build to localStorage', e);
  }
}

/**
 * @param {string} videoId
 * @param {string} startStr
 * @param {string} endStr
 */
function buildStoredYoutubeEmbedUrl(videoId, startStr, endStr) {
  const p = new URLSearchParams({ rel: '0' });
  if (startStr) p.set('start', startStr);
  if (endStr) p.set('end', endStr);
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${p.toString()}`;
}

/**
 * Collect all filled-in values from the create form and return a build object
 * compatible with the BUILDS format used in build-detail.html.
 * @param {string} title
 * @returns {object|null}
 */
function collectFormData(title) {
  const DDRAGON_VER = DDRAGON_VERSION;

  // Champion (required — submit UI prevents saving without one)
  const champId = (document.getElementById('createChampionId')?.value || '').trim();
  const champMeta = champId ? getChampionMetaById(champId) : null;
  if (!champMeta) return null;
  const champName = champMeta.name;
  const champRole = champMeta.tags && champMeta.tags.length ? champMeta.tags.join(' · ') : 'Unknown';
  const champImg = champMeta.loading;
  const champIcon = champMeta.icon;

  const roleSlug = (document.getElementById('createRoleTag')?.value || '').trim();
  const playSlug = (document.getElementById('createPlaystyleTag')?.value || '').trim();
  if (!roleSlug) return null;
  const roleEntry =
    typeof ARAM_BUILD_TAG_BY_SLUG !== 'undefined' ? ARAM_BUILD_TAG_BY_SLUG[roleSlug] : null;
  if (!roleEntry) return null;
  let playEntry = null;
  if (playSlug) {
    playEntry =
      typeof ARAM_BUILD_TAG_BY_SLUG !== 'undefined' ? ARAM_BUILD_TAG_BY_SLUG[playSlug] : null;
    if (!playEntry) return null;
  } else {
    playEntry = { slug: '', label: '', category: 'playstyle' };
  }
  const buildTagLabel = playSlug ? `${roleEntry.label} · ${playEntry.label}` : roleEntry.label;

  // Summoners
  const s1Key = document.getElementById('createSummoner1')?.value || '';
  const s2Key = document.getElementById('createSummoner2')?.value || '';
  const spellLabel = {
    snowball: 'Snowball', clarity: 'Clarity', ignite: 'Ignite',
    flash: 'Flash', ghost: 'Ghost', heal: 'Heal', cleanse: 'Cleanse',
  };
  const spells = [
    s1Key ? (spellLabel[s1Key] || s1Key) : null,
    s2Key ? (spellLabel[s2Key] || s2Key) : null,
  ].filter(Boolean);

  // Overview
  const description = (document.getElementById('overviewSummary')?.value || '').trim();

  // Items — core path
  const mainItems = pathsState.main.items.map((id) => {
    const meta = itemCatalog[id];
    return meta ? meta.name : `Item ${id}`;
  });
  const mainItemIds = pathsState.main.items.slice();

  const mainHost = document.querySelector('.create-path-block[data-path-key="main"]');
  const mainUsecase = (mainHost?.querySelector('textarea[name="main_usecase"]')?.value || '').trim();
  const mainNotes = (mainHost?.querySelector('input[name="main_notes"]')?.value || '').trim();

  /** @type {{ main: object, alternates: object[] }} */
  const itemPaths = {
    main: {
      usecase: mainUsecase,
      notes: mainNotes,
      itemIds: mainItemIds.slice(),
      itemNames: mainItems.slice(),
    },
    alternates: pathsState.alternates.map((block) => {
      const host = document.querySelector(
        `.create-path-block[data-path-key="${CSS.escape(block.uid)}"]`
      );
      const label = (host?.querySelector('.create-alt-path-label')?.value || '').trim();
      const usecase = (host?.querySelector('.create-alt-path-usecase')?.value || '').trim();
      const notes = (host?.querySelector('.create-alt-path-notes')?.value || '').trim();
      const ids = block.items.slice();
      const itemNames = ids.map((id) => {
        const meta = itemCatalog[id];
        return meta ? meta.name : `Item ${id}`;
      });
      return { label, usecase, notes, itemIds: ids, itemNames };
    }),
  };

  const itemsNote = mainNotes;

  const augPayload = collectAugmentPayloadFromForm();
  const augmentPicks = augPayload.augmentPicks;
  const bisChaseRefs = augPayload.bisChaseRefs;
  const bisChasePicks = augPayload.bisChasePicks;

  // Legacy card grid: one entry per tier with BiS + alternates (for any older readers)
  const augments = [];
  let slotNum = 1;
  (['silver', 'gold', 'prismatic']).forEach((tierKey) => {
    const filled = (augmentPicks[tierKey] || []).filter((p) => p.name);
    if (!filled.length) return;
    const bis = filled[0].name;
    const alts = filled.slice(1, 3).map((p) => p.name).filter(Boolean);
    const tierLabel = tierKey.charAt(0).toUpperCase() + tierKey.slice(1);
    augments.push({
      slot: slotNum++,
      tier: tierKey,
      tierLabel,
      bis,
      alts,
    });
  });

  // YouTube — all three phases
  const ytEarlyId = document.getElementById('youtubeEarlyVideoId')?.value?.trim() || '';
  const ytEarlyStart = document.getElementById('youtubeEarlyStartSec')?.value?.trim() || '';
  const ytEarlyEnd = document.getElementById('youtubeEarlyEndSec')?.value?.trim() || '';
  const ytMidId = document.getElementById('youtubeMidVideoId')?.value?.trim() || '';
  const ytMidStart = document.getElementById('youtubeMidStartSec')?.value?.trim() || '';
  const ytMidEnd = document.getElementById('youtubeMidEndSec')?.value?.trim() || '';
  const ytLateId = document.getElementById('youtubeLateVideoId')?.value?.trim() || '';
  const ytLateStart = document.getElementById('youtubeLateStartSec')?.value?.trim() || '';
  const ytLateEnd = document.getElementById('youtubeLateEndSec')?.value?.trim() || '';

  const youtubePhases = {
    early: ytEarlyId
      ? { videoId: ytEarlyId, startSec: ytEarlyStart, endSec: ytEarlyEnd, embedUrl: buildStoredYoutubeEmbedUrl(ytEarlyId, ytEarlyStart, ytEarlyEnd) }
      : null,
    mid: ytMidId
      ? { videoId: ytMidId, startSec: ytMidStart, endSec: ytMidEnd, embedUrl: buildStoredYoutubeEmbedUrl(ytMidId, ytMidStart, ytMidEnd) }
      : null,
    late: ytLateId
      ? { videoId: ytLateId, startSec: ytLateStart, endSec: ytLateEnd, embedUrl: buildStoredYoutubeEmbedUrl(ytLateId, ytLateStart, ytLateEnd) }
      : null,
  };

  let videoUrl = '';
  if (youtubePhases.early) videoUrl = youtubePhases.early.embedUrl;
  else if (youtubePhases.mid) videoUrl = youtubePhases.mid.embedUrl;
  else if (youtubePhases.late) videoUrl = youtubePhases.late.embedUrl;

  // Tags — champion, role, playstyle, new
  const tags = [champName, roleEntry.label, playEntry.label, 'New!'].filter(Boolean);

  // Build the object
  return {
    championKey: champMeta.id,
    champName,
    champRole,
    roleTag: roleSlug,
    roleTagLabel: roleEntry.label,
    buildTag: playSlug,
    buildTagLabel,
    playstyleTag: playSlug,
    playstyleLabel: playEntry.label,
    champImg,
    champIcon,
    title,
    author: 'You',
    authorInitial: 'Y',
    patch: DDRAGON_VER.split('.').slice(0, 2).join('.'),
    rating: 0,
    votes: 0,
    spicy: 0,
    tags,
    description: description || 'No overview provided.',
    strengths: [],
    weaknesses: [],
    difficulty: 'Medium',
    items: mainItems,
    itemIds: mainItemIds,
    itemsNote,
    itemPaths,
    spells,
    augments,
    augmentPicks,
    bisChaseRefs,
    bisChasePicks,
    videoUrl,
    youtubePhases,
    comments: [],
    _userSubmitted: true,
    _submittedAt: Date.now(),
  };
}

/** Last saved user build id (dialog redirect). Set on successful submit. */
let pendingUserBuildId = null;

function initCreateSubmitNameDialog() {
  const dialog = document.getElementById('createBuildNameDialog');
  const openBtn = document.getElementById('createSubmitBuildBtn');
  const panel = document.getElementById('createSubmitDialogPanel');
  const success = document.getElementById('createSubmitDialogSuccess');
  const input = document.getElementById('createSubmitDialogNameInput');
  const errEl = document.getElementById('createSubmitDialogError');
  const hiddenTitle = document.getElementById('createBuildTitle');
  const confirmBtn = document.getElementById('createSubmitDialogConfirm');
  const cancelBtn = document.getElementById('createSubmitDialogCancel');
  const closeBtn = document.getElementById('createSubmitDialogClose');
  const doneBtn = document.getElementById('createSubmitDialogDone');
  const successName = document.getElementById('createSubmitDialogSuccessName');
  const form = document.getElementById('createBuildForm');

  if (!dialog || !openBtn || !panel || !success || !input || !hiddenTitle || !confirmBtn) return;

  function showErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = !msg;
  }

  function resetToForm() {
    panel.hidden = false;
    success.hidden = true;
    showErr('');
    input.classList.remove('create-submit-dialog-input--error');
  }

  function openDialog() {
    resetToForm();
    input.value = hiddenTitle.value.trim() || input.value.trim();
    showErr('');
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
    input.focus();
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
  }

  dialog.addEventListener('close', () => {
    resetToForm();
    input.value = '';
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  openBtn.addEventListener('click', () => {
    if (!isCreateChampionSelected() || !isCreateBuildTagSelected()) return;
    if (form) {
      /** @type {{ _youtubeSyncFns?: (() => void)[] }} */
      const f = form;
      const syncFns = f._youtubeSyncFns || [];
      syncFns.forEach((fn) => fn());
    }
    openDialog();
  });

  function onConfirm() {
    const name = input.value.trim();
    if (!name) {
      showErr('Give your build a title—this is the name players will see.');
      input.classList.add('create-submit-dialog-input--error');
      input.focus();
      return;
    }
    hiddenTitle.value = name;
    showErr('');
    input.classList.remove('create-submit-dialog-input--error');

    // Collect form data and save to localStorage
    const buildData = collectFormData(name);
    if (!buildData) {
      closeDialog();
      syncCreateSubmitBuildButton();
      return;
    }
    const buildId = 'user-' + Date.now();
    pendingUserBuildId = buildId;
    saveUserBuild(buildId, buildData);

    // Show brief success screen, then redirect
    panel.hidden = true;
    success.hidden = false;
    if (successName) successName.textContent = name;

    // Update the sub-text and done button to reflect redirect
    const subEl = success.querySelector('.create-submit-dialog-success-sub');
    if (subEl) subEl.textContent = 'Taking you to your build now…';
    if (doneBtn) {
      doneBtn.textContent = 'View My Build →';
      doneBtn.focus();
    }

    // Redirect after a short celebratory pause
    setTimeout(() => {
      window.location.href = `build-detail.html?build=${encodeURIComponent(buildId)}`;
    }, 1200);
  }

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn?.addEventListener('click', () => closeDialog());
  closeBtn?.addEventListener('click', () => closeDialog());
  // Don't wire doneBtn to close — it now triggers the redirect (same as timeout)
  doneBtn?.addEventListener('click', () => {
    const id = pendingUserBuildId;
    if (id) window.location.href = `build-detail.html?build=${encodeURIComponent(id)}`;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
  });

  input.addEventListener('input', () => {
    showErr('');
    input.classList.remove('create-submit-dialog-input--error');
  });
}

document.addEventListener('DOMContentLoaded', initCreateBuildPage);
