import re
import pandas as pd
import unicodedata


def _normalize(text):
    """Normalizza un'intestazione: minuscolo, senza accenti, senza spazi/simboli extra."""
    text = str(text).strip().lower()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "", text)
    return text


# Mappa: campo canonico -> possibili varianti di intestazione (già normalizzate al volo)
FIELD_MAP = {
    "arbitri": {
        "codice_fiscale": ["codicefiscale", "cf", "cfiscale"],
        "cognome_nome": ["cognomeenome", "cognomenome", "nominativo", "cognomenomearbitro"],
        "matricola": ["matricola", "matr", "codicearbitro"],
        "comune": ["comune", "citta", "città", "residenza", "comuneresidenza"],
        "ruolo": ["ruolo", "qualifica", "categoria"],
        "cellulare": ["cellulare", "telefono", "cellulare1", "numerocellulare", "tel"],
        "email": ["email", "emails", "posta", "postaelettronica", "indirizzoemail"],
    },
    "partite": {
        "data": ["data", "datapartita", "giorno"],
        "ora": ["ora", "orario"],
        "campionato": ["campionato", "torneo"],
        "categoria": ["categoria", "cat"],
        "girone": ["girone", "gruppo", "gironegruppo"],
        "numero_gara": ["numerogara", "ngara", "nrgara", "numero"],
        "localita": ["localita", "città", "citta", "comune"],
        "squadra_casa": ["squadracasa", "casa", "squadraa", "padroniddicasa", "padronidicasa"],
        "squadra_ospite": ["squadraospite", "ospite", "squadrab", "trasferta"],
        "campo": ["campo", "luogo", "impianto"],
        "aff_a": ["affa", "affiliazionecasa", "codicesquadracasa"],
        "aff_b": ["affb", "affiliazioneospite", "codicesquadraospite"],
        "arbitro": ["arbitro", "arbitrodesignato"],
        "residenza_arbitro": ["residenzaarbitro"],
        "assistente1": ["assistente1", "ai1", "guardalinee1", "assistentea", "iiarbitro"],
        "residenza_assistente1": ["residenzaassistente1", "residenzaassistentea"],
        "assistente2": ["assistente2", "ai2", "guardalinee2", "assistenteb", "arbitroassociato"],
        "residenza_assistente2": ["residenzaassistente2", "residenzaassistenteb"],
        "osservatore": ["osservatore"],
        "residenza_osservatore": ["residenzaosservatore"],
        "osservatore_associato": ["osservatoreassociato", "osservatoreassociat"],
        "residenza_osservatore_associato": ["residenzaosservatoreassociato"],
        "segnapunti": ["segnapunti"],
        "residenza_segnapunti": ["residenzasegnapunti"],
        "risultato": ["risultato", "score", "esito", "ris"],
        "parziali": ["parziali", "setscore", "parziale"],
        "numero_ufficiali": ["ufficiale", "ufficiali", "numeroufficiali"],
    },
    "indisponibilita": {
        "arbitro": ["arbitro", "nomearbitro", "cognomeenome", "cognomenome"],
        "codice_fiscale": ["codicefiscale", "cf", "cfiscale"],
        "ruolo": ["ruolo", "qualifica"],
        "data_inizio": ["datainizio", "dal"],
        "ora_inizio": ["orainizio", "oradal"],
        "data_fine": ["datafine", "al"],
        "ora_fine": ["orafine", "oraal"],
        "motivo": ["motivo", "causale", "note"],
        "data_richiesta": ["datarichiesta"],
    },
}


def map_columns(df, tabella):
    """Rinomina le colonne del dataframe secondo i campi canonici della tabella indicata."""
    field_map = FIELD_MAP[tabella]
    # costruisco una mappa inversa: variante_normalizzata -> campo_canonico
    reverse = {}
    for canonico, varianti in field_map.items():
        reverse[_normalize(canonico)] = canonico
        for v in varianti:
            reverse[_normalize(v)] = canonico

    nuove_colonne = {}
    for col in df.columns:
        norm = _normalize(col)
        if norm in reverse:
            nuove_colonne[col] = reverse[norm]

    df = df.rename(columns=nuove_colonne)
    # tengo solo le colonne riconosciute
    colonne_valide = [c for c in df.columns if c in field_map.keys()]
    df = df[colonne_valide]
    return df


def leggi_excel(file_stream, tabella):
    """Legge un file Excel e restituisce una lista di dict pronti per l'inserimento nel DB."""
    # le tabelle storiche (import per una stagione passata) hanno lo stesso formato Excel
    # delle corrispondenti live: usiamo la stessa logica di riconoscimento/mappatura colonne.
    tabella_formato = {"partite_storiche": "partite", "indisponibilita_storiche": "indisponibilita"}.get(tabella, tabella)

    df = pd.read_excel(file_stream, dtype=str)
    df = df.fillna("")

    if tabella_formato == "partite" and _is_formato_filtro_gare(df):
        record = _mappa_filtro_gare(df)
    elif tabella_formato == "indisponibilita" and _is_formato_elenco_indispo(df):
        record = _mappa_elenco_indispo(df)
    else:
        df = map_columns(df, tabella_formato)
        record = df.to_dict(orient="records")

    # normalizzo il campo 'data'/'data_inizio'/'data_fine' se sono datetime letti come stringa strana
    for riga in record:
        for col in ("data", "data_inizio", "data_fine"):
            if col in riga:
                riga[col] = _format_possible_date(riga[col])

    return record


