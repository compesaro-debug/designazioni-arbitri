let filtriSezione = {};
let ordinamentoSezione = { campo: null, direzione: "asc" };
let _sezioneCaricata = false;

function cambiaTabReport(tab) {
  document.querySelectorAll(".tabs .tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("card-report-arbitro").style.display = tab === "arbitro" ? "" : "none";
  document.getElementById("card-report-sezione").style.display = tab === "sezione" ? "" : "none";
  document.getElementById("card-report-campionato").style.display = tab === "campionato" ? "" : "none";
  document.getElementById("card-report-copertura").style.display = tab === "copertura" ? "" : "none";
  document.getElementById("card-report-confronto").style.display = tab === "confronto" ? "" : "none";
  document.getElementById("card-report-tutoraggi").style.display = tab === "tutoraggi" ? "" : "none";
  // il confronto mostra sempre tutte le stagioni insieme, e i tutoraggi esistono solo sulla
  // stagione corrente (Rimborsi km non ha un equivalente storico): il selettore stagione in
  // cima alla pagina non si applica a queste due schede.
  document.getElementById("selettore-stagione-report").closest(".actions").style.display = (tab === "confronto" || tab === "tutoraggi") ? "none" : "";
  if (tab === "sezione" && !_sezioneCaricata) {
    _sezioneCaricata = true;
    caricaReportSezione();
  }
  if (tab === "campionato" && !window._campionatoReportCaricato) {
    window._campionatoReportCaricato = true;
    caricaReportCampionati();
  }
  if (tab === "copertura" && !window._coperturaReportCaricato) {
    window._coperturaReportCaricato = true;
    caricaReportCopertura();
  }
  if (tab === "confronto" && !window._confrontoReportCaricato) {
    window._confrontoReportCaricato = true;
    caricaReportConfronto();
  }
  if (tab === "tutoraggi" && !window._tutoraggiReportCaricato) {
    window._tutoraggiReportCaricato = true;
    caricaReportTutoraggi();
  }
}

function cambiaStagioneReport() {
  window._stagioneReportId = document.getElementById("selettore-stagione-report").value;
  // invalida le cache lazy-load delle schede: la prossima apertura ricarica con la nuova stagione
  _sezioneCaricata = false;
  window._campionatoReportCaricato = false;
  window._coperturaReportCaricato = false;
  closeOverlay("modale-report-arbitro");

  const tabAttiva = document.querySelector(".tabs .tab-btn.active")?.dataset.tab || "arbitro";
  if (tabAttiva === "sezione") { _sezioneCaricata = true; caricaReportSezione(); }
  else if (tabAttiva === "campionato") { window._campionatoReportCaricato = true; caricaReportCampionati(); }
  else if (tabAttiva === "copertura") { window._coperturaReportCaricato = true; caricaReportCopertura(); }
}

async function caricaReportSezione() {
  const dati = await apiGet(`/api/report/sezione${_querySuffixStagione()}`);
  window._reportSezioneCache = dati.arbitri;

  document.getElementById("sezione-n-arbitri").textContent = formattaNumero(dati.n_arbitri);
  document.getElementById("sezione-n-gare").textContent = formattaNumero(dati.n_gare_sezione);
  document.getElementById("sezione-media-gare").textContent = formattaNumero(dati.media_gare);
  document.getElementById("sezione-km-totali").textContent = `${formattaNumero(dati.km_totali_sezione)} km`;
  document.getElementById("sezione-n-gare-doppia").textContent = formattaNumero(dati.n_gare_doppia_designazione);
  document.getElementById("sezione-pct-gare-doppia").textContent = `${formattaNumero(dati.pct_gare_doppia_designazione)}% delle gare disputate`;
  _renderGraficiSezione(dati);

  document.getElementById("tabella-sezione-ruolo").innerHTML = dati.distribuzione_ruolo.map(d => `
    <tr>
      <td>${d.ruolo}</td>
      <td>${d.arbitri != null ? d.arbitri : "-"}</td>
      <td>${d.gare}</td>
      <td>${d.percentuale}%</td>
      <td>${d.media_gare != null ? d.media_gare : "-"}</td>
      <td>${d.km_totali != null ? d.km_totali + " km" : "-"}</td>
      <td>${d.pct_primo != null ? d.pct_primo + "%" : "-"}</td>
      <td>${d.pct_secondo != null ? d.pct_secondo + "%" : "-"}</td>
    </tr>
  `).join("");

  renderTabellaSezione();
}

const NOMI_QUALIFICA = { NAZ: "Nazionale (NAZ)", REG: "Regionale (REG)", TER: "Territoriale (TER)" };

function _renderGraficiSezione(dati) {
  const arbitri = (dati.arbitri || []).filter(a => a.gare > 0);

  graficoBarre(document.getElementById("grafico-sezione-qualifica"), dati.distribuzione_ruolo.map(d => ({
    etichetta: NOMI_QUALIFICA[d.ruolo] || d.ruolo,
    valore: d.gare,
    dettaglio: d.arbitri != null
      ? `${d.arbitri} arbitri · media ${formattaNumero(d.media_gare)} gare\n${formattaNumero(d.percentuale)}% delle gare`
      : `${formattaNumero(d.percentuale)}% delle gare`,
  })), { vuoto: "Nessuna gara disputata in questa stagione" });

  // conteggi 1°/2° sommati dagli arbitri, per qualifica e per tutta la sezione
  const perRuolo = {};
  arbitri.forEach(a => {
    const r = perRuolo[a.ruolo] = perRuolo[a.ruolo] || [0, 0];
    r[0] += a.n_primo;
    r[1] += a.n_secondo;
  });
  const totale = arbitri.reduce((t, a) => [t[0] + a.n_primo, t[1] + a.n_secondo], [0, 0]);
  const ordine = ["NAZ", "REG", "TER"];
  const ruoliOrdinati = Object.keys(perRuolo).sort((a, b) => (ordine.indexOf(a) + 1 || 99) - (ordine.indexOf(b) + 1 || 99));
  const pctPrimo = (v) => v[0] + v[1] ? Math.round(v[0] / (v[0] + v[1]) * 100) : 0;
  graficoImpilato(document.getElementById("grafico-sezione-ruoli"), [
    { etichetta: "Tutta la sezione", valori: totale },
    ...ruoliOrdinati.map(r => ({ etichetta: NOMI_QUALIFICA[r] || r, valori: perRuolo[r] })),
  ], [
    { nome: "1° arbitro", colore: "var(--serie-1)" },
    { nome: "2° arbitro", colore: "var(--serie-2)" },
  ], {
    percentuale: true,
    fine: (r) => `${pctPrimo(r.valori)}% · ${100 - pctPrimo(r.valori)}%`,
    vuoto: "Nessuna designazione",
  });

  const perGare = [...arbitri].sort((a, b) => b.gare - a.gare);
  graficoBarre(document.getElementById("grafico-sezione-carico"), perGare.map(a => ({
    etichetta: a.nome,
    valore: a.gare,
    dettaglio: `${a.ruolo || "-"} · ${a.comune || "-"}\n1° arbitro ${a.n_primo} · 2° arbitro ${a.n_secondo}`,
    onClick: () => apriReportArbitro(a.id),
  })), { riferimento: { valore: dati.media_gare, etichetta: "Media della sezione" }, massimoRighe: 15 });

  const perKm = [...arbitri].filter(a => a.km_totali > 0).sort((a, b) => b.km_totali - a.km_totali);
  graficoBarre(document.getElementById("grafico-sezione-km"), perKm.map(a => ({
    etichetta: a.nome,
    valore: a.km_totali,
    dettaglio: `${a.gare} gare · ${a.comune || "-"}`,
    onClick: () => apriReportArbitro(a.id),
  })), { unita: " km", massimoRighe: 15, vuoto: "Nessun km calcolato" });
}

function renderTabellaSezione() {
  let arbitri = window._reportSezioneCache || [];

  arbitri = arbitri.filter(a =>
    Object.entries(filtriSezione).every(([campo, valore]) => {
      if (!valore) return true;
      return String(a[campo] ?? "").toLowerCase().includes(valore.toLowerCase());
    })
  );

  if (ordinamentoSezione.campo) {
    const campo = ordinamentoSezione.campo;
    const dir = ordinamentoSezione.direzione === "asc" ? 1 : -1;
    const numerico = ["gare", "n_primo", "n_secondo", "km_totali", "scostamento"].includes(campo);
    arbitri = [...arbitri].sort((a, b) => {
      let va = a[campo], vb = b[campo];
      if (numerico) {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = String(va ?? "").toLowerCase();
        vb = String(vb ?? "").toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  const tbody = document.getElementById("tabella-sezione");
  tbody.innerHTML = arbitri.length
    ? arbitri.map(a => {
        const scostamentoTesto = a.scostamento > 0 ? `+${a.scostamento}` : `${a.scostamento}`;
        const classeScostamento = a.scostamento > 0 ? "tag-verde" : (a.scostamento < 0 ? "tag-rosso" : "");
        return `
          <tr>
            <td>${a.nome}</td>
            <td>${a.comune}</td>
            <td>${a.ruolo}</td>
            <td>${a.gare}</td>
            <td>${a.n_primo} (${a.pct_primo}%)</td>
            <td>${a.n_secondo} (${a.pct_secondo}%)</td>
            <td>${a.km_totali} km</td>
            <td>${classeScostamento ? `<span class="tag ${classeScostamento}">${scostamentoTesto}</span>` : scostamentoTesto}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="8" style="text-align:center;color:var(--testo-tenue)">Nessun arbitro</td></tr>`;
}

abilitaOrdinamento("#tabella-head-sezione", ordinamentoSezione, renderTabellaSezione);
abilitaFiltri("#tabella-head-sezione", filtriSezione, renderTabellaSezione);
abilitaRidimensionamentoColonne("#tabella-sezione-el");
rendiHeaderFisso("#tabella-head-sezione");
