let _confrontoStagioniCache = [];
let _confrontoStagioniVisibili = new Set();

async function caricaReportConfronto() {
  const dati = await apiGet("/api/report/confronto-stagioni");
  _confrontoStagioniCache = dati;
  _confrontoStagioniVisibili = new Set(dati.map(s => s.stagione_id));
  renderCheckboxConfronto();
  renderTabellaConfronto();
}

function renderCheckboxConfronto() {
  const cont = document.getElementById("confronto-stagioni-checkbox");
  cont.innerHTML = _confrontoStagioniCache.map(s => `
    <label style="display:flex; align-items:center; gap:6px; font-size:13.5px; cursor:pointer;">
      <input type="checkbox" ${_confrontoStagioniVisibili.has(s.stagione_id) ? "checked" : ""} onchange="toggleStagioneConfronto(${s.stagione_id}, this.checked)">
      ${s.stagione_nome}${s.dati_live ? " (corrente)" : ""}
    </label>
  `).join("");
}

function toggleStagioneConfronto(id, checked) {
  if (checked) _confrontoStagioniVisibili.add(id);
  else _confrontoStagioniVisibili.delete(id);
  renderTabellaConfronto();
}

function renderTabellaConfronto() {
  const tbody = document.getElementById("tabella-confronto-stagioni");
  const stagioni = _confrontoStagioniCache.filter(s => _confrontoStagioniVisibili.has(s.stagione_id));
  if (!stagioni.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--testo-tenue)">Nessuna stagione selezionata</td></tr>`;
    return;
  }
  tbody.innerHTML = stagioni.map(s => {
    const etichettaStagione = `${s.stagione_nome}${s.dati_live ? ' <span class="tag tag-verde">corrente</span>' : ""}`;
    const rigaTotale = `
      <tr style="font-weight:600; border-top:2px solid var(--bordo)">
        <td rowspan="${s.distribuzione_ruolo.length + 1}" style="vertical-align:top">${etichettaStagione}</td>
        <td>Totale</td>
        <td>${s.n_arbitri}</td>
        <td>${s.n_gare_sezione}</td>
        <td>${s.media_gare}</td>
        <td>${s.km_totali_sezione} km</td>
        <td>-</td>
      </tr>
    `;
    const righeRuolo = s.distribuzione_ruolo.map(d => `
      <tr>
        <td>${d.ruolo}</td>
        <td>${d.arbitri != null ? d.arbitri : "-"}</td>
        <td>${d.gare}</td>
        <td>${d.media_gare != null ? d.media_gare : "-"}</td>
        <td>${d.km_totali != null ? d.km_totali + " km" : "-"}</td>
        <td>${d.percentuale}%</td>
      </tr>
    `).join("");
    return rigaTotale + righeRuolo;
  }).join("");
}
