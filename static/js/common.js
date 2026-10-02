// ---------- SOTTO-ALIAS CAMPIONATO (campionato/coppa/playoff/fasi finali) ----------
// Stessa etichetta/colore ovunque compaia il tipo_fase di una gara (Partite, Designazioni,
// Report...): valori coerenti con ETICHETTE_FASE lato backend (app.py).

const ETICHETTE_FASE_JS = { campionato: "Campionato", coppa: "Coppa", playoff: "Playoff/Play out", final_four: "Fasi finali" };
const ORDINE_FASI_JS = ["campionato", "coppa", "playoff", "final_four"];
const CLASSE_TAG_FASE_JS = { campionato: "", coppa: "tag-verde", playoff: "tag-arancione", final_four: "tag-giallo" };

function tagFase(tipoFase) {
  const fase = tipoFase || "campionato";
  const etichetta = ETICHETTE_FASE_JS[fase] || fase;
  const classe = CLASSE_TAG_FASE_JS[fase] || "";
  return `<span class="tag ${classe}">${etichetta}</span>`;
}

// ---------- GARE IMPORTATE COME DISPUTATE MA CON DATA FUTURA ----------
// Il sistema principale (federale) a volte esporta come "disputate" gare già designate ma
// non ancora giocate nella realtà: si riconoscono dal fatto che la loro data è successiva a
// oggi. Evidenziarle evita di trattarle come risultati reali finché la data non è passata.

function dataNelFuturo(data) {
  return !!data && data > new Date().toISOString().slice(0, 10);
}

// ---------- MENU LATERALE APRIBILE/CHIUDIBILE ----------

function toggleSidebar() {
  const collassata = document.documentElement.classList.toggle("sidebar-collassata");
  localStorage.setItem("sidebarCollassata", collassata ? "1" : "0");
}

// ---------- GRUPPI DI MENU (sottomenu a comparsa nella sidebar) ----------
// Ogni gruppo ricorda se era aperto o chiuso in localStorage (aperto se mai toccato); il
// gruppo che contiene la pagina attualmente attiva viene sempre aperto.

function toggleNavGroup(nome) {
  if (document.documentElement.classList.contains("sidebar-collassata")) {
    toggleSidebar();
  }
  const gruppo = document.querySelector(`.nav-group[data-nav-group="${nome}"]`);
  if (!gruppo) return;
  const espandi = !gruppo.classList.contains("espanso");
  gruppo.classList.toggle("espanso", espandi);
  localStorage.setItem(`navGroupEspanso_${nome}`, espandi ? "1" : "0");
}

document.querySelectorAll(".nav-group").forEach(gruppo => {
  const nome = gruppo.dataset.navGroup;
  const contieneAttiva = !!gruppo.querySelector(".nav-item.active");
  const salvato = localStorage.getItem(`navGroupEspanso_${nome}`);
  gruppo.classList.toggle("espanso", contieneAttiva || salvato !== "0");
});

// ---------- PULSANTI AZIONE DI RIGA (icona + etichetta) ----------
// Il tipo "modifica" è l'azione principale: la lancia anche il doppio clic sulla riga.

const ICONE_AZIONE = {
  modifica: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>',
  elimina: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
  report: '<path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19V3"></path>',
  gestisci: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"></path>',
  designa: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line>',
  conferma: '<polyline points="20 6 9 17 4 12"></polyline>',
  storico: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path>',
};

function iconaAzione(tipo, dimensione = 14) {
  return `<svg viewBox="0 0 24 24" width="${dimensione}" height="${dimensione}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE_AZIONE[tipo] || ""}</svg>`;
}

function btnAzione(tipo, onclick, etichetta, principale = tipo === "modifica") {
  return `<button type="button" class="btn-azione btn-azione-${tipo}" onclick="${onclick}" title="${etichetta}" data-icona="${tipo}"${principale ? " data-azione-principale" : ""}>${iconaAzione(tipo)}<span>${etichetta}</span></button>`;
}

// ---------- MENU TASTO DESTRO ----------
// Funziona su qualunque "record" (riga di tabella o riquadro) che contenga un elemento
// marcato data-azioni: il menu elenca i pulsanti che ci sono dentro, quindi resta sempre
// allineato a quello che si vede sulla riga senza doverlo configurare pagina per pagina.

const _SELETTORE_RECORD = "tbody tr, .riquadro-designazione";
let _menuContestuale = null;

function _chiudiMenuContestuale() {
  if (_menuContestuale) {
    _menuContestuale.remove();
    _menuContestuale = null;
  }
  document.querySelectorAll(".record-attivo").forEach(el => el.classList.remove("record-attivo"));
}

// i pulsanti possono essere nascosti (colonna azioni): contano comunque come voci del menu;
// l'azione principale (quella del doppio clic) va sempre per prima
function _pulsantiAzioneRecord(record) {
  const pulsanti = [...record.querySelectorAll("[data-azioni] button")].filter(b => !b.disabled);
  return pulsanti.sort((a, b) => b.hasAttribute("data-azione-principale") - a.hasAttribute("data-azione-principale"));
}

function _etichettaPulsante(b) {
  return (b.title || b.textContent || "").trim();
}

function _tipoPulsante(b) {
  if (b.dataset.icona) return b.dataset.icona;
  const testo = _etichettaPulsante(b).toLowerCase();
  if (b.classList.contains("btn-rimuovi-x") || testo.startsWith("elimina") || testo.startsWith("rimuovi")) return "elimina";
  if (testo.startsWith("designa")) return "designa";
  if (testo.startsWith("modifica")) return "modifica";
  if (testo.startsWith("conferma")) return "conferma";
  return "";
}

