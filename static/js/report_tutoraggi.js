// Report tutoraggi: solo stagione corrente (il tutoraggio si dichiara in Rimborsi km, che
// esiste solo per la stagione live). Riusa lo stesso endpoint di Rimborsi km e filtra le
// gare con modalità "tutoraggio_primo"/"tutoraggio_secondo", riorganizzandole per ruolo
// tutor/tutorato invece che 1°/2° arbitro, poi le raggruppa per campionato. Il filtro per
// arbitro tutorato restringe riepilogo e conteggi a lui solo.

async function caricaReportTutoraggi() {
  const da = document.getElementById("tutoraggi-data-da").value || "";
  const a = document.getElementById("tutoraggi-data-a").value || "";
  const params = new URLSearchParams();
  if (da) params.set("da", da);
  if (a) params.set("a", a);
  const righe = await apiGet(`/api/rimborsi-km?${params.toString()}`);
  window._tutoraggiCache = righe.filter(r => r.rimborso_km_modalita === "tutoraggio_primo" || r.rimborso_km_modalita === "tutoraggio_secondo");
  _aggiornaSelectTutorato();
  renderTutoraggi();
}

function azzeraFiltroDataTutoraggi() {
  document.getElementById("tutoraggi-data-da").value = "";
  document.getElementById("tutoraggi-data-a").value = "";
  caricaReportTutoraggi();
}

function _ruoliTutoraggio(r) {
  const tutorPrimo = r.rimborso_km_modalita === "tutoraggio_primo";
  return {
    tutor: tutorPrimo ? r.arbitro : r.assistente1,
    comuneTutor: tutorPrimo ? r.comune_arbitro : r.comune_assistente1,
    kmTutor: tutorPrimo ? r.km_arbitro : r.km_assistente1,
    tutorato: tutorPrimo ? r.assistente1 : r.arbitro,
    comuneTutorato: tutorPrimo ? r.comune_assistente1 : r.comune_arbitro,
  };
}

// Elenco dei tutorati presenti nei dati caricati (periodo Da/A), per popolare il filtro senza
// perdere la selezione già fatta quando si cambia periodo.
function _aggiornaSelectTutorato() {
  const select = document.getElementById("tutoraggi-filtro-tutorato");
  const selezionato = select.value;
  const nomi = [...new Set((window._tutoraggiCache || []).map(r => _ruoliTutoraggio(r).tutorato).filter(Boolean))].sort();
  select.innerHTML = `<option value="">Tutti</option>` + nomi.map(n => `<option value="${n}">${n}</option>`).join("");
  if (nomi.includes(selezionato)) select.value = selezionato;
}

function _riepilogoTutoraggi(righe) {
  let kmTutorTotali = 0, nKmTutor = 0;
  righe.forEach(r => {
    const { kmTutor } = _ruoliTutoraggio(r);
    if (kmTutor != null) { kmTutorTotali += kmTutor; nKmTutor++; }
  });
  return {
    n: righe.length,
    kmTutorTotali: Math.round(kmTutorTotali * 10) / 10,
    mediaKmTutor: nKmTutor ? Math.round(kmTutorTotali / nKmTutor * 10) / 10 : 0,
  };
}

