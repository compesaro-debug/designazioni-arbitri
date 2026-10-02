// Sorprese della pagina Designazioni:
// - il gabbiano gigante a ali incrociate quando si prova a designare un arbitro indisponibile
//   (chiede conferma: con il doppio clic sulla griglia sarebbe facile designarlo per sbaglio);
// - la schermata della "giovane promessa" quando viene designato Di Domenico.
// Usa _versoGabbiano() e _gabbianoMuto() di common.js.

const SVG_GABBIANO_STOP = `
  <svg viewBox="0 0 240 270" width="240" height="270" aria-hidden="true">
    <g stroke="#e8892b" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M100 236 L96 258 L84 262 M96 258 L104 264"/>
      <path d="M140 236 L144 258 L136 264 M144 258 L156 262"/>
    </g>
    <ellipse cx="120" cy="168" rx="72" ry="78" fill="#ffffff" stroke="#d3d8e0" stroke-width="2"/>
    <circle cx="120" cy="78" r="50" fill="#ffffff" stroke="#d3d8e0" stroke-width="2"/>
    <path d="M84 56 L110 68" stroke="#1b2130" stroke-width="6" stroke-linecap="round"/>
    <path d="M156 56 L130 68" stroke="#1b2130" stroke-width="6" stroke-linecap="round"/>
    <circle cx="100" cy="78" r="6.5" fill="#1b2130"/>
    <circle cx="140" cy="78" r="6.5" fill="#1b2130"/>
    <path d="M104 94 L136 94 L120 122 Z" fill="#f2b705"/>
    <circle cx="120" cy="114" r="3" fill="#d0392b"/>
    <g class="ala-stop ala-stop-sx">
      <path d="M22 158 Q120 128 224 150 L236 166 Q120 186 22 172 Z" fill="#9aa5b4"/>
      <path d="M210 150 L236 166 L212 170 Z" fill="#1b2130"/>
    </g>
    <g class="ala-stop ala-stop-dx">
      <path d="M218 158 Q120 128 16 150 L4 166 Q120 186 218 172 Z" fill="#8f9aab"/>
      <path d="M30 150 L4 166 L28 170 Z" fill="#1b2130"/>
    </g>
  </svg>`;

function _periodoIndisponibilita(c) {
  const dal = c.indisp_dal_data ? `${formattaData(c.indisp_dal_data)}${c.indisp_dal_ora ? " " + c.indisp_dal_ora : ""}` : "";
  const al = c.indisp_al_data ? `${formattaData(c.indisp_al_data)}${c.indisp_al_ora ? " " + c.indisp_al_ora : ""}` : "";
  const periodo = dal && al ? `dal ${dal} al ${al}` : (dal ? `dal ${dal}` : "");
  return [periodo, c.indisp_motivo].filter(Boolean).join(" — ");
}

// Promise<boolean>: true se si vuole designare comunque
function gabbianoIndisponibile(candidato) {
  return new Promise(resolve => {
    if (!_gabbianoMuto()) {
      _versoGabbiano();
      setTimeout(_versoGabbiano, 1300);
    }
    const overlay = document.createElement("div");
    overlay.className = "overlay show overlay-conferma overlay-gabbiano-stop";
    overlay.innerHTML = `
      <div class="gabbiano-stop" role="alertdialog" aria-modal="true" aria-labelledby="gabbiano-stop-titolo">
        <div class="gabbiano-stop-fumetto" id="gabbiano-stop-titolo">È indisponibile, gabbiano!</div>
        <div class="gabbiano-stop-figura">${SVG_GABBIANO_STOP}</div>
        <p class="gabbiano-stop-dettaglio"></p>
        <div class="gabbiano-stop-azioni">
          <button type="button" class="btn btn-primary" data-scelta="no">Va bene, scelgo un altro</button>
          <button type="button" class="btn btn-secondary" data-scelta="si">Designa comunque</button>
        </div>
      </div>`;
    const dettaglio = _periodoIndisponibilita(candidato);
    overlay.querySelector(".gabbiano-stop-dettaglio").textContent =
      `${candidato.nome} non è disponibile per questa gara${dettaglio ? ": " + dettaglio : "."}`;

    const chiudi = (esito) => {
      document.removeEventListener("keydown", tasti, true);
      overlay.remove();
      resolve(esito);
    };
    const tasti = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); chiudi(false); }
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) chiudi(false);
      const scelta = e.target.closest("[data-scelta]");
      if (scelta) chiudi(scelta.dataset.scelta === "si");
    });
    document.addEventListener("keydown", tasti, true);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-scelta="no"]').focus();
  });
}