function _apriMenuContestuale(record, x, y) {
  _chiudiMenuContestuale();
  const pulsanti = _pulsantiAzioneRecord(record);
  if (!pulsanti.length) return false;

  record.classList.add("record-attivo");
  const menu = document.createElement("div");
  menu.className = "menu-contestuale";
  menu.setAttribute("role", "menu");

  const normali = pulsanti.filter(b => _tipoPulsante(b) !== "elimina");
  const pericolosi = pulsanti.filter(b => _tipoPulsante(b) === "elimina");
  const creaVoce = (b) => {
    const tipo = _tipoPulsante(b);
    const voce = document.createElement("button");
    voce.type = "button";
    voce.className = "menu-contestuale-voce" + (tipo === "elimina" ? " pericolosa" : "");
    voce.setAttribute("role", "menuitem");
    voce.innerHTML = `${tipo ? iconaAzione(tipo, 15) : '<span class="menu-contestuale-spazio"></span>'}<span></span>`;
    voce.lastElementChild.textContent = _etichettaPulsante(b);
    voce.addEventListener("click", () => {
      _chiudiMenuContestuale();
      b.click();
    });
    return voce;
  };
  normali.forEach(b => menu.appendChild(creaVoce(b)));
  if (normali.length && pericolosi.length) {
    const sep = document.createElement("div");
    sep.className = "menu-contestuale-separatore";
    menu.appendChild(sep);
  }
  pericolosi.forEach(b => menu.appendChild(creaVoce(b)));

  document.body.appendChild(menu);
  const larghezza = menu.offsetWidth;
  const altezza = menu.offsetHeight;
  menu.style.left = `${Math.min(x, window.innerWidth - larghezza - 8)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - altezza - 8)}px`;
  _menuContestuale = menu;
  menu.querySelector("button").focus();
  return true;
}

document.addEventListener("contextmenu", (e) => {
  const record = e.target.closest(_SELETTORE_RECORD);
  if (!record || e.target.closest("input, textarea, select")) {
    _chiudiMenuContestuale();
    return;
  }
  if (_apriMenuContestuale(record, e.clientX, e.clientY)) e.preventDefault();
});

document.addEventListener("dblclick", (e) => {
  if (e.target.closest("button, a, input, select, textarea, label")) return;
  const record = e.target.closest(_SELETTORE_RECORD);
  if (!record) return;
  const principale = record.querySelector("[data-azioni] [data-azione-principale]");
  if (principale) {
    window.getSelection()?.removeAllRanges();
    principale.click();
  }
});

document.addEventListener("click", (e) => {
  if (_menuContestuale && !_menuContestuale.contains(e.target)) _chiudiMenuContestuale();
});
document.addEventListener("scroll", _chiudiMenuContestuale, true);
window.addEventListener("resize", _chiudiMenuContestuale);
document.addEventListener("keydown", (e) => {
  if (!_menuContestuale) return;
  const voci = [..._menuContestuale.querySelectorAll(".menu-contestuale-voce")];
  const i = voci.indexOf(document.activeElement);
  if (e.key === "Escape") { e.stopPropagation(); _chiudiMenuContestuale(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); voci[(i + 1) % voci.length].focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); voci[(i - 1 + voci.length) % voci.length].focus(); }
}, true);

// ---------- FINESTRA DI CONFERMA E NOTIFICHE ----------
// conferma() sostituisce il confirm() del browser: stessa semantica (true/false) ma come
// Promise, quindi si usa con await. avviso() mostra una notifica che sparisce da sola.

