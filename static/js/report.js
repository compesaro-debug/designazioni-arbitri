let _reportListaArbitri = [];
let filtriReportArbitri = {};
let ordinamentoReportArbitri = { campo: null, direzione: "asc" };

async function caricaListaArbitriReport() {
  _reportListaArbitri = await apiGet("/api/arbitri");
  renderListaArbitriReport();
}

function renderListaArbitriReport() {
  const filtroRapido = (document.getElementById("filtro-report-arbitri").value || "").trim().toLowerCase();
  let arbitri = _reportListaArbitri.filter(a =>
    !filtroRapido || a.cognome_nome.toLowerCase().includes(filtroRapido) || (a.comune || "").toLowerCase().includes(filtroRapido)
  );
  arbitri = applicaFiltriOrdinamento(arbitri, filtriReportArbitri, ordinamentoReportArbitri, "#tabella-head-report-arbitri");

  const tbody = document.getElementById("tabella-report-lista-arbitri");
  tbody.innerHTML = arbitri.length
    ? arbitri.map(a => `
        <tr>
          <td>${a.cognome_nome}</td>
          <td>${a.comune}</td>
          <td>${a.ruolo}</td>
          <td>${Number(a.attivo) ? '<span class="tag tag-verde">In attività</span>' : '<span class="tag tag-rosso">Non in attività</span>'}</td>
          <td class="cella-azioni" data-azioni>${btnAzione("report", `apriReportArbitro(${a.id})`, "Apri report", true)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--testo-tenue)">Nessun arbitro trovato</td></tr>`;
}

document.getElementById("filtro-report-arbitri").addEventListener("input", renderListaArbitriReport);
abilitaOrdinamento("#tabella-head-report-arbitri", ordinamentoReportArbitri, renderListaArbitriReport);
abilitaFiltri("#tabella-head-report-arbitri", filtriReportArbitri, renderListaArbitriReport);
abilitaRidimensionamentoColonne("#tabella-report-arbitri-el");
rendiHeaderFisso("#tabella-head-report-arbitri");
caricaListaArbitriReport();

// Selettore stagione (in cima alla pagina, condiviso da tutte le schede): il valore della
// stagione corrente (dati_live) è sempre stringa vuota, cosi' _querySuffixStagione() lo
// tratta come "nessuna stagione storica" senza bisogno di un caso speciale nel frontend.
async function caricaSelettoreStagioneReport() {
  const stagioni = await apiGet("/api/stagioni");
  const select = document.getElementById("selettore-stagione-report");
  select.innerHTML = stagioni
    .map(s => `<option value="${s.dati_live ? "" : s.id}">${s.nome}${s.dati_live && !/corrente/i.test(s.nome) ? " (corrente)" : ""}</option>`)
    .join("");
  window._stagioneReportId = "";
}
caricaSelettoreStagioneReport();
