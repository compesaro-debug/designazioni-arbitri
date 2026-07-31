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

let filtriRimborsi = {};
let ordinamentoRimborsi = { campo: null, direzione: "asc" };

async function caricaRimborsiKm() {
  const { da, a } = _periodoRimborsi();
  const params = new URLSearchParams();
  if (da) params.set("da", da);
  if (a) params.set("a", a);
  const righe = await apiGet(`/api/rimborsi-km?${params.toString()}`);
  righe.forEach(r => {
    r.campionato_display = `${r.campionato}${r.numero_gara ? " · n° " + r.numero_gara : ""}`;
    r.squadre = `${r.squadra_casa} vs ${r.squadra_ospite}`;
  });
  window._rimborsiKmCache = righe;
  renderTabellaRimborsi();
}

function _rigaCorrispondeFiltri(r, filtri) {
  return Object.entries(filtri).every(([campo, valore]) => {
    if (!valore) return true;
    if (campo === "rimborso_km_modalita") {
      return valore === "separata" ? !r.rimborso_km_modalita : r.rimborso_km_modalita === valore;
    }
    return String(r[campo] ?? "").toLowerCase().includes(valore.toLowerCase());
  });
}

function renderTabellaRimborsi() {
  const filtroRapido = (document.getElementById("filtro-rimborsi-rapido").value || "").trim().toLowerCase();
  let righe = (window._rimborsiKmCache || []).filter(r =>
    (!filtroRapido || [r.campionato_display, r.squadre, r.arbitro, r.assistente1].some(v => (v || "").toLowerCase().includes(filtroRapido)))
    && _rigaCorrispondeFiltri(r, filtriRimborsi)
  );

  if (ordinamentoRimborsi.campo) {
    const campo = ordinamentoRimborsi.campo;
    const dir = ordinamentoRimborsi.direzione === "asc" ? 1 : -1;
    const numerico = ["km_arbitro", "km_assistente1"].includes(campo);
    righe = [...righe].sort((a, b) => {
      let va = a[campo], vb = b[campo];
      if (numerico) {
        va = va == null ? -Infinity : Number(va);
        vb = vb == null ? -Infinity : Number(vb);
      } else {
        va = String(va ?? "").toLowerCase();
        vb = String(vb ?? "").toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

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

// Etichette compatte delle modalità, riusate per mostrare la proposta di rimborso km
// salvata in precedenza (sopravvive a un reimport/cancellazione della gara, vedi backend).
const ETICHETTE_MODALITA_RIMBORSO = {
  "primo": "Auto unica — ha guidato il 1°",
  "secondo": "Auto unica — ha guidato il 2°",
  "tutoraggio_primo": "Tutoraggio — tutor il 1°",
  "tutoraggio_secondo": "Tutoraggio — tutor il 2°",
  "manuale": "Dichiaro a mano",
};

async function confermaPropostaRimborso(id, modalita, kmManualeArbitro, kmManualeAssistente1) {
  await apiSend(`/api/partite/${id}/rimborso-km`, "PUT", {
    rimborso_km_modalita: modalita,
    rimborso_km_manuale_arbitro: modalita === "manuale" ? (kmManualeArbitro || "") : "",
    rimborso_km_manuale_assistente1: modalita === "manuale" ? (kmManualeAssistente1 || "") : "",
  });
  caricaRimborsiKm();
}

function _rigaRimborso(r) {
  const manuale = r.rimborso_km_modalita === "manuale";
  const cellaKm = (kmAuto, campoManuale, idRiga) => manuale
    ? `<input type="number" step="0.1" min="0" class="${campoManuale}" style="width:70px" value="${r[campoManuale] || ""}" onchange="salvaRigaRimborso(${idRiga})">`
    : (kmAuto != null ? kmAuto + " km" : "-");

  // proposta salvata in precedenza (dal designante, o da una gara con lo stesso campionato+
  // numero gara prima di un reimport): mostrata solo se non c'è già una modalità scelta ora,
  // e mai applicata da sola — serve un clic esplicito su "Conferma".
  const proposta = (!r.rimborso_km_modalita && r.proposta_modalita)
    ? `<div class="hint" style="margin-top:4px;">
        <span class="tag tag-giallo">Proposto</span> ${ETICHETTE_MODALITA_RIMBORSO[r.proposta_modalita] || r.proposta_modalita}
        <button class="btn-testo" style="padding:2px 8px;font-size:11px;" onclick="confermaPropostaRimborso(${r.id}, '${r.proposta_modalita}', '${r.proposta_km_manuale_arbitro || ""}', '${r.proposta_km_manuale_assistente1 || ""}')">Conferma</button>
      </div>`
    : "";

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
          <option value="primo" ${r.rimborso_km_modalita === "primo" ? "selected" : ""}>Auto unica — ha guidato il 1° (2° = 0 km)</option>
          <option value="secondo" ${r.rimborso_km_modalita === "secondo" ? "selected" : ""}>Auto unica — ha guidato il 2° (1° = 0 km)</option>
          <option value="tutoraggio_primo" ${r.rimborso_km_modalita === "tutoraggio_primo" ? "selected" : ""}>Tutoraggio — tutor il 1° (2° azzerato)</option>
          <option value="tutoraggio_secondo" ${r.rimborso_km_modalita === "tutoraggio_secondo" ? "selected" : ""}>Tutoraggio — tutor il 2° (1° azzerato)</option>
          <option value="manuale" ${manuale ? "selected" : ""}>Dichiaro a mano</option>
        </select>
        ${proposta}
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
document.getElementById("filtro-rimborsi-rapido").addEventListener("input", renderTabellaRimborsi);

abilitaOrdinamento("#tabella-head-rimborsi", ordinamentoRimborsi, renderTabellaRimborsi);
abilitaFiltri("#tabella-head-rimborsi", filtriRimborsi, renderTabellaRimborsi);
abilitaRidimensionamentoColonne("#tabella-rimborsi-el");
rendiHeaderFisso("#tabella-head-rimborsi");
abilitaSelettoreColonne("#tabella-rimborsi-el", document.getElementById("colonne-rimborsi"));

caricaRimborsiKm();
