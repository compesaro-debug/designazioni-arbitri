import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "designazioni.db")

# Elenco completo dei campi della tabella "partite" (esclusi id e disputata), nell'ordine
# in cui compaiono nel file Excel di export "filtro gare" usato per l'import delle partite disputate.
PARTITE_COLONNE = [
    "data", "ora", "campionato", "categoria", "girone", "numero_gara", "localita", "campo",
    "aff_a", "squadra_casa", "aff_b", "squadra_ospite", "risultato", "parziali", "numero_ufficiali",
    "arbitro", "residenza_arbitro", "assistente1", "residenza_assistente1",
    "osservatore_associato", "residenza_osservatore_associato", "segnapunti", "residenza_segnapunti",
    "assistente2", "residenza_assistente2", "osservatore", "residenza_osservatore",
]

# Accordo di trasferta/rimborso km dichiarato per la coppia arbitro+2° arbitro di una gara
# (es. viaggiano insieme con un'unica auto): solo sulla tabella "partite" live, non su
# quella storica, per questo è una lista separata da PARTITE_COLONNE (che è condivisa con
# lo schema di partite_storiche).
PARTITE_RIMBORSO_COLONNE = ["rimborso_km_modalita", "rimborso_km_manuale_arbitro", "rimborso_km_manuale_assistente1"]

# Elenco completo dei campi della tabella "indisponibilita", nell'ordine in cui compaiono
# nel file Excel di export usato per l'import (colonne Da/A con data e ora combinate).
INDISPONIBILITA_COLONNE = [
    "arbitro", "codice_fiscale", "ruolo", "data_inizio", "ora_inizio",
    "data_fine", "ora_fine", "motivo", "data_richiesta",
]

# Campi della tabella "note_inibizioni" (inserimento manuale, nessun import Excel).
NOTE_INIBIZIONI_COLONNE = ["arbitro", "tipo", "descrizione", "codice_affiliazione"]

