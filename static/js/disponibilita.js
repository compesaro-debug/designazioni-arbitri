// Formatta una Date locale come stringa ISO aaaa-mm-gg senza passare per l'UTC
// (evita lo sfasamento di un giorno che darebbe toISOString() in fusi orari != UTC).
function _isoLocale(d) {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, "0");
  const giorno = String(d.getDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

function _elencoDateInIntervallo(dal, al) {
  const date = [];
  let corrente = new Date(dal + "T00:00:00");
  const fine = new Date(al + "T00:00:00");
  while (corrente <= fine) {
    date.push(_isoLocale(corrente));
    corrente.setDate(corrente.getDate() + 1);
  }
  return date;
}

function _formattaGiornoBreve(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function _nomeGiornoBreve(iso) {
  const giorni = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  return giorni[new Date(iso + "T00:00:00").getDay()];
}

function _normDisp(s) {
  return (s || "").trim().toLowerCase();
}

function _conflittoGiorno(nomeArbitro, giorno) {
  const nomeNorm = _normDisp(nomeArbitro);
  return (window._dispIndisponibilita || []).find(ind =>
    _normDisp(ind.arbitro) === nomeNorm && ind.data_inizio <= giorno && giorno <= ind.data_fine
  );
}

// tutti i periodi di indisponibilità di un arbitro che toccano quel giorno (di solito uno solo,
// ma sono possibili sovrapposizioni).
function _periodiGiorno(nomeArbitro, giorno) {
  const nomeNorm = _normDisp(nomeArbitro);
  return (window._dispIndisponibilita || []).filter(ind =>
    _normDisp(ind.arbitro) === nomeNorm && ind.data_inizio <= giorno && giorno <= ind.data_fine
  );
}

// Stessa logica di app.py:_classifica_giorno — "totale" se il giorno è bloccato per intero da
// almeno un periodo, "parziale" se lo è solo in parte (es. solo la sera), null se disponibile.
function _classificaGiornoDisp(giornoIso, periodi) {
  let stato = null;
  for (const p of periodi) {
    const primoGiorno = p.data_inizio === giornoIso;
    const ultimoGiorno = p.data_fine === giornoIso;
    let pieno;
    if (primoGiorno && ultimoGiorno) {
      pieno = (!p.ora_inizio || p.ora_inizio <= "00:00") && (!p.ora_fine || p.ora_fine >= "23:59");
    } else if (primoGiorno) {
      pieno = !p.ora_inizio || p.ora_inizio <= "00:00";
    } else if (ultimoGiorno) {
      pieno = !p.ora_fine || p.ora_fine >= "23:59";
    } else {
      pieno = true;
    }
    if (pieno) return "totale";
    stato = "parziale";
  }
  return stato;
}

async function cercaDisponibilita() {
  const dal = document.getElementById("disp-dal").value;
  const al = document.getElementById("disp-al").value;
  if (!dal || !al) {
    alert("Imposta sia la data Dal che la data Al.");
    return;
  }
  if (dal > al) {
    alert("La data Dal deve essere precedente o uguale alla data Al.");
    return;
  }

  const giorni = _elencoDateInIntervallo(dal, al);
  if (giorni.length > 62 && !confirm(`L'intervallo scelto copre ${giorni.length} giorni: la tabella sarà molto larga. Continuare?`)) {
    return;
  }

  const [arbitri, indisponibilita] = await Promise.all([apiGet("/api/arbitri"), apiGet("/api/indisponibilita")]);
  window._dispGiorni = giorni;
  window._dispArbitri = arbitri;
  window._dispIndisponibilita = indisponibilita;

  costruisciHeaderDisponibilita(giorni);
  renderTabellaDisponibilita();
  document.getElementById("stato-vuoto-disponibilita").style.display = "none";
}

function costruisciHeaderDisponibilita(giorni) {
  const thead = document.getElementById("tabella-head-disponibilita");
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  tr.innerHTML = `<th>Arbitro</th><th>Ruolo</th><th>Comune</th>` +
    giorni.map(g => `<th>${_nomeGiornoBreve(g)}<br>${_formattaGiornoBreve(g)}</th>`).join("");
  thead.appendChild(tr);

  document.getElementById("tabella-disponibilita-el").style.minWidth = `${320 + giorni.length * 64}px`;
  abilitaRidimensionamentoColonne("#tabella-disponibilita-el");
  rendiHeaderFisso("#tabella-head-disponibilita");
  abilitaSelettoreColonne("#tabella-disponibilita-el", document.getElementById("colonne-disponibilita"), { persisti: false });
}

function renderTabellaDisponibilita() {
  const filtro = (document.getElementById("disp-filtro-arbitro").value || "").trim().toLowerCase();
  const tbody = document.getElementById("tabella-disponibilita");
  tbody.innerHTML = "";
  const giorni = window._dispGiorni || [];

  const arbitri = (window._dispArbitri || []).filter(a =>
    !filtro || a.cognome_nome.toLowerCase().includes(filtro) || (a.comune || "").toLowerCase().includes(filtro)
  );

  arbitri.forEach(a => {
    const tr = document.createElement("tr");
    let celle = `<td>${a.cognome_nome}</td><td>${a.ruolo}</td><td>${a.comune}</td>`;
    giorni.forEach(g => {
      const periodi = _periodiGiorno(a.cognome_nome, g);
      const stato = periodi.length ? _classificaGiornoDisp(g, periodi) : null;
      if (stato === "totale") {
        celle += `<td class="cella-non-disp" title="${periodi[0].motivo || "Non disponibile"}" onclick="mostraDettaglioIndisponibilita(${periodi[0].id})">✕</td>`;
      } else if (stato === "parziale") {
        celle += `<td class="cella-parz-disp" title="${periodi[0].motivo || "Non disponibile solo in parte della giornata"}" onclick="mostraDettaglioIndisponibilita(${periodi[0].id})">◐</td>`;
      } else {
        celle += `<td class="cella-disp">✓</td>`;
      }
    });
    tr.innerHTML = celle;
    tbody.appendChild(tr);
  });
}

function mostraDettaglioIndisponibilita(id) {
  const ind = (window._dispIndisponibilita || []).find(i => i.id === id);
  if (!ind) return;
  document.getElementById("dettaglio-indisp-arbitro").textContent = ind.arbitro;
  document.getElementById("dettaglio-indisp-dal").textContent =
    `${formattaData(ind.data_inizio)}${ind.ora_inizio ? " " + ind.ora_inizio : ""}`;
  document.getElementById("dettaglio-indisp-al").textContent =
    `${formattaData(ind.data_fine)}${ind.ora_fine ? " " + ind.ora_fine : ""}`;
  document.getElementById("dettaglio-indisp-motivo").textContent = ind.motivo || "";
  document.getElementById("dettaglio-indisp-richiesta").textContent = ind.data_richiesta || "";
  openOverlay("modale-dettaglio-indisponibilita");
}

document.getElementById("disp-filtro-arbitro").addEventListener("input", renderTabellaDisponibilita);

// precompila un intervallo comodo di default (oggi + 7 giorni)
(function precompila() {
  const oggi = new Date();
  const fra7 = new Date();
  fra7.setDate(oggi.getDate() + 7);
  document.getElementById("disp-dal").value = _isoLocale(oggi);
  document.getElementById("disp-al").value = _isoLocale(fra7);
})();
