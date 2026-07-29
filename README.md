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
