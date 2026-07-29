let _stagioneSelezionataId = null;

async function caricaStagioni() {
  const stagioni = await apiGet("/api/stagioni");
  window._stagioniCache = stagioni;
  const select = document.getElementById("selettore-stagione-dati");
  select.innerHTML = stagioni.map(s => `<option value="${s.id}">${s.nome}${s.dati_live ? " (corrente)" : ""}</option>`).join("");

  const daSelezionare = stagioni.find(s => s.id === _stagioneSelezionataId) ? _stagioneSelezionataId : (stagioni.find(s => s.dati_live) || stagioni[0])?.id;
  select.value = daSelezionare;
  await selezionaStagione();
}

async function selezionaStagione() {
  const id = Number(document.getElementById("selettore-stagione-dati").value);
  _stagioneSelezionataId = id;
  const riepilogo = await apiGet(`/api/stagioni/${id}/riepilogo`);

  document.getElementById("card-stagione-live").style.display = riepilogo.dati_live ? "" : "none";
  document.getElementById("sezioni-stagione-storica").style.display = riepilogo.dati_live ? "none" : "";

  if (riepilogo.dati_live) {
    document.getElementById("live-n-partite").textContent = riepilogo.n_partite;
    document.getElementById("live-n-indisponibilita").textContent = riepilogo.n_indisponibilita;
    document.getElementById("live-n-campionati").textContent = riepilogo.n_campionati;
  } else {
    document.getElementById("storico-n-partite").textContent = riepilogo.n_partite;
    document.getElementById("storico-n-indisponibilita").textContent = riepilogo.n_indisponibilita;
    document.getElementById("storico-n-campionati").textContent = riepilogo.n_campionati;
    await caricaCampionatiStorici();
  }
}

document.getElementById("selettore-stagione-dati").addEventListener("change", selezionaStagione);

function apriModaleStagione() {
  document.getElementById("f-stagione-nome").value = "";
  openOverlay("modale-stagione");
}

async function salvaStagione() {
  const nome = document.getElementById("f-stagione-nome").value.trim();
  if (!nome) return;
  const risultato = await apiSend("/api/stagioni", "POST", { nome });
  closeOverlay("modale-stagione");
  _stagioneSelezionataId = risultato.id;
  await caricaStagioni();
}

async function eliminaStagioneCorrente() {
  if (!_stagioneSelezionataId) return;
  const stagione = (window._stagioniCache || []).find(s => s.id === _stagioneSelezionataId);
  if (!confirm(`Eliminare la stagione "${stagione ? stagione.nome : ""}"? Vengono cancellate tutte le partite, indisponibilità e alias campionati importati per questa stagione.`)) return;
  const risultato = await apiDelete(`/api/stagioni/${_stagioneSelezionataId}`);
  if (!risultato.ok) {
    alert(risultato.errore || "Errore durante l'eliminazione.");
    return;
  }
  _stagioneSelezionataId = null;
  await caricaStagioni();
}

// ---------- IMPORT PARTITE/INDISPONIBILITA STORICHE (riusa la modale import comune) ----------

function apriImportPartiteStoriche() {
  apriImportModal("import-partite-storiche", {
    endpoint: `/api/stagioni/${_stagioneSelezionataId}/partite/import`,
    onDone: selezionaStagione,
  });
}

function apriImportIndisponibilitaStoriche() {
  apriImportModal("import-indisponibilita-storiche", {
    endpoint: `/api/stagioni/${_stagioneSelezionataId}/indisponibilita/import`,
    onDone: selezionaStagione,
  });
}

// ---------- ALIAS CAMPIONATI DELLA STAGIONE STORICA (stesso pattern di campionati.js) ----------

async function caricaCampionatiStorici() {
  const campionati = await apiGet(`/api/stagioni/${_stagioneSelezionataId}/campionati`);
  window._campionatiStoriciCache = campionati;
  renderTabellaCampionatiStorici();
}

