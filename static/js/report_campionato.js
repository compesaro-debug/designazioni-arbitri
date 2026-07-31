let _reportCampionatiCache = [];

async function caricaReportCampionati() {
  _reportCampionatiCache = await apiGet(`/api/report/campionati${_querySuffixStagione()}`);
  renderTabellaReportCampionati();
}

function _cellaScostamentoSoglia(c, fase) {
  if (c.soglia_km == null) return "-";
  if (c.scostamento_soglia == null) return `<span class="hint">${c.soglia_km} km — nessuna gara federale</span>`;
  const testo = c.scostamento_soglia > 0 ? `+${c.scostamento_soglia} km` : `${c.scostamento_soglia} km`;
  const classe = c.scostamento_soglia > 0 ? "tag-rosso" : (c.scostamento_soglia < 0 ? "tag-verde" : "tag-arancione");
  const arg = fase ? `'${c.chiave}', '${fase}'` : `'${c.chiave}'`;
  return `<span class="tag ${classe} riga-cliccabile" onclick="event.stopPropagation(); apriGareSopraMedia(${arg})" title="Clic per l'elenco delle gare sopra la media">${testo}</span>`;
}

function _righeDettaglioFasi(c) {
  if (!c.dettaglio_fasi || !c.dettaglio_fasi.length) return "";
  return c.dettaglio_fasi.map(f => `
    <tr style="color:var(--testo-tenue); font-size:12.5px;">
      <td style="padding-left:24px">↳ ${f.etichetta}</td>
      <td>${f.n_gare}</td>
      <td>${f.n_federali} (${f.pct_federali}%)</td>
      <td>${f.n_associato} (${f.pct_associato}%)</td>
      <td>${f.km_totali} km</td>
      <td>${f.media_km_gara} km</td>
      <td>${f.media_km_solo_federali} km</td>
      <td>${f.soglia_km != null ? f.soglia_km + " km" : "-"}</td>
      <td>${_cellaScostamentoSoglia(f, f.fase)}</td>
    </tr>
  `).join("");
}

function renderTabellaReportCampionati() {
  const filtro = (document.getElementById("filtro-report-campionati").value || "").trim().toLowerCase();
  const righe = _reportCampionatiCache.filter(c => !filtro || c.nome.toLowerCase().includes(filtro));
  const tbody = document.getElementById("tabella-report-campionati-lista");
  tbody.innerHTML = righe.length
    ? righe.map(c => `
        <tr class="riga-cliccabile" data-chiave="${c.chiave}" style="cursor:pointer">
          <td>${c.nome}</td>
          <td>${c.n_gare}</td>
          <td>${c.n_federali} <span style="color:var(--testo-tenue)">(${c.pct_federali}%)</span></td>
          <td>${c.n_associato} <span style="color:var(--testo-tenue)">(${c.pct_associato}%)</span></td>
          <td>${c.km_totali} km</td>
          <td>${c.media_km_gara} km</td>
          <td>${c.media_km_solo_federali} km</td>
          <td>${c.soglia_km != null ? c.soglia_km + " km" : "-"}</td>
          <td>${_cellaScostamentoSoglia(c)}</td>
        </tr>
      ` + _righeDettaglioFasi(c)).join("") + _rigaTotaleReportCampionati(righe)
    : `<tr><td colspan="9" style="text-align:center;color:var(--testo-tenue)">Nessun campionato trovato</td></tr>`;

  tbody.querySelectorAll("tr[data-chiave]").forEach(tr => {
    tr.addEventListener("click", () => apriDettaglioCampionato(tr.dataset.chiave));
  });
}

