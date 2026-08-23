const API_BASE_URL = 'https://yuki-music-backend.vercel.app';

const app = document.querySelector('#app');

async function getHome() {
  const response = await fetch(`${API_BASE_URL}/api/home`);
  if (!response.ok) throw new Error(`Backend ${response.status}`);
  return response.json();
}

async function getSearch(query) {
  const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Backend ${response.status}`);
  return response.json();
}

function render(items = []) {
  return items.map(item => `
    <article class="card">
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" loading="lazy">` : ''}
      <div class="card-title">${escapeHtml(item.title || '')}</div>
      <div class="card-subtitle">${escapeHtml(item.subtitle || '')}</div>
    </article>
  `).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' }[char]));
}

function renderSections(sections = []) {
  return sections.map(section => `
    <section>
      <div class="section-heading">${escapeHtml(section.title || '')}</div>
      <div class="cards">${render(section.items || [])}</div>
    </section>
  `).join('');
}

async function boot() {
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">Yuki Music</div>
      <form id="search-form"><input id="search" placeholder="Search music..." autocomplete="off"><button>Search</button></form>
    </header>
    <main><div id="status">Loading...</div><div id="content"></div></main>
  `;

  const status = document.querySelector('#status');
  const content = document.querySelector('#content');
  try {
    const data = await getHome();
    status.remove();
    content.innerHTML = renderSections(data.sections);
  } catch (error) {
    status.textContent = `Backend error: ${error.message}`;
  }

  document.querySelector('#search-form').addEventListener('submit', async event => {
    event.preventDefault();
    const query = document.querySelector('#search').value.trim();
    if (!query) return;
    content.innerHTML = '<div class="loading">Searching...</div>';
    try {
      const data = await getSearch(query);
      content.innerHTML = renderSections(data.sections);
    } catch (error) {
      content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  });
}

boot();
