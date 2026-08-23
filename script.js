/* =========================================================
   AuraOS / duskOS — browser desktop
   Fixed window state management
   ========================================================= */

const APPS = {
  finder:  { title:'Finder',         glyph:'🗂️', glyphClass:'g-finder',  w:640, h:420 },
  notes:   { title:'Notes',          glyph:'📝', glyphClass:'g-notes',   w:560, h:420 },
  term:    { title:'Terminal',       glyph:'▮',  glyphClass:'g-term',    w:560, h:380 },
  calc:    { title:'Calculator',     glyph:'🧮', glyphClass:'g-calc',   w:280, h:400 },
  music:   { title:'Vibes',          glyph:'🎧', glyphClass:'g-music',  w:340, h:480 },
  weather: { title:'Weather',        glyph:'🌤️', glyphClass:'g-weather',w:340, h:420 },
  settings:{ title:'Settings',       glyph:'⚙️', glyphClass:'g-settings',w:520, h:400 },
  about:   { title:'About This Mac', glyph:'💾', glyphClass:'g-about',  w:380, h:440 }
};

const layer = document.getElementById('windows-layer');

const openWindows = {};

let topZ = 10;
let cascade = 0;

/* =========================================================
   ANIMATION CLEANUP
   ========================================================= */

function runEndAction(el, timeoutMs, callback){
  let done = false;

  const timer = setTimeout(finish, timeoutMs);

  function finish(e){
    if(e && e.target !== el) return;
    if(done) return;

    done = true;

    el.removeEventListener('animationend', finish);
    el.removeEventListener('transitionend', finish);
    clearTimeout(timer);

    callback();
  }

  el.addEventListener('animationend', finish);
  el.addEventListener('transitionend', finish);
}

/* =========================================================
   CLOCK
   ========================================================= */

function fmtTime(d){
  let h = d.getHours();
  let m = d.getMinutes();

  const ampm = h >= 12 ? 'PM' : 'AM';

  h = h % 12 || 12;

  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function fmtDateShort(d){
  const days = [
    'Sun','Mon','Tue','Wed','Thu','Fri','Sat'
  ];

  const mons = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];

  return `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]}`;
}

function tickClock(){
  const d = new Date();

  const clock = document.getElementById('clock');
  const islandTime = document.getElementById('island-time');

  if(clock){
    clock.textContent =
      `${fmtDateShort(d)}   ${fmtTime(d)}`;
  }

  if(islandTime){
    islandTime.textContent = fmtTime(d);
  }
}

tickClock();
setInterval(tickClock,1000);

/* =========================================================
   BOOT
   ========================================================= */

const bootEl = document.getElementById('boot');

if(bootEl){
  runEndAction(bootEl,2500,()=>{
    bootEl.remove();

    if(!openWindows.finder){
      openApp('finder');
    }
  });
}

/* =========================================================
   OPEN APPLICATION
   ========================================================= */

function openApp(appId){
  const existing = openWindows[appId];

  if(existing){
    const hidden =
      existing.style.display === 'none' ||
      existing.classList.contains('minimized-state') ||
      existing.classList.contains('minimized');

    if(hidden){
      restoreWindow(appId);
    }else{
      focusWindow(existing,appId);
    }

    return;
  }

  const cfg = APPS[appId];

  if(!cfg) return;

  const win = document.createElement('div');

  win.className = 'window opening';

  const x =
    90 + (cascade % 5) * 36;

  const y =
    70 + (cascade % 5) * 28;

  cascade++;

  win.style.left = `${x}px`;
  win.style.top = `${y}px`;

  win.style.width = `${cfg.w}px`;
  win.style.height = `${cfg.h}px`;

  win.dataset.app = appId;

  win.innerHTML = `
    <div class="titlebar">
      <div class="traffic">
        <i class="close" title="Close"></i>
        <i class="min" title="Minimize"></i>
        <i class="max" title="Maximize"></i>
      </div>

      <div class="win-title">
        ${cfg.title}
      </div>
    </div>

    <div class="win-body">
      ${renderApp(appId)}
    </div>

    <div class="resize-handle"></div>
  `;

  layer.appendChild(win);

  openWindows[appId] = win;

  focusWindow(win,appId);
  wireWindow(win,appId);
  postMount(appId,win);

  document
    .querySelector(`.dock-item[data-app="${appId}"]`)
    ?.classList.add('running');

  /*
     IMPORTANT:
     Do NOT leave the window in an invisible state
     after removing .opening.
  */

  runEndAction(win,380,()=>{
    if(!win.isConnected) return;

    win.classList.remove('opening');

    /*
       Force the normal resting state.
    */
    win.style.opacity = '1';
    win.style.transform = 'none';
  });
}