function conferma(messaggio, opzioni = {}) {
  const { titolo = "Sei sicuro?", testoConferma = "Conferma", pericolosa = true } = opzioni;
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "overlay show overlay-conferma";
    overlay.innerHTML = `
      <div class="modal modal-conferma" role="alertdialog" aria-modal="true">
        <div class="modal-conferma-icona ${pericolosa ? "pericolosa" : ""}">${iconaAzione(pericolosa ? "elimina" : "conferma", 22)}</div>
        <h2></h2>
        <p class="modal-conferma-testo"></p>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-scelta="no">Annulla</button>
          <button type="button" class="btn ${pericolosa ? "btn-danger" : "btn-primary"}" data-scelta="si"></button>
        </div>
      </div>`;
    overlay.querySelector("h2").textContent = titolo;
    overlay.querySelector(".modal-conferma-testo").textContent = messaggio;
    overlay.querySelector('[data-scelta="si"]').textContent = testoConferma;

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

function avviso(messaggio, tipo = "ok") {
  let contenitore = document.getElementById("contenitore-avvisi");
  if (!contenitore) {
    contenitore = document.createElement("div");
    contenitore.id = "contenitore-avvisi";
    contenitore.setAttribute("aria-live", "polite");
    document.body.appendChild(contenitore);
  }
  const el = document.createElement("div");
  el.className = `avviso avviso-${tipo}`;
  el.textContent = messaggio;
  el.addEventListener("click", () => el.remove());
  contenitore.appendChild(el);
  setTimeout(() => {
    el.classList.add("in-uscita");
    setTimeout(() => el.remove(), 250);
  }, tipo === "errore" ? 7000 : 4000 + Math.min(messaggio.length * 25, 4000));
}

// ---------- IL GABBIANO DEL SALVATAGGIO ----------
// A ogni salvataggio arriva un gabbiano in volo, annuisce con un "Ok!" e riparte, facendo il
// verso. Il verso è sintetizzato con Web Audio (nessun file da scaricare). Un clic sul
// gabbiano lo rende muto o gli ridà la voce; la scelta resta salvata nel browser.

let _contestoAudioGabbiano = null;

function _audioGabbiano() {
  const ContestoAudio = window.AudioContext || window.webkitAudioContext;
  if (!ContestoAudio) return null;
  if (!_contestoAudioGabbiano) _contestoAudioGabbiano = new ContestoAudio();
  if (_contestoAudioGabbiano.state === "suspended") _contestoAudioGabbiano.resume();
  return _contestoAudioGabbiano;
}

// i browser fanno partire l'audio solo dopo un'interazione dell'utente: il contesto audio
// viene preparato al primo clic sulla pagina, così è pronto quando arriva il salvataggio
document.addEventListener("pointerdown", _audioGabbiano, { once: true });

function _gabbianoMuto() {
  try { return localStorage.getItem("gabbianoMuto") === "1"; } catch { return false; }
}

// tre richiami "kiaa" discendenti: dente di sega filtrato con una glissata veloce verso
// l'alto e una lunga verso il basso, più un vibrato rapido che dà la voce rauca
function _versoGabbiano() {
  const ctx = _audioGabbiano();
  if (!ctx) return;
  const inizio = ctx.currentTime + 0.05;
  [[0, 1, 0.32], [0.36, 0.94, 0.3], [0.68, 0.88, 0.42]].forEach(([ritardo, tono, durata]) => {
    const t = inizio + ritardo;
    const voce = ctx.createOscillator();
    voce.type = "sawtooth";
    voce.frequency.setValueAtTime(1050 * tono, t);
    voce.frequency.exponentialRampToValueAtTime(1700 * tono, t + 0.06);
    voce.frequency.exponentialRampToValueAtTime(760 * tono, t + durata);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 36;
    const ampiezzaVibrato = ctx.createGain();
    ampiezzaVibrato.gain.value = 55;
    vibrato.connect(ampiezzaVibrato).connect(voce.frequency);

    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.Q.value = 5;
    filtro.frequency.setValueAtTime(1500 * tono, t);
    filtro.frequency.exponentialRampToValueAtTime(1000 * tono, t + durata);

    const volume = ctx.createGain();
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
    volume.gain.setValueAtTime(0.4, t + durata * 0.5);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + durata);

    voce.connect(filtro).connect(volume).connect(ctx.destination);
    voce.start(t);
    vibrato.start(t);
    voce.stop(t + durata + 0.05);
    vibrato.stop(t + durata + 0.05);
  });
}

const SVG_GABBIANO = `
  <svg viewBox="0 0 130 100" width="130" height="100" aria-hidden="true">
    <path class="gabbiano-coda" d="M36 60 L12 52 L16 66 Z" fill="#8f9aab"/>
    <g class="gabbiano-zampe" stroke="#e8892b" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M56 74 L53 90 L47 92 M53 90 L58 93"/>
      <path d="M68 74 L69 90 L63 92 M69 90 L74 92"/>
    </g>
    <ellipse cx="62" cy="60" rx="30" ry="17" fill="#ffffff" stroke="#d3d8e0" stroke-width="1.5"/>
    <g class="gabbiano-testa">
      <circle cx="88" cy="40" r="14" fill="#ffffff" stroke="#d3d8e0" stroke-width="1.5"/>
      <path d="M99 39 L118 43 L99 48 Z" fill="#f2b705"/>
      <circle cx="108" cy="45" r="1.8" fill="#d0392b"/>
      <circle cx="92" cy="36" r="2.4" fill="#1b2130"/>
    </g>
    <g class="gabbiano-ala">
      <path d="M58 52 Q40 18 14 24 Q30 38 34 46 Q46 56 62 62 Z" fill="#9aa5b4"/>
      <path d="M14 24 Q22 26 26 32 L20 30 Z" fill="#1b2130"/>
    </g>
  </svg>`;

function gabbianoOk() {
  const precedente = document.getElementById("gabbiano-ok");
  if (precedente) precedente.remove();
  if (!_gabbianoMuto()) _versoGabbiano();

  const gabbiano = document.createElement("button");
  gabbiano.type = "button";
  gabbiano.id = "gabbiano-ok";
  gabbiano.className = "gabbiano";
  gabbiano.title = _gabbianoMuto() ? "Clic per ridare la voce al gabbiano" : "Clic per silenziare il gabbiano";
  gabbiano.setAttribute("aria-label", "Salvato");
  gabbiano.innerHTML = `<span class="gabbiano-fumetto">Ok!</span>${SVG_GABBIANO}`;
  gabbiano.addEventListener("click", () => {
    const muto = !_gabbianoMuto();
    try { localStorage.setItem("gabbianoMuto", muto ? "1" : "0"); } catch {}
    avviso(muto ? "Gabbiano silenziato: farà ok senza verso." : "Il gabbiano ha di nuovo la voce.", "info");
    if (!muto) _versoGabbiano();
  });
  gabbiano.addEventListener("animationend", (e) => {
    if (e.target === gabbiano) gabbiano.remove();
  });
  // se la scheda non è in primo piano l'animazione può non finire mai: va via comunque
  setTimeout(() => gabbiano.remove(), 3500);
  document.body.appendChild(gabbiano);
}

