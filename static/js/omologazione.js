let filtriOmologazione = {};
let ordinamentoOmologazione = { campo: null, direzione: "asc" };

async function caricaOmologazione() {
  const partite = await apiGet("/api/partite?disputata=1");
  window._omologazioneCache = partite;
  renderTabellaOmologazione();
}

function cellaOmologazione(p) {
  const omologata = p.numero_ufficiali === "1";
  return omologata
    ? `<span class="tag tag-verde">Omologata</span>`
    : `<span class="tag tag-rosso">Non omologata</span>`;
}

function renderTabellaOmologazione() {
  const partite = applicaFiltriOrdinamento(window._omologazioneCache || [], filtriOmologazione, ordinamentoOmologazione, "#tabella-head-omologazione");
  const tbody = document.getElementById("tabella-omologazione");
  const vuoto = document.getElementById("stato-vuoto-omologazione");
  tbody.innerHTML = "";

  if (partite.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  partite.forEach(p => {
    const tr = document.createElement("tr");
    if (dataNelFuturo(p.data)) tr.classList.add("riga-data-futura");
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
      <td>${p.risultato}</td>
      <td>${p.parziali}</td>
      <td>${p.numero_ufficiali}</td>
      <td>${cellaOmologazione(p)}</td>
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
    `;
    tbody.appendChild(tr);
  });
}

abilitaOrdinamento("#tabella-head-omologazione", ordinamentoOmologazione, renderTabellaOmologazione);
abilitaFiltri("#tabella-head-omologazione", filtriOmologazione, renderTabellaOmologazione);
abilitaRidimensionamentoColonne("#tabella-omologazione-el");
rendiHeaderFisso("#tabella-head-omologazione");
abilitaSelettoreColonne("#tabella-omologazione-el", document.getElementById("colonne-omologazione"));
