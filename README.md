# Designazioni Arbitri

Applicazione web locale per gestire designazioni arbitrali: partite da disputare, partite disputate, anagrafica arbitri e indisponibilità. Ogni pagina permette l'import diretto da file Excel (.xlsx).

## Requisiti

- Python 3.9 o superiore

## Installazione (prima volta)

Apri il terminale nella cartella del progetto e lancia:

```bash
pip install -r requirements.txt
```

## Avvio

```bash
python app.py
```

Poi apri il browser su:

```
http://127.0.0.1:5000
```

L'app resta attiva finché il terminale resta aperto. Per fermarla: `CTRL+C`.

## Dati

I dati vengono salvati in un file SQLite locale: `data/designazioni.db`, creato automaticamente al primo avvio. Non serve installare nessun database esterno. Facendo una copia di questo file hai un backup completo di tutti i dati.

## Struttura delle pagine

- **Partite** (`/`): due schede, "Da disputare" e "Disputate". Le partite spostate su "Disputate" mostrano anche il campo Risultato.
- **Anagrafica arbitri** (`/arbitri`): elenco arbitri con dati di contatto.
- **Indisponibilità** (`/indisponibilita`): periodi in cui un arbitro non è disponibile.

## Import da Excel

In ogni pagina, il pulsante **"Importa da Excel"** apre una finestra dove puoi:
- caricare un file `.xlsx`;
- scegliere se **aggiungere** i dati a quelli esistenti o **sostituire** quelli già presenti (per le partite, la sostituzione riguarda solo la scheda attiva: importando su "Disputate" non tocchi le partite "Da disputare", e viceversa).

Le colonne del file Excel vengono riconosciute automaticamente in base al nome dell'intestazione (senza distinguere maiuscole/minuscole o accenti). Colonne riconosciute per ciascuna pagina:

**Anagrafica arbitri**
`Codice fiscale`, `Cognome e nome`, `Matricola`, `Comune`, `Ruolo`

**Partite**
`Data`, `Ora`, `Campionato`, `Categoria`, `Girone`, `Squadra Casa`, `Squadra Ospite`, `Campo`, `Arbitro`, `Assistente1`, `Assistente2`, `Risultato`

**Indisponibilità**
`Arbitro`, `Data Inizio` (o Dal), `Data Fine` (o Al), `Motivo`

Le date nel file Excel possono essere in formato `GG/MM/AAAA` o simili: vengono convertite automaticamente. Le colonne non riconosciute vengono semplicemente ignorate; se nessuna colonna viene riconosciuta, l'import segnala un errore.

## Personalizzazioni future

Il progetto è volutamente semplice per partire in fretta. Idee naturali per estenderlo in seguito:
- collegare l'arbitro delle partite all'anagrafica (invece del solo testo libero), per evidenziare automaticamente i conflitti con le indisponibilità;
- esportazione in Excel/PDF delle designazioni;
- login e gestione utenti se più persone devono accedere.

## Import automatico (per uno script che scarica l'Excel)

Il sito ha un indirizzo riservato a cui uno script esterno può mandare l'Excel del calendario: l'import è sempre **Aggiungi** (non cancella mai niente), fa prima un backup del database (ne tiene gli ultimi 14) e salva un report, visibile in Partite → **Import automatici**.

Attivazione: impostare la variabile d'ambiente `IMPORT_TOKEN` (almeno 16 caratteri, segreta) prima di avviare il sito. Senza, la funzione è spenta.

```bash
# manda il file
curl -X POST -H "Authorization: Bearer <IMPORT_TOKEN>" -F "file=@calendario.xlsx" https://<sito>/api/automatico/import-partite
# segnala che lo script non è riuscito a scaricare il file (compare nell'elenco come Errore)
curl -X POST -H "Authorization: Bearer <IMPORT_TOKEN>" -H "Content-Type: application/json" -d '{"messaggio":"Login rifiutato"}' https://<sito>/api/automatico/errore
```

## Metterlo online su PythonAnywhere

1. Crea l'account su pythonanywhere.com (il nome utente diventa l'indirizzo `https://NOMEUTENTE.pythonanywhere.com`).
2. Console **Bash**: `git clone https://github.com/compesaro-debug/designazioni-arbitri.git` e poi `cd designazioni-arbitri && pip install --user -r requirements.txt`.
3. Scheda **Web** → *Add a new web app* → *Manual configuration* → Python 3.12 o 3.13 (non scegliere Flask: la configurazione la facciamo noi).
4. Nella stessa scheda apri il file **WSGI configuration** e sostituisci tutto il contenuto con:

```python
import os, sys
percorso = "/home/NOMEUTENTE/designazioni-arbitri"
if percorso not in sys.path:
    sys.path.insert(0, percorso)
os.environ["PRODUZIONE"] = "1"
os.environ["SECRET_KEY"] = "<stringa casuale lunga>"
os.environ["AUTH_USERNAME"] = "<il tuo utente>"
os.environ["AUTH_PASSWORD"] = "<password di almeno 10 caratteri>"
os.environ["IMPORT_TOKEN"] = "<altra stringa casuale lunga>"   # solo per l'import automatico
from app import app as application
```

   Una stringa casuale si genera con `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Con `PRODUZIONE=1` il sito non parte se la password è `admin`, è corta, o manca `SECRET_KEY`.
5. Scheda **Files**: carica `designazioni.db` in `designazioni-arbitri/data/` (il database non è in git; senza, il sito parte vuoto).
6. Scheda **Web**: attiva *Force HTTPS* e premi **Reload**.

Limiti del piano gratuito: il sito va rinnovato con il pulsante nella scheda Web ogni 3 mesi, e dai task programmati si può uscire solo verso un elenco di siti ammessi, quindi lo script che scarica l'Excel da MPS deve girare altrove (il tuo PC o GitHub Actions) e mandare il file all'indirizzo `/api/automatico/import-partite`.