// notifica di salvataggio riuscito + gabbiano
function salvato(messaggio) {
  avviso(messaggio);
  gabbianoOk();
}

// ---------- HELPER FETCH ----------

async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function apiSend(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: "DELETE" });
  return res.json();
}

// ---------- MODALI GENERICHE ----------

function openOverlay(id) {
  document.getElementById(id).classList.add("show");
}

function closeOverlay(id) {
  document.getElementById(id).classList.remove("show");
}

// ---------- CHIUSURA MODALI: X in alto a destra, clic fuori, tasto Esc ----------

function _abilitaChiusuraModale(overlay) {
  const modal = overlay.querySelector(".modal");
  if (!modal) return;
  if (!modal.querySelector(".modal-close")) {
    const bottone = document.createElement("button");
    bottone.type = "button";
    bottone.className = "modal-close";
    bottone.setAttribute("aria-label", "Chiudi");
    bottone.innerHTML = "&times;";
    bottone.addEventListener("click", () => closeOverlay(overlay.id));
    modal.prepend(bottone);
  }
  if (!overlay.dataset.chiusuraFuoriAbilitata) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay(overlay.id);
    });
    overlay.dataset.chiusuraFuoriAbilitata = "1";
  }
}

function abilitaChiusuraModali() {
  document.querySelectorAll(".overlay").forEach(_abilitaChiusuraModale);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".overlay.show:not(.overlay-conferma)").forEach(overlay => closeOverlay(overlay.id));
  }
});

abilitaChiusuraModali();

// ---------- MODALE IMPORT EXCEL (riutilizzabile in tutte le pagine) ----------
// config: { endpoint, params (oggetto query string), onDone (callback dopo import riuscito) }

function creaImportOverlay(overlayId, config) {
  const existing = document.getElementById(overlayId);
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = overlayId;
  overlay.innerHTML = `
    <div class="modal modal-large">
      <h2>Importa da Excel</h2>
      <p class="hint">Il file deve avere una riga di intestazione. Le colonne vengono riconosciute automaticamente dal nome (es. "Cognome", "Data", "Squadra Casa"...).</p>
      <div class="import-drop">
        <strong>Seleziona un file .xlsx</strong><br>
        <input type="file" id="${overlayId}-file" accept=".xlsx,.xls" style="margin-top:12px;">
      </div>
      <div class="import-mode">
        <label><input type="radio" name="${overlayId}-modalita" value="aggiungi" checked> Aggiungi ai dati esistenti</label>
        <label><input type="radio" name="${overlayId}-modalita" value="sostituisci"> Sostituisci tutti i dati</label>
      </div>
      <div id="${overlayId}-result"></div>
      <div id="${overlayId}-anteprima"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-close>Annulla</button>
        <button class="btn btn-secondary" id="${overlayId}-anteprima-btn">Vedi anteprima</button>
        <button class="btn btn-import" id="${overlayId}-submit" style="display:none;">Conferma import</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  _abilitaChiusuraModale(overlay);

  overlay.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeOverlay(overlayId));
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay(overlayId);
  });

  const fileInput = document.getElementById(`${overlayId}-file`);
  const resultDiv = document.getElementById(`${overlayId}-result`);
  const anteprimaDiv = document.getElementById(`${overlayId}-anteprima`);
  const anteprimaBtn = document.getElementById(`${overlayId}-anteprima-btn`);
  const submitBtn = document.getElementById(`${overlayId}-submit`);

  // se cambia il file o la modalità dopo aver visto un'anteprima, va rifatta: altrimenti
  // si rischia di confermare un import diverso da quello mostrato.
  const invalidaAnteprima = () => {
    submitBtn.style.display = "none";
    anteprimaDiv.innerHTML = "";
    resultDiv.innerHTML = "";
  };
  fileInput.addEventListener("change", invalidaAnteprima);
  overlay.querySelectorAll(`input[name="${overlayId}-modalita"]`).forEach(r => r.addEventListener("change", invalidaAnteprima));

  anteprimaBtn.addEventListener("click", async () => {
    if (!fileInput.files.length) {
      resultDiv.innerHTML = `<div class="import-result errore">Seleziona prima un file.</div>`;
      return;
    }
    const modalita = overlay.querySelector(`input[name="${overlayId}-modalita"]:checked`).value;
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    const params = new URLSearchParams({ modalita, ...(config.params || {}) });

    resultDiv.innerHTML = `<div class="import-result">Lettura del file in corso...</div>`;
    anteprimaDiv.innerHTML = "";
    submitBtn.style.display = "none";

    try {
      const res = await fetch(`${config.endpoint}/anteprima?${params.toString()}`, { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) {
        resultDiv.innerHTML = `<div class="import-result errore">${data.errore || "Errore durante la lettura del file."}</div>`;
        return;
      }

      resultDiv.innerHTML = (data.duplicate > 0
        ? `<div class="import-result errore">${data.totale} righe lette: ${data.nuove} nuove, ${data.duplicate} già presenti nel sistema (evidenziate sotto in rosso — verranno aggiornate con i nuovi dati se confermi).</div>`
        : `<div class="import-result ok">${data.totale} righe lette: tutte nuove, nessun duplicato trovato.</div>`)
        + (data.nota ? `<div class="import-result">${_esc(data.nota)}</div>` : "");

      const colonne = data.righe.length ? Object.keys(data.righe[0].dati) : [];
      anteprimaDiv.innerHTML = data.righe.length ? `
        <div class="table-scroll" style="max-height:320px; margin-top:10px;">
          <table>
            <thead><tr>${colonne.map(c => `<th>${c.replace(/_/g, " ")}</th>`).join("")}<th></th></tr></thead>
            <tbody>
              ${data.righe.map(r => `
                <tr${r.duplicato ? ' style="background:var(--rosso-tinta)"' : ""}>
                  ${colonne.map(c => `<td>${r.dati[c] ?? ""}</td>`).join("")}
                  <td>${r.duplicato ? '<span class="tag tag-rosso">Duplicato</span>' : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : "";

      submitBtn.style.display = "";
    } catch (err) {
      resultDiv.innerHTML = `<div class="import-result errore">Errore di connessione: ${err}</div>`;
    }
  });

  submitBtn.addEventListener("click", async () => {
    const modalita = overlay.querySelector(`input[name="${overlayId}-modalita"]:checked`).value;
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    const params = new URLSearchParams({ modalita, ...(config.params || {}) });

    resultDiv.innerHTML = `<div class="import-result">Importazione in corso...</div>`;
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${config.endpoint}?${params.toString()}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        resultDiv.innerHTML = (data.aggiornati > 0
          ? `<div class="import-result ok">Importate ${data.inseriti} righe nuove, aggiornate ${data.aggiornati} già esistenti.</div>`
          : `<div class="import-result ok">Importate ${data.inseriti} righe con successo.</div>`)
          + (data.nota ? `<div class="import-result ok">${_esc(data.nota)}</div>` : "");
        // gare la cui data/ora e' cambiata rispetto a prima (rinvio): l'arbitro gia' assegnato
        // resta quello, ma vale la pena ricontrollarne la disponibilita' sulla nuova data.
        if (data.rinviate && data.rinviate.length) {
          anteprimaDiv.innerHTML = `
            <div class="table-scroll" style="max-height:220px; margin-top:10px;">
              <table>
                <thead><tr><th>Campionato</th><th>N. Gara</th><th>Data/ora prima</th><th>Data/ora dopo</th></tr></thead>
                <tbody>
                  ${data.rinviate.map(g => `
                    <tr>
                      <td>${g.campionato}</td>
                      <td>${g.numero_gara}</td>
                      <td>${formattaData(g.data_prima)} ${g.ora_prima || ""}</td>
                      <td><span class="tag tag-arancione">${formattaData(g.data_dopo)} ${g.ora_dopo || ""}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            <p class="hint" style="margin-top:6px;">${data.rinviate.length} gare rinviate: l'arbitro già designato resta assegnato, ma ricontrolla la disponibilità sulla nuova data.</p>
          `;
          submitBtn.style.display = "none";
          if (config.onDone) config.onDone();
          return;
        }
        anteprimaDiv.innerHTML = "";
        submitBtn.style.display = "none";
        if (config.onDone) config.onDone();
        setTimeout(() => closeOverlay(overlayId), 900);
      } else {
        resultDiv.innerHTML = `<div class="import-result errore">${data.errore || "Errore durante l'import."}</div>`;
        submitBtn.disabled = false;
      }
    } catch (err) {
      resultDiv.innerHTML = `<div class="import-result errore">Errore di connessione: ${err}</div>`;
      submitBtn.disabled = false;
    }
  });
}