/* =========================================================
   FOCUS
   ========================================================= */

function focusWindow(win,appId){
  if(!win || !win.isConnected) return;

  topZ++;

  win.style.zIndex = topZ;

  document
    .querySelectorAll('.window')
    .forEach(w=>w.classList.remove('focused'));

  win.classList.add('focused');

  const activeName =
    document.getElementById('active-app-name');

  if(activeName && APPS[appId]){
    activeName.textContent =
      APPS[appId].title;
  }
}

/* =========================================================
   CLOSE
   ========================================================= */

function closeApp(appId){
  const win = openWindows[appId];

  if(!win) return;

  if(win.classList.contains('closing')) return;

  win.classList.remove(
    'opening',
    'restoring',
    'minimized',
    'minimized-state'
  );

  win.style.display = 'flex';
  win.style.opacity = '1';

  win.classList.add('closing');

  runEndAction(win,300,()=>{
    if(win.isConnected){
      win.remove();
    }

    delete openWindows[appId];

    document
      .querySelector(`.dock-item[data-app="${appId}"]`)
      ?.classList.remove('running');
  });
}

/* =========================================================
   MINIMIZE
   ========================================================= */

function minimizeApp(appId){
  const win = openWindows[appId];

  if(!win) return;

  if(win.classList.contains('minimized-state')) return;

  const dockIcon =
    document.querySelector(
      `.dock-item[data-app="${appId}"]`
    );

  if(dockIcon){
    const wr =
      win.getBoundingClientRect();

    const dr =
      dockIcon.getBoundingClientRect();

    win.style.setProperty(
      '--tx',
      `${dr.left + dr.width / 2 -
        (wr.left + wr.width / 2)}px`
    );

    win.style.setProperty(
      '--ty',
      `${dr.top + dr.height / 2 -
        (wr.top + wr.height / 2)}px`
    );
  }

  win.classList.remove(
    'opening',
    'restoring',
    'closing'
  );

  win.classList.add(
    'minimized',
    'minimized-state'
  );

  runEndAction(win,420,()=>{
    if(
      win.classList.contains('minimized-state')
    ){
      win.style.display = 'none';
    }
  });
}

/* =========================================================
   RESTORE
   ========================================================= */

function restoreWindow(appId){
  const win = openWindows[appId];

  if(!win) return;

  win.style.display = 'flex';

  /*
     Start from the dock.
  */

  win.classList.remove(
    'minimized',
    'minimized-state',
    'closing',
    'opening'
  );

  win.classList.add('restoring');

  focusWindow(win,appId);

  runEndAction(win,420,()=>{
    win.classList.remove('restoring');

    /*
       Force normal visible state.
    */

    win.style.opacity = '1';
    win.style.transform = 'none';

    win.style.removeProperty('--tx');
    win.style.removeProperty('--ty');
  });
}

/* =========================================================
   MAXIMIZE
   ========================================================= */

function toggleMaximize(win){
  if(!win) return;

  win.classList.toggle('maximized');

  /*
     Maximized windows should always be visible.
  */

  win.style.opacity = '1';
}

/* =========================================================
   WINDOW EVENTS
   ========================================================= */

