// Grafici leggeri in HTML/CSS, senza librerie esterne: barre orizzontali, barre impilate e
// colonne. I colori sono le variabili --serie-* / --stato-* di style.css, validate per il
// daltonismo; i testi usano sempre i colori del testo, mai quello della serie.

const _formatoNumero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

function formattaNumero(v) {
  return v == null || Number.isNaN(v) ? "-" : _formatoNumero.format(v);
}

// Massimo "tondo" per l'asse (1, 2, 5 × 10^k) e passo della griglia, così le tacche cadono
// su numeri puliti invece che su 37,4.
function _scalaPulita(massimo, nTacche = 4) {
  if (!massimo || massimo <= 0) return { max: 1, passo: 1 };
  const grezzo = massimo / nTacche;
  const ordine = 10 ** Math.floor(Math.log10(grezzo));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * ordine).find(p => p >= grezzo);
  return { max: passo * Math.ceil(massimo / passo), passo };
}

// ---------- TOOLTIP CONDIVISO ----------
// Qualunque elemento con data-tooltip dentro un grafico lo mostra al passaggio del mouse o
// al focus da tastiera; i valori restano comunque leggibili anche senza (etichette/tabelle).

let _tooltipGrafico = null;

function _posizionaTooltip(x, y) {
  const t = _tooltipGrafico;
  const larghezza = t.offsetWidth, altezza = t.offsetHeight;
  let left = x + 14, top = y - altezza - 10;
  if (left + larghezza > window.innerWidth - 8) left = x - larghezza - 14;
  if (top < 8) top = y + 18;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${top}px`;
}

function _mostraTooltip(el, x, y) {
  if (!_tooltipGrafico) {
    _tooltipGrafico = document.createElement("div");
    _tooltipGrafico.className = "tooltip-grafico";
    _tooltipGrafico.setAttribute("role", "tooltip");
    document.body.appendChild(_tooltipGrafico);
  }
  const [titolo, ...righe] = el.dataset.tooltip.split("\n");
  _tooltipGrafico.innerHTML = `<strong>${_esc(titolo)}</strong>${righe.map(r => `<span>${_esc(r)}</span>`).join("")}`;
  _tooltipGrafico.classList.add("visibile");
  _posizionaTooltip(x, y);
}

function _nascondiTooltip() {
  if (_tooltipGrafico) _tooltipGrafico.classList.remove("visibile");
}

document.addEventListener("mousemove", (e) => {
  const el = e.target.closest && e.target.closest(".grafico [data-tooltip]");
  if (el) _mostraTooltip(el, e.clientX, e.clientY);
  else _nascondiTooltip();
});
document.addEventListener("focusin", (e) => {
  const el = e.target.closest && e.target.closest(".grafico [data-tooltip]");
  if (!el) return;
  const r = el.getBoundingClientRect();
  _mostraTooltip(el, r.left + r.width / 2, r.top);
});
document.addEventListener("focusout", _nascondiTooltip);
document.addEventListener("scroll", _nascondiTooltip, true);

// Le callback dei clic vengono registrate qui e richiamate per indice, così il markup resta
// una stringa HTML semplice.
const _azioniGrafici = [];
function _registraAzione(fn) {
  _azioniGrafici.push(fn);
  return _azioniGrafici.length - 1;
}
function _eseguiAzioneGrafico(i) {
  if (_azioniGrafici[i]) _azioniGrafici[i]();
}

function _vuoto(el, testo) {
  el.innerHTML = `<div class="grafico grafico-vuoto">${_esc(testo || "Nessun dato da visualizzare")}</div>`;
}

function _legenda(serie) {
  return `<div class="grafico-legenda">${serie.map(s =>
    `<span class="grafico-legenda-voce"><span class="grafico-legenda-segno" style="background:${s.colore}"></span>${_esc(s.nome)}</span>`
  ).join("")}</div>`;
}

// ---------- BARRE ORIZZONTALI (una serie) ----------
// righe: [{ etichetta, valore, dettaglio?, onClick?, tenue?, colore?, testo?, segno? }]
//   testo: sostituisce il valore scritto in fondo alla barra; segno: tacca verticale di soglia
// opzioni: { unita, massimoRighe, riferimento: {valore, etichetta}, notaSegno, colore,
//            spazioValore (px riservati al testo in fondo), vuoto }

function graficoBarre(el, righe, opzioni = {}) {
  if (!el) return;
  const { unita = "", massimoRighe = 12, riferimento = null, notaSegno = "", colore = "var(--serie-1)", spazioValore = 64, vuoto } = opzioni;
  const valide = righe.filter(r => r.valore != null);
  if (!valide.length) return _vuoto(el, vuoto);

  const mostraTutte = el.dataset.mostraTutte === "1";
  const visibili = mostraTutte ? valide : valide.slice(0, massimoRighe);
  const massimo = Math.max(...valide.map(r => Math.max(r.valore, r.segno ?? 0)), riferimento ? riferimento.valore : 0) || 1;
  const frazione = (v) => Math.max(0, v) / massimo;
  const posizione = (v) => `calc((100% - ${spazioValore}px) * ${frazione(v)})`;

  const righeHtml = visibili.map(r => {
    const testoValore = r.testo ?? `${formattaNumero(r.valore)}${unita}`;
    const tooltip = `${r.etichetta}\n${testoValore}${r.dettaglio ? "\n" + r.dettaglio : ""}`;
    const tag = r.onClick ? "button" : "div";
    const attributi = r.onClick ? ` type="button" onclick="_eseguiAzioneGrafico(${_registraAzione(r.onClick)})"` : "";
    const larghezza = r.valore > 0 ? `max(3px, ${posizione(r.valore)})` : "0px";
    // se la tacca di soglia sta oltre la fine della barra, il numero va scritto dopo la tacca
    const spaziatore = r.segno != null && r.segno > r.valore
      ? `<span style="flex-shrink:0; width:calc((100% - ${spazioValore}px) * ${frazione(r.segno) - frazione(r.valore)} - 4px)"></span>`
      : "";
    return `
      <${tag} class="gb-riga${r.onClick ? " cliccabile" : ""}${r.tenue ? " tenue" : ""}"${attributi} data-tooltip="${_esc(tooltip)}">
        <span class="gb-etichetta" title="${_esc(r.etichetta)}">${_esc(r.etichetta)}</span>
        <span class="gb-traccia">
          ${riferimento ? `<span class="gb-riferimento" style="left:${posizione(riferimento.valore)}"></span>` : ""}
          ${r.segno != null ? `<span class="gb-segno" style="left:${posizione(r.segno)}"></span>` : ""}
          <span class="gb-barra" style="width:${larghezza}; background:${r.colore || colore}"></span>${spaziatore}
          <span class="gb-valore">${_esc(testoValore)}</span>
        </span>
      </${tag}>`;
  }).join("");

  const nascoste = valide.length - visibili.length;
  const piede = valide.length > massimoRighe
    ? `<button type="button" class="grafico-altro" data-azione="espandi">${mostraTutte ? "Mostra meno" : `Mostra tutti (${nascoste} in più)`}</button>`
    : "";
  const legendaRif = (riferimento
    ? `<div class="grafico-nota"><span class="gb-riferimento-segno"></span>${_esc(riferimento.etichetta)}: ${formattaNumero(riferimento.valore)}${_esc(unita)}</div>`
    : "") + (notaSegno
    ? `<div class="grafico-nota"><span class="gb-segno-legenda"></span>${_esc(notaSegno)}</div>`
    : "");

  el.innerHTML = `<div class="grafico grafico-barre">${legendaRif}${righeHtml}${piede}</div>`;
  const bottone = el.querySelector('[data-azione="espandi"]');
  if (bottone) bottone.addEventListener("click", () => {
    el.dataset.mostraTutte = mostraTutte ? "0" : "1";
    graficoBarre(el, righe, opzioni);
  });
}

// ---------- BARRE ORIZZONTALI IMPILATE ----------
// righe: [{ etichetta, valori: [..], onClick?, dettaglio? }]
// serie: [{ nome, colore }]
// opzioni: { percentuale (barre al 100%), unita, massimoRighe, fine: (riga) => testo, vuoto }

function graficoImpilato(el, righe, serie, opzioni = {}) {
  if (!el) return;
  const { percentuale = false, unita = "", massimoRighe = 12, fine = null, vuoto } = opzioni;
  const totale = (r) => r.valori.reduce((s, v) => s + (v || 0), 0);
  const valide = righe.filter(r => totale(r) > 0);
  if (!valide.length) return _vuoto(el, vuoto);

  const mostraTutte = el.dataset.mostraTutte === "1";
  const visibili = mostraTutte ? valide : valide.slice(0, massimoRighe);
  const massimo = Math.max(...valide.map(totale)) || 1;

  const righeHtml = visibili.map(r => {
    const tot = totale(r);
    const scala = percentuale ? 1 : tot / massimo;
    const segmenti = r.valori.map((v, i) => {
      if (!v) return "";
      const pct = Math.round(v / tot * 1000) / 10;
      const tooltip = `${r.etichetta}\n${serie[i].nome}: ${formattaNumero(v)}${unita} (${formattaNumero(pct)}%)${r.dettaglio ? "\n" + r.dettaglio : ""}`;
      return `<span class="gi-segmento" style="flex:${v} 1 0; background:${serie[i].colore}" data-tooltip="${_esc(tooltip)}"></span>`;
    }).join("");
    const testoFine = fine ? fine(r) : `${formattaNumero(tot)}${unita}`;
    const tag = r.onClick ? "button" : "div";
    const attributi = r.onClick ? ` type="button" onclick="_eseguiAzioneGrafico(${_registraAzione(r.onClick)})"` : "";
    return `
      <${tag} class="gb-riga${r.onClick ? " cliccabile" : ""}"${attributi}>
        <span class="gb-etichetta" title="${_esc(r.etichetta)}">${_esc(r.etichetta)}</span>
        <span class="gb-traccia">
          <span class="gi-barra" style="width:calc((100% - ${percentuale ? 118 : 64}px) * ${scala})">${segmenti}</span>
          <span class="gb-valore">${_esc(testoFine)}</span>
        </span>
      </${tag}>`;
  }).join("");

  const nascoste = valide.length - visibili.length;
  const piede = valide.length > massimoRighe
    ? `<button type="button" class="grafico-altro" data-azione="espandi">${mostraTutte ? "Mostra meno" : `Mostra tutti (${nascoste} in più)`}</button>`
    : "";

  el.innerHTML = `<div class="grafico grafico-barre">${_legenda(serie)}${righeHtml}${piede}</div>`;
  const bottone = el.querySelector('[data-azione="espandi"]');
  if (bottone) bottone.addEventListener("click", () => {
    el.dataset.mostraTutte = mostraTutte ? "0" : "1";
    graficoImpilato(el, righe, serie, opzioni);
  });
}

// ---------- COLONNE VERTICALI (anche impilate) ----------
// punti: [{ etichetta, sottoetichetta?, valori: [..], evidenzia?, onClick? }]
// serie: [{ nome, colore, coloreTenue? }] — con una sola serie la legenda non serve
// opzioni: { unita, altezza, etichetteValori (default: se <= 16 colonne), vuoto }

function graficoColonne(el, punti, serie, opzioni = {}) {
  if (!el) return;
  const { unita = "", altezza = 180, vuoto } = opzioni;
  const totale = (p) => p.valori.reduce((s, v) => s + (v || 0), 0);
  if (!punti.length || !punti.some(p => totale(p) > 0)) return _vuoto(el, vuoto);

  const etichetteValori = opzioni.etichetteValori ?? punti.length <= 16;
  const { max, passo } = _scalaPulita(Math.max(...punti.map(totale)));
  const tacche = [];
  for (let v = 0; v <= max + 1e-9; v += passo) tacche.push(v);

  const griglia = tacche.map(v =>
    `<span class="gc-tacca" style="bottom:${v / max * 100}%"><span class="gc-tacca-testo">${formattaNumero(v)}</span></span>`
  ).join("");

  const colonne = punti.map(p => {
    const tot = totale(p);
    const segmenti = p.valori.map((v, i) => {
      if (!v) return "";
      const s = serie[i];
      const coloreSegmento = p.evidenzia === false && s.coloreTenue ? s.coloreTenue : s.colore;
      return `<span class="gc-segmento" style="flex:${v} 1 0; background:${coloreSegmento}"></span>`;
    }).join("");
    const righeTooltip = serie.length > 1
      ? serie.map((s, i) => `${s.nome}: ${formattaNumero(p.valori[i] || 0)}${unita}`).join("\n")
      : `${formattaNumero(tot)}${unita}`;
    const tooltip = `${p.etichetta}${p.sottoetichetta ? " " + p.sottoetichetta : ""}\n${righeTooltip}`;
    const tag = p.onClick ? "button" : "div";
    const attributi = p.onClick ? ` type="button" onclick="_eseguiAzioneGrafico(${_registraAzione(p.onClick)})"` : "";
    return `
      <${tag} class="gc-slot${p.onClick ? " cliccabile" : ""}"${attributi} data-tooltip="${_esc(tooltip)}">
        <span class="gc-colonna" style="height:${tot / max * 100}%">
          ${etichetteValori && tot > 0 ? `<span class="gc-valore">${formattaNumero(tot)}</span>` : ""}
          ${segmenti}
        </span>
      </${tag}>`;
  }).join("");

  const asseX = punti.map(p =>
    `<span class="gc-etichetta">${_esc(p.etichetta)}${p.sottoetichetta ? `<small>${_esc(p.sottoetichetta)}</small>` : ""}</span>`
  ).join("");

  el.innerHTML = `
    <div class="grafico grafico-colonne">
      ${serie.length > 1 ? _legenda(serie) : ""}
      <div class="gc-scorrimento">
        <div class="gc-contenuto" style="min-width:${punti.length * 34 + 40}px">
          <div class="gc-area" style="height:${altezza}px">
            ${griglia}
            <div class="gc-colonne">${colonne}</div>
          </div>
          <div class="gc-asse-x">${asseX}</div>
        </div>
      </div>
    </div>`;
}
