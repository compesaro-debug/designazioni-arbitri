async function caricaSocieta() {
  window._societaCache = await apiGet("/api/societa");
  renderTabellaSocieta();
}

function renderTabellaSocieta() {
  const filtro = (document.getElementById("filtro-societa").value || "").trim().toLowerCase();
  const societa = (window._societaCache || []).filter(s =>
    !filtro || s.codice_affiliazione.toLowerCase().includes(filtro) || s.ragione_sociale.toLowerCase().includes(filtro)
  );
  const tbody = document.getElementById("tabella-societa");
  const vuoto = document.getElementById("stato-vuoto-societa");

  if ((window._societaCache || []).length === 0) {
    tbody.innerHTML = "";
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  tbody.innerHTML = societa.length
    ? societa.map(s => `
        <tr>
          <td>${s.codice_affiliazione}</td>
          <td>${s.ragione_sociale}</td>
          <td style="white-space:nowrap">
            <button class="btn-danger-text" style="color:var(--primario)" onclick="apriModaleSocieta(${s.id})">Modifica</button>
            <button class="btn-danger-text" onclick="eliminaSocieta(${s.id})">Elimina</button>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="text-align:center;color:var(--testo-tenue)">Nessun risultato</td></tr>`;
}

document.getElementById("filtro-societa").addEventListener("input", renderTabellaSocieta);

function apriModaleSocieta(id) {
  const societa = id ? (window._societaCache || []).find(s => s.id === id) : null;
  document.getElementById("titolo-modale-societa").textContent = societa ? "Modifica società" : "Nuova società";
  document.getElementById("societa-id").value = societa ? societa.id : "";
  document.getElementById("f-societa-codice").value = societa ? societa.codice_affiliazione : "";
  document.getElementById("f-societa-ragione").value = societa ? societa.ragione_sociale : "";
  openOverlay("modale-societa");
}

async function salvaSocieta() {
  const id = document.getElementById("societa-id").value;
  const codice_affiliazione = document.getElementById("f-societa-codice").value.trim();
  const ragione_sociale = document.getElementById("f-societa-ragione").value.trim();
  if (!codice_affiliazione || !ragione_sociale) return;
  if (id) {
    await apiSend(`/api/societa/${id}`, "PUT", { codice_affiliazione, ragione_sociale });
  } else {
    await apiSend("/api/societa", "POST", { codice_affiliazione, ragione_sociale });
  }
  closeOverlay("modale-societa");
  caricaSocieta();
}

async function eliminaSocieta(id) {
  if (!confirm("Eliminare questa società dall'anagrafica?")) return;
  await apiDelete(`/api/societa/${id}`);
  caricaSocieta();
}

async function importaSocieta() {
  const risultato = await apiSend("/api/societa/importa", "POST", {});
  await caricaSocieta();
  alert(risultato.inserite > 0
    ? `Importate ${risultato.inserite} nuove società. Controlla le ragioni sociali suggerite (viene scelto il nome squadra più frequente per quel codice) e correggile dove serve.`
    : "Nessuna nuova società da importare: i codici presenti nelle partite sono già tutti in anagrafica.");
}

abilitaSelettoreColonne("#tabella-societa-el", document.getElementById("colonne-societa"));
caricaSocieta();
