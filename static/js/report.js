let _reportListaArbitri = [];

async function caricaListaArbitriReport() {
  _reportListaArbitri = await apiGet("/api/arbitri");
  renderListaArbitriReport();
}

function renderListaArbitriReport() {
  const filtro = (document.getElementById("filtro-report-arbitri").value || "").trim().toLowerCase();
  const tbody = document.getElementById("tabella-report-lista-arbitri");
  const arbitri = _reportListaArbitri.filter(a =>
    !filtro || a.cognome_nome.toLowerCase().includes(filtro) || (a.comune || "").toLowerCase().includes(filtro)
  );
  tbody.innerHTML = arbitri.length
    ? arbitri.map(a => `
        <tr>
          <td>${a.cognome_nome}</td>
          <td>${a.comune}</td>
          <td>${a.ruolo}</td>
          <td><button class="btn btn-primary" style="padding:6px 12px;font-size:12.5px" onclick="apriReportArbitro(${a.id})">Apri report</button></td>
        </tr>
      `).join("")
    : `<tr><td colspan="4" style="text-align:center;color:var(--testo-tenue)">Nessun arbitro trovato</td></tr>`;
}

document.getElementById("filtro-report-arbitri").addEventListener("input", renderListaArbitriReport);
caricaListaArbitriReport();

// Selettore stagione (in cima alla pagina, condiviso da tutte le schede): il valore della
// stagione corrente (dati_live) è sempre stringa vuota, cosi' _querySuffixStagione() lo
// tratta come "nessuna stagione storica" senza bisogno di un caso speciale nel frontend.
async function caricaSelettoreStagioneReport() {
  const stagioni = await apiGet("/api/stagioni");
  const select = document.getElementById("selettore-stagione-report");
  select.innerHTML = stagioni
    .map(s => `<option value="${s.dati_live ? "" : s.id}">${s.nome}${s.dati_live ? " (corrente)" : ""}</option>`)
    .join("");
  window._stagioneReportId = "";
}
caricaSelettoreStagioneReport();
