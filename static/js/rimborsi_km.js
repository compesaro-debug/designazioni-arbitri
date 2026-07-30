// ---------- FILTRO PERIODO ----------

function _periodoRimborsi() {
  return {
    da: document.getElementById("rimborsi-data-da").value || "",
    a: document.getElementById("rimborsi-data-a").value || "",
  };
}

function azzeraFiltroDataRimborsi() {
  document.getElementById("rimborsi-data-da").value = "";
  document.getElementById("rimborsi-data-a").value = "";
  caricaRimborsiKm();
}

// ---------- CARICAMENTO E RENDER ----------

async function caricaRimborsiKm() {
  const { da, a } = _periodoRimborsi();
  const params = new URLSearchParams();
  if (da) params.set("da", da);
  if (a) params.set("a", a);
  const righe = await apiGet(`/api/rimborsi-km?${params.toString()}`);
  window._rimborsiKmCache = righe;

  const tbody = document.getElementById("tabella-rimborsi-km");
  const vuoto = document.getElementById("stato-vuoto-rimborsi");
  if (righe.length === 0) {
    tbody.innerHTML = "";
    vuoto.style.display = "block";
  } else {
    vuoto.style.display = "none";
    tbody.innerHTML = righe.map(_rigaRimborso).join("");
  }
  _renderTotaliRimborsi(righe);
}

function _rigaRimborso(r) {
  const manuale = r.rimborso_km_modalita === "manuale";
  const cellaKm = (kmAuto, campoManuale, idRiga) => manuale
    ? `<input type="number" step="0.1" min="0" class="${campoManuale}" style="width:70px" value="${r[campoManuale] || ""}" onchange="salvaRigaRimborso(${idRiga})">`
    : (kmAuto != null ? kmAuto + " km" : "-");

  return `
    <tr id="riga-rimborso-${r.id}">
      <td style="white-space:nowrap">${formattaData(r.data)} ${r.ora || ""}</td>
      <td>${r.campionato}${r.numero_gara ? " · n° " + r.numero_gara : ""}</td>
      <td>${r.squadra_casa} vs ${r.squadra_ospite}</td>
      <td>${r.arbitro}</td>
      <td>${r.assistente1}</td>
      <td>
        <select class="rimborso-modalita" onchange="salvaRigaRimborso(${r.id})">
          <option value="" ${r.rimborso_km_modalita === "" ? "selected" : ""}>Ognuno la propria auto</option>
          <option value="primo" ${r.rimborso_km_modalita === "primo" ? "selected" : ""}>Ha guidato il 1° arbitro (2° = 0 km)</option>
          <option value="secondo" ${r.rimborso_km_modalita === "secondo" ? "selected" : ""}>Ha guidato il 2° arbitro (1° = 0 km)</option>
          <option value="manuale" ${manuale ? "selected" : ""}>Dichiaro a mano</option>
        </select>
      </td>
      <td>${cellaKm(r.km_arbitro, "rimborso_km_manuale_arbitro", r.id)}</td>
      <td>${cellaKm(r.km_assistente1, "rimborso_km_manuale_assistente1", r.id)}</td>
      <td></td>
    </tr>
  `;
}

function _renderTotaliRimborsi(righe) {
  const totali = {};
  righe.forEach(r => {
    if (r.km_arbitro != null && r.arbitro) totali[r.arbitro] = (totali[r.arbitro] || 0) + r.km_arbitro;
    if (r.km_assistente1 != null && r.assistente1) totali[r.assistente1] = (totali[r.assistente1] || 0) + r.km_assistente1;
  });
  const tbody = document.getElementById("tabella-totali-rimborsi");
  const nomi = Object.keys(totali).sort();
  tbody.innerHTML = nomi.length
    ? nomi.map(n => `<tr><td>${n}</td><td>${Math.round(totali[n] * 10) / 10} km</td></tr>`).join("")
    : `<tr><td colspan="2" style="text-align:center;color:var(--testo-tenue)">Nessun dato</td></tr>`;
}

async function salvaRigaRimborso(id) {
  const riga = document.getElementById(`riga-rimborso-${id}`);
  const modalita = riga.querySelector(".rimborso-modalita").value;
  const kmArbManuale = riga.querySelector(".rimborso_km_manuale_arbitro")?.value || "";
  const kmAssManuale = riga.querySelector(".rimborso_km_manuale_assistente1")?.value || "";
  await apiSend(`/api/partite/${id}/rimborso-km`, "PUT", {
    rimborso_km_modalita: modalita,
    rimborso_km_manuale_arbitro: modalita === "manuale" ? kmArbManuale.trim() : "",
    rimborso_km_manuale_assistente1: modalita === "manuale" ? kmAssManuale.trim() : "",
  });
  caricaRimborsiKm();
}

document.getElementById("rimborsi-data-da").addEventListener("change", caricaRimborsiKm);
document.getElementById("rimborsi-data-a").addEventListener("change", caricaRimborsiKm);

caricaRimborsiKm();
