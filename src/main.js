import './style.css';

const API_BASE_URL = 'https://yuki-music-backend.vercel.app';
const $ = (s) => document.querySelector(s);
const state = { queue: [], index: -1, yt: null, ready: false, playing: false, repeat: false, shuffle: false, theme: localStorage.getItem('yuki-theme') || 'dark', lyrics: [] };

async function api(path) { const r = await fetch(`${API_BASE_URL}${path}`); if (!r.ok) throw new Error(`${r.status}`); return r.json(); }
function fmt(s) { s = Math.max(0, Math.floor(Number(s) || 0)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function normalize(item) { return {...item, artist: item.artist || (item.subtitle || '').split(' • ')[0] || '', duration: item.duration || null}; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function shell() {
  document.documentElement.dataset.theme = state.theme;
  document.body.innerHTML = `
    <div id="app-shell">
      <aside id="sidebar">
        <div class="brand"><span class="brand-logo">♫</span><div><b>Yuki Music</b><small>Music for everyone</small></div></div>
        <nav class="side-nav">
          <button class="nav active" data-view="home"><span>⌂</span>Home</button>
          <button class="nav" data-view="search"><span>⌕</span>Search</button>
          <button class="nav" data-view="charts"><span>▥</span>Charts</button>
        </nav>
        <section class="queue-box"><div class="queue-title"><b>☷ &nbsp;Queue</b></div><p>Play a song, then tap the queue icon to add tracks here.</p><button id="open-queue">Open queue</button></section>
        <section class="library-box"><button class="library-title"><span>▥</span><b>Your Library</b><span>›</span></button><div id="library-list"><div class="muted">Your library is empty</div><p>Like songs, save albums & artists, or open library to create a playlist</p></div></section>
        <footer>Yuki Music · web music player</footer>
      </aside>
      <section id="main-panel">
        <header id="topbar"><div class="history-buttons"><button id="back">‹</button><button id="forward">›</button></div><form id="search-form"><span>⌕</span><input id="search-input" placeholder="What do you want to play?" autocomplete="off"></form><button id="theme-btn" title="Toggle theme">☼</button></header>
        <main id="view"><div id="view-content"><div class="loading">Loading Yuki Music…</div></div></main>
      </section>
    </div>
    <div id="yt-host" aria-hidden="true"><div id="yt-player"></div></div>
    <div id="mini-player" class="hidden"><img id="mini-art"><div class="mini-meta"><b id="mini-title">Nothing playing</b><small id="mini-artist">Choose a song</small></div><div class="mini-actions"><button id="mini-prev">⏮</button><button id="mini-play">▶</button><button id="mini-next">⏭</button><button id="mini-open">⌃</button></div></div>
    <div id="now-playing" class="hidden"><div class="np-top"><button id="np-close">⌄</button><span>NOW PLAYING</span><button id="np-theme">☼</button></div><div class="np-body"><div class="np-art-wrap"><img id="np-art"></div><div class="np-info"><div class="np-tabs"><button class="active">Song</button><button>Lyrics</button><button>Queue</button><button>Related</button></div><h1 id="np-title">Nothing playing</h1><p id="np-artist"></p><div id="lyrics" class="lyrics"></div></div></div><div class="np-controls"><div class="progress"><span id="elapsed">0:00</span><input id="seek" type="range" min="0" max="100" value="0"><span id="total">0:00</span></div><div class="transport"><button id="shuffle">🔀</button><button id="np-prev">⏮</button><button id="np-play" class="big-play">▶</button><button id="np-next">⏭</button><button id="repeat">🔁</button></div></div></div>
  `;
  bindShell();
}

function bindShell() {
  document.querySelectorAll('.nav').forEach(b => b.onclick = () => { document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active')); b.classList.add('active'); if (b.dataset.view === 'search') $('#search-input').focus(); else loadView(b.dataset.view); });
  $('.library-title').onclick = () => loadView('library');
  $('#search-form').onsubmit = e => { e.preventDefault(); const q = $('#search-input').value.trim(); if (q) search(q); };
  $('#theme-btn').onclick = toggleTheme; $('#np-theme').onclick = toggleTheme;
  $('#mini-open').onclick = () => $('#now-playing').classList.remove('hidden'); $('#np-close').onclick = () => $('#now-playing').classList.add('hidden');
  $('#mini-play').onclick = togglePlay; $('#np-play').onclick = togglePlay; $('#mini-next').onclick = nextTrack; $('#np-next').onclick = nextTrack; $('#mini-prev').onclick = prevTrack; $('#np-prev').onclick = prevTrack;
  $('#shuffle').onclick = () => { state.shuffle = !state.shuffle; $('#shuffle').classList.toggle('active', state.shuffle); };
  $('#repeat').onclick = () => { state.repeat = !state.repeat; $('#repeat').classList.toggle('active', state.repeat); };
  $('#seek').oninput = e => { if (state.yt?.seekTo) state.yt.seekTo(Number(e.target.value), true); };
}
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('yuki-theme', state.theme); document.documentElement.dataset.theme = state.theme; }
function card(item) { const s = normalize(item); if (!s.videoId) return ''; return `<button class="music-card" data-video="${esc(s.videoId)}"><div class="cover-wrap"><img src="${esc(s.thumbnail || '')}" loading="lazy"><span class="card-play">▶</span></div><b>${esc(s.title)}</b><small>${esc(s.subtitle || s.artist || '')}</small></button>`; }
function listRow(item) { const s = normalize(item); if (!s.videoId) return ''; return `<button class="song-row" data-video="${esc(s.videoId)}"><img src="${esc(s.thumbnail || '')}"><span><b>${esc(s.title)}</b><small>${esc(s.subtitle || s.artist || '')}</small></span><em>${esc(s.duration || '')}</em></button>`; }
function renderSections(sections) { return (sections || []).map(s => `<section class="shelf"><div class="shelf-head"><h2>${esc(s.title || 'Music')}</h2><button>Show all</button></div><div class="card-row">${(s.items || []).map(card).join('')}</div></section>`).join(''); }
async function loadView(view='home') { if (view === 'home') return home(); if (view === 'library') return library(); if (view === 'charts') return charts(); }
async function home() { setView('<div class="loading">Loading…</div>'); try { const data = await api('/api/home'); setView(`<div class="date-label">${new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</div><h1 class="page-title">Good evening</h1>${renderSections(data.sections)}`); } catch(e) { setView(`<div class="error">Could not load home: ${esc(e.message)}</div>`); } }
async function charts() { setView('<div class="loading">Loading charts…</div>'); try { const data = await api('/api/charts'); setView(`<h1 class="page-title">Charts</h1>${renderSections(data.sections)}`); } catch(e) { setView(`<div class="error">Could not load charts: ${esc(e.message)}</div>`); } }
async function search(q) { setView('<div class="loading">Searching…</div>'); try { const data = await api(`/api/search?q=${encodeURIComponent(q)}`); setView(`<div class="search-head"><span>Search results</span><h1>“${esc(q)}”</h1></div>${renderSections(data.sections)}`); } catch(e) { setView(`<div class="error">Search failed: ${esc(e.message)}</div>`); } }
function library() { const fav = JSON.parse(localStorage.getItem('yuki-favorites') || '[]'); setView(`<h1 class="page-title">Your Library</h1><section class="library-view"><div class="library-empty">${fav.length ? `<div class="song-list">${fav.map(listRow).join('')}</div>` : '<b>Your library is empty</b><p>Like songs, save albums & artists, or create a playlist to see them here.</p>'}</div></section>`); }
function setView(html) { $('#view-content').innerHTML = html; document.querySelectorAll('[data-video]').forEach(el => el.onclick = () => playById(el.dataset.video)); }
async function playById(videoId) { try { const data = await api(`/api/song?videoId=${encodeURIComponent(videoId)}`); const song = normalize({...data, videoId}); const idx = state.queue.findIndex(x => x.videoId === videoId); if (idx < 0) { state.queue = [song]; state.index = 0; } else state.index = idx; await fetchQueue(song); startSong(song); } catch(e) { toast(`Cannot play: ${e.message}`); } }
async function fetchQueue(song) { try { const data = await api(`/api/next?videoId=${encodeURIComponent(song.videoId)}`); const extra = (data.queue || []).map(normalize).filter(x => x.videoId && x.videoId !== song.videoId); const existing = new Set(state.queue.map(x => x.videoId)); for (const x of extra) if (!existing.has(x.videoId)) state.queue.push(x); } catch {} }
function startSong(song) { state.index = Math.max(0, state.queue.findIndex(x => x.videoId === song.videoId)); updatePlayer(song); if (state.ready) state.yt.loadVideoById(song.videoId); }
function togglePlay() { if (!state.yt || !state.ready) return; state.playing ? state.yt.pauseVideo() : state.yt.playVideo(); }
function nextTrack() { if (!state.queue.length) return; if (state.repeat) return startSong(state.queue[state.index]); let i = state.shuffle ? Math.floor(Math.random()*state.queue.length) : state.index + 1; if (i >= state.queue.length) i = 0; state.index = i; startSong(state.queue[i]); }
function prevTrack() { if (!state.yt) return; if (state.yt.getCurrentTime() > 4) state.yt.seekTo(0, true); else { state.index = (state.index - 1 + state.queue.length) % state.queue.length; startSong(state.queue[state.index]); } }
function updatePlayer(song) { $('#mini-player').classList.remove('hidden'); $('#mini-art').src = song.thumbnail || ''; $('#mini-title').textContent = song.title || ''; $('#mini-artist').textContent = song.artist || song.subtitle || ''; $('#np-art').src = song.thumbnail || ''; $('#np-title').textContent = song.title || ''; $('#np-artist').textContent = song.artist || song.subtitle || ''; loadLyrics(song); mediaSession(song); }
async function loadLyrics(song) { $('#lyrics').innerHTML = '<div class="muted">Loading lyrics…</div>'; try { const data = await api(`/api/lyrics?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || song.subtitle || '')}`); state.lyrics = parseLrc(data.synced); $('#lyrics').innerHTML = state.lyrics.length ? state.lyrics.map((l,i)=>`<button class="lyric" data-i="${i}">${esc(l.text)}</button>`).join('') : `<p class="muted">${esc(data.plain || 'Lyrics not available.')}</p>`; document.querySelectorAll('.lyric').forEach((b,i)=>b.onclick=()=>state.yt?.seekTo(state.lyrics[i].time,true)); } catch { $('#lyrics').innerHTML = '<p class="muted">Lyrics unavailable.</p>'; } }
function parseLrc(text) { if (!text) return []; return text.split(/\r?\n/).map(line => { const m=line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/); return m ? {time:Number(m[1])*60+Number(m[2]),text:m[3]} : null; }).filter(Boolean); }
function syncLyrics(time) { let active=-1; state.lyrics.forEach((l,i)=>{if(time>=l.time) active=i;}); document.querySelectorAll('.lyric').forEach((el,i)=>el.classList.toggle('active',i===active)); }
function mediaSession(song) { if (!('mediaSession' in navigator)) return; navigator.mediaSession.metadata = new MediaMetadata({title:song.title || 'Yuki Music', artist:song.artist || song.subtitle || 'Yuki Music', artwork:song.thumbnail ? [{src:song.thumbnail,sizes:'512x512',type:'image/jpeg'}] : []}); for (const [a,fn] of [['play',togglePlay],['pause',togglePlay],['nexttrack',nextTrack],['previoustrack',prevTrack]]) { try { navigator.mediaSession.setActionHandler(a,fn); } catch {} } }
function initYT() { window.onYouTubeIframeAPIReady = () => { state.yt = new YT.Player('yt-player',{width:'1',height:'1',host:'https://www.youtube.com',playerVars:{playsinline:1,controls:0,rel:0,modestbranding:1},events:{onReady:()=>{state.ready=true;},onStateChange:e=>{state.playing=e.data===YT.PlayerState.PLAYING; $('#mini-play').textContent=state.playing?'❚❚':'▶'; $('#np-play').textContent=state.playing?'❚❚':'▶'; if(e.data===YT.PlayerState.ENDED) nextTrack();},onError:()=>toast('Track unavailable')}}); }; const s=document.createElement('script'); s.src='https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
let toastTimer; function toast(msg){ let t=$('#toast'); if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);} t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200); }
setInterval(()=>{ if(state.yt && state.playing){ const t=state.yt.getCurrentTime?.()||0; const d=state.yt.getDuration?.()||0; $('#elapsed').textContent=fmt(t); $('#total').textContent=fmt(d); $('#seek').max=Math.max(1,d); $('#seek').value=t; syncLyrics(t); } },500);
shell(); initYT(); loadView('home');
