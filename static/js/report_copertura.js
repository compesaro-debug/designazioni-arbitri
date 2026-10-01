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
  _renderKpiEGraficiCopertura(righe);
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

function _renderKpiEGraficiCopertura(righe) {
  const scoperte = righe.filter(c => c.n_arbitri_vicini === 0);
  const coperte = righe.filter(c => c.rapporto != null);
  const gareScoperte = scoperte.reduce((s, c) => s + c.n_gare, 0);
  const mediaRapporto = coperte.length ? coperte.reduce((s, c) => s + c.rapporto, 0) / coperte.length : null;

  document.getElementById("copertura-kpi-comuni").textContent = formattaNumero(righe.length);
  document.getElementById("copertura-kpi-scoperte").textContent = formattaNumero(scoperte.length);
  document.getElementById("copertura-kpi-scoperte-gare").textContent = scoperte.length
    ? `${formattaNumero(gareScoperte)} gare senza arbitri vicini`
    : "tutti i comuni hanno arbitri in zona";
  document.getElementById("copertura-kpi-rapporto").textContent = mediaRapporto != null ? formattaNumero(Math.round(mediaRapporto * 10) / 10) : "-";

  const dettaglioArbitri = (c) => c.arbitri_vicini.length
    ? `In zona: ${c.arbitri_vicini.slice(0, 6).join(", ")}${c.arbitri_vicini.length > 6 ? ` e altri ${c.arbitri_vicini.length - 6}` : ""}`
    : "";

  graficoBarre(document.getElementById("grafico-copertura-pressione"),
    [...coperte].sort((a, b) => b.rapporto - a.rapporto).map(c => ({
      etichetta: c.comune,
      valore: c.rapporto,
      dettaglio: `${c.n_gare} gare · ${c.n_arbitri_vicini} arbitri in zona (${c.n_arbitri_locali} residenti)\n${dettaglioArbitri(c)}`,
    })),
    { massimoRighe: 12, riferimento: mediaRapporto != null ? { valore: Math.round(mediaRapporto * 10) / 10, etichetta: "Media dei comuni" } : null, vuoto: "Nessun comune con arbitri in zona" });

  graficoBarre(document.getElementById("grafico-copertura-scoperte"),
    [...scoperte].sort((a, b) => b.n_gare - a.n_gare).map(c => ({
      etichetta: c.comune,
      valore: c.n_gare,
      testo: `${c.n_gare} gare`,
      colore: "var(--stato-ko)",
      dettaglio: "Nessun arbitro residente entro la soglia km",
    })),
    { massimoRighe: 12, spazioValore: 72, vuoto: "Nessuna zona scoperta: ogni comune ha almeno un arbitro vicino" });
}

document.getElementById("filtro-report-copertura").addEventListener("input", renderTabellaReportCopertura);
