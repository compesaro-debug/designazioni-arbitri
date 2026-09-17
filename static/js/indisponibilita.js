let filtriIndisponibilita = {};
let ordinamentoIndisponibilita = { campo: null, direzione: "asc" };

const CAMPI_INDISPONIBILITA = [
  "arbitro", "codice_fiscale", "ruolo", "data_inizio", "ora_inizio",
  "data_fine", "ora_fine", "motivo", "data_richiesta",
];

// Stato del periodo rispetto a oggi: usato sia per il cartellino colorato sia per il filtro
// a tendina "Stato" (il valore testuale deve combaciare con le option del filtro).
function _statoIndisponibilita(r) {
  const oggi = new Date().toISOString().slice(0, 10);
  if (r.data_inizio && r.data_inizio > oggi) return "Futura";
  if (r.data_fine && r.data_fine < oggi) return "Passata";
  return "In corso";
}

async function caricaIndisponibilita() {
  const righe = await apiGet("/api/indisponibilita");
  righe.forEach(r => { r.stato_testo = _statoIndisponibilita(r); });
  window._indispCache = righe;
  renderTabellaIndisponibilita();
}

function renderTabellaIndisponibilita() {
  const righe = applicaFiltriOrdinamento(window._indispCache || [], filtriIndisponibilita, ordinamentoIndisponibilita, "#tabella-head-indisponibilita");
  const tbody = document.getElementById("tabella-indisponibilita");
  const vuoto = document.getElementById("stato-vuoto-indisponibilita");
  tbody.innerHTML = "";

  if (righe.length === 0) {
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  const TAG_STATO = {
    "In corso": '<span class="tag tag-rosso">In corso</span>',
    "Futura": '<span class="tag tag-giallo">Futura</span>',
    "Passata": '<span style="color:var(--testo-tenue)">Passata</span>',
  };
  righe.forEach(r => {
    const tr = document.createElement("tr");
    if (r.stato_testo === "In corso") tr.classList.add("riga-non-disponibile");
    else if (r.stato_testo === "Futura") tr.classList.add("riga-data-futura");
    const dal = `${formattaData(r.data_inizio)}${r.ora_inizio ? " " + r.ora_inizio : ""}`;
    const al = `${formattaData(r.data_fine)}${r.ora_fine ? " " + r.ora_fine : ""}`;
    tr.innerHTML = `
      <td>${r.arbitro}</td>
      <td>${r.codice_fiscale}</td>
      <td>${r.ruolo}</td>
      <td>${dal}</td>
      <td>${al}</td>
      <td>${TAG_STATO[r.stato_testo] || ""}</td>
      <td>${r.motivo}</td>
      <td>${r.data_richiesta}</td>
      <td style="white-space:nowrap">
        <button class="btn-danger-text" style="color:var(--primario)" onclick="modificaIndisponibilita(${r.id})">Modifica</button>
        <button class="btn-danger-text" onclick="eliminaIndisponibilita(${r.id})">Elimina</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function apriModaleIndisponibilita() {
  document.getElementById("titolo-modale-indisponibilita").textContent = "Nuova indisponibilità";
  document.getElementById("indisponibilita-id").value = "";
  CAMPI_INDISPONIBILITA.forEach(c => {
    document.getElementById(`f-i-${c}`).value = "";
  });
  openOverlay("modale-indisponibilita");
}

function modificaIndisponibilita(id) {
  const r = window._indispCache.find(x => x.id === id);
  if (!r) return;
  document.getElementById("titolo-modale-indisponibilita").textContent = "Modifica indisponibilità";
  document.getElementById("indisponibilita-id").value = r.id;
  CAMPI_INDISPONIBILITA.forEach(c => {
    document.getElementById(`f-i-${c}`).value = r[c] || "";
  });
  openOverlay("modale-indisponibilita");
}

async function salvaIndisponibilita() {
  const id = document.getElementById("indisponibilita-id").value;
  const payload = {};
  CAMPI_INDISPONIBILITA.forEach(c => {
    payload[c] = document.getElementById(`f-i-${c}`).value;
  });
  if (id) {
    await apiSend(`/api/indisponibilita/${id}`, "PUT", payload);
  } else {
    await apiSend("/api/indisponibilita", "POST", payload);
  }
  closeOverlay("modale-indisponibilita");
  caricaIndisponibilita();
}

async function eliminaIndisponibilita(id) {
  if (!confirm("Eliminare questa indisponibilità?")) return;
  await apiDelete(`/api/indisponibilita/${id}`);
  caricaIndisponibilita();
}

abilitaOrdinamento("#tabella-head-indisponibilita", ordinamentoIndisponibilita, renderTabellaIndisponibilita);
abilitaFiltri("#tabella-head-indisponibilita", filtriIndisponibilita, renderTabellaIndisponibilita);
abilitaRidimensionamentoColonne("#tabella-indisponibilita-el");
rendiHeaderFisso("#tabella-head-indisponibilita");
abilitaSelettoreColonne("#tabella-indisponibilita-el", document.getElementById("colonne-indisponibilita"));
caricaIndisponibilita();
