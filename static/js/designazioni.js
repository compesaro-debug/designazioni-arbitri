let filtriDesignazioni = {};
let ordinamentoDesignazioni = { campo: null, direzione: "asc" };
let ordinamentoCandidati = { campo: null, direzione: "asc" };

// Colonne della griglia candidati che hanno un testo lungo e vanno mostrate su due righe.
const COLONNE_DUE_RIGHE_CANDIDATI = ["note", "indisp_motivo"];

async function caricaPartiteDesignazioni() {
  const partite = await apiGet("/api/partite?disputata=0");
  window._partiteDesignazioniCache = partite;
  renderTabellaDesignazioni();
  renderVistaGiornaliera();
}

// ---------- VISTA GIORNALIERA (riquadri raggruppati per giorno) ----------

function cambiaVistaDesignazioni(vista) {
  document.querySelectorAll(".tabs .tab-btn[data-vista]").forEach(b => b.classList.toggle("active", b.dataset.vista === vista));
  document.getElementById("vista-giornaliera-designazioni").style.display = vista === "giornaliera" ? "" : "none";
  document.getElementById("vista-tabella-designazioni").style.display = vista === "tabella" ? "" : "none";
}

const NOMI_GIORNI_SETTIMANA = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const NOMI_MESI_ESTESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function _titoloGiorno(dataIso) {
  const d = new Date(`${dataIso}T00:00:00`);
  const giornoSettimana = NOMI_GIORNI_SETTIMANA[(d.getDay() + 6) % 7];
  return `${giornoSettimana} ${d.getDate()} ${NOMI_MESI_ESTESI[d.getMonth()]} ${d.getFullYear()}`;
}

function _riquadroRuolo(p, campo, etichetta) {
  const nome = p[campo];
  if (nome) {
    return `
      <div class="riquadro-designazione-ruolo assegnato">
        <span class="riquadro-designazione-ruolo-etichetta">${etichetta}</span>
        <span class="riquadro-designazione-ruolo-nome">${nome}</span>
        <button class="btn-rimuovi-x" title="Rimuovi ${etichetta}" onclick="rimuoviArbitro(${p.id}, '${campo}')">&times;</button>
      </div>`;
  }
  return `
    <div class="riquadro-designazione-ruolo">
      <span class="riquadro-designazione-ruolo-etichetta">${etichetta}</span>
      <button class="btn btn-primary" style="padding:4px 10px;font-size:12px" onclick="apriModaleDesignazione(${p.id}, '${campo}')">Designa</button>
    </div>`;
}

