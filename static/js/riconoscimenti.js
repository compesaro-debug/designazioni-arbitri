let _stagioneRiconoscimentiId = "";

function _testoNomi(badge) {
  return badge.nomi.length ? badge.nomi.join(", ") : "Nessuno";
}

async function caricaSelettoreStagioneRiconoscimenti() {
  const stagioni = await apiGet("/api/stagioni");
  const select = document.getElementById("selettore-stagione-riconoscimenti");
  select.innerHTML = stagioni
    .map(s => `<option value="${s.dati_live ? "" : s.id}">${s.nome}${s.dati_live ? " (corrente)" : ""}</option>`)
    .join("");
  _stagioneRiconoscimentiId = "";
}

function cambiaStagioneRiconoscimenti() {
  _stagioneRiconoscimentiId = document.getElementById("selettore-stagione-riconoscimenti").value;
  caricaRiconoscimenti();
}

async function caricaRiconoscimenti() {
  const suffisso = _stagioneRiconoscimentiId ? `?stagione_id=${_stagioneRiconoscimentiId}` : "";
  const dati = await apiGet(`/api/report/riconoscimenti${suffisso}`);

  document.getElementById("badge-maratoneta-nomi").textContent = _testoNomi(dati.maratoneta);
  document.getElementById("badge-maratoneta-valore").textContent = dati.maratoneta.valore != null ? `${dati.maratoneta.valore} km` : "";

  document.getElementById("badge-jolly_campionati-nomi").textContent = _testoNomi(dati.jolly_campionati);
  document.getElementById("badge-jolly_campionati-valore").textContent = dati.jolly_campionati.valore != null ? `${dati.jolly_campionati.valore} campionati` : "";

  document.getElementById("badge-jolly_societa-nomi").textContent = _testoNomi(dati.jolly_societa);
  document.getElementById("badge-jolly_societa-valore").textContent = dati.jolly_societa.valore != null ? `${dati.jolly_societa.valore} società` : "";

  document.getElementById("badge-roccia-nomi").textContent = _testoNomi(dati.roccia);

  document.getElementById("badge-sempre_disponibile-nomi").textContent = _testoNomi(dati.sempre_disponibile);
  document.getElementById("badge-sempre_disponibile-valore").textContent = dati.sempre_disponibile.valore != null ? `${dati.sempre_disponibile.valore}% disponibilità` : "";

  document.getElementById("badge-rookie-nomi").textContent = _testoNomi(dati.rookie);
  document.getElementById("badge-rookie-valore").textContent = dati.rookie.valore != null ? `+${dati.rookie.valore} gare/mese` : "";

  document.getElementById("badge-in_frenata-nomi").textContent = _testoNomi(dati.in_frenata);
  document.getElementById("badge-in_frenata-valore").textContent = dati.in_frenata.valore != null ? `${dati.in_frenata.valore} gare/mese` : "";

  document.getElementById("badge-local_hero-nomi").textContent = _testoNomi(dati.local_hero);
  document.getElementById("badge-local_hero-valore").textContent = dati.local_hero.valore != null ? `${dati.local_hero.valore} gare a 0 km` : "";

  document.getElementById("badge-globetrotter-nomi").textContent = _testoNomi(dati.globetrotter);
  document.getElementById("badge-globetrotter-valore").textContent = dati.globetrotter.valore != null ? `${dati.globetrotter.valore} comuni` : "";

  document.getElementById("badge-viaggio_estremo-nomi").textContent = _testoNomi(dati.viaggio_estremo);
  document.getElementById("badge-viaggio_estremo-valore").textContent = dati.viaggio_estremo.valore != null ? `${dati.viaggio_estremo.valore} km` : "";

  document.getElementById("badge-instancabile-nomi").textContent = _testoNomi(dati.instancabile);
  document.getElementById("badge-instancabile-valore").textContent = dati.instancabile.valore != null ? `${dati.instancabile.valore} gare` : "";

  document.getElementById("badge-direttore-nomi").textContent = _testoNomi(dati.direttore);
  document.getElementById("badge-direttore-valore").textContent = dati.direttore.valore != null ? `${dati.direttore.valore} gare` : "";

  document.getElementById("badge-spalla_di_ferro-nomi").textContent = _testoNomi(dati.spalla_di_ferro);
  document.getElementById("badge-spalla_di_ferro-valore").textContent = dati.spalla_di_ferro.valore != null ? `${dati.spalla_di_ferro.valore} gare` : "";

  document.getElementById("badge-veterano-nomi").textContent = _testoNomi(dati.veterano);
  document.getElementById("badge-veterano-valore").textContent = dati.veterano.valore != null ? `dal ${dati.veterano.valore}` : "";

  document.getElementById("badge-new_entry-nomi").textContent = _testoNomi(dati.new_entry);
  document.getElementById("badge-new_entry-valore").textContent = dati.new_entry.valore != null ? `dal ${dati.new_entry.valore}` : "";
}

caricaSelettoreStagioneRiconoscimenti();
caricaRiconoscimenti();
