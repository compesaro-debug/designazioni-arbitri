let tabCorrente = "da_disputare";
let filtriPartite = {};
let ordinamentoPartite = { campo: null, direzione: "asc" };
let _codiciAliasSelezionato = null; // Set di codici campionato (normalizzati) del gruppo alias scelto, o null = nessun filtro

async function caricaFiltroAliasCampionati() {
  const campionati = await apiGet("/api/campionati");
  const select = document.getElementById("filtro-alias-campionato");
  select.innerHTML = `<option value="">Tutti</option>` +
    campionati.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
}

async function cambiaFiltroAliasCampionato() {
  const id = document.getElementById("filtro-alias-campionato").value;
  if (!id) {
    _codiciAliasSelezionato = null;
  } else {
    const dettaglio = await apiGet(`/api/campionati/${id}/dettaglio`);
    _codiciAliasSelezionato = new Set((dettaglio.codici || []).map(c => (c.codice || "").trim().toLowerCase()));
  }
  renderTabellaPartite();
}
caricaFiltroAliasCampionati();

// Tutti i campi della partita gestiti dal modulo (esclusi id e disputata, gestiti a parte).
const CAMPI_PARTITA = [
  "data", "ora", "campionato", "categoria", "girone", "numero_gara", "localita", "campo",
  "aff_a", "squadra_casa", "aff_b", "squadra_ospite", "risultato", "parziali", "numero_ufficiali",
  "arbitro", "residenza_arbitro", "assistente1", "residenza_assistente1",
  "osservatore_associato", "residenza_osservatore_associato", "segnapunti", "residenza_segnapunti",
  "assistente2", "residenza_assistente2", "osservatore", "residenza_osservatore",
];

function cambiaTab(tab) {
  tabCorrente = tab;
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  const isOmologazione = tab === "omologazione";
  document.getElementById("card-partite").style.display = isOmologazione ? "none" : "";
  document.getElementById("card-omologazione").style.display = isOmologazione ? "" : "none";
  document.getElementById("colonne-partite").style.display = isOmologazione ? "none" : "";
  document.getElementById("colonne-omologazione").style.display = isOmologazione ? "" : "none";
  document.getElementById("btn-azzera-filtri-partite").style.display = isOmologazione ? "none" : "";
  document.getElementById("btn-azzera-filtri-omologazione").style.display = isOmologazione ? "" : "none";
  document.getElementById("btn-importa-partite").style.display = isOmologazione ? "none" : "";
  document.getElementById("btn-importa-tutte-partite").style.display = isOmologazione ? "none" : "";
  document.getElementById("btn-nuova-partita").style.display = isOmologazione ? "none" : "";
  document.getElementById("btn-elimina-tutte-partite").style.display = isOmologazione ? "none" : "";
  document.getElementById("btn-elimina-tutte-partite").textContent =
    tab === "disputate" ? "Elimina tutte le disputate" : "Elimina tutte le da disputare";
  document.getElementById("hint-data-futura").style.display = (tab === "disputate" || isOmologazione) ? "" : "none";

  if (isOmologazione) {
    if (!window._omologazioneCaricata) {
      window._omologazioneCaricata = true;
      caricaOmologazione();
    }
    return;
  }

  aggiornaVisibilitaRisultato();
  aggiornaBottoneImport();
  caricaPartite();
}

function aggiornaVisibilitaRisultato() {
  document.getElementById("tabella-partite-el")
    .classList.toggle("mostra-risultato", tabCorrente === "disputate");
}

function aggiornaBottoneImport() {
  const btn = document.getElementById("btn-importa-partite");
  btn.onclick = () => {
    apriImportModal(`import-partite-${tabCorrente}`, {
      endpoint: "/api/partite/import",
      params: { tipo: tabCorrente },
      onDone: caricaPartite,
    });
  };
}

async function caricaPartite() {
  const disputataVal = tabCorrente === "disputate" ? "1" : "0";
  const partite = await apiGet(`/api/partite?disputata=${disputataVal}`);
  window._partiteCache = partite;
  renderTabellaPartite();
}

// Sulla scheda Disputate una gara senza risultato non è ancora stata giocata davvero (es.
// importata come designata prima della partita): il cartellino la distingue da una cella vuota.
function _cellaRisultato(risultato) {
  return risultato
    ? `<span class="tag tag-verde">${risultato}</span>`
    : `<span class="tag tag-giallo">Senza risultato</span>`;
}