// Elenco delle designazioni di arbitri federali con km sopra la media del campionato
// (media_km_solo_federali): utile per capire quali gare pesano di più sullo scostamento
// dalla soglia impostata in Alias campionati.
function apriGareSopraMedia(chiave, fase) {
  const campionato = _reportCampionatiCache.find(c => c.chiave === chiave);
  if (!campionato) return;
  const contesto = fase ? (campionato.dettaglio_fasi || []).find(f => f.fase === fase) : campionato;
  if (!contesto || contesto.media_km_solo_federali == null) return;
  const media = contesto.media_km_solo_federali;
  const gareContesto = fase ? campionato.gare.filter(g => g.tipo_fase === fase) : campionato.gare;

  const righe = [];
  gareContesto.forEach(g => {
    [["arbitro", "1° Arbitro", g.km_arbitro], ["assistente1", "2° Arbitro", g.km_assistente1]].forEach(([campo, etichetta, km]) => {
      const nome = g[campo];
      if (!nome || nome === "Arbitro Associato" || km == null) return;
      if (km > media) {
        righe.push({ data: g.data, numero_gara: g.numero_gara, tipo_fase: g.tipo_fase, squadre: `${g.squadra_casa} vs ${g.squadra_ospite}`, arbitro: nome, ruolo: etichetta, km });
      }
    });
  });
  righe.sort((a, b) => b.km - a.km);

  document.getElementById("titolo-gare-sopra-media").textContent = `Gare sopra la media — ${campionato.nome}${fase ? " · " + contesto.etichetta : ""}`;
  document.getElementById("info-gare-sopra-media").textContent = `Media (solo federali): ${media} km — ${righe.length} designazioni sopra media su ${contesto.n_federali} federali`;
  document.getElementById("tabella-gare-sopra-media").innerHTML = righe.length
    ? righe.map(r => `
      <tr>
        <td>${formattaData(r.data)}</td>
        <td>${r.numero_gara}</td>
        <td>${tagFase(r.tipo_fase)}</td>
        <td>${r.squadre}</td>
        <td>${r.arbitro}</td>
        <td>${r.ruolo}</td>
        <td><span class="tag tag-rosso">${r.km} km</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" style="text-align:center;color:var(--testo-tenue)">Nessuna gara sopra la media</td></tr>`;

  openOverlay("modale-gare-sopra-media");
}

function _rigaTotaleReportCampionati(righe) {
  const nGare = righe.reduce((s, c) => s + c.n_gare, 0);
  const nFederali = righe.reduce((s, c) => s + c.n_federali, 0);
  const nAssociato = righe.reduce((s, c) => s + c.n_associato, 0);
  const kmTotali = Math.round(righe.reduce((s, c) => s + c.km_totali, 0) * 10) / 10;
  const totaleDesignazioni = nFederali + nAssociato;
  const pctFederali = totaleDesignazioni ? Math.round(nFederali / totaleDesignazioni * 1000) / 10 : 0;
  const pctAssociato = totaleDesignazioni ? Math.round(nAssociato / totaleDesignazioni * 1000) / 10 : 0;
  const mediaKmGara = nGare ? Math.round(kmTotali / nGare * 10) / 10 : 0;
  const mediaKmFederali = nFederali ? Math.round(kmTotali / nFederali * 10) / 10 : 0;
  return `
    <tr style="font-weight:600; border-top:2px solid var(--bordo)">
      <td>Totale</td>
      <td>${nGare}</td>
      <td>${nFederali} <span style="color:var(--testo-tenue)">(${pctFederali}%)</span></td>
      <td>${nAssociato} <span style="color:var(--testo-tenue)">(${pctAssociato}%)</span></td>
      <td>${kmTotali} km</td>
      <td>${mediaKmGara} km</td>
      <td>${mediaKmFederali} km</td>
      <td></td>
      <td></td>
    </tr>
  `;
}

document.getElementById("filtro-report-campionati").addEventListener("input", renderTabellaReportCampionati);

function apriDettaglioCampionato(chiave) {
  const campionato = _reportCampionatiCache.find(c => c.chiave === chiave);
  if (!campionato) return;
  window._dettaglioCampionatoCorrente = campionato;

  document.getElementById("titolo-modale-dettaglio-campionato").textContent =
    `${campionato.nome} — quante volte ogni arbitro ha diretto ogni squadra`;
  document.getElementById("filtro-dettaglio-campionato").value = "";
  renderDettaglioCampionato();
  openOverlay("modale-dettaglio-campionato");
}

function renderDettaglioCampionato() {
  const campionato = window._dettaglioCampionatoCorrente;
  if (!campionato) return;
  const filtro = (document.getElementById("filtro-dettaglio-campionato").value || "").trim().toLowerCase();

  // per ogni gara, l'arbitro (e il 2° arbitro, se presente) ha diretto sia la squadra di
  // casa che quella ospite: ogni combinazione squadra+arbitro conta quante volte si ripete.
  const conteggio = {}; // "squadra||arbitro" -> {squadra, arbitro, n}
  // in parallelo, tiene il conteggio federale/associato diviso per squadra e per casa/fuori casa.
  const casaOspite = {}; // squadra -> {casa: {federale, associato}, ospite: {federale, associato}}
  function segnaCasaOspite(squadra, lato, nomeArbitro) {
    if (!squadra || !nomeArbitro) return;
    const s = casaOspite[squadra] = casaOspite[squadra] || { casa: { federale: 0, associato: 0 }, ospite: { federale: 0, associato: 0 } };
    s[lato][nomeArbitro === "Arbitro Associato" ? "associato" : "federale"]++;
  }
  campionato.gare.forEach(g => {
    [g.squadra_casa, g.squadra_ospite].forEach(squadra => {
      if (!squadra) return;
      [g.arbitro, g.assistente1].forEach(arbitro => {
        if (!arbitro) return;
        const chiave = `${squadra}||${arbitro}`;
        conteggio[chiave] = conteggio[chiave] || { squadra, arbitro, n: 0, perFase: {} };
        conteggio[chiave].n++;
        const fase = g.tipo_fase || "campionato";
        conteggio[chiave].perFase[fase] = (conteggio[chiave].perFase[fase] || 0) + 1;
      });
    });
    [g.arbitro, g.assistente1].forEach(arbitro => {
      if (!arbitro) return;
      segnaCasaOspite(g.squadra_casa, "casa", arbitro);
      segnaCasaOspite(g.squadra_ospite, "ospite", arbitro);
    });
  });

  let righe = Object.values(conteggio);
  if (filtro) {
    righe = righe.filter(r => r.squadra.toLowerCase().includes(filtro) || r.arbitro.toLowerCase().includes(filtro));
  }
  righe.sort((a, b) => a.squadra.localeCompare(b.squadra) || b.n - a.n);

  // raggruppa per squadra con rowspan: il nome della squadra compare una sola volta invece
  // di essere ripetuto su ogni riga arbitro.
  const gruppi = [];
  righe.forEach(r => {
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.squadra === r.squadra) {
      ultimo.righe.push(r);
    } else {
      gruppi.push({ squadra: r.squadra, righe: [r] });
    }
  });

  function calcolaPct(federale, associato) {
    const totale = federale + associato;
    return {
      federale, associato,
      pctFederale: totale ? Math.round(federale / totale * 1000) / 10 : 0,
      pctAssociato: totale ? Math.round(associato / totale * 1000) / 10 : 0,
    };
  }

  gruppi.forEach(gr => {
    const co = casaOspite[gr.squadra] || { casa: { federale: 0, associato: 0 }, ospite: { federale: 0, associato: 0 } };
    gr.totale = calcolaPct(co.casa.federale + co.ospite.federale, co.casa.associato + co.ospite.associato);
    gr.casa = calcolaPct(co.casa.federale, co.casa.associato);
    gr.ospite = calcolaPct(co.ospite.federale, co.ospite.associato);
  });

  const rigaEtichetta = (etichetta, dati) =>
    `<tr><td colspan="2" style="font-size:12.5px; color:var(--testo-tenue)">${etichetta}: Federale ${dati.pctFederale}% &nbsp;·&nbsp; Associato ${dati.pctAssociato}%</td></tr>`;

  const mostraDettaglioFasi = campionato.dettaglio_fasi && campionato.dettaglio_fasi.length > 1;

  document.getElementById("tabella-dettaglio-campionato").innerHTML = gruppi.length
    ? _rigaTotaleDettaglioCampionato(righe) + gruppi.map(gr => {
        const righeArbitro = gr.righe.map((r, i) => {
          const dettaglioFasi = mostraDettaglioFasi
            ? ORDINE_FASI_JS.filter(f => r.perFase[f]).map(f => `${ETICHETTE_FASE_JS[f]} ${r.perFase[f]}`).join(" · ")
            : "";
          return `
          <tr${i === 0 ? ' style="border-top:2px solid var(--bordo)"' : ""}>
            ${i === 0 ? `<td rowspan="${gr.righe.length + 3}" style="vertical-align:top">${gr.squadra}</td>` : ""}
            <td>${r.arbitro}</td>
            <td>${r.n}${dettaglioFasi ? `<div style="font-size:11.5px;color:var(--testo-tenue);margin-top:2px;">${dettaglioFasi}</div>` : ""}</td>
          </tr>
        `;
        }).join("");
        const righePercentuali =
          rigaEtichetta("Totale", gr.totale) +
          rigaEtichetta("In casa", gr.casa) +
          rigaEtichetta("Fuori casa", gr.ospite);
        return righeArbitro + righePercentuali;
      }).join("")
    : `<tr><td colspan="3" style="text-align:center;color:var(--testo-tenue)">Nessun risultato</td></tr>`;
}

function _rigaTotaleDettaglioCampionato(righe) {
  const totale = righe.reduce((s, r) => s + r.n, 0);
  const associato = righe.filter(r => r.arbitro === "Arbitro Associato").reduce((s, r) => s + r.n, 0);
  const federale = totale - associato;
  const pctFederale = totale ? Math.round(federale / totale * 1000) / 10 : 0;
  const pctAssociato = totale ? Math.round(associato / totale * 1000) / 10 : 0;
  return `
    <tr style="font-weight:600">
      <td>Totale</td>
      <td>Federale ${federale} (${pctFederale}%) &nbsp;·&nbsp; Associato ${associato} (${pctAssociato}%)</td>
      <td>${totale}</td>
    </tr>
  `;
}

document.getElementById("filtro-dettaglio-campionato").addEventListener("input", renderDettaglioCampionato);