function renderTutoraggi() {
  const filtro = (document.getElementById("filtro-tutoraggi").value || "").trim().toLowerCase();
  const tutorato = document.getElementById("tutoraggi-filtro-tutorato").value;

  const tutte = (window._tutoraggiCache || []).filter(r => !tutorato || _ruoliTutoraggio(r).tutorato === tutorato);

  // riepilogo generale sul periodo + tutorato selezionato (non sul filtro testo campionato).
  const rGen = _riepilogoTutoraggi(tutte);
  document.getElementById("tutoraggi-n-gare").textContent = rGen.n;
  document.getElementById("tutoraggi-media-km").textContent = rGen.n ? `${formattaNumero(rGen.mediaKmTutor)} km` : "-";
  document.getElementById("tutoraggi-km-tutor-totali").textContent = `${formattaNumero(rGen.kmTutorTotali)} km`;

  const gruppi = {};
  tutte.forEach(r => {
    const chiave = r.campionato || "—";
    (gruppi[chiave] = gruppi[chiave] || []).push(r);
  });
  let campionati = Object.entries(gruppi).map(([nome, righe]) => ({ nome, righe, ..._riepilogoTutoraggi(righe) }));
  if (filtro) campionati = campionati.filter(c => c.nome.toLowerCase().includes(filtro));
  campionati.sort((a, b) => b.n - a.n);
  window._tutoraggiPerCampionato = campionati;
  _renderGraficiTutoraggi(tutte, campionati);

  const tbody = document.getElementById("tabella-tutoraggi");
  const vuoto = document.getElementById("stato-vuoto-tutoraggi");
  if (campionati.length === 0) {
    tbody.innerHTML = "";
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";
  tbody.innerHTML = campionati.map((c, i) => `
    <tr class="riga-cliccabile" style="cursor:pointer" onclick="apriDettaglioTutoraggiCampionato(${i})">
      <td>${c.nome}</td>
      <td>${c.n}</td>
      <td>${c.mediaKmTutor} km</td>
      <td>${c.kmTutorTotali} km</td>
    </tr>
  `).join("");
}

// stesso requisito del banner in Designazioni: il tutoraggio è concluso con almeno 5 gare
// e almeno 3 tutor diversi
const GARE_TUTORAGGIO_RICHIESTE = 5;
const TUTOR_DIVERSI_RICHIESTI_REPORT = 3;

function _renderGraficiTutoraggi(righe, campionati) {
  const perTutorato = {};
  righe.forEach(r => {
    const { tutor, tutorato } = _ruoliTutoraggio(r);
    if (!tutorato) return;
    const t = perTutorato[tutorato] = perTutorato[tutorato] || { n: 0, tutor: new Set() };
    t.n++;
    if (tutor) t.tutor.add(tutor);
  });
  const tutorati = Object.entries(perTutorato).map(([nome, t]) => ({
    nome, n: t.n, tutor: [...t.tutor].sort(),
    completato: t.n >= GARE_TUTORAGGIO_RICHIESTE && t.tutor.size >= TUTOR_DIVERSI_RICHIESTI_REPORT,
  })).sort((a, b) => (a.completato - b.completato) || (b.n - a.n));

  const nCompletati = tutorati.filter(t => t.completato).length;
  document.getElementById("tutoraggi-n-tutorati").textContent = formattaNumero(tutorati.length);
  document.getElementById("tutoraggi-n-completati").textContent = tutorati.length
    ? `${nCompletati} con tutoraggio completato`
    : "";

  const select = document.getElementById("tutoraggi-filtro-tutorato");
  graficoBarre(document.getElementById("grafico-tutoraggi-tutorati"), tutorati.map(t => {
    const mancanoGare = Math.max(0, GARE_TUTORAGGIO_RICHIESTE - t.n);
    const mancanoTutor = Math.max(0, TUTOR_DIVERSI_RICHIESTI_REPORT - t.tutor.length);
    const stato = t.completato
      ? "Tutoraggio completato"
      : `Mancano ${[mancanoGare ? `${mancanoGare} gare` : "", mancanoTutor ? `${mancanoTutor} tutor diversi` : ""].filter(Boolean).join(" e ")}`;
    return {
      etichetta: t.nome,
      valore: t.n,
      testo: `${t.n} gare · ${t.tutor.length} tutor`,
      tenue: t.completato,
      colore: t.completato ? "var(--serie-1-tenue)" : undefined,
      dettaglio: `Tutor: ${t.tutor.join(", ") || "-"}\n${stato}`,
      onClick: () => { select.value = select.value === t.nome ? "" : t.nome; renderTutoraggi(); },
    };
  }), {
    spazioValore: 104,
    massimoRighe: 15,
    riferimento: { valore: GARE_TUTORAGGIO_RICHIESTE, etichetta: "Obiettivo gare" },
    vuoto: "Nessun arbitro tutorato nel periodo",
  });

  graficoBarre(document.getElementById("grafico-tutoraggi-campionati"), campionati.map((c, i) => ({
    etichetta: c.nome,
    valore: c.n,
    testo: `${c.n} gare`,
    dettaglio: `Media km tutor: ${formattaNumero(c.mediaKmTutor)} km\nKm tutor totali: ${formattaNumero(c.kmTutorTotali)} km`,
    onClick: () => apriDettaglioTutoraggiCampionato(i),
  })), { spazioValore: 72, massimoRighe: 12, vuoto: "Nessuna gara in tutoraggio nel periodo" });
}

function apriDettaglioTutoraggiCampionato(indice) {
  const gruppo = (window._tutoraggiPerCampionato || [])[indice];
  if (!gruppo) return;
  document.getElementById("titolo-modale-dettaglio-tutoraggi").textContent = `Tutoraggi — ${gruppo.nome}`;
  document.getElementById("tabella-dettaglio-tutoraggi").innerHTML = gruppo.righe.map(r => {
    const { tutor, comuneTutor, kmTutor, tutorato, comuneTutorato } = _ruoliTutoraggio(r);
    return `
      <tr>
        <td style="white-space:nowrap">${formattaData(r.data)}</td>
        <td>${r.numero_gara || "-"}</td>
        <td>${r.squadra_casa} vs ${r.squadra_ospite}</td>
        <td>${r.localita || "-"}</td>
        <td>${tutor}</td>
        <td>${comuneTutor || "-"}</td>
        <td>${kmTutor != null ? kmTutor + " km" : "-"}</td>
        <td>${tutorato}</td>
        <td>${comuneTutorato || "-"}</td>
      </tr>
    `;
  }).join("");
  openOverlay("modale-dettaglio-tutoraggi");
}

document.getElementById("filtro-tutoraggi").addEventListener("input", renderTutoraggi);
document.getElementById("tutoraggi-data-da").addEventListener("change", caricaReportTutoraggi);
document.getElementById("tutoraggi-data-a").addEventListener("change", caricaReportTutoraggi);