function renderTabellaPartite() {
  let partite = applicaFiltriOrdinamento(window._partiteCache || [], filtriPartite, ordinamentoPartite, "#tabella-head-partite");
  if (_codiciAliasSelezionato) {
    partite = partite.filter(p => _codiciAliasSelezionato.has((p.campionato || "").trim().toLowerCase()));
  }
  const tbody = document.getElementById("tabella-partite");
  const vuoto = document.getElementById("stato-vuoto-partite");
  tbody.innerHTML = "";

  if (partite.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  partite.forEach(p => {
    const tr = document.createElement("tr");
    if (tabCorrente === "disputate" && dataNelFuturo(p.data)) tr.classList.add("riga-data-futura");
    tr.innerHTML = `
      <td>${formattaData(p.data)}</td>
      <td>${p.ora}</td>
      <td>${p.campionato}</td>
      <td>${tagFase(p.tipo_fase)}</td>
      <td>${p.categoria}</td>
      <td>${p.girone}</td>
      <td>${p.numero_gara}</td>
      <td>${p.localita}</td>
      <td>${p.campo}</td>
      <td>${p.aff_a}</td>
      <td>${p.squadra_casa}</td>
      <td>${p.aff_b}</td>
      <td>${p.squadra_ospite}</td>
      <td class="col-risultato">${tabCorrente === "disputate" ? _cellaRisultato(p.risultato) : p.risultato}</td>
      <td class="col-risultato">${p.parziali}</td>
      <td>${p.numero_ufficiali}</td>
      <td>${p.arbitro}</td>
      <td>${p.residenza_arbitro}</td>
      <td>${p.assistente1}</td>
      <td>${p.residenza_assistente1}</td>
      <td>${p.osservatore_associato}</td>
      <td>${p.residenza_osservatore_associato}</td>
      <td>${p.segnapunti}</td>
      <td>${p.residenza_segnapunti}</td>
      <td>${p.assistente2}</td>
      <td>${p.residenza_assistente2}</td>
      <td>${p.osservatore}</td>
      <td>${p.residenza_osservatore}</td>
      <td class="cella-azioni" data-azioni>
        ${btnAzione("modifica", `modificaPartita(${p.id})`, "Modifica")}
        ${btnAzione("cronologia", `apriCronologiaGara(${p.id})`, "Cronologia")}
        ${btnAzione("elimina", `eliminaPartita(${p.id})`, "Elimina")}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function apriModalePartita() {
  document.getElementById("titolo-modale-partita").textContent = "Nuova partita";
  document.getElementById("partita-id").value = "";
  CAMPI_PARTITA.forEach(c => {
    document.getElementById(`f-${c}`).value = "";
  });
  document.getElementById("f-disputata").value = tabCorrente === "disputate" ? "1" : "0";
  openOverlay("modale-partita");
}

function modificaPartita(id) {
  const p = window._partiteCache.find(x => x.id === id);
  if (!p) return;
  document.getElementById("titolo-modale-partita").textContent = "Modifica partita";
  document.getElementById("partita-id").value = p.id;
  CAMPI_PARTITA.forEach(c => {
    document.getElementById(`f-${c}`).value = p[c] || "";
  });
  document.getElementById("f-disputata").value = String(p.disputata);
  openOverlay("modale-partita");
}

async function salvaPartita() {
  const id = document.getElementById("partita-id").value;
  const payload = {};
  CAMPI_PARTITA.forEach(c => {
    payload[c] = document.getElementById(`f-${c}`).value;
  });
  payload.disputata = document.getElementById("f-disputata").value;

  if (id) {
    await apiSend(`/api/partite/${id}`, "PUT", payload);
  } else {
    await apiSend("/api/partite", "POST", payload);
  }
  closeOverlay("modale-partita");
  await caricaPartite();
  salvato(id ? "Modifiche salvate." : "Partita aggiunta.");
}

async function eliminaPartita(id) {
  const p = (window._partiteCache || []).find(x => x.id === id);
  const dettaglio = p ? `${p.campionato} n° ${p.numero_gara} — ${p.squadra_casa} vs ${p.squadra_ospite}` : "";
  if (!await conferma(dettaglio ? `Eliminare la gara ${dettaglio}?` : "Eliminare questa partita?", { titolo: "Elimina partita", testoConferma: "Elimina" })) return;
  await apiDelete(`/api/partite/${id}`);
  await caricaPartite();
  avviso("Partita eliminata.");
}

async function eliminaTutteLePartite() {
  const etichetta = tabCorrente === "disputate" ? "disputate" : "da disputare";
  const n = (window._partiteCache || []).length;
  if (!await conferma(`Stai per eliminare tutte le ${n} partite "${etichetta}". Le altre schede non vengono toccate e prima viene fatto un backup automatico del database.`, { titolo: `Eliminare tutte le ${etichetta}?`, testoConferma: "Continua" })) return;
  if (!await conferma(`Confermi la cancellazione in blocco di ${n} partite "${etichetta}"?`, { titolo: "Ultima conferma", testoConferma: `Elimina ${n} partite` })) return;
  const risultato = await apiDelete(`/api/partite/elimina-tutte?disputata=${tabCorrente === "disputate" ? "1" : "0"}`);
  await caricaPartite();
  avviso(`Eliminate ${risultato.eliminate} partite.`);
}

abilitaOrdinamento("#tabella-head-partite", ordinamentoPartite, renderTabellaPartite);
abilitaFiltri("#tabella-head-partite", filtriPartite, renderTabellaPartite);
abilitaRidimensionamentoColonne("#tabella-partite-el");
rendiHeaderFisso("#tabella-head-partite");
abilitaSelettoreColonne("#tabella-partite-el", document.getElementById("colonne-partite"));

const tabIniziale = new URLSearchParams(location.search).get("tab");
if (tabIniziale === "omologazione" || tabIniziale === "disputate") {
  cambiaTab(tabIniziale);
} else {
  aggiornaVisibilitaRisultato();
  aggiornaBottoneImport();
  caricaPartite();
}

// ---------- IMPORT AUTOMATICI (script esterno che scarica l'Excel e lo manda al sito) ----------

async function apriImportAutomatici() {
  const corpo = document.getElementById("corpo-import-automatici");
  corpo.innerHTML = `<p class="hint">Caricamento...</p>`;
  openOverlay("modale-import-automatici");
  const elenco = await apiGet("/api/import-automatici");
  if (!elenco.length) {
    corpo.innerHTML = `<div class="empty-state"><strong>Nessun import automatico ancora</strong>Compariranno qui quando lo script manderà il primo file.</div>`;
    return;
  }
  corpo.innerHTML = `
    <div class="table-scroll" style="max-height:420px;">
      <table>
        <thead><tr><th>Quando</th><th>Esito</th><th>Righe</th><th>Nuove</th><th>Aggiornate</th><th>Rinviate</th><th>Arbitri cambiati</th><th>Assenti dal file</th><th></th></tr></thead>
        <tbody>
          ${elenco.map(r => r.esito === "ok" ? `
            <tr>
              <td>${_esc(_quandoLeggibile(r.quando))}</td>
              <td><span class="tag tag-verde">Ok</span></td>
              <td>${r.riepilogo.righe}</td><td>${r.riepilogo.nuove}</td><td>${r.riepilogo.aggiornate}</td>
              <td>${r.riepilogo.rinviate}</td><td>${r.riepilogo.arbitri_cambiati}</td><td>${r.riepilogo.assenti}</td>
              <td><button type="button" class="btn-testo" onclick="apriReportImportAutomatico(${r.id})">Apri report</button></td>
            </tr>` : `
            <tr style="background:var(--rosso-tinta)">
              <td>${_esc(_quandoLeggibile(r.quando))}</td>
              <td><span class="tag tag-rosso">Errore</span></td>
              <td colspan="7">${_esc(r.messaggio)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function _quandoLeggibile(quando) {
  const [data, ora] = (quando || "").split(" ");
  return `${formattaData(data)} ${(ora || "").slice(0, 5)}`;
}

async function apriReportImportAutomatico(id) {
  const esito = await apiGet(`/api/import-automatici/${id}`);
  if (!esito.ok) { avviso(esito.errore || "Report non trovato.", "errore"); return; }
  mostraReportImport(esito.dati, { onDone: caricaPartite });
}