function renderTabellaCampionatiStorici() {
  const tbody = document.getElementById("tabella-campionati-storici");
  const vuoto = document.getElementById("stato-vuoto-campionati-storici");
  const campionati = window._campionatiStoriciCache || [];
  tbody.innerHTML = "";

  if (campionati.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  campionati.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.n_squadre}</td>
      <td>${c.n_codici}</td>
      <td style="white-space:nowrap">
        <button class="btn-danger-text" style="color:var(--primario)" onclick="apriGestioneCampionatoStorico(${c.id})">Gestisci</button>
        <button class="btn-danger-text" onclick="eliminaCampionatoStorico(${c.id})">Elimina</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function apriModaleCampionatoStorico() {
  document.getElementById("titolo-modale-campionato-storico").textContent = "Nuovo campionato";
  document.getElementById("campionato-storico-id").value = "";
  document.getElementById("f-campionato-storico-nome").value = "";
  openOverlay("modale-campionato-storico");
}

async function salvaCampionatoStorico() {
  const nome = document.getElementById("f-campionato-storico-nome").value.trim();
  if (!nome) return;
  await apiSend(`/api/stagioni/${_stagioneSelezionataId}/campionati`, "POST", { nome });
  closeOverlay("modale-campionato-storico");
  caricaCampionatiStorici();
}

async function eliminaCampionatoStorico(id) {
  if (!confirm("Eliminare questo campionato? Vengono rimossi anche le squadre e i codici collegati.")) return;
  await apiDelete(`/api/campionati-storici/${id}`);
  caricaCampionatiStorici();
}

async function apriGestioneCampionatoStorico(id) {
  const campionato = (window._campionatiStoriciCache || []).find(c => c.id === id);
  if (!campionato) return;
  window._campionatoStoricoCorrente = id;
  document.getElementById("titolo-modale-gestisci-storico").textContent = `Gestisci — ${campionato.nome}`;
  document.getElementById("nuova-squadra-storica-nome").value = "";
  document.getElementById("nuovo-codice-storico").value = "";
  openOverlay("modale-gestisci-campionato-storico");
  await ricaricaDettaglioCampionatoStorico();
}

async function ricaricaDettaglioCampionatoStorico() {
  const id = window._campionatoStoricoCorrente;
  const dettaglio = await apiGet(`/api/campionati-storici/${id}/dettaglio`);

  const listaSquadre = document.getElementById("lista-squadre-storiche");
  listaSquadre.innerHTML = dettaglio.squadre.length
    ? dettaglio.squadre.map(s => `<li>${s.nome} <button class="btn-danger-text" onclick="rimuoviSquadraStorica(${s.id})">Rimuovi</button></li>`).join("")
    : `<li style="color:var(--testo-tenue)">Nessuna squadra aggiunta</li>`;

  const listaCodici = document.getElementById("lista-codici-storici");
  listaCodici.innerHTML = dettaglio.codici.length
    ? dettaglio.codici.map(c => `<li>${c.codice} <button class="btn-danger-text" onclick="rimuoviCodiceStorico(${c.id})">Rimuovi</button></li>`).join("")
    : `<li style="color:var(--testo-tenue)">Nessun codice collegato</li>`;
}

async function aggiungiSquadraStorica() {
  const input = document.getElementById("nuova-squadra-storica-nome");
  const nome = input.value.trim();
  if (!nome) return;
  await apiSend("/api/squadre-storiche", "POST", { campionato_storico_id: window._campionatoStoricoCorrente, nome });
  input.value = "";
  await ricaricaDettaglioCampionatoStorico();
  caricaCampionatiStorici();
}

async function rimuoviSquadraStorica(id) {
  await apiDelete(`/api/squadre-storiche/${id}`);
  await ricaricaDettaglioCampionatoStorico();
  caricaCampionatiStorici();
}

async function aggiungiCodiceStorico() {
  const input = document.getElementById("nuovo-codice-storico");
  const codice = input.value.trim();
  if (!codice) return;
  await apiSend("/api/campionati-storici-codici", "POST", { campionato_storico_id: window._campionatoStoricoCorrente, codice });
  input.value = "";
  await ricaricaDettaglioCampionatoStorico();
  caricaCampionatiStorici();
}

async function rimuoviCodiceStorico(id) {
  await apiDelete(`/api/campionati-storici-codici/${id}`);
  await ricaricaDettaglioCampionatoStorico();
  caricaCampionatiStorici();
}

caricaStagioni();
