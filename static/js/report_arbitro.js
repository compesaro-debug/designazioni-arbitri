// Logica del "Report arbitro" (statistiche stagionali: gare, km, campionati, società,
// disponibilità). Condivisa tra la pagina Anagrafica arbitri (pulsante "Report" per riga)
// e la pagina Report (selezione arbitro dedicata): entrambe includono questo file e il
// partial _report_arbitro_modali.html con il markup delle due modali.

function _righeDettaglioReport(gare) {
  return gare.length
    ? gare.map(g => `
        <tr>
          <td>${formattaData(g.data)}</td>
          <td>${g.campionato}</td>
          <td>${g.girone}</td>
          <td>${g.numero_gara}</td>
          <td>${g.squadra_casa}</td>
          <td>${g.squadra_ospite}</td>
          <td>${g.risultato}</td>
          <td>${g.ruolo_designazione}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="8" style="text-align:center;color:var(--testo-tenue)">Nessuna gara</td></tr>`;
}

function mostraDettaglioReport(titolo, gare) {
  document.getElementById("titolo-modale-dettaglio-report").textContent = `${titolo} (${gare.length})`;
  document.getElementById("tabella-dettaglio-report").innerHTML = _righeDettaglioReport(gare);
  openOverlay("modale-dettaglio-report");
}

// Se la pagina ha un selettore stagione (solo la pagina Report, non l'Anagrafica arbitri),
// la variabile globale window._stagioneReportId ne riflette la scelta corrente: se vuota o
// non definita, il report resta sulla stagione corrente (comportamento di sempre).
function _querySuffixStagione() {
  return (typeof window._stagioneReportId !== "undefined" && window._stagioneReportId)
    ? `?stagione_id=${window._stagioneReportId}`
    : "";
}

async function apriReportArbitro(id) {
  const suffisso = _querySuffixStagione();
  const [dati, societa] = await Promise.all([
    apiGet(`/api/arbitri/${id}/report${suffisso}`),
    apiGet("/api/societa"),
  ]);
  const mappaSocieta = {};
  societa.forEach(s => { mappaSocieta[s.codice_affiliazione] = s.ragione_sociale; });
  window._reportArbitroCorrente = dati;
  const gare = dati.gare;

  document.getElementById("titolo-modale-report").textContent = `Report — ${dati.arbitro}`;
  document.getElementById("report-km-totali").textContent = `${dati.km_totali} km`;
  document.getElementById("report-km-nota").textContent = dati.n_km_mancanti > 0
    ? `Km calcolati su ${dati.n_km_calcolate} gare; ${dati.n_km_mancanti} escluse perché la distanza comune-comune non è disponibile.`
    : `Km calcolati su tutte le ${dati.n_km_calcolate} gare disputate.`;

  document.getElementById("report-periodo-disponibilita").textContent = dati.primo_giorno_globale && dati.ultimo_giorno_globale
    ? `Disponibilità (dalla prima all'ultima gara disputata nel sistema: ${formattaData(dati.primo_giorno_globale)} - ${formattaData(dati.ultimo_giorno_globale)})`
    : "Disponibilità";
  document.getElementById("report-giorni-calendario").textContent = dati.giorni_calendario;
  document.getElementById("report-giorni-disponibili").textContent = dati.giorni_disponibili;
  document.getElementById("report-giorni-indisp-totali").textContent = dati.giorni_indisponibili_totali;
  document.getElementById("report-giorni-indisp-parziali").textContent = dati.giorni_indisponibili_parziali;
  document.getElementById("report-media-disponibilita").textContent = `${dati.media_disponibilita}%`;

  // gare designate per giorno della settimana, nello stesso ordine Lun..Dom usato dal
  // backend per la disponibilità (JS: getDay() 0=domenica..6=sabato -> indice 0=lunedì..6=domenica)
  const gareSettimana = [0, 0, 0, 0, 0, 0, 0];
  gare.forEach(g => {
    const giornoJs = new Date(`${g.data}T00:00:00`).getDay();
    gareSettimana[(giornoJs + 6) % 7]++;
  });

  const tbodySettimana = document.getElementById("tabella-report-settimana");
  tbodySettimana.innerHTML = dati.distribuzione_settimana.map((d, i) => `
    <tr>
      <td>${d.giorno}</td>
      <td>${d.disponibili} / ${d.totale} <span style="color:var(--testo-tenue)">(${d.percentuale}%)</span></td>
      <td>${d.parziali} / ${d.totale} <span style="color:var(--testo-tenue)">(${d.percentuale_parziale}%)</span></td>
      <td>${d.indisponibili} / ${d.totale} <span style="color:var(--testo-tenue)">(${d.percentuale_indisponibile}%)</span></td>
      <td>${gareSettimana[i]}</td>
    </tr>
  `).join("");

  // andamento mensile: uniamo TUTTI i mesi del periodo di disponibilità (anche quelli
  // senza gare dirette) con il conteggio gare per mese, cosi la tabella e il grafico
  // riflettono l'intero arco temporale e non solo i mesi in cui l'arbitro ha diretto.
  const gareXMese = {};
  gare.forEach(g => {
    const chiave = g.data.slice(0, 7);
    gareXMese[chiave] = (gareXMese[chiave] || 0) + 1;
  });
  const nomiMesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const mensile = (dati.distribuzione_mensile || []).map(d => ({
    chiave: d.mese,
    etichetta: `${nomiMesi[Number(d.mese.split("-")[1]) - 1]} ${d.mese.split("-")[0]}`,
    gare: gareXMese[d.mese] || 0,
    disponibili: d.disponibili,
    parziali: d.parziali,
    indisponibili: d.indisponibili,
    totale: d.totale,
  }));
  window._reportMensileCorrente = mensile;

  document.getElementById("tabella-report-mesi").innerHTML = mensile.length
    ? mensile.map(m => `
        <tr>
          <td>${m.etichetta}</td>
          <td>${m.gare}</td>
          <td>${m.disponibili}</td>
          <td>${m.parziali}</td>
          <td>${m.indisponibili}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--testo-tenue)">Nessun dato</td></tr>`;

  const garePrimo = gare.filter(g => g.ruolo_designazione === "Arbitro");
  const gareSecondo = gare.filter(g => g.ruolo_designazione === "2° Arbitro");

  document.getElementById("report-gare-totali-btn").textContent = gare.length;
  document.getElementById("report-gare-totali-btn").onclick = () => mostraDettaglioReport(`Gare dirette da ${dati.arbitro}`, gare);
  document.getElementById("report-gare-primo-btn").textContent = garePrimo.length;
  document.getElementById("report-gare-primo-btn").onclick = () => mostraDettaglioReport(`${dati.arbitro} come Primo Arbitro`, garePrimo);
  document.getElementById("report-gare-secondo-btn").textContent = gareSecondo.length;
  document.getElementById("report-gare-secondo-btn").onclick = () => mostraDettaglioReport(`${dati.arbitro} come 2° Arbitro`, gareSecondo);

  // distribuzione per campionato (alias-aware: i gironi collegati nella pagina Campionati
  // vengono conteggiati insieme sotto il nome del torneo logico)
  const perCampionato = {};
  gare.forEach(g => {
    (perCampionato[g.campionato_alias] = perCampionato[g.campionato_alias] || []).push(g);
  });
  const listaCampionati = Object.entries(perCampionato).sort((a, b) => b[1].length - a[1].length);
  const tbodyCampionati = document.getElementById("tabella-report-campionati");
  tbodyCampionati.innerHTML = listaCampionati.length
    ? listaCampionati.map(([nome, righe]) => `<tr><td>${nome}</td><td><button class="btn-storico-inline">${righe.length}</button></td></tr>`).join("")
    : `<tr><td colspan="2" style="text-align:center;color:var(--testo-tenue)">Nessuna gara</td></tr>`;
  tbodyCampionati.querySelectorAll("button").forEach((btn, i) => {
    const [nome, righe] = listaCampionati[i];
    btn.addEventListener("click", () => mostraDettaglioReport(`${dati.arbitro} — ${nome}`, righe));
  });

  // distribuzione per società (per codice di affiliazione): ogni gara conta sia per la
  // società di casa che per quella ospite, perché l'arbitro è comunque stato presente
  // alla partita di entrambe.
  const perSocieta = {};
  gare.forEach(g => {
    [[g.aff_a, g.squadra_casa], [g.aff_b, g.squadra_ospite]].forEach(([cod, nome]) => {
      if (!cod) return;
      if (!perSocieta[cod]) perSocieta[cod] = { nome, righe: [] };
      perSocieta[cod].righe.push(g);
    });
  });
  const listaSocieta = Object.entries(perSocieta).sort((a, b) => b[1].righe.length - a[1].righe.length);
  const tbodySocieta = document.getElementById("tabella-report-societa");
  tbodySocieta.innerHTML = listaSocieta.length
    ? listaSocieta.map(([cod, info]) => `<tr><td>${mappaSocieta[cod] || info.nome} (${cod})</td><td><button class="btn-storico-inline">${info.righe.length}</button></td></tr>`).join("")
    : `<tr><td colspan="2" style="text-align:center;color:var(--testo-tenue)">Nessuna gara</td></tr>`;
  tbodySocieta.querySelectorAll("button").forEach((btn, i) => {
    const [cod, info] = listaSocieta[i];
    btn.addEventListener("click", () => mostraDettaglioReport(`${dati.arbitro} — ${mappaSocieta[cod] || info.nome} (${cod})`, info.righe));
  });

  openOverlay("modale-report-arbitro");
}

function apriGraficoMensileReport() {
  const mensile = window._reportMensileCorrente || [];
  const cont = document.getElementById("grafico-mensile-report");

  if (!mensile.length) {
    cont.innerHTML = `<p style="text-align:center;color:var(--testo-tenue);padding:30px;">Nessun dato da visualizzare</p>`;
    openOverlay("modale-grafico-mensile-report");
    return;
  }

  const margin = { top: 20, right: 46, bottom: 46, left: 34 };
  const slot = 70;
  const plotWidth = mensile.length * slot;
  const plotHeight = 260;
  const width = plotWidth + margin.left + margin.right;
  const height = plotHeight + margin.top + margin.bottom;
  const barWidth = slot * 0.55;

  const maxGiorni = Math.max(1, ...mensile.map(m => m.totale));
  const maxGare = Math.max(1, ...mensile.map(m => m.gare));
  const nomiMesiCorti = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

  let barre = "";
  const puntiLinea = [];
  mensile.forEach(m => {
    const i = mensile.indexOf(m);
    const xSlot = margin.left + i * slot;
    const xBar = xSlot + (slot - barWidth) / 2;
    const yBase = margin.top + plotHeight;

    const hDisp = (m.disponibili / maxGiorni) * plotHeight;
    const hParz = (m.parziali / maxGiorni) * plotHeight;
    const hIndisp = (m.indisponibili / maxGiorni) * plotHeight;

    let yCursor = yBase;
    if (hDisp > 0) { barre += `<rect x="${xBar}" y="${yCursor - hDisp}" width="${barWidth}" height="${hDisp}" fill="#16a34a"></rect>`; yCursor -= hDisp; }
    if (hParz > 0) { barre += `<rect x="${xBar}" y="${yCursor - hParz}" width="${barWidth}" height="${hParz}" fill="#f59e0b"></rect>`; yCursor -= hParz; }
    if (hIndisp > 0) { barre += `<rect x="${xBar}" y="${yCursor - hIndisp}" width="${barWidth}" height="${hIndisp}" fill="#dc2626"></rect>`; yCursor -= hIndisp; }

    const [anno, mese] = m.chiave.split("-");
    barre += `<text x="${xSlot + slot / 2}" y="${yBase + 16}" text-anchor="middle" font-size="11" fill="var(--testo-tenue)">${nomiMesiCorti[Number(mese) - 1]}</text>`;
    barre += `<text x="${xSlot + slot / 2}" y="${yBase + 30}" text-anchor="middle" font-size="10" fill="var(--testo-tenue)">${anno}</text>`;

    const cx = xSlot + slot / 2;
    const cy = margin.top + plotHeight - (m.gare / maxGare) * plotHeight;
    puntiLinea.push(`${cx},${cy}`);
    barre += `<circle cx="${cx}" cy="${cy}" r="4" fill="#2563eb"></circle>`;
    barre += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="10" fill="#2563eb">${m.gare}</text>`;
  });

  let griglia = "";
  for (let f = 0; f <= 4; f++) {
    const frac = f / 4;
    const y = margin.top + plotHeight - frac * plotHeight;
    griglia += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}" stroke="var(--bordo)" stroke-width="1"></line>`;
    griglia += `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--testo-tenue)">${Math.round(frac * maxGiorni)}</text>`;
    griglia += `<text x="${margin.left + plotWidth + 8}" y="${y + 4}" text-anchor="start" font-size="10" fill="#2563eb">${Math.round(frac * maxGare)}</text>`;
  }

  cont.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="max-width:none;">
      ${griglia}
      <polyline points="${puntiLinea.join(" ")}" fill="none" stroke="#2563eb" stroke-width="2"></polyline>
      ${barre}
    </svg>
  `;
  openOverlay("modale-grafico-mensile-report");
}