function apriImportModal(overlayId, config) {
  creaImportOverlay(overlayId, config);
  openOverlay(overlayId);
}

// Converte una data ISO (aaaa-mm-gg) nel formato visualizzato gg/mm/aaaa.
function formattaData(d) {
  if (!d) return "";
  const parti = d.split("-");
  if (parti.length === 3) return `${parti[2]}/${parti[1]}/${parti[0]}`;
  return d;
}

// ---------- FILTRI E ORDINAMENTO TABELLE (riutilizzabile in tutte le pagine) ----------

function _normalizzaTesto(v) {
  return String(v ?? "").toLowerCase();
}

// Confronta il valore grezzo di una cella col testo del filtro. Per le date in
// formato ISO (aaaa-mm-gg) accetta anche la ricerca nel formato visualizzato gg/mm/aaaa.
function _testoCorrisponde(valoreGrezzo, filtro) {
  if (!filtro) return true;
  const filtroNorm = _normalizzaTesto(filtro);
  const valoreNorm = _normalizzaTesto(valoreGrezzo);
  if (valoreNorm.includes(filtroNorm)) return true;
  const parti = valoreNorm.split("-");
  if (parti.length === 3) {
    const formattata = `${parti[2]}/${parti[1]}/${parti[0]}`;
    if (formattata.includes(filtroNorm)) return true;
  }
  return false;
}

// filtri: { campo: testoFiltro }, ordinamento: { campo, direzione: "asc"|"desc" }
// containerSelector (opzionale): se passato, mostra sopra la tabella un indicatore
// "filtro attivo" + il conteggio "N di M risultati" quando almeno un filtro è impostato.
function applicaFiltriOrdinamento(dati, filtri, ordinamento, containerSelector) {
  let risultato = dati.filter(riga =>
    Object.entries(filtri).every(([campo, valore]) => _testoCorrisponde(riga[campo], valore))
  );
  if (ordinamento && ordinamento.campo) {
    const { campo, direzione } = ordinamento;
    risultato = [...risultato].sort((a, b) => {
      const va = _normalizzaTesto(a[campo]);
      const vb = _normalizzaTesto(b[campo]);
      if (va < vb) return direzione === "asc" ? -1 : 1;
      if (va > vb) return direzione === "asc" ? 1 : -1;
      return 0;
    });
  }
  if (containerSelector) {
    _aggiornaStatoFiltri(containerSelector, filtri, risultato.length, dati.length);
  }
  return risultato;
}