function wireWindow(win,appId){

  win.addEventListener('mousedown',()=>{
    focusWindow(win,appId);
  });

  const bar =
    win.querySelector('.titlebar');

  bar.addEventListener('mousedown',(e)=>{
    if(e.target.closest('.traffic')) return;
    if(win.classList.contains('maximized')) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const ol = win.offsetLeft;
    const ot = win.offsetTop;

    function move(ev){
      win.style.left =
        `${ol + ev.clientX - startX}px`;

      win.style.top =
        `${Math.max(
          28,
          ot + ev.clientY - startY
        )}px`;
    }

    function up(){
      document.removeEventListener(
        'mousemove',
        move
      );

      document.removeEventListener(
        'mouseup',
        up
      );
    }

    document.addEventListener(
      'mousemove',
      move
    );

    document.addEventListener(
      'mouseup',
      up
    );
  });

  const rh =
    win.querySelector('.resize-handle');

  rh.addEventListener('mousedown',(e)=>{
    e.stopPropagation();

    if(win.classList.contains('maximized')){
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;

    const ow = win.offsetWidth;
    const oh = win.offsetHeight;

    function move(ev){
      win.style.width =
        `${Math.max(
          280,
          ow + ev.clientX - startX
        )}px`;

      win.style.height =
        `${Math.max(
          180,
          oh + ev.clientY - startY
        )}px`;
    }

    function up(){
      document.removeEventListener(
        'mousemove',
        move
      );

      document.removeEventListener(
        'mouseup',
        up
      );
    }

    document.addEventListener(
      'mousemove',
      move
    );

    document.addEventListener(
      'mouseup',
      up
    );
  });

  win
    .querySelector('.traffic .close')
    .addEventListener('click',(e)=>{
      e.stopPropagation();
      closeApp(appId);
    });

  win
    .querySelector('.traffic .min')
    .addEventListener('click',(e)=>{
      e.stopPropagation();
      minimizeApp(appId);
    });

  win
    .querySelector('.traffic .max')
    .addEventListener('click',(e)=>{
      e.stopPropagation();
      toggleMaximize(win);
    });

  bar.addEventListener('dblclick',(e)=>{
    if(!e.target.closest('.traffic')){
      toggleMaximize(win);
    }
  });
}

/* =========================================================
   APPLICATION CONTENT
   ========================================================= */

function renderApp(appId){

  switch(appId){

    case 'finder':
      return `
        <div class="app-finder">

          <div class="fd-sidebar">

            <h4>Favorites</h4>

            <div class="fd-item active">
              🏠 Home
            </div>

            <div class="fd-item">
              🖥️ Desktop
            </div>

            <div class="fd-item">
              📄 Documents
            </div>

            <div class="fd-item">
              ⬇️ Downloads
            </div>

            <h4>Tags</h4>

            <div class="fd-item">
              🟠 Devlogs
            </div>

            <div class="fd-item">
              🔵 Assets
            </div>

          </div>

          <div class="fd-main">

            <div class="fd-file">
              <div class="fico">📁</div>
              <span>Devlogs</span>
            </div>

            <div class="fd-file">
              <div class="fico">📁</div>
              <span>Assets</span>
            </div>

            <div class="fd-file">
              <div class="fico">🖼️</div>
              <span>wallpaper.png</span>
            </div>

            <div class="fd-file">
              <div class="fico">📄</div>
              <span>readme.txt</span>
            </div>

            <div class="fd-file">
              <div class="fico">🎵</div>
              <span>lofi.mp3</span>
            </div>

            <div class="fd-file">
              <div class="fico">📄</div>
              <span>notes.txt</span>
            </div>

          </div>

        </div>
      `;

    case 'notes':
      return `
        <div class="app-notes">

          <div class="nt-list">

            <div
              class="nt-list-item active"
              data-note="0"
            >
              <b>Devlog 1</b>
              <small>
                Kickoff & window system
              </small>
            </div>

            <div
              class="nt-list-item"
              data-note="1"
            >
              <b>Devlog 2</b>
              <small>
                Dock + magnification
              </small>
            </div>

            <div
              class="nt-list-item"
              data-note="2"
            >
              <b>Devlog 3</b>
              <small>
                Dynamic Island + Spotlight
              </small>
            </div>

            <div
              class="nt-list-item"
              data-note="3"
            >
              <b>Scratchpad</b>
              <small>
                Random ideas
              </small>
            </div>

          </div>

          <div class="nt-editor">
            <textarea id="notes-area"></textarea>
          </div>

        </div>
      `;

    case 'term':
      return `
        <div
          class="app-term"
          id="term-body"
        >

          <div class="line">
            duskOS terminal — type "help" to get started.
          </div>

          <div class="prompt-row">

            <span class="prompt-label">
              guest@duskos ~ %
            </span>

            <input
              id="term-input"
              autocomplete="off"
              spellcheck="false"
            >

          </div>

        </div>
      `;

    case 'calc':
      return `
        <div class="app-calc">

          <div
            class="calc-screen"
            id="calc-screen"
          >
            0
          </div>

          <div
            class="calc-grid"
            id="calc-grid"
          ></div>

        </div>
      `;

    case 'music':
      return `
        <div class="app-music">

          <div
            class="mu-art"
            id="mu-art"
          >
            🎵
          </div>

          <div
            class="mu-title"
            id="mu-title"
          >
            —
          </div>

          <div
            class="mu-artist"
            id="mu-artist"
          >
            —
          </div>

          <div class="mu-progress">
            <div
              class="mu-fill"
              id="mu-fill"
            ></div>
          </div>

          <div class="mu-time">
            <span id="mu-elapsed">
              0:00
            </span>

            <span id="mu-duration">
              0:00
            </span>
          </div>

          <div class="mu-controls">

            <button
              id="mu-prev"
              title="Previous"
            >
              ⏮
            </button>

            <button
              id="mu-play"
              title="Play"
            >
              ▶
            </button>

            <button
              id="mu-next"
              title="Next"
            >
              ⏭
            </button>

          </div>

          <div
            class="mu-list"
            id="mu-list"
          ></div>

        </div>
      `;

    case 'weather':
      return `
        <div class="app-weather">

          <div class="wx-loc">
            Dusk Valley
          </div>

          <div class="wx-cond">
            Partly Cloudy
          </div>

          <div class="wx-temp">
            72°
          </div>

          <div class="wx-range">
            H:78°&nbsp;&nbsp;L:64°
          </div>

          <div class="wx-days">

            <div class="wx-day">
              <span>Mon</span>
              <b>⛅</b>
              <small>75/61</small>
            </div>

            <div class="wx-day">
              <span>Tue</span>
              <b>🌦️</b>
              <small>68/58</small>
            </div>

            <div class="wx-day">
              <span>Wed</span>
              <b>☀️</b>
              <small>80/66</small>
            </div>

            <div class="wx-day">
              <span>Thu</span>
              <b>⛅</b>
              <small>76/63</small>
            </div>

            <div class="wx-day">
              <span>Fri</span>
              <b>🌥️</b>
              <small>71/60</small>
            </div>

          </div>

          <p class="wx-note">
            Sample forecast — duskOS doesn't call a live weather service.
          </p>

        </div>
      `;

    case 'settings':
      return `
        <div class="app-settings">

          <div class="st-sidebar">

            <div
              class="st-item active"
              data-panel="appearance"
            >
              🌗 Appearance
            </div>

            <div
              class="st-item"
              data-panel="wallpaper"
            >
              🖼️ Wallpaper
            </div>

            <div
              class="st-item"
              data-panel="sound"
            >
              🔊 Sound
            </div>

            <div
              class="st-item"
              data-panel="about"
            >
              ℹ️ About
            </div>

          </div>

          <div class="st-main">

            <div
              class="st-panel"
              data-panel="appearance"
            >

              <h3>Appearance</h3>

              <div
                class="st-row appearance-switch"
                id="settings-appearance-toggle"
              >

                <span>Theme</span>

                <span class="appearance-value">
                  Dusk
                </span>

              </div>

              <p class="st-hint">
                Switch between Dusk and Daylight.
                This stays in sync with Control Center.
              </p>

            </div>

            <div
              class="st-panel"
              data-panel="wallpaper"
              hidden
            >

              <h3>Wallpaper</h3>

              <div class="wp-preview"></div>

              <p class="st-hint">
                Drop a file named
                <b>wallpaper.png</b>
                next to index.html
                to use your own background.
              </p>

            </div>

            <div
              class="st-panel"
              data-panel="sound"
              hidden
            >

              <h3>Sound</h3>

              <div
                class="st-row"
                style="cursor:default;"
              >
                <span>Output Volume</span>
              </div>

              <input
                type="range"
                class="cc-slider volume-slider"
                min="0"
                max="100"
                value="60"
              >

            </div>

            <div
              class="st-panel"
              data-panel="about"
              hidden
            >

              <h3>About</h3>

              <p class="st-hint">
                duskOS 1.0 — a tiny desktop environment
                built in HTML, CSS and JavaScript.
              </p>

            </div>

          </div>

        </div>
      `;

    case 'about':
      return `
        <div class="app-about">

          <div class="badge">
            💾
          </div>

          <h2>
            duskOS
          </h2>

          <p>
            A tiny desktop environment built entirely
            in HTML, CSS and JavaScript.
          </p>

          <div class="about-specs">

            <div>
              <span>Chip</span>
              <b>Custom Web Engine</b>
            </div>

            <div>
              <span>Memory</span>
              <b>Whatever the tab allows</b>
            </div>

            <div>
              <span>Version</span>
              <b>dusk 1.0</b>
            </div>

            <div>
              <span>Built with</span>
              <b>HTML / CSS / JS</b>
            </div>

          </div>

        </div>
      `;
  }

  return '';
}

/* =========================================================
   POST MOUNT
   ========================================================= */

function postMount(appId,win){

  if(appId === 'notes'){
    setupNotes(win);
  }

  if(appId === 'term'){
    setupTerminal(win);
  }

  if(appId === 'calc'){
    setupCalc(win);
  }

  if(appId === 'music'){
    setupMusic(win);
  }

  if(appId === 'settings'){
    setupSettings(win);
  }
}

/* =========================================================
   NOTES
   ========================================================= */

const noteContents = [
  "Devlog 1\n\nGot the base window manager working today.",
  "Devlog 2\n\nBuilt the dock with smooth hover magnification.",
  "Devlog 3\n\nDynamic Island sits as a clock pill and morphs into Spotlight.",
  "Scratchpad\n\n- toggle light/dark ✅\n- window manager fixes ✅"
];

function setupNotes(win){

  const area =
    win.querySelector('#notes-area');

  const items =
    win.querySelectorAll('.nt-list-item');

  function load(i){
    area.value =
      noteContents[i] || '';
  }

  load(0);

  items.forEach(it=>{

    it.addEventListener('click',()=>{

      items.forEach(x=>
        x.classList.remove('active')
      );

      it.classList.add('active');

      load(+it.dataset.note);
    });

  });
}

/* =========================================================
   TERMINAL
   ========================================================= */

function setupTerminal(win){

  const body =
    win.querySelector('#term-body');

  const input =
    win.querySelector('#term-input');

  const help =
    `Available commands: help, about, projects, date, whoami, joke, clear`;

  const cmds = {

    help:()=>help,

    about:()=>
      "duskOS — a browser-based desktop environment.",

    projects:()=>
      "→ duskOS (this project)\n→ 3 devlogs in Notes",

    date:()=>
      new Date().toString(),

    whoami:()=>
      "guest — poking around the desktop",

    joke:()=>
      "Why did the window get promoted? It had great focus."

  };

  input.addEventListener('keydown',(e)=>{

    if(e.key !== 'Enter') return;

    const raw =
      input.value.trim();

    const echo =
      document.createElement('div');

    echo.className = 'line';

    echo.textContent =
      `guest@duskos ~ % ${raw}`;

    body.insertBefore(
      echo,
      body.lastElementChild
    );

    if(raw === 'clear'){

      body
        .querySelectorAll('.line')
        .forEach(l=>l.remove());

    }else if(raw){

      const fn =
        cmds[raw.toLowerCase()];

      const out =
        document.createElement('div');

      out.className = 'line';

      out.textContent =
        fn
          ? fn()
          : `command not found: ${raw} — try "help"`;

      body.insertBefore(
        out,
        body.lastElementChild
      );
    }

    input.value = '';

    body.scrollTop =
      body.scrollHeight;
  });

  win.addEventListener(
    'mousedown',
    ()=>{
      setTimeout(
        ()=>input.focus(),
        0
      );
    }
  );
}

/* =========================================================
   CALCULATOR
   ========================================================= */

function setupCalc(win){

  const screen =
    win.querySelector('#calc-screen');

  const grid =
    win.querySelector('#calc-grid');

  const keys = [
    'C','±','%','÷',
    '7','8','9','×',
    '4','5','6','−',
    '1','2','3','+',
    '0','.','='
  ];

  let cur = '0';
  let prevVal = null;
  let op = null;
  let fresh = true;

  keys.forEach(k=>{

    const btn =
      document.createElement('button');

    btn.className =
      'calc-btn' +
      (
        ['÷','×','−','+','='].includes(k)
          ? ' op'
          : ['C','±','%'].includes(k)
            ? ' fn'
            : ''
      ) +
      (
        k === '0'
          ? ' zero'
          : ''
      );

    btn.textContent = k;

    btn.addEventListener(
      'click',
      ()=>press(k)
    );

    grid.appendChild(btn);
  });

  function render(){
    screen.textContent =
      cur;
  }

  function press(k){

    if(!isNaN(k) || k === '.'){

      if(fresh){

        cur =
          k === '.'
            ? '0.'
            : k;

        fresh = false;

      }else{

        if(
          k === '.' &&
          cur.includes('.')
        ){
          return;
        }

        cur += k;
      }

    }else if(k === 'C'){

      cur = '0';
      prevVal = null;
      op = null;
      fresh = true;

    }else if(k === '±'){

      cur =
        String(parseFloat(cur) * -1);

    }else if(k === '%'){

      cur =
        String(parseFloat(cur) / 100);

    }else if(
      ['÷','×','−','+'].includes(k)
    ){

      prevVal =
        parseFloat(cur);

      op = k;
      fresh = true;

    }else if(k === '='){

      if(op !== null){

        const b =
          parseFloat(cur);

        let r = b;

        if(op === '÷'){
          r = prevVal / b;
        }

        if(op === '×'){
          r = prevVal * b;
        }

        if(op === '−'){
          r = prevVal - b;
        }

        if(op === '+'){
          r = prevVal + b;
        }

        cur =
          String(
            Math.round(r * 1e8) / 1e8
          );

        op = null;
        prevVal = null;
        fresh = true;
      }
    }

    render();
  }

  render();
}

/* =========================================================
   MUSIC
   ========================================================= */

const playlist = [
  {
    title:'Afterglow',
    artist:'Late Static',
    duration:184
  },
  {
    title:'Violet Hour',
    artist:'Kite & Coast',
    duration:212
  },
  {
    title:'Low Tide Motel',
    artist:'Paper Radio',
    duration:167
  },
  {
    title:'Amber Streetlamp',
    artist:'Late Static',
    duration:198
  }
];

function setupMusic(win){

  let idx = 0;
  let playing = false;
  let elapsed = 0;
  let timer = null;

  const title =
    win.querySelector('#mu-title');

  const artist =
    win.querySelector('#mu-artist');

  const fill =
    win.querySelector('#mu-fill');

  const elapsedEl =
    win.querySelector('#mu-elapsed');

  const durationEl =
    win.querySelector('#mu-duration');

  const playBtn =
    win.querySelector('#mu-play');

  const list =
    win.querySelector('#mu-list');

  function fmt(s){

    const m =
      Math.floor(s / 60);

    const r =
      Math.floor(s % 60);

    return `${m}:${String(r).padStart(2,'0')}`;
  }

  function renderList(){

    list.innerHTML = '';

    playlist.forEach((t,i)=>{

      const row =
        document.createElement('div');

      row.className =
        'mu-track' +
        (
          i === idx
            ? ' playing'
            : ''
        );

      row.innerHTML = `
        <span>${t.title}</span>
        <small>${fmt(t.duration)}</small>
      `;

      row.addEventListener(
        'click',
        ()=>loadTrack(i,true)
      );

      list.appendChild(row);
    });
  }

  function loadTrack(i,autoplay){

    idx =
      (i + playlist.length) %
      playlist.length;

    elapsed = 0;

    const t =
      playlist[idx];

    title.textContent =
      t.title;

    artist.textContent =
      t.artist;

    durationEl.textContent =
      fmt(t.duration);

    elapsedEl.textContent =
      '0:00';

    fill.style.width =
      '0%';

    renderList();

    if(autoplay){
      play();
    }else{
      pause();
    }
  }

  function tick(){

    elapsed++;

    const t =
      playlist[idx];

    if(elapsed >= t.duration){

      loadTrack(
        idx + 1,
        true
      );

      return;
    }

    elapsedEl.textContent =
      fmt(elapsed);

    fill.style.width =
      `${elapsed / t.duration * 100}%`;
  }

  function play(){

    playing = true;

    playBtn.textContent =
      '⏸';

    clearInterval(timer);

    timer =
      setInterval(
        tick,
        1000
      );
  }

  function pause(){

    playing = false;

    playBtn.textContent =
      '▶';

    clearInterval(timer);

    timer = null;
  }

  playBtn.addEventListener(
    'click',
    ()=>{
      playing
        ? pause()
        : play();
    }
  );

  win
    .querySelector('#mu-next')
    .addEventListener(
      'click',
      ()=>{
        loadTrack(
          idx + 1,
          playing
        );
      }
    );

  win
    .querySelector('#mu-prev')
    .addEventListener(
      'click',
      ()=>{
        loadTrack(
          idx - 1,
          playing
        );
      }
    );

  loadTrack(
    0,
    false
  );
}

/* =========================================================
   SETTINGS
   ========================================================= */

let isLight =
  document.body.classList.contains(
    'light-mode'
  );

function applyAppearance(light){

  isLight = light;

  document.body.classList.toggle(
    'light-mode',
    light
  );

  document
    .querySelectorAll('.appearance-value')
    .forEach(el=>{
      el.textContent =
        light
          ? 'Daylight'
          : 'Dusk';
    });

  document
    .querySelectorAll('.appearance-switch')
    .forEach(el=>{
      el.classList.toggle(
        'is-on',
        light
      );
    });
}

function setupSettings(win){

  const items =
    win.querySelectorAll('.st-item');

  const panels =
    win.querySelectorAll('.st-panel');

  items.forEach(it=>{

    it.addEventListener(
      'click',
      ()=>{

        items.forEach(x=>
          x.classList.remove('active')
        );

        it.classList.add('active');

        panels.forEach(panel=>{
          panel.hidden =
            panel.dataset.panel !==
            it.dataset.panel;
        });

      }
    );

  });

  const toggle =
    win.querySelector(
      '#settings-appearance-toggle'
    );

  if(toggle){

    toggle.addEventListener(
      'click',
      ()=>{
        applyAppearance(!isLight);
      }
    );
  }

  applyAppearance(isLight);
}

/* =========================================================
   DOCK
   ========================================================= */

function handleDockClick(appId){

  if(!appId) return;

  const win =
    openWindows[appId];

  if(!win){

    openApp(appId);

  }else if(
    win.style.display === 'none' ||
    win.classList.contains('minimized-state') ||
    win.classList.contains('minimized')
  ){

    restoreWindow(appId);

  }else if(
    win.classList.contains('focused')
  ){

    minimizeApp(appId);

  }else{

    focusWindow(
      win,
      appId
    );
  }
}

document
  .querySelectorAll('.dock-item')
  .forEach(item=>{

    item.addEventListener(
      'click',
      e=>{
        e.stopPropagation();

        handleDockClick(
          item.dataset.app
        );
      }
    );

  });

/* =========================================================
   DESKTOP ICONS
   ========================================================= */

document
  .querySelectorAll('.dicon[data-open]')
  .forEach(icon=>{

    icon.addEventListener(
      'dblclick',
      ()=>{
        openApp(
          icon.dataset.open
        );
      }
    );

    /*
       Also allow a single click.
    */

    icon.addEventListener(
      'click',
      ()=>{
        icon.classList.add('selected');

        setTimeout(()=>{
          icon.classList.remove('selected');
        },200);
      }
    );

  });

/* =========================================================
   DOCK MAGNIFICATION
   ========================================================= */

const dock =
  document.getElementById('dock');

if(dock){

  dock.addEventListener(
    'mousemove',
    e=>{

      const items =
        dock.querySelectorAll(
          '.dock-item'
        );

      items.forEach(it=>{

        const r =
          it.getBoundingClientRect();

        const dist =
          Math.abs(
            e.clientX -
            (r.left + r.width / 2)
          );

        const max = 74;
        const base = 52;
        const range = 110;

        const scale =
          dist > range
            ? 0
            : 1 - dist / range;

        const size =
          base +
          (max - base) * scale;

        it.style.width =
          `${size}px`;

        it.style.height =
          `${size}px`;

        it.style.fontSize =
          `${24 + 10 * scale}px`;
      });
    }
  );

  dock.addEventListener(
    'mouseleave',
    ()=>{

      dock
        .querySelectorAll('.dock-item')
        .forEach(it=>{

          it.style.width = '';
          it.style.height = '';
          it.style.fontSize = '';
        });
    }
  );
}

/* =========================================================
   CONTROL CENTER
   ========================================================= */

const cc =
  document.getElementById(
    'control-center'
  );

const ccToggle =
  document.getElementById(
    'cc-toggle'
  );

if(ccToggle && cc){

  ccToggle.addEventListener(
    'click',
    e=>{

      e.stopPropagation();

      cc.classList.toggle(
        'open'
      );
    }
  );

  document.addEventListener(
    'click',
    e=>{

      if(
        !cc.contains(e.target) &&
        !ccToggle.contains(e.target)
      ){

        cc.classList.remove(
          'open'
        );
      }
    }
  );
}

const ccAppearance =
  document.getElementById(
    'cc-appearance-toggle'
  );

if(ccAppearance){

  ccAppearance.addEventListener(
    'click',
    ()=>{
      applyAppearance(!isLight);
    }
  );
}

/* =========================================================
   BRIGHTNESS
   ========================================================= */

const brightness =
  document.getElementById(
    'brightness'
  );

if(brightness){

  brightness.addEventListener(
    'input',
    ()=>{

      const value =
        brightness.value / 100;

      document
        .getElementById('desktop')
        .style.filter =
        `brightness(${value})`;
    }
  );
}

/* =========================================================
   VOLUME
   ========================================================= */

document
  .querySelectorAll('.volume-slider')
  .forEach(slider=>{

    slider.addEventListener(
      'input',
      ()=>{
        document
          .querySelectorAll(
            '.volume-slider'
          )
          .forEach(other=>{
            if(other !== slider){
              other.value =
                slider.value;
            }
          });
      }
    );

  });

/* =========================================================
   DYNAMIC ISLAND / SPOTLIGHT
   ========================================================= */

const island =
  document.getElementById('island');

const spInput =
  document.getElementById(
    'spotlight-input'
  );

const spResults =
  document.getElementById(
    'spotlight-results'
  );

let spotlightSelected = 0;

function renderSpotlight(query=''){

  if(!spResults) return;

  const q =
    query.trim().toLowerCase();

  const matches =
    Object.entries(APPS)
      .filter(([id,cfg])=>{
        return (
          !q ||
          cfg.title
            .toLowerCase()
            .includes(q) ||
          id.includes(q)
        );
      });

  spResults.innerHTML = '';

  spotlightSelected = 0;

  if(!matches.length){

    spResults.innerHTML = `
      <div class="sp-empty">
        No apps found
      </div>
    `;

    return;
  }

  matches.forEach(
    ([id,cfg],index)=>{

      const item =
        document.createElement('div');

      item.className =
        'sp-item' +
        (
          index === 0
            ? ' sel'
            : ''
        );

      item.innerHTML = `
        <div class="glyph ${cfg.glyphClass}">
          ${cfg.glyph}
        </div>

        <div class="meta">
          <b>${cfg.title}</b>
          <small>Open application</small>
        </div>
      `;

      item.addEventListener(
        'click',
        ()=>{
          openApp(id);

          island?.classList.remove(
            'expanded'
          );

          if(spInput){
            spInput.value = '';
          }
        }
      );

      spResults.appendChild(
        item
      );
    }
  );
}

function expandIsland(){

  if(!island) return;

  island.classList.add(
    'expanded'
  );

  renderSpotlight('');

  setTimeout(
    ()=>{
      spInput?.focus();
    },
    100
  );
}

if(island){

  island.addEventListener(
    'click',
    ()=>{
      if(
        !island.classList.contains(
          'expanded'
        )
      ){
        expandIsland();
      }
    }
  );
}

if(spInput){

  spInput.addEventListener(
    'input',
    ()=>{
      renderSpotlight(
        spInput.value
      );
    }
  );

  spInput.addEventListener(
    'keydown',
    e=>{

      if(e.key === 'Escape'){

        island?.classList.remove(
          'expanded'
        );

        spInput.value = '';

        return;
      }

      if(e.key === 'Enter'){

        const first =
          spResults?.querySelector(
            '.sp-item'
          );

        if(first){
          first.click();
        }
      }
    }
  );
}

/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
  'keydown',
  e=>{

    /*
       Ctrl/Cmd + Space
       = Spotlight
    */

    if(
      (e.ctrlKey || e.metaKey) &&
      e.code === 'Space'
    ){

      e.preventDefault();

      expandIsland();
    }

    /*
       Escape closes Spotlight
    */

    if(
      e.key === 'Escape' &&
      island?.classList.contains(
        'expanded'
      )
    ){

      island.classList.remove(
        'expanded'
      );

      if(spInput){
        spInput.value = '';
      }
    }
  }
);

/* =========================================================
   INITIAL STATE
   ========================================================= */

applyAppearance(isLight);