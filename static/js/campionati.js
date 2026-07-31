let filtriCampionati = {};
let ordinamentoCampionati = { campo: null, direzione: "asc" };

async function caricaCampionati() {
  const campionati = await apiGet("/api/campionati");
  campionati.forEach(c => { c.arbitrabile_testo = Number(c.arbitrabile_da_associato) === 0 ? "No" : "Sì"; });
  window._campionatiCache = campionati;
  renderTabellaCampionati();
}

function renderTabellaCampionati() {
  const tbody = document.getElementById("tabella-campionati");
  const vuoto = document.getElementById("stato-vuoto-campionati");
  tbody.innerHTML = "";

  let campionati = (window._campionatiCache || []).filter(c => _rigaCorrispondeFiltriCampionati(c, filtriCampionati));

  if (ordinamentoCampionati.campo) {
    const campo = ordinamentoCampionati.campo;
    const dir = ordinamentoCampionati.direzione === "asc" ? 1 : -1;
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

function _rigaCorrispondeFiltriCampionati(c, filtri) {
  return Object.entries(filtri).every(([campo, valore]) => {
    if (!valore) return true;
    if (campo === "arbitrabile_testo") return c.arbitrabile_testo === valore;
    return String(c[campo] ?? "").toLowerCase().includes(valore.toLowerCase());
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
    ? dettaglio.codici.map(c => `
        <li>
          ${c.codice}
          <select class="select-fase-codice" onchange="impostaFaseCodice(${c.id}, this.value)">
            <option value="" ${!c.tipo_fase ? "selected" : ""}>Campionato</option>
            <option value="coppa" ${c.tipo_fase === "coppa" ? "selected" : ""}>Coppa</option>
            <option value="playoff" ${c.tipo_fase === "playoff" ? "selected" : ""}>Playoff/Play out</option>
            <option value="final_four" ${c.tipo_fase === "final_four" ? "selected" : ""}>Fasi finali</option>
          </select>
          <button class="btn-danger-text" onclick="rimuoviCodice(${c.id})">Rimuovi</button>
        </li>
      `).join("")
    : `<li style="color:var(--testo-tenue)">Nessun codice collegato</li>`;
}

async function impostaFaseCodice(id, tipoFase) {
  await apiSend(`/api/campionati-codici/${id}`, "PUT", { tipo_fase: tipoFase });
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

abilitaOrdinamento("#tabella-head-campionati", ordinamentoCampionati, renderTabellaCampionati);
abilitaFiltri("#tabella-head-campionati", filtriCampionati, renderTabellaCampionati);
abilitaSelettoreColonne("#tabella-campionati-el", document.getElementById("colonne-campionati"));
caricaCampionati();