// ---------- LA GIOVANE PROMESSA ----------

function eGiovanePromessa(nome) {
  return /\bdi\s*domenico\b/i.test(nome || "");
}

// posizioni delle stelle dentro ogni sfera (da 1 a 7 stelle)
const _STELLE_SFERA = [
  [[0, 0]],
  [[-6, -5], [6, 5]],
  [[0, -8], [-7, 5], [7, 5]],
  [[-6, -6], [6, -6], [-6, 6], [6, 6]],
  [[0, 0], [-8, -8], [8, -8], [-8, 8], [8, 8]],
  [[-6, -10], [6, -10], [-6, 0], [6, 0], [-6, 10], [6, 10]],
  [[0, 0], ...[0, 60, 120, 180, 240, 300].map(g => [11 * Math.cos(g * Math.PI / 180), 11 * Math.sin(g * Math.PI / 180)])],
];

function _stella(cx, cy, r = 5) {
  const punti = [];
  for (let i = 0; i < 10; i++) {
    const raggio = i % 2 === 0 ? r : r * 0.42;
    const angolo = -Math.PI / 2 + i * Math.PI / 5;
    punti.push(`${(cx + raggio * Math.cos(angolo)).toFixed(1)},${(cy + raggio * Math.sin(angolo)).toFixed(1)}`);
  }
  return `<polygon points="${punti.join(" ")}" fill="#d42a1e"/>`;
}

function _svgSfere() {
  const centro = 200, raggioCerchio = 150, raggioSfera = 27;
  const sfere = _STELLE_SFERA.map((stelle, i) => {
    const angolo = -Math.PI / 2 + i * 2 * Math.PI / 7;
    const x = centro + raggioCerchio * Math.cos(angolo);
    const y = centro + raggioCerchio * Math.sin(angolo);
    return `
      <g class="sfera" style="animation-delay:${(i * 0.18).toFixed(2)}s">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${raggioSfera}" fill="url(#gradiente-sfera)"/>
        ${stelle.map(([dx, dy]) => _stella(x + dx, y + dy)).join("")}
        <ellipse cx="${(x - 9).toFixed(1)}" cy="${(y - 11).toFixed(1)}" rx="8" ry="5" fill="#ffffff" opacity="0.55" transform="rotate(-30 ${(x - 9).toFixed(1)} ${(y - 11).toFixed(1)})"/>
      </g>`;
  }).join("");
  return `
    <svg viewBox="0 0 400 400" class="promessa-anello" aria-hidden="true">
      <defs>
        <radialGradient id="gradiente-sfera" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#ffe7a3"/>
          <stop offset="45%" stop-color="#f7a823"/>
          <stop offset="100%" stop-color="#c8560c"/>
        </radialGradient>
      </defs>
      ${sfere}
    </svg>`;
}

function mostraGiovanePromessa(nome, dettaglio) {
  const precedente = document.getElementById("giovane-promessa");
  if (precedente) precedente.remove();

  const overlay = document.createElement("div");
  overlay.id = "giovane-promessa";
  overlay.className = "overlay show overlay-conferma overlay-promessa";
  overlay.innerHTML = `
    <div class="promessa" role="dialog" aria-modal="true" aria-label="La giovane promessa">
      ${_svgSfere()}
      <div class="promessa-centro">
        <div class="promessa-titolo">La giovane<br>promessa</div>
        <div class="promessa-nome"></div>
        <div class="promessa-dettaglio"></div>
      </div>
      <div class="promessa-chiudi">Clic per chiudere</div>
    </div>`;
  overlay.querySelector(".promessa-nome").textContent = nome;
  overlay.querySelector(".promessa-dettaglio").textContent = dettaglio || "";

  const chiudi = () => {
    document.removeEventListener("keydown", tasti, true);
    overlay.classList.add("in-uscita");
    setTimeout(() => overlay.remove(), 400);
  };
  const tasti = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); chiudi(); }
  };
  overlay.addEventListener("click", chiudi);
  document.addEventListener("keydown", tasti, true);
  document.body.appendChild(overlay);
  setTimeout(chiudi, 6500);
}