function renderVistaGiornaliera() {
  const filtro = (document.getElementById("filtro-giornaliera-designazioni").value || "").trim().toLowerCase();
  const contenitore = document.getElementById("giorni-designazioni");
  const vuoto = document.getElementById("stato-vuoto-giornaliera");

  const tutte = window._partiteDesignazioniCache || [];
  if (tutte.length === 0) {
    contenitore.innerHTML = "";
    vuoto.style.display = "block";
    return;
  }

  const partite = tutte.filter(p => !filtro
    || (p.squadra_casa || "").toLowerCase().includes(filtro)
    || (p.squadra_ospite || "").toLowerCase().includes(filtro)
    || (p.campionato || "").toLowerCase().includes(filtro)
  );

  if (partite.length === 0) {
    contenitore.innerHTML = "";
    vuoto.style.display = "block";
    vuoto.querySelector("strong").textContent = "Nessun risultato";
    return;
  }
  vuoto.style.display = "none";

  const perGiorno = {};
  partite.forEach(p => {
    (perGiorno[p.data] = perGiorno[p.data] || []).push(p);
  });
  const giorniOrdinati = Object.keys(perGiorno).sort();

  contenitore.innerHTML = giorniOrdinati.map(giorno => {
    const gare = perGiorno[giorno].slice().sort((a, b) => (a.ora || "").localeCompare(b.ora || ""));
    const nDesignate = gare.filter(p => p.arbitro && p.assistente1).length;
    const nParziali = gare.filter(p => (p.arbitro || p.assistente1) && !(p.arbitro && p.assistente1)).length;
    const percentuale = Math.round((nDesignate / gare.length) * 100);
    const classeBarra = nDesignate === gare.length ? "completa" : nDesignate === 0 && nParziali === 0 ? "vuota" : "parziale";

    return `
      <div class="giorno-designazioni">
        <div class="giorno-designazioni-header">
          <span class="giorno-designazioni-titolo">${_titoloGiorno(giorno)}</span>
          <span class="giorno-designazioni-riepilogo">
            ${gare.length} gare · ${nDesignate} designate completamente
            <span class="giorno-designazioni-barra"><span class="giorno-designazioni-barra-riempimento ${classeBarra}" style="width:${percentuale}%"></span></span>
          </span>
        </div>
        <div class="riquadri-designazioni-grid">
          ${gare.map(p => `
            <div class="riquadro-designazione">
              <div class="riquadro-designazione-testata">
                <span class="riquadro-designazione-campionato">${p.campionato}${p.numero_gara ? " · n° " + p.numero_gara : ""}</span>
                <span class="riquadro-designazione-ora">${p.ora || "-"}</span>
              </div>
              <div class="riquadro-designazione-squadre">${p.squadra_casa} <span class="riquadro-designazione-vs">vs</span> ${p.squadra_ospite}</div>
              <div class="riquadro-designazione-luogo">${p.localita || ""}${p.campo ? " — " + p.campo : ""}</div>
              <div class="riquadro-designazione-ruoli">
                ${_riquadroRuolo(p, "arbitro", "Arbitro")}
                ${_riquadroRuolo(p, "assistente1", "2° Arbitro")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("filtro-giornaliera-designazioni").addEventListener("input", renderVistaGiornaliera);

function cellaArbitro(p, campo, etichetta) {
  const nome = p[campo];
  const rimuovi = nome ? `<button class="btn-rimuovi-x" title="Rimuovi ${etichetta}" onclick="rimuoviArbitro(${p.id}, '${campo}')">&times;</button>` : "";
  const designaBtn = `<button class="btn-storico-inline" onclick="apriModaleDesignazione(${p.id}, '${campo}')">designa</button>`;
  return `<td style="white-space:nowrap">${nome || "-"}${rimuovi} ${designaBtn}</td>`;
}

function renderTabellaDesignazioni() {
  const partite = applicaFiltriOrdinamento(window._partiteDesignazioniCache || [], filtriDesignazioni, ordinamentoDesignazioni, "#tabella-head-designazioni");
  const tbody = document.getElementById("tabella-designazioni");
  const vuoto = document.getElementById("stato-vuoto-designazioni");
  tbody.innerHTML = "";

  if (partite.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  partite.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formattaData(p.data)}</td>
      <td>${p.ora}</td>
      <td>${p.campionato}</td>
      <td>${p.numero_gara}</td>
      <td>${p.localita}</td>
      <td>${p.campo}</td>
      <td>${p.aff_a}</td>
      <td>${p.squadra_casa}</td>
      <td>${p.aff_b}</td>
      <td>${p.squadra_ospite}</td>
      ${cellaArbitro(p, "arbitro", "arbitro")}
      ${cellaArbitro(p, "assistente1", "2° Arbitro")}
    `;
    tbody.appendChild(tr);
  });
}

async function rimuoviArbitro(partitaId, campo) {
  const partita = window._partiteDesignazioniCache.find(p => p.id === partitaId);
  if (!partita) return;
  const aggiornata = { ...partita, [campo]: "" };
  await apiSend(`/api/partite/${partitaId}`, "PUT", aggiornata);
  caricaPartiteDesignazioni();
}

async function apriModaleDesignazione(partitaId, ruolo) {
  const partita = window._partiteDesignazioniCache.find(p => p.id === partitaId);
  if (!partita) return;
  window._partitaDaDesignare = partita;
  window._ruoloDaDesignare = ruolo || "arbitro";
  const etichettaRuolo = window._ruoloDaDesignare === "assistente1" ? "2° Arbitro" : "Arbitro";

  document.getElementById("titolo-modale-designazione").textContent =
    `Designa ${etichettaRuolo} — ${formattaData(partita.data)} ${partita.ora} · ${partita.campionato}, gara n° ${partita.numero_gara}`;
  document.getElementById("info-squadre-modale").innerHTML =
    `Casa: <strong>${partita.squadra_casa}</strong> <button class="btn-storico-inline" onclick="apriStoricoSquadra('casa')">storico</button>
     &nbsp;·&nbsp;
     Ospite: <strong>${partita.squadra_ospite}</strong> <button class="btn-storico-inline" onclick="apriStoricoSquadra('ospite')">storico</button>
     &nbsp;·&nbsp;
     <button class="btn-storico-inline" onclick="apriRiepilogoAssociati()">Riepilogo associati</button>`;
  document.getElementById("filtro-candidati").value = "";
  document.getElementById("tabella-candidati").innerHTML = "";
  openOverlay("modale-designazione");
  rendiHeaderFisso("#tabella-head-candidati");

  const candidati = await apiGet(`/api/designazioni/candidati/${partitaId}?ruolo=${window._ruoloDaDesignare}`);
  window._candidatiCache = candidati;
  renderCandidati();
}

// ---------- FILTRI AVANZATI CANDIDATI (testo / numero / data con operatori) ----------

function leggiFiltriCandidati() {
  const filtri = {};
  document.querySelectorAll("#riga-filtri-candidati .filtro-input[data-tipo='testo']").forEach(input => {
    filtri[input.dataset.campo] = { tipo: "testo", valore: input.value.trim().toLowerCase() };
  });
  document.querySelectorAll("#riga-filtri-candidati .filtro-operatore").forEach(sel => {
    const campo = sel.dataset.campo;
    const tipo = sel.dataset.tipo;
    const v1el = document.querySelector(`.filtro-valore[data-campo="${campo}"]`);
    const v2el = document.querySelector(`.filtro-valore2[data-campo="${campo}"]`);
    filtri[campo] = { tipo, operatore: sel.value, v1: v1el ? v1el.value : "", v2: v2el ? v2el.value : "" };
  });
  return filtri;
}

function passaFiltroCandidato(riga, campo, filtro) {
  if (filtro.tipo === "testo") {
    if (!filtro.valore) return true;
    return String(riga[campo] ?? "").toLowerCase().includes(filtro.valore);
  }
  if (!filtro.operatore) return true;
  const grezzo = riga[campo];
  if (filtro.operatore === "tra") {
    if (!filtro.v1 || !filtro.v2) return true;
    if (grezzo === "" || grezzo === null || grezzo === undefined) return false;
    if (filtro.tipo === "numero") {
      const val = Number(grezzo);
      return val >= Number(filtro.v1) && val <= Number(filtro.v2);
    }
    return grezzo >= filtro.v1 && grezzo <= filtro.v2;
  }
  if (!filtro.v1) return true;
  if (grezzo === "" || grezzo === null || grezzo === undefined) return false;
  if (filtro.tipo === "numero") {
    const val = Number(grezzo);
    const rif = Number(filtro.v1);
    if (filtro.operatore === "=") return val === rif;
    if (filtro.operatore === "<") return val < rif;
    if (filtro.operatore === "<=") return val <= rif;
    if (filtro.operatore === ">") return val > rif;
    if (filtro.operatore === ">=") return val >= rif;
    return true;
  }
  // data (confronto diretto su stringhe ISO aaaa-mm-gg, ordinabili lessicograficamente)
  if (filtro.operatore === "=") return grezzo === filtro.v1;
  if (filtro.operatore === "<") return grezzo < filtro.v1;
  if (filtro.operatore === ">") return grezzo > filtro.v1;
  return true;
}

function applicaFiltriCandidati(righe, filtri) {
  return righe.filter(riga => Object.entries(filtri).every(([campo, f]) => passaFiltroCandidato(riga, campo, f)));
}

function ordinaCandidati(righe) {
  const campo = ordinamentoCandidati.campo;
  const isNumero = campo && !!document.querySelector(`.filtro-operatore[data-campo="${campo}"][data-tipo="numero"]`);
  const dir = ordinamentoCandidati.direzione === "asc" ? 1 : -1;
  return [...righe].sort((a, b) => {
    // i non disponibili restano sempre in fondo, qualunque sia il filtro o l'ordinamento scelto
    if (!!a.disponibile !== !!b.disponibile) return a.disponibile ? -1 : 1;

    if (!campo) return 0;
    let va = a[campo];
    let vb = b[campo];
    if (isNumero) {
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

function azzeraFiltriCandidati() {
  document.querySelectorAll("#riga-filtri-candidati .filtro-input").forEach(el => { el.value = ""; });
  document.querySelectorAll("#riga-filtri-candidati .filtro-operatore").forEach(el => { el.value = ""; });
  document.querySelectorAll("#riga-filtri-candidati .filtro-valore, #riga-filtri-candidati .filtro-valore2").forEach(el => { el.value = ""; });
  document.querySelectorAll("#riga-filtri-candidati .filtro-valore2").forEach(el => { el.style.display = "none"; });
  document.getElementById("filtro-candidati").value = "";
  renderCandidati();
}

function cellaConteggio(valore, arbitroId, tipo) {
  if (!valore) return valore || "";
  return `<button class="btn-storico-inline" onclick="apriDettaglioConteggio(${arbitroId}, '${tipo}')">${valore}</button>`;
}

const ETICHETTE_DETTAGLIO_CONTEGGIO = {
  casa_cod: "gare dirette per la squadra di casa (per codice affiliazione)",
  casa_nome: "gare dirette per la squadra di casa (per campionato + nome squadra)",
  osp_cod: "gare dirette per la squadra ospite (per codice affiliazione)",
  osp_nome: "gare dirette per la squadra ospite (per campionato + nome squadra)",
};

async function apriDettaglioConteggio(arbitroId, tipo) {
  const candidato = (window._candidatiCache || []).find(c => c.id === arbitroId);
  if (!candidato || !window._partitaDaDesignare) return;
  const dati = await apiGet(`/api/designazioni/dettaglio-conteggio?partita_id=${window._partitaDaDesignare.id}&nome=${encodeURIComponent(candidato.nome)}&tipo=${tipo}`);
  document.getElementById("riepilogo-storico").style.display = "none";
  mostraStorico(`${candidato.nome} — ${ETICHETTE_DETTAGLIO_CONTEGGIO[tipo]} (${dati.length})`, dati, false);
}

function renderCandidati() {
  const filtroRapido = document.getElementById("filtro-candidati").value.trim().toLowerCase();
  const filtriColonna = leggiFiltriCandidati();
  const tbody = document.getElementById("tabella-candidati");
  tbody.innerHTML = "";

  let candidati = (window._candidatiCache || []).filter(c =>
    !filtroRapido || c.nome.toLowerCase().includes(filtroRapido) || (c.comune || "").toLowerCase().includes(filtroRapido)
  );
  candidati = applicaFiltriCandidati(candidati, filtriColonna);
  candidati = ordinaCandidati(candidati);

  candidati.forEach(c => {
    const tr = document.createElement("tr");
    if (!c.disponibile) tr.classList.add("riga-non-disponibile");
    else if (c.designato_oggi) tr.classList.add("riga-designato-oggi");
    else if (c.inibito) tr.classList.add("riga-inibito");
    const dalle = c.indisp_dal_data ? `${formattaData(c.indisp_dal_data)}${c.indisp_dal_ora ? " " + c.indisp_dal_ora : ""}` : "";
    const alle = c.indisp_al_data ? `${formattaData(c.indisp_al_data)}${c.indisp_al_ora ? " " + c.indisp_al_ora : ""}` : "";
    const designatoOggi = c.designato_oggi ? `Designato per: ${c.designato_info}` : "";
    tr.innerHTML = `
      <td class="cella-nome-candidato">${c.nome} <button class="btn-storico-icona" title="Storico ${c.nome}" onclick="apriStoricoArbitroId(${c.id})"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg></button></td>
      <td>${c.ruolo}</td>
      <td>${c.comune}</td>
      <td>${c.distanza_km != null ? c.distanza_km + " km" : "-"}</td>
      <td>${designatoOggi}</td>
      <td>${cellaConteggio(c.n_casa_codice, c.id, "casa_cod")}</td>
      <td>${cellaConteggio(c.n_casa_nome, c.id, "casa_nome")}</td>
      <td>${cellaConteggio(c.n_osp_codice, c.id, "osp_cod")}</td>
      <td>${cellaConteggio(c.n_osp_nome, c.id, "osp_nome")}</td>
      <td>${cellaConteggio(formattaData(c.ultima_designazione_casa), c.id, "casa_cod")}</td>
      <td>${cellaConteggio(formattaData(c.ultima_designazione_ospite), c.id, "osp_cod")}</td>
      <td>${dalle}</td>
      <td>${alle}</td>
      <td><div class="due-righe-interno">${c.indisp_motivo}</div></td>
      <td><div class="due-righe-interno">${c.note}</div></td>
      <td><div class="due-righe-interno">${c.inibizione}</div></td>
      <td><button class="btn btn-primary" style="padding:5px 10px;font-size:12px" onclick="designaArbitro(${c.id})">Designa</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- STORICO (arbitro / squadra / gare designate) ----------

function mostraStorico(titolo, righe, mostraStato) {
  document.getElementById("titolo-modale-storico").textContent = titolo;
  document.getElementById("col-stato-storico").style.display = mostraStato ? "" : "none";
  const mostraRuolo = righe.length > 0 && righe[0].ruolo_designazione !== undefined;
  document.getElementById("col-ruolo-storico").style.display = mostraRuolo ? "" : "none";
  const tbody = document.getElementById("tabella-storico");
  tbody.innerHTML = "";
  if (righe.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--testo-tenue)">Nessuna gara trovata</td></tr>`;
  } else {
    righe.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formattaData(r.data)}</td>
        <td>${r.campionato}</td>
        <td>${r.girone}</td>
        <td>${r.numero_gara}</td>
        <td>${r.squadra_casa}</td>
        <td>${r.squadra_ospite}</td>
        <td>${r.risultato}</td>
        <td>${r.arbitro}</td>
        <td>${r.assistente1 || ""}</td>
        ${mostraRuolo ? `<td>${r.ruolo_designazione}</td>` : `<td style="display:none"></td>`}
        ${mostraStato ? `<td>${r.stato}</td>` : `<td style="display:none"></td>`}
      `;
      tbody.appendChild(tr);
    });
  }
  openOverlay("modale-storico");
}

function _impostaTileUltimaGara(idBottone, valoreData, arbitroId, tipo) {
  const bottone = document.getElementById(idBottone);
  bottone.querySelector(".riepilogo-valore-piccolo").textContent = valoreData ? formattaData(valoreData) : "-";
  bottone.onclick = () => apriDettaglioConteggio(arbitroId, tipo);
}

async function apriStoricoArbitroId(arbitroId) {
  const candidato = (window._candidatiCache || []).find(c => c.id === arbitroId);
  if (!candidato) return;
  window._arbitroStoricoCorrente = candidato.nome;

  _impostaTileUltimaGara("riepilogo-ultima-casa-nome-btn", candidato.ultima_designazione_casa_nome, arbitroId, "casa_nome");
  _impostaTileUltimaGara("riepilogo-ultima-casa-cod-btn", candidato.ultima_designazione_casa, arbitroId, "casa_cod");
  _impostaTileUltimaGara("riepilogo-ultima-osp-nome-btn", candidato.ultima_designazione_ospite_nome, arbitroId, "osp_nome");
  _impostaTileUltimaGara("riepilogo-ultima-osp-cod-btn", candidato.ultima_designazione_ospite, arbitroId, "osp_cod");

  const riepilogo = await apiGet(`/api/designazioni/riepilogo-arbitro?nome=${encodeURIComponent(candidato.nome)}`);
  document.getElementById("riepilogo-storico").style.display = "flex";
  document.getElementById("riepilogo-15gg").textContent = riepilogo.gare_15gg;
  document.getElementById("riepilogo-mese").textContent = riepilogo.gare_mese;
  document.getElementById("riepilogo-anno").textContent = riepilogo.gare_anno;

  const gare = await apiGet(`/api/designazioni/gare-designate?nome=${encodeURIComponent(candidato.nome)}`);
  mostraStorico(`Storico ${candidato.nome} (${gare.length} gare designate)`, gare, true);
}

async function apriStoricoSquadra(lato) {
  document.getElementById("riepilogo-storico").style.display = "none";
  const partita = window._partitaDaDesignare;
  const squadra = lato === "casa" ? partita.squadra_casa : partita.squadra_ospite;
  const storico = await apiGet(`/api/designazioni/storico-squadra?campionato=${encodeURIComponent(partita.campionato)}&squadra=${encodeURIComponent(squadra)}`);
  mostraStorico(`Storico ${squadra} (ultime 10 gare)`, storico, false);
}

async function apriRiepilogoAssociati() {
  const partita = window._partitaDaDesignare;
  if (!partita) return;

  const [casa, ospite] = await Promise.all([
    apiGet(`/api/designazioni/riepilogo-associati?campionato=${encodeURIComponent(partita.campionato)}&squadra=${encodeURIComponent(partita.squadra_casa)}&aff=${encodeURIComponent(partita.aff_a || "")}`),
    apiGet(`/api/designazioni/riepilogo-associati?campionato=${encodeURIComponent(partita.campionato)}&squadra=${encodeURIComponent(partita.squadra_ospite)}&aff=${encodeURIComponent(partita.aff_b || "")}`),
  ]);

  document.getElementById("corpo-riepilogo-associati").innerHTML =
    _blocoRiepilogoAssociati("Casa", partita.squadra_casa, casa) +
    _blocoRiepilogoAssociati("Ospite", partita.squadra_ospite, ospite);

  openOverlay("modale-riepilogo-associati");
}

function _rigaRiepilogoAssociati(etichetta, dati) {
  if (!dati) {
    return `<p class="hint" style="margin:6px 0">${etichetta}: nessun codice di affiliazione disponibile per questa squadra.</p>`;
  }
  const nonValutabili = dati.n_gare - dati.n_gare_valutabili;
  return `
    <table style="width:100%; margin:6px 0 14px">
      <tbody>
        <tr><td>${etichetta} — gare disputate (totale)</td><td style="text-align:right"><strong>${dati.n_gare}</strong></td></tr>
        <tr><td>Dirette da federale</td><td style="text-align:right">${dati.n_federali} <span style="color:var(--testo-tenue)">(${dati.pct_federali}%)</span></td></tr>
        <tr><td>Dirette da Arbitro Associato</td><td style="text-align:right">${dati.n_associato} <span style="color:var(--testo-tenue)">(${dati.pct_associato}%)</span></td></tr>
        <tr><td>Ultima designazione federale</td><td style="text-align:right">${dati.ultima_designazione_federale ? formattaData(dati.ultima_designazione_federale) : "-"}</td></tr>
        ${nonValutabili > 0 ? `<tr><td colspan="2" class="hint" style="padding-top:4px">Di cui ${nonValutabili} in campionati non arbitrabili da associato (escluse dalle percentuali sopra)</td></tr>` : ""}
      </tbody>
    </table>
  `;
}

function _blocoRiepilogoAssociati(etichettaLato, nomeSquadra, dati) {
  return `
    <div class="form-field full">
      <p class="riepilogo-label" style="margin:10px 0 2px">${etichettaLato}: ${nomeSquadra}</p>
      <p class="hint" style="margin:0 0 4px">Per nome (alias campionato)</p>
      ${_rigaRiepilogoAssociati("Per nome", dati.per_nome)}
      <p class="hint" style="margin:0 0 4px">Per codice di affiliazione societaria</p>
      ${_rigaRiepilogoAssociati("Per codice", dati.per_codice)}
    </div>
  `;
}

async function designaArbitro(arbitroId) {
  const candidato = (window._candidatiCache || []).find(c => c.id === arbitroId);
  if (!candidato) return;
  const campo = window._ruoloDaDesignare || "arbitro";
  const partita = { ...window._partitaDaDesignare, [campo]: candidato.nome };
  await apiSend(`/api/partite/${partita.id}`, "PUT", partita);
  closeOverlay("modale-designazione");
  caricaPartiteDesignazioni();
}

// ---------- INIZIALIZZAZIONE ----------

document.getElementById("filtro-candidati").addEventListener("input", renderCandidati);
document.querySelectorAll("#riga-filtri-candidati .filtro-input").forEach(el => {
  el.addEventListener("input", renderCandidati);
});
document.querySelectorAll("#riga-filtri-candidati .filtro-operatore").forEach(sel => {
  sel.addEventListener("change", () => {
    const campo = sel.dataset.campo;
    const v2 = document.querySelector(`.filtro-valore2[data-campo="${campo}"]`);
    if (v2) v2.style.display = sel.value === "tra" ? "" : "none";
    renderCandidati();
  });
});
document.querySelectorAll("#riga-filtri-candidati .filtro-valore, #riga-filtri-candidati .filtro-valore2").forEach(el => {
  el.addEventListener("input", renderCandidati);
});

abilitaOrdinamento("#tabella-head-designazioni", ordinamentoDesignazioni, renderTabellaDesignazioni);
abilitaFiltri("#tabella-head-designazioni", filtriDesignazioni, renderTabellaDesignazioni);
abilitaRidimensionamentoColonne("#tabella-designazioni-el");
rendiHeaderFisso("#tabella-head-designazioni");
abilitaSelettoreColonne("#tabella-designazioni-el", document.getElementById("colonne-designazioni"));

abilitaOrdinamento("#tabella-head-candidati", ordinamentoCandidati, renderCandidati);
abilitaRidimensionamentoColonne("#tabella-candidati-el");
abilitaSelettoreColonne("#tabella-candidati-el", document.getElementById("colonne-candidati"));

caricaPartiteDesignazioni();
