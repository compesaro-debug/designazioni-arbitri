async function caricaCampionati() {
  const campionati = await apiGet("/api/campionati");
  window._campionatiCache = campionati;
  renderTabellaCampionati();
}

function renderTabellaCampionati() {
  const tbody = document.getElementById("tabella-campionati");
  const vuoto = document.getElementById("stato-vuoto-campionati");
  tbody.innerHTML = "";
  const campionati = window._campionatiCache || [];

  if (campionati.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  campionati.forEach(c => {
    const tr = document.createElement("tr");
    const arbitrabile = Number(c.arbitrabile_da_associato) !== 0;
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.n_squadre}</td>
      <td>${c.n_codici}</td>
      <td>${arbitrabile ? '<span class="tag tag-verde">Sì</span>' : '<span class="tag tag-rosso">No</span>'}</td>
      <td>${c.km_per_partita || "-"}</td>
      <td style="white-space:nowrap">
        <button class="btn-danger-text" style="color:var(--primario)" onclick="apriGestioneCampionato(${c.id})">Gestisci</button>
        <button class="btn-danger-text" style="color:var(--primario)" onclick="apriModaleCampionato(${c.id})">Modifica</button>
        <button class="btn-danger-text" onclick="eliminaCampionato(${c.id})">Elimina</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function apriModaleCampionato(id) {
  const campionato = id ? (window._campionatiCache || []).find(c => c.id === id) : null;
  document.getElementById("titolo-modale-campionato").textContent = campionato ? "Modifica campionato" : "Nuovo campionato";
  document.getElementById("campionato-id").value = campionato ? campionato.id : "";
  document.getElementById("f-campionato-nome").value = campionato ? campionato.nome : "";
  document.getElementById("f-campionato-arbitrabile-associato").value = campionato && Number(campionato.arbitrabile_da_associato) === 0 ? "0" : "1";
  document.getElementById("f-campionato-km-per-partita").value = campionato ? (campionato.km_per_partita || "") : "";
  openOverlay("modale-campionato");
}

async function salvaCampionato() {
  const id = document.getElementById("campionato-id").value;
  const nome = document.getElementById("f-campionato-nome").value.trim();
  if (!nome) return;
  const payload = {
    nome,
    arbitrabile_da_associato: document.getElementById("f-campionato-arbitrabile-associato").value,
    km_per_partita: document.getElementById("f-campionato-km-per-partita").value.trim(),
  };
  if (id) {
    await apiSend(`/api/campionati/${id}`, "PUT", payload);
  } else {
    await apiSend("/api/campionati", "POST", payload);
  }
  closeOverlay("modale-campionato");
  caricaCampionati();
}

async function eliminaCampionato(id) {
  if (!confirm("Eliminare questo campionato? Vengono rimossi anche le squadre e i codici collegati (le partite non vengono toccate).")) return;
  await apiDelete(`/api/campionati/${id}`);
  caricaCampionati();
}

async function apriGestioneCampionato(id) {
  const campionato = (window._campionatiCache || []).find(c => c.id === id);
  if (!campionato) return;
  window._campionatoCorrente = id;
  document.getElementById("titolo-modale-gestisci").textContent = `Gestisci — ${campionato.nome}`;
  document.getElementById("nuova-squadra-nome").value = "";
  document.getElementById("nuovo-codice").value = "";
  openOverlay("modale-gestisci-campionato");
  await ricaricaDettaglioCampionato();
}

async function ricaricaDettaglioCampionato() {
  const id = window._campionatoCorrente;
  const dettaglio = await apiGet(`/api/campionati/${id}/dettaglio`);

  const listaSquadre = document.getElementById("lista-squadre");
  listaSquadre.innerHTML = dettaglio.squadre.length
    ? dettaglio.squadre.map(s => `<li>${s.nome} <button class="btn-danger-text" onclick="rimuoviSquadra(${s.id})">Rimuovi</button></li>`).join("")
    : `<li style="color:var(--testo-tenue)">Nessuna squadra aggiunta</li>`;

  const listaCodici = document.getElementById("lista-codici");
  listaCodici.innerHTML = dettaglio.codici.length
    ? dettaglio.codici.map(c => `<li>${c.codice} <button class="btn-danger-text" onclick="rimuoviCodice(${c.id})">Rimuovi</button></li>`).join("")
    : `<li style="color:var(--testo-tenue)">Nessun codice collegato</li>`;
}

async function aggiungiSquadra() {
  const input = document.getElementById("nuova-squadra-nome");
  const nome = input.value.trim();
  if (!nome) return;
  await apiSend("/api/squadre", "POST", { campionato_id: window._campionatoCorrente, nome });
  input.value = "";
  await ricaricaDettaglioCampionato();
  caricaCampionati();
}

async function rimuoviSquadra(id) {
  await apiDelete(`/api/squadre/${id}`);
  await ricaricaDettaglioCampionato();
  caricaCampionati();
}

async function aggiungiCodice() {
  const input = document.getElementById("nuovo-codice");
  const codice = input.value.trim();
  if (!codice) return;
  await apiSend("/api/campionati-codici", "POST", { campionato_id: window._campionatoCorrente, codice });
  input.value = "";
  await ricaricaDettaglioCampionato();
  caricaCampionati();
}

async function rimuoviCodice(id) {
  await apiDelete(`/api/campionati-codici/${id}`);
  await ricaricaDettaglioCampionato();
  caricaCampionati();
}

abilitaSelettoreColonne("#tabella-campionati-el", document.getElementById("colonne-campionati"));
caricaCampionati();
