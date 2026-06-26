// Interactive fleet inspector — real, accurate aircraft models embedded from
// Sketchfab (CC-BY). A single viewer with a type switcher and attribution.
const MODELS = {
  atr72:   { uid: '1e1a7186f7444d288675262fcee44744', label: 'ATR 72-600',     author: 'Sofyan Kurniawan', lic: 'CC BY' },
  ejet:    { uid: '6a674201fceb4395bee35dce685e1ff6', label: 'Embraer E195-E2', author: 'Simaoelis3D',      lic: '' },
  b737max: { uid: '2747cad8b4c64122abe992c9ad1e8bd1', label: 'Boeing 737 MAX',  author: 'Sofyan Kurniawan', lic: 'CC BY' },
  a320neo: { uid: 'b14863d4091e41e6abe25832a0af3b00', label: 'Airbus A320neo',  author: 'pranav27',         lic: 'CC BY' },
};
const PARAMS = 'autostart=1&autospin=0.3&ui_theme=dark&dnt=1&transparent=1&ui_hint=2&ui_color=f0bd6c';

export function initFleet3D(stage) {
  const frame = document.createElement('iframe');
  frame.className = 'f3-frame';
  frame.title = 'Interactive 3D aircraft model';
  frame.loading = 'lazy';
  frame.allow = 'autoplay; fullscreen; xr-spatial-tracking';
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('mozallowfullscreen', 'true');
  frame.setAttribute('webkitallowfullscreen', 'true');

  const loader = document.createElement('div');
  loader.className = 'f3-loader';
  loader.innerHTML = '<span></span>LOADING AIRFRAME';
  stage.append(frame, loader);

  const credit = document.getElementById('fleet3d-credit');
  function load(key) {
    const m = MODELS[key];
    loader.classList.add('on');
    frame.src = `https://sketchfab.com/models/${m.uid}/embed?${PARAMS}`;
    if (credit) credit.innerHTML = `Live 3D · <b>${m.label}</b> — model by ${m.author}${m.lic ? ' · ' + m.lic : ''} · via Sketchfab`;
  }
  frame.addEventListener('load', () => loader.classList.remove('on'));

  const pills = [...document.querySelectorAll('#fleet3d-switch .f3-pill')];
  function select(key) {
    pills.forEach((b) => b.classList.toggle('on', b.dataset.type === key));
    load(key);
  }
  pills.forEach((btn) => btn.addEventListener('click', () => {
    if (!btn.classList.contains('on')) select(btn.dataset.type);
  }));
  select('atr72'); // authoritative default — visual + model always in sync
}
