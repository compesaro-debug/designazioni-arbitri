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
  document.getElementById("btn-nuova-partita").style.display = isOmologazione ? "none" : "";

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
    tr.innerHTML = `
      <td>${formattaData(p.data)}</td>
      <td>${p.ora}</td>
      <td>${p.campionato}</td>
      <td>${p.categoria}</td>
      <td>${p.girone}</td>
      <td>${p.numero_gara}</td>
      <td>${p.localita}</td>
      <td>${p.campo}</td>
      <td>${p.aff_a}</td>
      <td>${p.squadra_casa}</td>
      <td>${p.aff_b}</td>
      <td>${p.squadra_ospite}</td>
      <td class="col-risultato">${p.risultato}</td>
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
      <td style="white-space:nowrap">
        <button class="btn-danger-text" style="color:var(--primario)" onclick="modificaPartita(${p.id})">Modifica</button>
        <button class="btn-danger-text" onclick="eliminaPartita(${p.id})">Elimina</button>
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
  caricaPartite();
}

async function eliminaPartita(id) {
  if (!confirm("Eliminare questa partita?")) return;
  await apiDelete(`/api/partite/${id}`);
  caricaPartite();
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
