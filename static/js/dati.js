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

function apriModaleChiudiStagione() {
  document.getElementById("f-chiudi-stagione-nome").value = "";
  openOverlay("modale-chiudi-stagione");
}

async function confermaChiudiStagione() {
  const nome = document.getElementById("f-chiudi-stagione-nome").value.trim();
  if (!nome) return;
  if (!confirm(`Confermi? La stagione corrente verrà archiviata come "${nome}" e le tabelle della stagione corrente (partite, indisponibilità, alias campionati) verranno svuotate.`)) return;
  const risultato = await apiSend("/api/stagioni/chiudi-corrente", "POST", { nome });
  if (!risultato.ok) {
    alert(risultato.errore || "Errore durante la chiusura della stagione.");
    return;
  }
  closeOverlay("modale-chiudi-stagione");
  alert(
    `Stagione archiviata come "${nome}".\n\n` +
    `${risultato.n_partite_archiviate} partite disputate archiviate\n` +
    `${risultato.n_indisponibilita_archiviate} indisponibilità archiviate\n` +
    `${risultato.n_campionati_archiviati} alias campionati archiviati\n` +
    `${risultato.n_partite_eliminate} partite da disputare eliminate (non archiviabili)\n\n` +
    `Backup del database salvato come ${risultato.backup}.`
  );
  _stagioneSelezionataId = null;
  await caricaStagioni();
}

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

let filtriCampionatiStorici = {};
let ordinamentoCampionatiStorici = { campo: null, direzione: "asc" };

async function caricaCampionatiStorici() {
  const campionati = await apiGet(`/api/stagioni/${_stagioneSelezionataId}/campionati`);
  window._campionatiStoriciCache = campionati;
  renderTabellaCampionatiStorici();
}

function _rigaCorrispondeFiltriCampionatiStorici(c, filtri) {
  return Object.entries(filtri).every(([campo, valore]) => {
    if (!valore) return true;
    return String(c[campo] ?? "").toLowerCase().includes(valore.toLowerCase());
  });
}

function renderTabellaCampionatiStorici() {
  const tbody = document.getElementById("tabella-campionati-storici");
  const vuoto = document.getElementById("stato-vuoto-campionati-storici");
  tbody.innerHTML = "";

  let campionati = (window._campionatiStoriciCache || []).filter(c => _rigaCorrispondeFiltriCampionatiStorici(c, filtriCampionatiStorici));

  if (ordinamentoCampionatiStorici.campo) {
    const campo = ordinamentoCampionatiStorici.campo;
    const dir = ordinamentoCampionatiStorici.direzione === "asc" ? 1 : -1;
    const numerico = ["n_squadre", "n_codici"].includes(campo);
    campionati = [...campionati].sort((a, b) => {
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
      <td>${c.km_per_partita || "-"}</td>
      <td style="white-space:nowrap">
        <button class="btn-danger-text" style="color:var(--primario)" onclick="apriGestioneCampionatoStorico(${c.id})">Gestisci</button>
        <button class="btn-danger-text" style="color:var(--primario)" onclick="apriModaleCampionatoStorico(${c.id})">Modifica</button>
        <button class="btn-danger-text" onclick="eliminaCampionatoStorico(${c.id})">Elimina</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function apriModaleCampionatoStorico(id) {
  const campionato = id ? (window._campionatiStoriciCache || []).find(c => c.id === id) : null;
  document.getElementById("titolo-modale-campionato-storico").textContent = campionato ? "Modifica campionato" : "Nuovo campionato";
  document.getElementById("campionato-storico-id").value = campionato ? campionato.id : "";
  document.getElementById("f-campionato-storico-nome").value = campionato ? campionato.nome : "";
  document.getElementById("f-campionato-storico-km-per-partita").value = campionato ? (campionato.km_per_partita || "") : "";
  openOverlay("modale-campionato-storico");
}

async function salvaCampionatoStorico() {
  const id = document.getElementById("campionato-storico-id").value;
  const nome = document.getElementById("f-campionato-storico-nome").value.trim();
  if (!nome) return;
  const payload = { nome, km_per_partita: document.getElementById("f-campionato-storico-km-per-partita").value.trim() };
  if (id) {
    await apiSend(`/api/campionati-storici/${id}`, "PUT", payload);
  } else {
    await apiSend(`/api/stagioni/${_stagioneSelezionataId}/campionati`, "POST", payload);
  }
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
    ? dettaglio.codici.map(c => `
        <li>
          ${c.codice}
          <select class="select-fase-codice" onchange="impostaFaseCodiceStorico(${c.id}, this.value)">
            <option value="" ${!c.tipo_fase ? "selected" : ""}>Campionato</option>
            <option value="coppa" ${c.tipo_fase === "coppa" ? "selected" : ""}>Coppa</option>
            <option value="playoff" ${c.tipo_fase === "playoff" ? "selected" : ""}>Playoff/Play out</option>
            <option value="final_four" ${c.tipo_fase === "final_four" ? "selected" : ""}>Fasi finali</option>
          </select>
          <button class="btn-danger-text" onclick="rimuoviCodiceStorico(${c.id})">Rimuovi</button>
        </li>
      `).join("")
    : `<li style="color:var(--testo-tenue)">Nessun codice collegato</li>`;
}

async function impostaFaseCodiceStorico(id, tipoFase) {
  await apiSend(`/api/campionati-storici-codici/${id}`, "PUT", { tipo_fase: tipoFase });
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

abilitaOrdinamento("#tabella-head-campionati-storici", ordinamentoCampionatiStorici, renderTabellaCampionatiStorici);
abilitaFiltri("#tabella-head-campionati-storici", filtriCampionatiStorici, renderTabellaCampionatiStorici);

caricaStagioni();