// Piccola barra di stato sopra la tabella (creata al volo, una sola volta per tabella)
// con il badge "Filtro attivo" e il conteggio "N di M risultati".
const _elementiStatoFiltri = {};

function _aggiornaStatoFiltri(containerSelector, filtri, nFiltrati, nTotali) {
  let el = _elementiStatoFiltri[containerSelector];
  if (!el) {
    const thead = document.querySelector(containerSelector);
    const tabella = thead && thead.closest("table");
    if (!tabella) return;
    const ancora = tabella.closest(".table-scroll") || tabella;
    if (!ancora.parentElement) return;
    el = document.createElement("div");
    el.className = "filtri-stato";
    el.innerHTML = `<span class="filtri-stato-badge">Filtro attivo</span><span class="filtri-stato-conteggio"></span>`;
    ancora.parentElement.insertBefore(el, ancora);
    _elementiStatoFiltri[containerSelector] = el;
  }
  const attivo = Object.values(filtri).some(v => v);
  el.classList.toggle("attivo", attivo);
  el.querySelector(".filtri-stato-badge").style.display = attivo ? "" : "none";
  el.querySelector(".filtri-stato-conteggio").textContent = attivo ? `${nFiltrati} di ${nTotali} risultati` : "";
}

// Rende cliccabili gli header con classe "sortable" dentro il contenitore indicato.
// statoOrdinamento viene mutato in place; onChange viene richiamato ad ogni click.
function abilitaOrdinamento(containerSelector, statoOrdinamento, onChange) {
  document.querySelectorAll(`${containerSelector} th.sortable`).forEach(th => {
    th.addEventListener("click", () => {
      const campo = th.dataset.campo;
      if (statoOrdinamento.campo === campo) {
        statoOrdinamento.direzione = statoOrdinamento.direzione === "asc" ? "desc" : "asc";
      } else {
        statoOrdinamento.campo = campo;
        statoOrdinamento.direzione = "asc";
      }
      _aggiornaIndicatoriOrdinamento(containerSelector, statoOrdinamento);
      onChange();
    });
  });
}

