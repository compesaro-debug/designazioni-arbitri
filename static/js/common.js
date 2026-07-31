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
// Ogni gruppo ricorda se era aperto o chiuso in localStorage; il gruppo che contiene
// la pagina attualmente attiva viene sempre aperto, indipendentemente da cosa era salvato.

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
  gruppo.classList.toggle("espanso", contieneAttiva || salvato === "1");
});

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
    document.querySelectorAll(".overlay.show").forEach(overlay => closeOverlay(overlay.id));
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

      resultDiv.innerHTML = data.duplicate > 0
        ? `<div class="import-result errore">${data.totale} righe lette: ${data.nuove} nuove, ${data.duplicate} già presenti nel sistema (evidenziate sotto in rosso — verranno aggiornate con i nuovi dati se confermi).</div>`
        : `<div class="import-result ok">${data.totale} righe lette: tutte nuove, nessun duplicato trovato.</div>`;

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
        resultDiv.innerHTML = data.aggiornati > 0
          ? `<div class="import-result ok">Importate ${data.inseriti} righe nuove, aggiornate ${data.aggiornati} già esistenti.</div>`
          : `<div class="import-result ok">Importate ${data.inseriti} righe con successo.</div>`;
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

// ---------- RIDIMENSIONAMENTO COLONNE (tabelle molto larghe, es. Partite) ----------
// Aggiunge una maniglia trascinabile sul bordo destro di ogni intestazione di colonna
// della prima riga del thead. Richiede che la tabella abbia table-layout: fixed.

function abilitaRidimensionamentoColonne(tableSelector) {
  const tabella = document.querySelector(tableSelector);
  if (!tabella) return;
  const primaRiga = tabella.querySelector("thead tr:first-child");
  if (!primaRiga) return;

  primaRiga.querySelectorAll("th").forEach(th => {
    const maniglia = document.createElement("span");
    maniglia.className = "col-resize-handle";
    th.appendChild(maniglia);

    maniglia.addEventListener("click", (e) => e.stopPropagation());

    maniglia.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.pageX;
      const startWidth = th.offsetWidth;

      const onMouseMove = (e2) => {
        th.style.width = `${Math.max(50, startWidth + (e2.pageX - startX))}px`;
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  });
}

// ---------- SELETTORE COLONNE VISIBILI (riutilizzabile in tutte le tabelle) ----------
// Legge le intestazioni della prima riga del thead della tabella indicata e crea un
// pulsante "Colonne" con un pannello a checkbox per nascondere/mostrare ogni colonna.
// Le colonne senza testo nell'intestazione (es. quella con i pulsanti azione) restano
// sempre visibili e non compaiono nell'elenco. Richiede che la tabella abbia un id.
// opzioni.persisti (default true) ricorda la scelta in localStorage; va disattivato
// per tabelle il cui thead viene ricostruito da zero con colonne diverse ad ogni ricerca
// (es. la griglia Disponibilità, dove le colonne sono le date scelte di volta in volta).

function abilitaSelettoreColonne(tableSelector, containerElemento, opzioni = {}) {
  const tabella = document.querySelector(tableSelector);
  if (!tabella || !tabella.id || !containerElemento) return;
  const primaRiga = tabella.querySelector("thead tr:first-child");
  if (!primaRiga) return;

  const tableId = tabella.id;
  const persisti = opzioni.persisti !== false;
  const chiaveStorage = `colonneNascoste_${tableId}`;

  const colonne = [...primaRiga.querySelectorAll("th")]
    .map((th, indice) => ({ indice, etichetta: th.textContent.trim() }))
    .filter(c => c.etichetta);
  if (colonne.length === 0) return;

  const nascoste = new Set(persisti ? JSON.parse(localStorage.getItem(chiaveStorage) || "[]") : []);

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
    if (persisti) localStorage.setItem(chiaveStorage, JSON.stringify([...nascoste]));
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
      ${colonne.map(c => `<label><input type="checkbox" data-indice="${c.indice}" ${nascoste.has(c.indice) ? "" : "checked"}> ${c.etichetta}</label>`).join("")}
      <div class="pannello-colonne-azioni">
        <button type="button" data-azione="tutte">Mostra tutte</button>
        <button type="button" data-azione="nessuna">Nascondi tutte</button>
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

  applica();
}
