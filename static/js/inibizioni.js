let filtriInibizioni = {};
let ordinamentoInibizioni = { campo: null, direzione: "asc" };

const CAMPI_INIBIZIONE = ["arbitro", "tipo", "descrizione", "codice_affiliazione"];

async function popolaListaArbitri() {
  const arbitri = await apiGet("/api/arbitri");
  const datalist = document.getElementById("lista-arbitri");
  datalist.innerHTML = arbitri.map(a => `<option value="${a.cognome_nome}"></option>`).join("");
}

async function caricaInibizioni() {
  const righe = await apiGet("/api/inibizioni");
  window._inibizioniCache = righe;
  renderTabellaInibizioni();
}

function renderTabellaInibizioni() {
  const righe = applicaFiltriOrdinamento(window._inibizioniCache || [], filtriInibizioni, ordinamentoInibizioni, "#tabella-head-inibizioni");
  const tbody = document.getElementById("tabella-inibizioni");
  const vuoto = document.getElementById("stato-vuoto-inibizioni");
  tbody.innerHTML = "";

  if (righe.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  righe.forEach(r => {
    const tr = document.createElement("tr");
    const tagClasse = r.tipo === "inibizione" ? "tag-rosso" : "tag-giallo";
    const tagTesto = r.tipo === "inibizione" ? "Inibizione" : "Nota";
    tr.innerHTML = `
      <td>${r.arbitro}</td>
      <td><span class="tag ${tagClasse}">${tagTesto}</span></td>
      <td>${r.descrizione}</td>
      <td>${r.codice_affiliazione}</td>
      <td class="cella-azioni" data-azioni>
        ${btnAzione("modifica", `modificaInibizione(${r.id})`, "Modifica")}
        ${btnAzione("elimina", `eliminaInibizione(${r.id})`, "Elimina")}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function aggiornaCampoCodiceAffiliazione() {
  const tipo = document.getElementById("f-in-tipo").value;
  document.getElementById("campo-codice-affiliazione").style.display = tipo === "inibizione" ? "" : "none";
}

function apriModaleInibizione() {
  document.getElementById("titolo-modale-inibizione").textContent = "Nuova nota/inibizione";
  document.getElementById("inibizione-id").value = "";
  CAMPI_INIBIZIONE.forEach(c => {
    document.getElementById(`f-in-${c}`).value = "";
  });
  document.getElementById("f-in-tipo").value = "nota";
  aggiornaCampoCodiceAffiliazione();
  openOverlay("modale-inibizione");
}

function modificaInibizione(id) {
  const r = window._inibizioniCache.find(x => x.id === id);
  if (!r) return;
  document.getElementById("titolo-modale-inibizione").textContent = "Modifica nota/inibizione";
  document.getElementById("inibizione-id").value = r.id;
  CAMPI_INIBIZIONE.forEach(c => {
    document.getElementById(`f-in-${c}`).value = r[c] || "";
  });
  aggiornaCampoCodiceAffiliazione();
  openOverlay("modale-inibizione");
}

async function salvaInibizione() {
  const id = document.getElementById("inibizione-id").value;
  const payload = {};
  CAMPI_INIBIZIONE.forEach(c => {
    payload[c] = document.getElementById(`f-in-${c}`).value;
  });
  if (id) {
    await apiSend(`/api/inibizioni/${id}`, "PUT", payload);
  } else {
    await apiSend("/api/inibizioni", "POST", payload);
  }
  closeOverlay("modale-inibizione");
  await caricaInibizioni();
  avviso(id ? "Modifiche salvate." : "Nota/inibizione aggiunta.");
}

async function eliminaInibizione(id) {
  const r = (window._inibizioniCache || []).find(x => x.id === id);
  if (!await conferma(`Eliminare questa ${r && r.tipo === "inibizione" ? "inibizione" : "nota"}${r ? " di " + r.arbitro : ""}?`, { titolo: "Elimina nota/inibizione", testoConferma: "Elimina" })) return;
  await apiDelete(`/api/inibizioni/${id}`);
  await caricaInibizioni();
  avviso("Eliminata.");
}

abilitaOrdinamento("#tabella-head-inibizioni", ordinamentoInibizioni, renderTabellaInibizioni);
abilitaFiltri("#tabella-head-inibizioni", filtriInibizioni, renderTabellaInibizioni);
abilitaSelettoreColonne("#tabella-inibizioni-el", document.getElementById("colonne-inibizioni"));
popolaListaArbitri();
caricaInibizioni();
