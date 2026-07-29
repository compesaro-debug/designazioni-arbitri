let filtriArbitri = {};
let ordinamentoArbitri = { campo: null, direzione: "asc" };
let _selezionatiArbitri = new Set();

async function caricaArbitri() {
  const arbitri = await apiGet("/api/arbitri");
  window._arbitriCache = arbitri;
  renderTabellaArbitri();
}

function renderTabellaArbitri() {
  const arbitri = applicaFiltriOrdinamento(window._arbitriCache || [], filtriArbitri, ordinamentoArbitri, "#tabella-head-arbitri");
  const tbody = document.getElementById("tabella-arbitri");
  const vuoto = document.getElementById("stato-vuoto-arbitri");
  tbody.innerHTML = "";

  if (arbitri.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  arbitri.forEach(a => {
    const tr = document.createElement("tr");
    const attivo = Number(a.attivo) !== 0;
    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox-riga-arbitro" data-id="${a.id}" ${_selezionatiArbitri.has(a.id) ? "checked" : ""} onchange="toggleSelezionaArbitro(${a.id}, this.checked)"></td>
      <td>${a.codice_fiscale}</td>
      <td>${a.cognome_nome}</td>
      <td>${a.matricola}</td>
      <td>${a.comune}</td>
      <td>${a.ruolo}</td>
      <td>${attivo ? '<span class="tag tag-verde">In attività</span>' : '<span class="tag tag-rosso">Non in attività</span>'}</td>
      <td>${_testoScadenzaCertificato(a.scadenza_certificato_medico)}</td>
      <td>${a.cellulare}</td>
      <td>${a.email}</td>
      <td style="white-space:nowrap">
        <button class="btn-danger-text" onclick="apriReportArbitro(${a.id})" style="color:var(--primario)">Report</button>
        <button class="btn-danger-text" onclick="modificaArbitro(${a.id})" style="color:var(--primario)">Modifica</button>
        <button class="btn-danger-text" onclick="eliminaArbitro(${a.id})">Elimina</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  _aggiornaBarraSelezioneArbitri();
}

function toggleSelezionaArbitro(id, selezionato) {
  if (selezionato) _selezionatiArbitri.add(id);
  else _selezionatiArbitri.delete(id);
  _aggiornaBarraSelezioneArbitri();
}

function toggleSelezionaTuttiArbitri(selezionaTutti) {
  document.querySelectorAll(".checkbox-riga-arbitro").forEach(cb => {
    const id = Number(cb.dataset.id);
    cb.checked = selezionaTutti;
    if (selezionaTutti) _selezionatiArbitri.add(id);
    else _selezionatiArbitri.delete(id);
  });
  _aggiornaBarraSelezioneArbitri();
}

function deselezionaTuttiArbitri() {
  _selezionatiArbitri.clear();
  document.getElementById("checkbox-tutti-arbitri").checked = false;
  renderTabellaArbitri();
}

function _aggiornaBarraSelezioneArbitri() {
  const barra = document.getElementById("barra-selezione-arbitri");
  const n = _selezionatiArbitri.size;
  barra.style.display = n > 0 ? "flex" : "none";
  document.getElementById("conteggio-selezione-arbitri").textContent = `${n} arbitr${n === 1 ? "o" : "i"} selezionat${n === 1 ? "o" : "i"}`;
}

async function impostaAttivoMassivo(attivo) {
  const ids = Array.from(_selezionatiArbitri);
  if (!ids.length) return;
  await apiSend("/api/arbitri/attivo-massivo", "PUT", { ids, attivo });
  _selezionatiArbitri.clear();
  await caricaArbitri();
}

function _testoScadenzaCertificato(scadenza) {
  if (!scadenza) return "";
  const oggi = new Date().toISOString().slice(0, 10);
  const tra30gg = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const testo = formattaData(scadenza);
  if (scadenza < oggi) return `<span class="tag tag-rosso">Scaduto — ${testo}</span>`;
  if (scadenza <= tra30gg) return `<span class="tag tag-arancione">In scadenza — ${testo}</span>`;
  return testo;
}

function apriModaleArbitro() {
  document.getElementById("titolo-modale-arbitro").textContent = "Nuovo arbitro";
  document.getElementById("arbitro-id").value = "";
  ["codice_fiscale", "cognome_nome", "matricola", "comune", "ruolo", "scadenza_certificato_medico", "cellulare", "email"].forEach(campo => {
    document.getElementById(`f-${campo}`).value = "";
  });
  document.getElementById("f-attivo").value = "1";
  openOverlay("modale-arbitro");
}

function modificaArbitro(id) {
  const a = window._arbitriCache.find(x => x.id === id);
  if (!a) return;
  document.getElementById("titolo-modale-arbitro").textContent = "Modifica arbitro";
  document.getElementById("arbitro-id").value = a.id;
  ["codice_fiscale", "cognome_nome", "matricola", "comune", "ruolo", "scadenza_certificato_medico", "cellulare", "email"].forEach(campo => {
    document.getElementById(`f-${campo}`).value = a[campo] || "";
  });
  document.getElementById("f-attivo").value = Number(a.attivo) === 0 ? "0" : "1";
  openOverlay("modale-arbitro");
}

async function salvaArbitro() {
  const id = document.getElementById("arbitro-id").value;
  const payload = {};
  ["codice_fiscale", "cognome_nome", "matricola", "comune", "ruolo", "scadenza_certificato_medico", "cellulare", "email"].forEach(campo => {
    payload[campo] = document.getElementById(`f-${campo}`).value;
  });
  payload.attivo = document.getElementById("f-attivo").value;
  if (id) {
    await apiSend(`/api/arbitri/${id}`, "PUT", payload);
  } else {
    await apiSend("/api/arbitri", "POST", payload);
  }
  closeOverlay("modale-arbitro");
  caricaArbitri();
}

async function eliminaArbitro(id) {
  if (!confirm("Eliminare questo arbitro dall'anagrafica?")) return;
  await apiDelete(`/api/arbitri/${id}`);
  caricaArbitri();
}

abilitaOrdinamento("#tabella-head-arbitri", ordinamentoArbitri, renderTabellaArbitri);
abilitaFiltri("#tabella-head-arbitri", filtriArbitri, renderTabellaArbitri);
rendiHeaderFisso("#tabella-head-arbitri");
abilitaSelettoreColonne("#tabella-arbitri-el", document.getElementById("colonne-arbitri"));
caricaArbitri();
