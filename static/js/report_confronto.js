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
      ${s.stagione_nome}${s.dati_live && !/corrente/i.test(s.stagione_nome) ? " (corrente)" : ""}
    </label>
  `).join("");
}

function toggleStagioneConfronto(id, checked) {
  if (checked) _confrontoStagioniVisibili.add(id);
  else _confrontoStagioniVisibili.delete(id);
  renderTabellaConfronto();
}

function _renderGraficiConfronto(stagioni) {
  // ordine cronologico: stagioni passate dalla più vecchia, poi la corrente (evidenziata)
  const cronologiche = [...stagioni].sort((a, b) => (a.dati_live - b.dati_live) || (a.stagione_id - b.stagione_id));
  const serie = [{ nome: "Stagione", colore: "var(--serie-1)", coloreTenue: "var(--serie-1-tenue)" }];
  const disegna = (id, campo, unita = "") => {
    // la corrente si evidenzia solo se ha già dati: altrimenti tutte le colonne restano piene
    const correnteConDati = cronologiche.some(s => s.dati_live && s[campo] > 0);
    graficoColonne(document.getElementById(id), cronologiche.map(s => ({
      etichetta: s.stagione_nome,
      sottoetichetta: s.dati_live && !/corrente/i.test(s.stagione_nome) ? "corrente" : "",
      valori: [s[campo]],
      evidenzia: correnteConDati ? s.dati_live : true,
    })), serie, { unita, altezza: 160, vuoto: "Nessuna stagione selezionata" });
  };

  disegna("grafico-confronto-gare", "n_gare_sezione");
  disegna("grafico-confronto-arbitri", "n_arbitri");
  disegna("grafico-confronto-media", "media_gare");
  disegna("grafico-confronto-km", "km_totali_sezione", " km");
}

function renderTabellaConfronto() {
  const tbody = document.getElementById("tabella-confronto-stagioni");
  const stagioni = _confrontoStagioniCache.filter(s => _confrontoStagioniVisibili.has(s.stagione_id));
  _renderGraficiConfronto(stagioni);
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
