const container = document.getElementById("cards-container");
const searchBox = document.getElementById("searchBox");
const yearFilter = document.getElementById("yearFilter");

let papers = [];
let selectedCategory = null;

fetch('papers.json')
  .then(res => {
    if (!res.ok) throw new Error("Network response was not ok");
    return res.json();
  })
  .then(data => {
    papers = data;
    populateYearFilter();
    populateCategories();
    renderCards(papers);
  })
  .catch(err => {
    console.error("Failed to load data:", err);
    container.innerHTML = `
      <p>Error loading data.<br>
      Make sure you are running this project with a local server (not opening index.html directly).</p>
    `;
  });

function renderCards(items) {
  container.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = "<p>No results found.</p>";
    return;
  }

  // Render cards and add a staggered animation
  items.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "card";

  // Use raw text for truncation and perform HTML escaping once
  const rawTitle = p.title || 'Untitled';
  const rawAuthors = p.authors || 'Unknown';
  const year = p.year || '—';
  const rawOrganism = p.organism || '—';
  const rawSummary = p.summary || 'No summary available.';
  const link = p.link ? p.link : '#';

  const authors = escapeHtml(rawAuthors);
  const titleEscaped = escapeHtml(rawTitle);
  const organism = escapeHtml(rawOrganism);
  const summaryEscaped = escapeHtml(rawSummary);

  // Highlight search terms (work on escaped HTML so <span> is inserted safely)
  const q = searchBox.value.trim();
  const titleHtml = q ? highlight(titleEscaped, q) : titleEscaped;
  const summaryHtml = q ? highlight(summaryEscaped, q) : summaryEscaped;

  // Truncate raw summary to ~220 chars for brief view at a word boundary, then escape
  const MAX_BRIEF = 130;
  let brief;
  if (rawSummary.length > MAX_BRIEF) {
    const truncated = truncatePreferSentence(rawSummary, MAX_BRIEF);
    brief = escapeHtml(truncated) + '...';
  } else {
    brief = summaryEscaped;
  }

  const hasLink = p.link && p.link.trim() !== '' && p.link !== '#';

    card.innerHTML = `
      <h2>${titleHtml}</h2>
      <div class="meta">${authors} — ${year} — ${organism}</div>
      <div class="summary-brief"><p>${brief}</p></div>
      <div class="summary-full"><p>${summaryHtml}</p></div>
      <div class="card-footer">
        ${hasLink ? `<a class="btn btn-primary" href="${link}" target="_blank" rel="noopener"> <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 5l7 7-7 7M20 12H4" stroke="#01263b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Read more</a>` : `<button class="btn btn-ghost btn-details" type="button">Details</button>`}
        <div style="margin-left:auto"><button class="btn btn-ghost btn-toggle-summary" type="button">More</button></div>
      </div>
    `;

    container.appendChild(card);

    // staggered visible class for entrance
    setTimeout(() => card.classList.add('visible'), 70 * i);
  });
}

function populateYearFilter() {
  if (!Array.isArray(papers)) return;
  const years = [...new Set(papers.map(p => p.year).filter(Boolean))].sort((a,b)=>b-a);
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y.toString();
    opt.textContent = y.toString();
    yearFilter.appendChild(opt);
  });
}

function applyFilters() {
  const q = searchBox.value.trim().toLowerCase();
  const selYear = yearFilter.value;

  let filtered = papers.filter(p => {
    const title = (p.title || '').toLowerCase();
    const summary = (p.summary || '').toLowerCase();
    const keywords = (p.keywords || []).join(' ').toLowerCase();
    const inTitle = title.includes(q);
    const inSummary = summary.includes(q);
    const inKeywords = keywords.includes(q);
    return q === '' ? true : (inTitle || inSummary || inKeywords);
  });

  if (selYear !== "all") {
    filtered = filtered.filter(p => p.year.toString() === selYear);
  }

  // Apply category filter if selected
  if (selectedCategory) {
    filtered = filtered.filter(p => {
      const category = (p.category || p.organism || '').toString().toLowerCase();
      const kws = (p.keywords || []).map(k => k.toLowerCase());
      return category === selectedCategory.toLowerCase() || kws.includes(selectedCategory.toLowerCase());
    });
  }

  renderCards(filtered);
}

// ------------------ Sidebar / Categories ------------------
function deriveCategory(p) {
  if (p.category) return p.category;
  if (p.organism) return p.organism;
  if (Array.isArray(p.keywords) && p.keywords.length) return p.keywords[0];
  return 'Uncategorized';
}

function populateCategories() {
  const counts = {};
  papers.forEach(p => {
    const c = (deriveCategory(p) || 'Uncategorized');
    counts[c] = (counts[c] || 0) + 1;
  });

  // convert to array of [category, count], sort by count desc then name
  const catEntries = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const list = document.getElementById('categoryList');
  if (!list) return;
  list.innerHTML = '';

  // add 'All' option with total count
  const total = papers.length;
  const allItem = document.createElement('li');
  allItem.className = 'category-item' + (selectedCategory ? '' : ' active');
  allItem.dataset.cat = 'all';
  allItem.innerHTML = `<span class="cat-name">All Categories</span><span class="cat-count">${total}</span>`;
  allItem.addEventListener('click', () => {
    selectedCategory = null;
    updateCategoryUI();
    applyFilters();
    closeSidebar();
  });
  list.appendChild(allItem);

  catEntries.forEach(([c, count]) => {
    const li = document.createElement('li');
    li.className = 'category-item' + (selectedCategory && selectedCategory.toLowerCase() === c.toLowerCase() ? ' active' : '');
    li.dataset.cat = c;
    li.innerHTML = `<span class="cat-name">${escapeHtml(c)}</span><span class="cat-count">${count}</span>`;
    li.addEventListener('click', () => {
      selectedCategory = c;
      updateCategoryUI();
      applyFilters();
      closeSidebar();
    });
    list.appendChild(li);
  });
}

function updateCategoryUI() {
  const items = document.querySelectorAll('.category-item');
  items.forEach(it => {
    const cat = it.dataset.cat || '';
    if ((selectedCategory === null && cat === 'all') || (selectedCategory && cat.toLowerCase() === selectedCategory.toLowerCase())) {
      it.classList.add('active');
    } else {
      it.classList.remove('active');
    }
  });
}

// Sidebar open/close
function openSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebarOverlay');
  const t = document.getElementById('sidebarToggle');
  if (s) s.classList.add('open');
  if (o) { o.hidden = false; o.style.display = 'block'; }
  if (t) t.setAttribute('aria-expanded', 'true');
  if (s) s.setAttribute('aria-hidden', 'false');
}

function closeSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebarOverlay');
  const t = document.getElementById('sidebarToggle');
  if (s) s.classList.remove('open');
  if (o) { o.hidden = true; o.style.display = 'none'; }
  if (t) t.setAttribute('aria-expanded', 'false');
  if (s) s.setAttribute('aria-hidden', 'true');
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('sidebarToggle');
  const close = document.getElementById('sidebarClose');
  const overlay = document.getElementById('sidebarOverlay');
  if (toggle) toggle.addEventListener('click', openSidebar);
  if (close) close.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
});

// ربط الأحداث
// debounce user input for nicer UX
let debounceTimer = null;
searchBox.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, 180);
});
yearFilter.addEventListener("change", applyFilters);

// Event delegation for card buttons
container.addEventListener('click', (e) => {
  const toggle = e.target.closest('.btn-toggle-summary');
  if (toggle) {
    const card = toggle.closest('.card');
    if (!card) return;
    card.classList.toggle('summary-expanded');
    toggle.textContent = card.classList.contains('summary-expanded') ? 'Less' : 'More';
    return;
  }

  const detailsBtn = e.target.closest('.btn-details');
  if (detailsBtn) {
    const card = detailsBtn.closest('.card');
    if (!card) return;
    // toggle full summary as a lightweight 'details' behavior
    card.classList.toggle('summary-expanded');
    detailsBtn.textContent = card.classList.contains('summary-expanded') ? 'Hide' : 'Details';
    return;
  }
});

// small helpers
function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlight(text, q){
  if (!q) return text;
  // escape q for regex
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'gi');
  return text.replace(re, match => `<span class="highlight">${match}</span>`);
}

// Truncate at a word boundary near `max` characters (avoids cutting words)
function truncateAtWord(str, max) {
  if (str.length <= max) return str;
  // find last whitespace before max
  const slice = str.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > Math.floor(max * 0.6)) { // prefer not to produce very short result
    return slice.slice(0, lastSpace);
  }
  // fallback: cut at max
  return slice;
}

// Prefer truncation at sentence boundary (., ?, !) before max; otherwise fall back to word boundary
function truncatePreferSentence(str, max) {
  if (str.length <= max) return str;
  const slice = str.slice(0, max);
  // search for sentence-ending punctuation from the end of slice
  const punctIdx = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (punctIdx > Math.floor(max * 0.5)) {
    return slice.slice(0, punctIdx + 1);
  }
  // otherwise try a word boundary
  return truncateAtWord(str, max);
}

// Quick-focus: press '/' to focus the search box (except when typing in inputs)
// Shortcut preference (persisted)
const SHORTCUT_KEY = 'nasa_dashboard_shortcut_enabled';
function isShortcutEnabled() {
  const v = localStorage.getItem(SHORTCUT_KEY);
  return v === null ? true : v === '1';
}

function setShortcutEnabled(enabled) {
  localStorage.setItem(SHORTCUT_KEY, enabled ? '1' : '0');
  const toggle = document.getElementById('shortcutToggle');
  const hint = document.getElementById('shortcutHint');
  const tooltip = document.getElementById('shortcutTooltip');
  if (toggle) toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  if (hint) hint.style.display = enabled ? 'inline-block' : 'none';
  // tooltip visibility is managed by CSS on hover/focus; ensure it starts hidden
  if (tooltip) tooltip.style.display = 'none';
  // announce for screen readers
  const announcer = document.getElementById('sr-announcer');
  if (announcer) announcer.textContent = enabled ? "Shortcut enabled" : "Shortcut disabled";
}

// initialize toggle UI
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('shortcutToggle');
  const hint = document.getElementById('shortcutHint');
  const enabled = isShortcutEnabled();
  if (toggle) {
    toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggle.addEventListener('click', () => {
      const cur = isShortcutEnabled();
      setShortcutEnabled(!cur);
    });
  }
  if (hint) hint.style.display = enabled ? 'inline-block' : 'none';
  const tooltip = document.getElementById('shortcutTooltip');
  if (tooltip) tooltip.style.display = 'none';
});

// Tooltip suppression state and keyboard dismissal (Escape)
let tooltipSuppressed = false;
document.addEventListener('keydown', (e) => {
  // if Escape pressed, suppress tooltip until user moves mouse or focuses again
  if (e.key === 'Escape' || e.key === 'Esc') {
    const tooltip = document.getElementById('shortcutTooltip');
    if (tooltip) {
      tooltip.setAttribute('suppressed', 'true');
      tooltipSuppressed = true;
    }
  }
});

// Clear suppression on interactions: mousemove or focusin inside search area
document.addEventListener('mousemove', () => {
  if (!tooltipSuppressed) return;
  const tooltip = document.getElementById('shortcutTooltip');
  if (tooltip) {
    tooltip.removeAttribute('suppressed');
    tooltipSuppressed = false;
  }
});
document.addEventListener('focusin', (e) => {
  if (!tooltipSuppressed) return;
  const tooltip = document.getElementById('shortcutTooltip');
  if (tooltip) {
    tooltip.removeAttribute('suppressed');
    tooltipSuppressed = false;
  }
});

document.addEventListener('keydown', (e) => {
  // ignore if user is in an input or textarea
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
  if (!isShortcutEnabled()) return;
  if (e.key === '/') {
    e.preventDefault();
    searchBox.focus();
    searchBox.select();
  }
});
