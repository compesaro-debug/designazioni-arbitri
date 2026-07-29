let _reportCoperturaCache = [];

async function caricaReportCopertura() {
  const dati = await apiGet(`/api/report/copertura${_querySuffixStagione()}`);
  document.getElementById("copertura-soglia-km").textContent = dati.soglia_km;
  _reportCoperturaCache = dati.comuni;
  renderTabellaReportCopertura();
}

function renderTabellaReportCopertura() {
  const filtro = (document.getElementById("filtro-report-copertura").value || "").trim().toLowerCase();
  const righe = _reportCoperturaCache.filter(c => !filtro || c.comune.toLowerCase().includes(filtro));
  const tbody = document.getElementById("tabella-report-copertura");

  tbody.innerHTML = righe.length
    ? righe.map(c => `
        <tr${c.n_arbitri_vicini === 0 ? ' style="background:var(--rosso-tinta)"' : ""} title="${c.arbitri_vicini.join(", ") || "Nessun arbitro in zona"}">
          <td>${c.comune}</td>
          <td>${c.n_gare}</td>
          <td>${c.n_arbitri_locali}</td>
          <td>${c.n_arbitri_vicini}${c.n_arbitri_vicini === 0 ? ' <span class="tag tag-rosso">Zona scoperta</span>' : ""}</td>
          <td>${c.rapporto != null ? c.rapporto : "-"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--testo-tenue)">Nessun comune trovato</td></tr>`;
}

document.getElementById("filtro-report-copertura").addEventListener("input", renderTabellaReportCopertura);