# Campi delle tabelle per collegare tra loro i gironi/fasi di uno stesso campionato
# (es. "2DFUNA" e "POFF2DIV" sono in realtà lo stesso torneo in due fasi diverse),
# così le statistiche per squadra non si spezzano quando cambia il codice campionato.
CAMPIONATI_COLONNE = ["nome", "km_per_partita"]
SQUADRE_COLONNE = ["campionato_id", "nome"]
# "tipo_fase": sotto-alias veloce per distinguere fase campionato/playoff/final four
# all'interno dello stesso alias, senza doverli separare in alias diversi come si fa per
# i gironi. Vuoto = "campionato" (fase regolare, il default).
CAMPIONATI_CODICI_COLONNE = ["campionato_id", "codice", "tipo_fase"]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _migra_se_necessario(conn):
    """Se una tabella esiste già ma le manca qualche colonna prevista dallo schema attuale,
    la aggiunge con ALTER TABLE (senza mai toccare i dati già presenti)."""
    schema_atteso = {
        "arbitri": ["codice_fiscale", "cognome_nome", "matricola", "comune", "ruolo", "scadenza_certificato_medico", "cellulare", "email"],
        "partite": PARTITE_COLONNE + ["disputata"] + PARTITE_RIMBORSO_COLONNE,
        "indisponibilita": INDISPONIBILITA_COLONNE,
        "note_inibizioni": NOTE_INIBIZIONI_COLONNE,
        "campionati": CAMPIONATI_COLONNE,
        "squadre": SQUADRE_COLONNE,
        "campionati_codici": CAMPIONATI_CODICI_COLONNE,
        "campionati_storici": ["km_per_partita"],
        "campionati_storici_codici": ["tipo_fase"],
    }
    cur = conn.cursor()
    tabelle_esistenti = {r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}

    for tabella, colonne_attese in schema_atteso.items():
        if tabella not in tabelle_esistenti:
            continue
        colonne_reali = {r[1] for r in cur.execute(f"PRAGMA table_info({tabella})").fetchall()}
        for colonna in colonne_attese:
            if colonna not in colonne_reali:
                cur.execute(f"ALTER TABLE {tabella} ADD COLUMN {colonna} TEXT DEFAULT ''")

    # "attivo" è un flag intero (1/0), non testo: gestito a parte così le righe già presenti
    # ricevono di default 1 (in attività) invece di una stringa vuota.
    if "arbitri" in tabelle_esistenti:
        colonne_arbitri = {r[1] for r in cur.execute("PRAGMA table_info(arbitri)").fetchall()}
        if "attivo" not in colonne_arbitri:
            cur.execute("ALTER TABLE arbitri ADD COLUMN attivo INTEGER NOT NULL DEFAULT 1")

    # "arbitrabile_da_associato": flag intero (1/0) sull'alias campionato, stesso discorso.
    if "campionati" in tabelle_esistenti:
        colonne_campionati = {r[1] for r in cur.execute("PRAGMA table_info(campionati)").fetchall()}
        if "arbitrabile_da_associato" not in colonne_campionati:
            cur.execute("ALTER TABLE campionati ADD COLUMN arbitrabile_da_associato INTEGER NOT NULL DEFAULT 1")

    conn.commit()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS arbitri (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codice_fiscale TEXT DEFAULT '',
            cognome_nome TEXT NOT NULL DEFAULT '',
            matricola TEXT DEFAULT '',
            comune TEXT DEFAULT '',
            ruolo TEXT DEFAULT '',
            scadenza_certificato_medico TEXT DEFAULT '',
            cellulare TEXT DEFAULT '',
            email TEXT DEFAULT '',
            attivo INTEGER NOT NULL DEFAULT 1
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS partite (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT DEFAULT '',
            ora TEXT DEFAULT '',
            campionato TEXT DEFAULT '',
            categoria TEXT DEFAULT '',
            girone TEXT DEFAULT '',
            numero_gara TEXT DEFAULT '',
            localita TEXT DEFAULT '',
            campo TEXT DEFAULT '',
            aff_a TEXT DEFAULT '',
            squadra_casa TEXT DEFAULT '',
            aff_b TEXT DEFAULT '',
            squadra_ospite TEXT DEFAULT '',
            risultato TEXT DEFAULT '',
            parziali TEXT DEFAULT '',
            numero_ufficiali TEXT DEFAULT '',
            arbitro TEXT DEFAULT '',
            residenza_arbitro TEXT DEFAULT '',
            assistente1 TEXT DEFAULT '',
            residenza_assistente1 TEXT DEFAULT '',
            osservatore_associato TEXT DEFAULT '',
            residenza_osservatore_associato TEXT DEFAULT '',
            segnapunti TEXT DEFAULT '',
            residenza_segnapunti TEXT DEFAULT '',
            assistente2 TEXT DEFAULT '',
            residenza_assistente2 TEXT DEFAULT '',
            osservatore TEXT DEFAULT '',
            residenza_osservatore TEXT DEFAULT '',
            disputata INTEGER NOT NULL DEFAULT 0,
            rimborso_km_modalita TEXT DEFAULT '',
            rimborso_km_manuale_arbitro TEXT DEFAULT '',
            rimborso_km_manuale_assistente1 TEXT DEFAULT ''
        )
    """)

    # Scelta di rimborso km (auto unica/tutoraggio/manuale) salvata a parte, indicizzata per
    # campionato+numero gara invece che per id di riga: la riga di "partite" può essere
    # cancellata e reimportata (es. import "sostituisci" di da-disputare/disputate), ma la
    # scelta fatta dal designante deve sopravvivere e ripresentarsi come proposta da
    # confermare quando la gara ricompare, invece di andare persa.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS rimborso_km_proposte (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campionato TEXT DEFAULT '',
            numero_gara TEXT DEFAULT '',
            arbitro TEXT DEFAULT '',
            assistente1 TEXT DEFAULT '',
            rimborso_km_modalita TEXT DEFAULT '',
            rimborso_km_manuale_arbitro TEXT DEFAULT '',
            rimborso_km_manuale_assistente1 TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS indisponibilita (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arbitro TEXT DEFAULT '',
            codice_fiscale TEXT DEFAULT '',
            ruolo TEXT DEFAULT '',
            data_inizio TEXT DEFAULT '',
            ora_inizio TEXT DEFAULT '',
            data_fine TEXT DEFAULT '',
            ora_fine TEXT DEFAULT '',
            motivo TEXT DEFAULT '',
            data_richiesta TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS note_inibizioni (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arbitro TEXT DEFAULT '',
            tipo TEXT NOT NULL DEFAULT 'nota',
            descrizione TEXT DEFAULT '',
            codice_affiliazione TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS campionati (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL DEFAULT '',
            arbitrabile_da_associato INTEGER NOT NULL DEFAULT 1,
            km_per_partita TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS squadre (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campionato_id INTEGER NOT NULL,
            nome TEXT NOT NULL DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS campionati_codici (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campionato_id INTEGER NOT NULL,
            codice TEXT NOT NULL DEFAULT '',
            tipo_fase TEXT DEFAULT ''
        )
    """)

    # Anagrafica società: collega il codice di affiliazione (comune a tutte le squadre
    # dello stesso club, es. under 13/prima divisione della stessa società) alla ragione
    # sociale ufficiale del club, cosi le statistiche possono mostrare il nome del club
    # invece del solo codice.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS societa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codice_affiliazione TEXT NOT NULL DEFAULT '' UNIQUE,
            ragione_sociale TEXT NOT NULL DEFAULT ''
        )
    """)

    # Distanze in km tra comuni (per il calcolo della distanza arbitro-partita in Designazioni),
    # importate una tantum dal file "tabella km.xlsx". Ogni coppia è salvata in entrambe le
    # direzioni con i nomi già normalizzati, così il lookup è una singola query diretta.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS distanze_comuni (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comune_a TEXT NOT NULL,
            comune_b TEXT NOT NULL,
            comune_a_norm TEXT NOT NULL,
            comune_b_norm TEXT NOT NULL,
            km REAL NOT NULL,
            UNIQUE(comune_a_norm, comune_b_norm)
        )
    """)

    # Stagioni: la stagione con dati_live=1 (una sola, garantito dall'indice univoco parziale
    # sotto) rappresenta la stagione corrente e i suoi dati sono le tabelle live (partite,
    # indisponibilita, campionati...) usate da tutte le pagine operative, invariate. Le altre
    # stagioni (storiche) hanno i propri dati nelle tabelle "_storiche"/"_storici" qui sotto,
    # cosi' le pagine operative non vengono mai toccate da questa funzionalita'.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stagioni (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL DEFAULT '',
            dati_live INTEGER NOT NULL DEFAULT 0
        )
    """)
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stagione_live ON stagioni(dati_live) WHERE dati_live = 1
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS partite_storiche (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stagione_id INTEGER NOT NULL,
            data TEXT DEFAULT '',
            ora TEXT DEFAULT '',
            campionato TEXT DEFAULT '',
            categoria TEXT DEFAULT '',
            girone TEXT DEFAULT '',
            numero_gara TEXT DEFAULT '',
            localita TEXT DEFAULT '',
            campo TEXT DEFAULT '',
            aff_a TEXT DEFAULT '',
            squadra_casa TEXT DEFAULT '',
            aff_b TEXT DEFAULT '',
            squadra_ospite TEXT DEFAULT '',
            risultato TEXT DEFAULT '',
            parziali TEXT DEFAULT '',
            numero_ufficiali TEXT DEFAULT '',
            arbitro TEXT DEFAULT '',
            residenza_arbitro TEXT DEFAULT '',
            assistente1 TEXT DEFAULT '',
            residenza_assistente1 TEXT DEFAULT '',
            osservatore_associato TEXT DEFAULT '',
            residenza_osservatore_associato TEXT DEFAULT '',
            segnapunti TEXT DEFAULT '',
            residenza_segnapunti TEXT DEFAULT '',
            assistente2 TEXT DEFAULT '',
            residenza_assistente2 TEXT DEFAULT '',
            osservatore TEXT DEFAULT '',
            residenza_osservatore TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS indisponibilita_storiche (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stagione_id INTEGER NOT NULL,
            arbitro TEXT DEFAULT '',
            codice_fiscale TEXT DEFAULT '',
            ruolo TEXT DEFAULT '',
            data_inizio TEXT DEFAULT '',
            ora_inizio TEXT DEFAULT '',
            data_fine TEXT DEFAULT '',
            ora_fine TEXT DEFAULT '',
            motivo TEXT DEFAULT '',
            data_richiesta TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS campionati_storici (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stagione_id INTEGER NOT NULL,
            nome TEXT NOT NULL DEFAULT '',
            km_per_partita TEXT DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS squadre_storiche (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campionato_storico_id INTEGER NOT NULL,
            nome TEXT NOT NULL DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS campionati_storici_codici (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campionato_storico_id INTEGER NOT NULL,
            codice TEXT NOT NULL DEFAULT '',
            tipo_fase TEXT DEFAULT ''
        )
    """)

    conn.commit()
    _migra_se_necessario(conn)

    # garantisce che esista sempre esattamente una stagione "corrente" (dati_live=1),
    # creata automaticamente al primo avvio.
    if not cur.execute("SELECT 1 FROM stagioni WHERE dati_live=1").fetchone():
        cur.execute("INSERT INTO stagioni (nome, dati_live) VALUES ('Stagione corrente', 1)")
        conn.commit()

    conn.close()
