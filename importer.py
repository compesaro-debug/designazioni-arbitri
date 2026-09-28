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
        df_mappato = _mappa_filtro_gare(df)
    elif tabella_formato == "indisponibilita" and _is_formato_elenco_indispo(df):
        df_mappato = _mappa_elenco_indispo(df)
    else:
        df_mappato = map_columns(df, tabella_formato)

    # normalizzo il campo 'data'/'data_inizio'/'data_fine' se sono datetime letti come stringa
    # strana: sull'intera colonna in un colpo solo (vettoriale), non riga per riga, perché su
    # file con molte righe (es. il calendario di un'intera stagione) farlo valore per valore
    # con pandas è molto più lento e si sente parecchio in fase di import.
    for col in ("data", "data_inizio", "data_fine"):
        if col in df_mappato.columns:
            df_mappato[col] = _formatta_colonna_data(df_mappato[col])

    return df_mappato.to_dict(orient="records")


# Formato di export "filtro gare" (usato ad es. dai portali federali di pallavolo): ha due
# colonne di intestazione chiamate entrambe "Data" (la seconda, che pandas rinomina in "Data.1"
# per evitare il duplicato, contiene in realtà l'orario), quindi non può essere riconosciuto
# dalla mappatura generica basata sul nome delle intestazioni. Le colonne degli ufficiali di
# gara (I Arbitro, II Arbitro...) NON vengono richieste per il riconoscimento: sull'export delle
# gare "da disputare" non ci sono affatto (la gara non è ancora stata giocata/designata), quindi
# richiederle escludeva proprio quel caso e faceva ricadere il file sulla mappatura generica,
# che non riconosce "COD."/"G."/"N."/"Data.1" e lasciava campionato/girone/numero_gara/ora
# vuoti per ogni riga (e quindi tutte le righe sembravano duplicate tra loro).
_FILTRO_GARE_RICHIESTE = {"cod", "g", "n", "affa", "squadraa", "affb", "squadrab", "ris"}


def _is_formato_filtro_gare(df):
    colonne_normalizzate = {_normalize(c) for c in df.columns}
    return _FILTRO_GARE_RICHIESTE.issubset(colonne_normalizzate)


def _mappa_filtro_gare(df):
    """Come _is_formato_filtro_gare: rimappa le colonne di questo formato sui campi canonici
    di 'partite'. Lavora su colonne intere (Series) invece che riga per riga, così anche un
    file con migliaia di gare (es. il calendario di una stagione) si legge in un istante."""
    norm = {_normalize(c): c for c in df.columns}
    vuota = pd.Series([""] * len(df), index=df.index)

    def col(chiave_norm):
        c = norm.get(chiave_norm)
        return df[c].astype(str).str.strip() if c is not None else vuota.copy()

    risultato = col("ris")
    arbitro = col("iarbitro")
    # partita disputata ma senza un I Arbitro nominativo nel file: la federazione in questi
    # casi assegna un "Arbitro Associato" senza registrarne il nome.
    arbitro = arbitro.mask((arbitro == "") & (risultato != ""), "Arbitro Associato")

    return pd.DataFrame({
        "data": col("data"),
        "ora": col("data1").str.replace(".", ":", regex=False),
        "campionato": col("cod"),
        "categoria": vuota.copy(),
        "girone": col("g"),
        "numero_gara": col("n"),
        "localita": col("localita"),
        "campo": col("impianto"),
        "aff_a": col("affa"),
        "squadra_casa": col("squadraa"),
        "aff_b": col("affb"),
        "squadra_ospite": col("squadrab"),
        "risultato": risultato,
        "parziali": col("parziali").str.split().str.join(" "),
        "numero_ufficiali": col("ufficiale"),
        "arbitro": arbitro,
        "residenza_arbitro": col("residenza"),
        "assistente1": col("iiarbitro"),
        "residenza_assistente1": col("residenza1"),
        "osservatore_associato": col("osservatoreassociat"),
        "residenza_osservatore_associato": col("residenza2"),
        "segnapunti": col("segnapunti"),
        "residenza_segnapunti": col("residenza3"),
        "assistente2": col("arbitroassociato"),
        "residenza_assistente2": col("residenza4"),
        "osservatore": col("osservatore"),
        "residenza_osservatore": col("residenza5"),
    })


# Formato di export "elenco indisponibilità" (portali federali): le colonne "Da" e "A"
# contengono data e ora combinate in un'unica cella (es. "01/02/2026 00.00"), quindi il valore
# va spezzato in due campi distinti e non può essere riconosciuto dalla mappatura generica.
_ELENCO_INDISPO_RICHIESTE = {"da", "a", "motivo", "codicefiscale", "cognomeenome"}


def _is_formato_elenco_indispo(df):
    colonne_normalizzate = {_normalize(c) for c in df.columns}
    return _ELENCO_INDISPO_RICHIESTE.issubset(colonne_normalizzate)


def _spezza_colonna_data_ora(colonna):
    """Versione vettoriale di 'divide ogni cella gg/mm/aaaa hh.mm nelle sue due componenti':
    un'unica operazione sull'intera colonna invece di una per riga."""
    parti = colonna.str.split(n=1, expand=True)
    data = parti[0].fillna("") if 0 in parti.columns else pd.Series([""] * len(colonna), index=colonna.index)
    if 1 in parti.columns:
        ora = parti[1].fillna("").str.replace(".", ":", regex=False)
    else:
        ora = pd.Series([""] * len(colonna), index=colonna.index)
    return data, ora


def _mappa_elenco_indispo(df):
    norm = {_normalize(c): c for c in df.columns}
    vuota = pd.Series([""] * len(df), index=df.index)

    def col(chiave_norm):
        c = norm.get(chiave_norm)
        return df[c].astype(str).str.strip() if c is not None else vuota.copy()

    data_inizio, ora_inizio = _spezza_colonna_data_ora(col("da"))
    data_fine, ora_fine = _spezza_colonna_data_ora(col("a"))
    dr_data, dr_ora = _spezza_colonna_data_ora(col("datarichiesta"))
    dr_data = _formatta_colonna_data(dr_data)
    data_richiesta = (dr_data + " " + dr_ora).str.strip()

    return pd.DataFrame({
        "arbitro": col("cognomeenome"),
        "codice_fiscale": col("codicefiscale"),
        "ruolo": col("ruolo"),
        "data_inizio": data_inizio,
        "ora_inizio": ora_inizio,
        "data_fine": data_fine,
        "ora_fine": ora_fine,
        "motivo": col("motivo"),
        "data_richiesta": data_richiesta,
    })


def _formatta_colonna_data(colonna):
    """Versione vettoriale di 'interpreta come data e riformatta in ISO': prova a leggere
    l'intera colonna come date in un colpo solo (gestisce anche datetime di Excel), lasciando
    il testo originale dove non è una data riconoscibile. Riga per riga con pandas è molto più
    lento su file con tante righe, ed è la causa principale della lentezza sui file di import
    grandi (es. il calendario di un'intera stagione per le gare 'da disputare')."""
    testo = colonna.astype(str).str.strip()
    interpretata = pd.to_datetime(testo, dayfirst=True, errors="coerce")
    formattata = interpretata.dt.strftime("%Y-%m-%d")
    return formattata.where(interpretata.notna(), testo)
