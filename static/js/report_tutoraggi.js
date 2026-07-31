// Report tutoraggi: solo stagione corrente (il tutoraggio si dichiara in Rimborsi km, che
// esiste solo per la stagione live). Riusa lo stesso endpoint di Rimborsi km e filtra le
// gare con modalità "tutoraggio_primo"/"tutoraggio_secondo", riorganizzandole per ruolo
// tutor/tutorato invece che 1°/2° arbitro.

async function caricaReportTutoraggi() {
  const da = document.getElementById("tutoraggi-data-da").value || "";
  const a = document.getElementById("tutoraggi-data-a").value || "";
  const params = new URLSearchParams();
  if (da) params.set("da", da);
  if (a) params.set("a", a);
  const righe = await apiGet(`/api/rimborsi-km?${params.toString()}`);
  window._tutoraggiCache = righe.filter(r => r.rimborso_km_modalita === "tutoraggio_primo" || r.rimborso_km_modalita === "tutoraggio_secondo");
  renderTabellaTutoraggi();
}

function azzeraFiltroDataTutoraggi() {
  document.getElementById("tutoraggi-data-da").value = "";
  document.getElementById("tutoraggi-data-a").value = "";
  caricaReportTutoraggi();
}

function _ruoliTutoraggio(r) {
  const tutorPrimo = r.rimborso_km_modalita === "tutoraggio_primo";
  return {
    tutor: tutorPrimo ? r.arbitro : r.assistente1,
    comuneTutor: tutorPrimo ? r.comune_arbitro : r.comune_assistente1,
    kmTutor: tutorPrimo ? r.km_arbitro : r.km_assistente1,
    tutorato: tutorPrimo ? r.assistente1 : r.arbitro,
    comuneTutorato: tutorPrimo ? r.comune_assistente1 : r.comune_arbitro,
    kmTutoratoPieni: tutorPrimo ? r.km_assistente1_auto : r.km_arbitro_auto,
  };
}

function renderTabellaTutoraggi() {
  const filtro = (document.getElementById("filtro-tutoraggi").value || "").trim().toLowerCase();
  const righe = (window._tutoraggiCache || []).filter(r => {
    if (!filtro) return true;
    const { tutor, tutorato } = _ruoliTutoraggio(r);
    return [r.campionato, r.squadra_casa, r.squadra_ospite, tutor, tutorato].some(v => (v || "").toLowerCase().includes(filtro));
  });

  const tbody = document.getElementById("tabella-tutoraggi");
  const vuoto = document.getElementById("stato-vuoto-tutoraggi");
  if (righe.length === 0) {
    tbody.innerHTML = "";
    vuoto.style.display = "block";
    return;
  }
  vuoto.style.display = "none";

  tbody.innerHTML = righe.map(r => {
    const { tutor, comuneTutor, kmTutor, tutorato, comuneTutorato, kmTutoratoPieni } = _ruoliTutoraggio(r);
    return `
      <tr>
        <td style="white-space:nowrap">${formattaData(r.data)}</td>
        <td>${r.campionato}${r.numero_gara ? " · n° " + r.numero_gara : ""}</td>
        <td>${r.squadra_casa} vs ${r.squadra_ospite}</td>
        <td>${r.localita || "-"}</td>
        <td>${tutor}</td>
        <td>${comuneTutor || "-"}</td>
        <td>${kmTutor != null ? kmTutor + " km" : "-"}</td>
        <td>${tutorato}</td>
        <td>${comuneTutorato || "-"}</td>
        <td>${kmTutoratoPieni != null ? kmTutoratoPieni + " km" : "-"}</td>
      </tr>
    `;
  }).join("");
}

document.getElementById("filtro-tutoraggi").addEventListener("input", renderTabellaTutoraggi);
document.getElementById("tutoraggi-data-da").addEventListener("change", caricaReportTutoraggi);
document.getElementById("tutoraggi-data-a").addEventListener("change", caricaReportTutoraggi);
