// Intro animata di Designazioni: alba sul mare con i gabbiani in volo e le scritte sincronizzate
// con il messaggio vocale. Compare la prima volta che si apre la pagina dopo aver aperto il
// sito (una volta per sessione del browser). I tempi delle frasi vengono dall'analisi delle
// pause dell'audio; la sequenza segue audio.currentTime, quindi resta allineata anche se
// l'audio parte in ritardo. Se il browser blocca l'audio automatico compare un pulsante Play.

const INTRO_AUDIO = "/static/audio/intro_designazioni.opus";
const INTRO_CHIAVE_SESSIONE = "introDesignazioniVista";
const INTRO_DURATA = 12.2;

// [inizio, fine) in secondi: ogni elemento con quell'indice è visibile nell'intervallo
const INTRO_SCALETTA = [
  { classe: "frase-1", da: 0.7, a: 6.2 },
  { classe: "frase-2", da: 3.0, a: 6.2 },
  { classe: "frase-3", da: 6.5, a: 8.6 },
  { classe: "gabbiano-telefono", da: 6.5, a: 99 },
  { classe: "frase-4", da: 8.5, a: 99 },
  { classe: "intro-azione", da: 9.6, a: 99 },
];

function _gabbianoInVolo(x, y, scala, durata, ritardo, bob) {
  return `
    <g class="volo" style="--y:${y}px; --dur:${durata}s; --delay:${ritardo}s; --x0:${x}px">
      <g class="volo-bob" style="--bob:${bob}px">
        <path transform="scale(${scala})" d="M-30 0 Q-15 -16 0 0 Q15 -16 30 0" fill="none" stroke="#1d2340" stroke-width="${4 / scala}" stroke-linecap="round" stroke-linejoin="round">
          <animate attributeName="d" dur="${(0.45 + scala * 0.25).toFixed(2)}s" repeatCount="indefinite"
            values="M-30 0 Q-15 -16 0 0 Q15 -16 30 0;M-30 8 Q-15 8 0 0 Q15 8 30 8;M-30 0 Q-15 -16 0 0 Q15 -16 30 0"/>
        </path>
      </g>
    </g>`;
}

function _scenaAlba() {
  const onde = [0, 1, 2, 3].map(i => {
    const y = 640 + i * 55;
    const segmento = "q 50 -9 100 0 t 100 0";
    return `<path class="onda" style="--dur:${7 + i * 3}s; opacity:${0.35 - i * 0.06}" d="M-200 ${y} ${segmento.repeat(20)}" fill="none" stroke="#ffe3b8" stroke-width="${2.5 - i * 0.4}"/>`;
  }).join("");
  const riflessi = Array.from({ length: 14 }, (_, i) => {
    const y = 625 + i * 19;
    const larghezza = 150 - i * 7 + (i % 3) * 18;
    return `<rect class="riflesso" style="--delay:${(i * 0.17).toFixed(2)}s" x="${1105 - larghezza / 2}" y="${y}" width="${larghezza}" height="5" rx="2.5" fill="#ffd37a"/>`;
  }).join("");
  const stormo = [
    _gabbianoInVolo(1700, 230, 2.3, 10, 0, 22),
    _gabbianoInVolo(1850, 320, 1.7, 12, 0.6, 16),
    _gabbianoInVolo(1760, 400, 1.2, 14, 1.4, 12),
    _gabbianoInVolo(2000, 180, 1.0, 16, 2.2, 10),
    _gabbianoInVolo(1900, 470, 0.8, 18, 0.2, 8),
    _gabbianoInVolo(2150, 270, 1.9, 11, 4.5, 18),
    _gabbianoInVolo(2300, 360, 1.4, 13, 6.0, 12),
  ].join("");
  return `
    <svg class="intro-scena" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="intro-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#16204a"/>
          <stop offset="0.45" stop-color="#5b3f86"/>
          <stop offset="0.72" stop-color="#e2735a"/>
          <stop offset="1" stop-color="#ffc77a"/>
        </linearGradient>
        <linearGradient id="intro-cielo-giorno" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4f7fc4"/>
          <stop offset="0.5" stop-color="#9fb8e3"/>
          <stop offset="0.8" stop-color="#ffc59a"/>
          <stop offset="1" stop-color="#ffe2a8"/>
        </linearGradient>
        <linearGradient id="intro-mare" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3a3f74"/>
          <stop offset="1" stop-color="#0d1430"/>
        </linearGradient>
        <radialGradient id="intro-sole" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#fffbe6"/>
          <stop offset="0.55" stop-color="#ffd166"/>
          <stop offset="1" stop-color="#ff9a3d"/>
        </radialGradient>
        <radialGradient id="intro-alone" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#ffd38a" stop-opacity="0.75"/>
          <stop offset="1" stop-color="#ffd38a" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="intro-sopra-orizzonte"><rect x="0" y="0" width="1600" height="600"/></clipPath>
      </defs>
      <rect width="1600" height="600" fill="url(#intro-cielo)"/>
      <rect class="cielo-giorno" width="1600" height="600" fill="url(#intro-cielo-giorno)"/>
      <g class="nuvole">
        <ellipse cx="300" cy="190" rx="190" ry="26" fill="#f7b8a2" opacity="0.55"/>
        <ellipse cx="430" cy="215" rx="120" ry="18" fill="#ffd0b5" opacity="0.45"/>
        <ellipse cx="1300" cy="130" rx="220" ry="24" fill="#f3a7a0" opacity="0.4"/>
        <ellipse cx="820" cy="300" rx="160" ry="16" fill="#ffc9a8" opacity="0.4"/>
      </g>
      <g clip-path="url(#intro-sopra-orizzonte)">
        <g class="sole">
          <circle cx="1105" cy="600" r="260" fill="url(#intro-alone)" class="sole-alone"/>
          <circle cx="1105" cy="600" r="78" fill="url(#intro-sole)"/>
        </g>
      </g>
      <rect y="600" width="1600" height="300" fill="url(#intro-mare)"/>
      <rect y="598" width="1600" height="4" fill="#ffd8a0" opacity="0.6"/>
      <g class="riflessi">${riflessi}</g>
      <g class="onde">${onde}</g>
      <g class="stormo">${stormo}</g>
    </svg>`;
}