function _aggiornaIndicatoriOrdinamento(containerSelector, statoOrdinamento) {
  document.querySelectorAll(`${containerSelector} th.sortable`).forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.campo === statoOrdinamento.campo) {
      th.classList.add(statoOrdinamento.direzione === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

// Collega gli input con classe "filtro-input" dentro il contenitore indicato.
// statoFiltri viene mutato in place; onChange viene richiamato ad ogni digitazione.
// I filtri impostati vengono salvati in sessionStorage (per tabella) e ripristinati
// automaticamente se si ricarica la pagina o si torna indietro, senza bisogno del DB:
// spariscono da soli quando si chiude la scheda/il browser.
function abilitaFiltri(containerSelector, statoFiltri, onChange) {
  const chiaveStorage = `filtriTabella_${containerSelector}`;
  const salvati = JSON.parse(sessionStorage.getItem(chiaveStorage) || "{}");
  Object.entries(salvati).forEach(([campo, valore]) => { statoFiltri[campo] = valore; });

  document.querySelectorAll(`${containerSelector} .filtro-input`).forEach(input => {
    if (statoFiltri[input.dataset.campo]) input.value = statoFiltri[input.dataset.campo];
    input.addEventListener("input", () => {
      statoFiltri[input.dataset.campo] = input.value;
      sessionStorage.setItem(chiaveStorage, JSON.stringify(statoFiltri));
      onChange();
    });
  });
}

// Svuota visivamente gli input filtro dentro il contenitore e resetta lo stato
// (incluso quanto salvato in sessionStorage).
function azzeraFiltri(containerSelector, statoFiltri, onChange) {
  document.querySelectorAll(`${containerSelector} .filtro-input`).forEach(input => {
    input.value = "";
  });
  Object.keys(statoFiltri).forEach(k => delete statoFiltri[k]);
  sessionStorage.removeItem(`filtriTabella_${containerSelector}`);
  onChange();
}

// ---------- INTESTAZIONE FISSA IN SCORRIMENTO ----------
// Rende sticky la riga (o le due righe: intestazione + filtri) di un thead,
// così restano visibili scorrendo la tabella verticalmente.

function rendiHeaderFisso(theadSelector) {
  const thead = document.querySelector(theadSelector);
  if (!thead) return;
  const righe = thead.querySelectorAll("tr");
  if (righe.length === 0) return;

  righe[0].querySelectorAll("th").forEach(th => {
    th.style.position = "sticky";
    th.style.top = "0px";
    th.style.zIndex = "3";
  });

  if (righe.length > 1) {
    const aggiornaOffset = () => {
      // usa il rettangolo reale (sottopixel incluso) invece di offsetHeight, che arrotonda
      // per difetto: uno scarto anche solo di qualche decimo di pixel basta a far intravedere
      // la riga dati sotto la riga filtri quando si scorre la tabella.
      const altezzaPrimaRiga = righe[0].getBoundingClientRect().height;
      righe[1].querySelectorAll("th").forEach(th => {
        th.style.position = "sticky";
        th.style.top = `${altezzaPrimaRiga}px`;
        th.style.zIndex = "3";
      });
    };
    aggiornaOffset();
    // la prima riga può cambiare altezza dopo l'inizializzazione (ridimensionamento
    // colonne, selettore colonne che nasconde/mostra intestazioni, resize finestra,
    // caricamento font): un ResizeObserver tiene l'offset della riga filtri sempre corretto
    // invece di calcolarlo una sola volta e lasciarlo eventualmente non aggiornato.
    if (window.ResizeObserver && !righe[0]._resizeObserverFisso) {
      const observer = new ResizeObserver(aggiornaOffset);
      observer.observe(righe[0]);
      righe[0]._resizeObserverFisso = observer;
    }
  }
}

// ---------- COLONNE CONFIGURABILI: larghezza, visibilità, colonne fisse ----------
// Ogni scelta (colonne nascoste, larghezze, colonne fisse a sinistra) è ricordata per
// tabella nel browser, così riaprendo la pagina la tabella si presenta come l'avevi lasciata.

function _leggiPreferenza(chiave, predefinito) {
  try {
    return JSON.parse(localStorage.getItem(chiave)) ?? predefinito;
  } catch {
    return predefinito;
  }
}

function _salvaPreferenza(chiave, valore) {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {}
}

// Maniglia trascinabile sul bordo destro di ogni intestazione della prima riga del thead.
// Può essere richiamata più volte sulla stessa tabella: le maniglie già presenti non si
// duplicano (la griglia Disponibilità ricostruisce il thead ad ogni ricerca).
function abilitaRidimensionamentoColonne(tableSelector, opzioni = {}) {
  const tabella = document.querySelector(tableSelector);
  if (!tabella) return;
  const primaRiga = tabella.querySelector("thead tr:first-child");
  if (!primaRiga) return;

  const persisti = opzioni.persisti !== false && !!tabella.id;
  const chiave = `larghezzeColonne_${tabella.id}`;
  const larghezze = persisti ? _leggiPreferenza(chiave, {}) : {};

  primaRiga.querySelectorAll("th").forEach((th, i) => {
    if (larghezze[i]) th.style.width = `${larghezze[i]}px`;
    if (th.querySelector(".col-resize-handle")) return;
    if (getComputedStyle(th).position === "static") th.style.position = "relative";

    const maniglia = document.createElement("span");
    maniglia.className = "col-resize-handle";
    maniglia.title = "Trascina per cambiare la larghezza";
    th.appendChild(maniglia);

    maniglia.addEventListener("click", (e) => e.stopPropagation());

    maniglia.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.pageX;
      const startWidth = th.offsetWidth;

      const onMouseMove = (e2) => {
        th.style.width = `${Math.max(50, startWidth + (e2.pageX - startX))}px`;
        _aggiornaColonneFisse(tabella);
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (persisti) {
          larghezze[i] = Math.round(th.getBoundingClientRect().width);
          _salvaPreferenza(chiave, larghezze);
        }
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });
}

// Colonne fisse: restano agganciate al bordo sinistro mentre il resto della tabella scorre
// in orizzontale. La posizione di ognuna dipende dalla larghezza reale delle fisse che la
// precedono, quindi va ricalcolata ogni volta che una larghezza cambia.
function _aggiornaColonneFisse(tabella) {
  if (!tabella || !tabella.id) return;
  let styleTag = document.getElementById(`stile-fisse-${tabella.id}`);
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = `stile-fisse-${tabella.id}`;
    document.head.appendChild(styleTag);
  }
  const fisse = tabella._colonneFisse;
  const ths = [...tabella.querySelectorAll("thead tr:first-child th")];
  const indici = fisse
    ? [...fisse].filter(i => ths[i] && getComputedStyle(ths[i]).display !== "none").sort((a, b) => a - b)
    : [];
  const id = tabella.id;
  let sinistra = 0;
  styleTag.textContent = indici.map((i, k) => {
    const n = i + 1;
    const ombra = k === indici.length - 1 ? " box-shadow: inset -1px 0 0 var(--bordo), 8px 0 8px -8px rgba(15,23,42,0.25);" : "";
    const regole = `
      #${id} tr > :nth-child(${n}) { position: sticky; left: ${sinistra}px; z-index: 2;${ombra} }
      #${id} tbody tr > td:nth-child(${n}) { background: inherit; }
      #${id} thead tr > th:nth-child(${n}) { z-index: 6 !important; background: var(--carta); }`;
    sinistra += ths[i].getBoundingClientRect().width;
    return regole;
  }).join("\n");
}

const ICONA_FISSA_COLONNA = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"></path><path d="M9 3h6"></path><path d="M10 3v7.5L6.5 14v3h11v-3L14 10.5V3"></path></svg>';

// Pulsante "Colonne" con un pannello per scegliere, colonna per colonna, se è visibile e se
// è fissa a sinistra; attiva anche il ridimensionamento. Le colonne senza testo
// nell'intestazione (es. quella delle azioni) non compaiono nell'elenco. Richiede che la
// tabella abbia un id. opzioni.persisti (default true) va disattivato per tabelle il cui
// thead cambia colonne ad ogni ricerca (es. la griglia Disponibilità, colonne = date scelte).
function abilitaSelettoreColonne(tableSelector, containerElemento, opzioni = {}) {
  const tabella = document.querySelector(tableSelector);
  if (!tabella || !tabella.id || !containerElemento) return;
  const primaRiga = tabella.querySelector("thead tr:first-child");
  if (!primaRiga) return;

  const tableId = tabella.id;
  const persisti = opzioni.persisti !== false;
  const chiaveNascoste = `colonneNascoste_${tableId}`;
  const chiaveFisse = `colonneFisse_${tableId}`;

  abilitaRidimensionamentoColonne(tableSelector, { persisti });

  const colonne = [...primaRiga.querySelectorAll("th")]
    .map((th, indice) => ({ indice, etichetta: th.textContent.trim() }))
    .filter(c => c.etichetta);
  if (colonne.length === 0) return;

  const nascoste = new Set(persisti ? _leggiPreferenza(chiaveNascoste, []) : []);
  const fisse = new Set(persisti ? _leggiPreferenza(chiaveFisse, []) : []);
  tabella._colonneFisse = fisse;

  function applica() {
    let styleTag = document.getElementById(`stile-colonne-${tableId}`);
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = `stile-colonne-${tableId}`;
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = [...nascoste]
      .map(i => `#${tableId} th:nth-child(${i + 1}), #${tableId} td:nth-child(${i + 1}) { display: none; }`)
      .join("\n");
    if (persisti) {
      _salvaPreferenza(chiaveNascoste, [...nascoste]);
      _salvaPreferenza(chiaveFisse, [...fisse]);
    }
    _aggiornaColonneFisse(tabella);
  }

  const esistente = document.getElementById(`selettore-colonne-${tableId}`);
  if (esistente) esistente.remove();

  const contenitore = document.createElement("div");
  contenitore.className = "selettore-colonne";
  contenitore.id = `selettore-colonne-${tableId}`;
  contenitore.innerHTML = `
    <button type="button" class="btn-testo btn-selettore-colonne">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="3" y="4" width="6" height="16" rx="1"></rect><rect x="14" y="4" width="7" height="16" rx="1"></rect></svg>
      Colonne
    </button>
    <div class="pannello-colonne">
      <div class="pannello-colonne-intestazione"><span>Colonna visibile</span><span>Fissa</span></div>
      ${colonne.map(c => `
        <div class="pannello-colonne-riga">
          <label><input type="checkbox" data-indice="${c.indice}" ${nascoste.has(c.indice) ? "" : "checked"}> ${_esc(c.etichetta)}</label>
          <button type="button" class="btn-fissa-colonna${fisse.has(c.indice) ? " attiva" : ""}" data-fissa="${c.indice}" aria-pressed="${fisse.has(c.indice)}" title="Fissa a sinistra: resta visibile mentre il resto scorre">${ICONA_FISSA_COLONNA}</button>
        </div>`).join("")}
      <p class="pannello-colonne-nota">Trascina il bordo destro di un'intestazione per cambiarne la larghezza. Tutto viene ricordato.</p>
      <div class="pannello-colonne-azioni">
        <button type="button" data-azione="tutte">Mostra tutte</button>
        <button type="button" data-azione="nessuna">Nascondi tutte</button>
        <button type="button" data-azione="sblocca">Nessuna fissa</button>
        <button type="button" data-azione="larghezze">Larghezze originali</button>
      </div>
    </div>
  `;
  containerElemento.appendChild(contenitore);

  const bottone = contenitore.querySelector(".btn-selettore-colonne");
  const pannello = contenitore.querySelector(".pannello-colonne");

  bottone.addEventListener("click", (e) => {
    e.stopPropagation();
    pannello.classList.toggle("show");
  });
  document.addEventListener("click", (e) => {
    if (!contenitore.contains(e.target)) pannello.classList.remove("show");
  });

  pannello.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const i = Number(cb.dataset.indice);
      if (cb.checked) nascoste.delete(i); else nascoste.add(i);
      applica();
    });
  });
  pannello.querySelectorAll("[data-fissa]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.fissa);
      if (fisse.has(i)) fisse.delete(i); else fisse.add(i);
      btn.classList.toggle("attiva", fisse.has(i));
      btn.setAttribute("aria-pressed", String(fisse.has(i)));
      applica();
    });
  });
  pannello.querySelector('[data-azione="tutte"]').addEventListener("click", () => {
    nascoste.clear();
    pannello.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = true);
    applica();
  });
  pannello.querySelector('[data-azione="nessuna"]').addEventListener("click", () => {
    colonne.forEach(c => nascoste.add(c.indice));
    pannello.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
    applica();
  });
  pannello.querySelector('[data-azione="sblocca"]').addEventListener("click", () => {
    fisse.clear();
    pannello.querySelectorAll("[data-fissa]").forEach(b => { b.classList.remove("attiva"); b.setAttribute("aria-pressed", "false"); });
    applica();
  });
  pannello.querySelector('[data-azione="larghezze"]').addEventListener("click", () => {
    primaRiga.querySelectorAll("th").forEach(th => { th.style.width = ""; });
    try { localStorage.removeItem(`larghezzeColonne_${tableId}`); } catch {}
    abilitaRidimensionamentoColonne(tableSelector, { persisti });
    applica();
  });

  // le larghezze reali cambiano con il contenuto, la finestra e il caricamento dei font:
  // le posizioni delle colonne fisse vanno ricalcolate di conseguenza
  if (window.ResizeObserver && !tabella._osservatoreFisse) {
    let inAttesa = false;
    tabella._osservatoreFisse = new ResizeObserver(() => {
      if (inAttesa) return;
      inAttesa = true;
      requestAnimationFrame(() => { inAttesa = false; _aggiornaColonneFisse(tabella); });
    });
    primaRiga.querySelectorAll("th").forEach(th => tabella._osservatoreFisse.observe(th));
  }

  applica();
}

function _esc(testo) {
  return String(testo ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
