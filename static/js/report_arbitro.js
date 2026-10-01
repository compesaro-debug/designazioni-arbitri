// Logica del "Report arbitro" (statistiche stagionali: gare, km, campionati, società,
// disponibilità). Condivisa tra la pagina Anagrafica arbitri (pulsante "Report" per riga)
// e la pagina Report (selezione arbitro dedicata): entrambe includono questo file e il
// partial _report_arbitro_modali.html con il markup delle due modali.

function _righeDettaglioReport(gare) {
  return gare.length
    ? gare.map(g => `
        <tr${dataNelFuturo(g.data) ? ' class="riga-data-futura"' : ""}>
          <td>${formattaData(g.data)}</td>
          <td>${g.campionato}</td>
          <td>${tagFase(g.tipo_fase)}</td>
          <td>${g.girone}</td>
          <td>${g.numero_gara}</td>
          <td>${g.squadra_casa}</td>
          <td>${g.squadra_ospite}</td>
          <td>${g.risultato}</td>
          <td>${g.ruolo_designazione}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="9" style="text-align:center;color:var(--testo-tenue)">Nessuna gara</td></tr>`;
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

const NOMI_MESI_REPORT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const NOMI_MESI_CORTI_REPORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const SERIE_DISPONIBILITA = [
  { nome: "Disponibile", colore: "var(--stato-ok)" },
  { nome: "Disponibile in parte", colore: "var(--stato-parziale)" },
  { nome: "Indisponibile", colore: "var(--stato-ko)" },
];

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

  // ogni arbitro riparte con i grafici compatti ("Mostra tutti" non resta aperto dal precedente)
  document.querySelectorAll("#modale-report-arbitro [id^='grafico-arbitro-']").forEach(el => delete el.dataset.mostraTutte);

  document.getElementById("titolo-modale-report").textContent = `Report — ${dati.arbitro}`;
  document.getElementById("report-km-totali").textContent = `${formattaNumero(dati.km_totali)} km`;
  document.getElementById("report-km-nota").textContent = dati.n_km_mancanti > 0
    ? `Km calcolati su ${dati.n_km_calcolate} gare; ${dati.n_km_mancanti} escluse perché la distanza comune-comune non è disponibile.`
    : `Km calcolati su tutte le ${dati.n_km_calcolate} gare disputate.`;

  document.getElementById("report-periodo-disponibilita").textContent = dati.primo_giorno_globale && dati.ultimo_giorno_globale
    ? `Disponibilità · dal ${formattaData(dati.primo_giorno_globale)} al ${formattaData(dati.ultimo_giorno_globale)}`
    : "Disponibilità";
  document.getElementById("report-giorni-calendario").textContent = dati.giorni_calendario;
  document.getElementById("report-giorni-disponibili").textContent = dati.giorni_disponibili;
  document.getElementById("report-giorni-indisp-totali").textContent = dati.giorni_indisponibili_totali;
  document.getElementById("report-giorni-indisp-parziali").textContent = dati.giorni_indisponibili_parziali;
  document.getElementById("report-media-disponibilita").textContent = `${formattaNumero(dati.media_disponibilita)}%`;

  // ---- gare: totali, ruolo, tutor ----
  const garePrimo = gare.filter(g => g.ruolo_designazione === "Arbitro");
  const gareSecondo = gare.filter(g => g.ruolo_designazione === "2° Arbitro");
  const gareTutor = gare.filter(g => g.e_tutor);
  [
    ["report-gare-totali-btn", gare, `Gare dirette da ${dati.arbitro}`],
    ["report-gare-primo-btn", garePrimo, `${dati.arbitro} come Primo Arbitro`],
    ["report-gare-secondo-btn", gareSecondo, `${dati.arbitro} come 2° Arbitro`],
    ["report-gare-tutor-btn", gareTutor, `${dati.arbitro} come tutor`],
  ].forEach(([idBottone, elenco, titolo]) => {
    const bottone = document.getElementById(idBottone);
    bottone.textContent = elenco.length;
    bottone.onclick = () => mostraDettaglioReport(titolo, elenco);
  });

  // ---- andamento mensile: tutti i mesi del periodo, anche senza gare ----
  const gareXMese = {};
  gare.forEach(g => {
    const chiave = g.data.slice(0, 7);
    (gareXMese[chiave] = gareXMese[chiave] || []).push(g);
  });
  const mensile = (dati.distribuzione_mensile || []).map(d => {
    const [anno, mese] = d.mese.split("-");
    return {
      chiave: d.mese,
      anno,
      meseCorto: NOMI_MESI_CORTI_REPORT[Number(mese) - 1],
      etichetta: `${NOMI_MESI_REPORT[Number(mese) - 1]} ${anno}`,
      gare: gareXMese[d.mese] || [],
      disponibili: d.disponibili,
      parziali: d.parziali,
      indisponibili: d.indisponibili,
    };
  });

  graficoColonne(document.getElementById("grafico-arbitro-mesi"), mensile.map((m, i) => ({
    etichetta: m.meseCorto,
    sottoetichetta: i === 0 || m.meseCorto === "Gen" ? m.anno : "",
    valori: [m.gare.length],
    onClick: m.gare.length ? () => mostraDettaglioReport(`${dati.arbitro} — ${m.etichetta}`, m.gare) : null,
  })), [{ nome: "Gare", colore: "var(--serie-1)" }], { vuoto: "Nessuna gara diretta nel periodo" });

  graficoColonne(document.getElementById("grafico-arbitro-disp-mesi"), mensile.map((m, i) => ({
    etichetta: m.meseCorto,
    sottoetichetta: i === 0 || m.meseCorto === "Gen" ? m.anno : "",
    valori: [m.disponibili, m.parziali, m.indisponibili],
  })), SERIE_DISPONIBILITA, { unita: " giorni", etichetteValori: false, vuoto: "Nessun dato di disponibilità" });

  document.getElementById("tabella-report-mesi").innerHTML = mensile.length
    ? mensile.map(m => `
        <tr>
          <td>${m.etichetta}</td>
          <td>${m.gare.length}</td>
          <td>${m.disponibili}</td>
          <td>${m.parziali}</td>
          <td>${m.indisponibili}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--testo-tenue)">Nessun dato</td></tr>`;

  // ---- giorno della settimana: stesso ordine Lun..Dom del backend
  // (JS: getDay() 0=domenica..6=sabato -> indice 0=lunedì..6=domenica) ----
  const gareSettimana = [0, 0, 0, 0, 0, 0, 0];
  gare.forEach(g => {
    const giornoJs = new Date(`${g.data}T00:00:00`).getDay();
    gareSettimana[(giornoJs + 6) % 7]++;
  });

  graficoImpilato(document.getElementById("grafico-arbitro-settimana"), dati.distribuzione_settimana.map((d, i) => ({
    etichetta: d.giorno,
    valori: [d.disponibili, d.parziali, d.indisponibili],
    gare: gareSettimana[i],
  })), SERIE_DISPONIBILITA, {
    percentuale: true,
    unita: " giorni",
    fine: (r) => `${r.gare} gar${r.gare === 1 ? "a" : "e"}`,
    vuoto: "Nessun dato di disponibilità",
  });

  document.getElementById("tabella-report-settimana").innerHTML = dati.distribuzione_settimana.map((d, i) => `
    <tr>
      <td>${d.giorno}</td>
      <td>${d.disponibili} / ${d.totale} <span style="color:var(--testo-tenue)">(${d.percentuale}%)</span></td>
      <td>${d.parziali} / ${d.totale} <span style="color:var(--testo-tenue)">(${d.percentuale_parziale}%)</span></td>
      <td>${d.indisponibili} / ${d.totale} <span style="color:var(--testo-tenue)">(${d.percentuale_indisponibile}%)</span></td>
      <td>${gareSettimana[i]}</td>
    </tr>
  `).join("");

  // ---- gare per fase (sotto-alias impostato in Alias campionati) ----
  graficoBarre(document.getElementById("grafico-arbitro-fasi"), ORDINE_FASI_JS.map(fase => {
    const gareFase = gare.filter(g => (g.tipo_fase || "campionato") === fase);
    return {
      etichetta: ETICHETTE_FASE_JS[fase],
      valore: gareFase.length,
      onClick: gareFase.length ? () => mostraDettaglioReport(`${dati.arbitro} — ${ETICHETTE_FASE_JS[fase]}`, gareFase) : null,
    };
  }), { vuoto: "Nessuna gara" });

  // ---- per campionato (alias-aware: i gironi collegati contano sotto il torneo logico) ----
  const perCampionato = {};
  gare.forEach(g => {
    (perCampionato[g.campionato_alias] = perCampionato[g.campionato_alias] || []).push(g);
  });
  graficoBarre(document.getElementById("grafico-arbitro-campionati"),
    Object.entries(perCampionato).sort((a, b) => b[1].length - a[1].length).map(([nome, righe]) => ({
      etichetta: nome,
      valore: righe.length,
      onClick: () => mostraDettaglioReport(`${dati.arbitro} — ${nome}`, righe),
    })), { massimoRighe: 10, vuoto: "Nessuna gara" });

  // ---- per società (codice affiliazione): ogni gara conta per casa e ospite ----
  const perSocieta = {};
  gare.forEach(g => {
    [[g.aff_a, g.squadra_casa], [g.aff_b, g.squadra_ospite]].forEach(([cod, nome]) => {
      if (!cod) return;
      if (!perSocieta[cod]) perSocieta[cod] = { nome, righe: [] };
      perSocieta[cod].righe.push(g);
    });
  });
  graficoBarre(document.getElementById("grafico-arbitro-societa"),
    Object.entries(perSocieta).sort((a, b) => b[1].righe.length - a[1].righe.length).map(([cod, info]) => {
      const nome = mappaSocieta[cod] || info.nome;
      return {
        etichetta: nome,
        valore: info.righe.length,
        dettaglio: `Cod. affiliazione ${cod}`,
        onClick: () => mostraDettaglioReport(`${dati.arbitro} — ${nome} (${cod})`, info.righe),
      };
    }), { massimoRighe: 10, vuoto: "Nessuna gara" });

  openOverlay("modale-report-arbitro");
}
