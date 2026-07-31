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

  document.getElementById("sezione-n-arbitri").textContent = dati.n_arbitri;
  document.getElementById("sezione-n-gare").textContent = dati.n_gare_sezione;
  document.getElementById("sezione-media-gare").textContent = dati.media_gare;
  document.getElementById("sezione-km-totali").textContent = `${dati.km_totali_sezione} km`;
  document.getElementById("sezione-n-gare-doppia").textContent = dati.n_gare_doppia_designazione;
  document.getElementById("sezione-pct-gare-doppia").textContent = `(${dati.pct_gare_doppia_designazione}% delle gare disputate)`;
  document.getElementById("sezione-pct-primo").textContent = `${dati.pct_primo_totale}%`;
  document.getElementById("sezione-pct-secondo").textContent = `${dati.pct_secondo_totale}%`;

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