# Formato di export "filtro gare" (usato ad es. dai portali federali di pallavolo per le
# partite disputate): ha due colonne di intestazione chiamate entrambe "Data" (la seconda,
# che pandas rinomina in "Data.1" per evitare il duplicato, contiene in realtà l'orario), quindi
# non può essere riconosciuto dalla mappatura generica basata sul nome delle intestazioni.
_FILTRO_GARE_RICHIESTE = {"cod", "affa", "squadraa", "affb", "squadrab", "ris", "iarbitro"}


def _is_formato_filtro_gare(df):
    colonne_normalizzate = {_normalize(c) for c in df.columns}
    return _FILTRO_GARE_RICHIESTE.issubset(colonne_normalizzate)


def _mappa_filtro_gare(df):
    norm = {_normalize(c): c for c in df.columns}

    def val(chiave_norm, riga):
        col = norm.get(chiave_norm)
        return str(riga.get(col, "")).strip() if col else ""

    righe = []
    for _, r in df.iterrows():
        risultato = val("ris", r)
        arbitro = val("iarbitro", r)
        if not arbitro and risultato:
            # partita disputata ma senza un I Arbitro nominativo nel file: la federazione
            # in questi casi assegna un "Arbitro Associato" senza registrarne il nome.
            arbitro = "Arbitro Associato"
        righe.append({
            "data": val("data", r),
            "ora": val("data1", r).replace(".", ":"),
            "campionato": val("cod", r),
            "categoria": "",
            "girone": val("g", r),
            "numero_gara": val("n", r),
            "localita": val("localita", r),
            "campo": val("impianto", r),
            "aff_a": val("affa", r),
            "squadra_casa": val("squadraa", r),
            "aff_b": val("affb", r),
            "squadra_ospite": val("squadrab", r),
            "risultato": risultato,
            "parziali": " ".join(val("parziali", r).split()),
            "numero_ufficiali": val("ufficiale", r),
            "arbitro": arbitro,
            "residenza_arbitro": val("residenza", r),
            "assistente1": val("iiarbitro", r),
            "residenza_assistente1": val("residenza1", r),
            "osservatore_associato": val("osservatoreassociat", r),
            "residenza_osservatore_associato": val("residenza2", r),
            "segnapunti": val("segnapunti", r),
            "residenza_segnapunti": val("residenza3", r),
            "assistente2": val("arbitroassociato", r),
            "residenza_assistente2": val("residenza4", r),
            "osservatore": val("osservatore", r),
            "residenza_osservatore": val("residenza5", r),
        })
    return righe


# Formato di export "elenco indisponibilità" (portali federali): le colonne "Da" e "A"
# contengono data e ora combinate in un'unica cella (es. "01/02/2026 00.00"), quindi il valore
# va spezzato in due campi distinti e non può essere riconosciuto dalla mappatura generica.
_ELENCO_INDISPO_RICHIESTE = {"da", "a", "motivo", "codicefiscale", "cognomeenome"}


def _is_formato_elenco_indispo(df):
    colonne_normalizzate = {_normalize(c) for c in df.columns}
    return _ELENCO_INDISPO_RICHIESTE.issubset(colonne_normalizzate)


def _spezza_data_ora(testo):
    """Divide una stringa 'gg/mm/aaaa hh.mm' nelle sue componenti data e ora (hh:mm)."""
    parti = str(testo).strip().split()
    data = parti[0] if len(parti) >= 1 else ""
    ora = parti[1].replace(".", ":") if len(parti) >= 2 else ""
    return data, ora


def _mappa_elenco_indispo(df):
    norm = {_normalize(c): c for c in df.columns}

    def val(chiave_norm, riga):
        col = norm.get(chiave_norm)
        return str(riga.get(col, "")).strip() if col else ""

    righe = []
    for _, r in df.iterrows():
        data_inizio, ora_inizio = _spezza_data_ora(val("da", r))
        data_fine, ora_fine = _spezza_data_ora(val("a", r))
        data_richiesta_data, data_richiesta_ora = _spezza_data_ora(val("datarichiesta", r))
        data_richiesta_data = _format_possible_date(data_richiesta_data)
        data_richiesta = f"{data_richiesta_data} {data_richiesta_ora}".strip()

        righe.append({
            "arbitro": val("cognomeenome", r),
            "codice_fiscale": val("codicefiscale", r),
            "ruolo": val("ruolo", r),
            "data_inizio": data_inizio,
            "ora_inizio": ora_inizio,
            "data_fine": data_fine,
            "ora_fine": ora_fine,
            "motivo": val("motivo", r),
            "data_richiesta": data_richiesta,
        })
    return righe


def _format_possible_date(val):
    val = str(val).strip()
    if not val:
        return val
    # prova a interpretare come data pandas (gestisce anche datetime di Excel)
    try:
        dt = pd.to_datetime(val, dayfirst=True, errors="raise")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return val