const SVG_TELEFONO_INTRO = `
  <svg class="telefono" viewBox="0 0 60 100" aria-hidden="true">
    <rect x="2" y="2" width="56" height="96" rx="10" fill="#1b2130"/>
    <rect x="7" y="12" width="46" height="74" rx="4" fill="#3a6bb5"/>
    <rect x="12" y="20" width="36" height="6" rx="3" fill="#ffffff" opacity="0.9"/>
    <rect x="12" y="32" width="26" height="5" rx="2.5" fill="#ffffff" opacity="0.6"/>
    <rect x="12" y="42" width="31" height="5" rx="2.5" fill="#ffffff" opacity="0.6"/>
    <rect x="12" y="62" width="36" height="14" rx="5" fill="#ffd166"/>
    <rect x="24" y="5" width="12" height="3" rx="1.5" fill="#3d4559"/>
  </svg>`;

function apriIntroDesignazioni() {
  if (document.getElementById("intro-designazioni")) return;

  const overlay = document.createElement("div");
  overlay.id = "intro-designazioni";
  overlay.className = "intro-overlay";
  overlay.innerHTML = `
    <div class="intro-video" role="dialog" aria-modal="true" aria-label="Buongiorno: è ora di fare le designazioni">
      ${_scenaAlba()}
      <div class="intro-testi">
        <p class="intro-frase frase-1">Ciao gabbiano!</p>
        <p class="intro-frase frase-2">Hai finito la doccia, immagino…</p>
        <p class="intro-frase frase-3">…e ti prendi il telefono</p>
        <p class="intro-frase intro-finale frase-4">È ora di fare le designazioni, allora??</p>
      </div>
      <div class="gabbiano-telefono">${SVG_GABBIANO}${SVG_TELEFONO_INTRO}</div>
      <button type="button" class="btn btn-primary intro-azione">Andiamo a designare</button>
      <button type="button" class="intro-play" aria-label="Avvia l'intro con l'audio">
        <span class="intro-play-icona"></span>
        <span>Buongiorno!</span>
      </button>
      <button type="button" class="intro-chiudi" aria-label="Salta l'intro">Salta &times;</button>
      <div class="intro-progresso"><span></span></div>
    </div>`;
  document.body.appendChild(overlay);

  const video = overlay.querySelector(".intro-video");
  const barra = overlay.querySelector(".intro-progresso span");
  const audio = new Audio(INTRO_AUDIO);
  audio.preload = "auto";
  let partenzaSenzaAudio = null;
  let senzaAudio = false;
  let animazione = null;
  let chiusa = false;

  const tempo = () => senzaAudio ? (performance.now() - partenzaSenzaAudio) / 1000 : audio.currentTime;

  const aggiorna = () => {
    if (chiusa) return;
    const t = tempo();
    INTRO_SCALETTA.forEach(({ classe, da, a }) => {
      const el = overlay.querySelector(`.${classe}`);
      if (el) el.classList.toggle("visibile", t >= da && t < a);
    });
    barra.style.width = `${Math.min(100, t / INTRO_DURATA * 100)}%`;
    animazione = requestAnimationFrame(aggiorna);
  };

  const avvia = (conAudio) => {
    overlay.classList.add("in-corso");
    overlay.querySelector(".intro-play").remove();
    if (!conAudio) {
      senzaAudio = true;
      partenzaSenzaAudio = performance.now();
    }
    aggiorna();
  };

  const chiudi = () => {
    if (chiusa) return;
    chiusa = true;
    cancelAnimationFrame(animazione);
    audio.pause();
    document.removeEventListener("keydown", tasti, true);
    overlay.classList.add("in-uscita");
    setTimeout(() => overlay.remove(), 450);
  };
  const tasti = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); chiudi(); }
  };

  overlay.querySelector(".intro-chiudi").addEventListener("click", chiudi);
  overlay.querySelector(".intro-azione").addEventListener("click", chiudi);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) chiudi(); });
  document.addEventListener("keydown", tasti, true);
  overlay.querySelector(".intro-play").addEventListener("click", () => {
    audio.play().then(() => avvia(true)).catch(() => avvia(false));
  });

  // se il browser permette l'audio automatico parte subito, altrimenti aspetta il clic su Play
  audio.play().then(() => avvia(true)).catch(() => video.classList.add("attende-play"));
}

document.addEventListener("DOMContentLoaded", () => {
  let giaVista = false;
  try {
    giaVista = sessionStorage.getItem(INTRO_CHIAVE_SESSIONE) === "1";
    sessionStorage.setItem(INTRO_CHIAVE_SESSIONE, "1");
  } catch {}
  if (!giaVista) apriIntroDesignazioni();
});
