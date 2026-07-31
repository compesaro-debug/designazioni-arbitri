from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import datetime
import os
import re
import secrets
import db
import importer

app = Flask(__name__)
db.init_db()

# Chiave per firmare i cookie di sessione: va impostata con la variabile d'ambiente SECRET_KEY
# in produzione (così le sessioni non si invalidano ad ogni riavvio); in locale, se non è
# impostata, ne viene generata una casuale ad ogni avvio (va bene per lo sviluppo).
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

# Credenziali di accesso al sito: da impostare con le variabili d'ambiente AUTH_USERNAME e
# AUTH_PASSWORD in produzione. I valori di default sono solo per l'uso in locale.
AUTH_USERNAME = os.environ.get("AUTH_USERNAME", "admin")
AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "admin")


@app.before_request
def richiedi_login():
    if request.path == "/login" or request.path.startswith("/static/"):
        return None
    if not session.get("autenticato"):
        return redirect(url_for("login", next=request.path))


@app.route("/login", methods=["GET", "POST"])
def login():
    errore = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == AUTH_USERNAME and password == AUTH_PASSWORD:
            session["autenticato"] = True
            session.permanent = True
            destinazione = request.args.get("next") or "/"
            return redirect(destinazione)
        errore = "Utente o password non corretti."
    return render_template("login.html", errore=errore)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------- PAGINE ----------

@app.route("/")
def home():
    conn = db.get_db()
    oggi = datetime.date.today().isoformat()
    tra_7gg = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()
    tra_30gg = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()

    n_da_disputare = conn.execute(
        "SELECT COUNT(*) FROM partite WHERE disputata=0"
    ).fetchone()[0]
    n_da_designare = conn.execute(
        "SELECT COUNT(*) FROM partite WHERE disputata=0 AND (arbitro='' OR arbitro IS NULL)"
    ).fetchone()[0]
    n_in_scadenza = conn.execute(
        "SELECT COUNT(*) FROM partite WHERE disputata=0 AND (arbitro='' OR arbitro IS NULL) "
        "AND data BETWEEN ? AND ?",
        (oggi, tra_7gg),
    ).fetchone()[0]
    n_indisponibilita_attive = conn.execute(
        "SELECT COUNT(*) FROM indisponibilita WHERE data_inizio<=? AND data_fine>=?",
        (oggi, oggi),
    ).fetchone()[0]
    n_arbitri = conn.execute("SELECT COUNT(*) FROM arbitri").fetchone()[0]
    n_inibizioni_attive = conn.execute(
        "SELECT COUNT(*) FROM note_inibizioni WHERE tipo='inibizione'"
    ).fetchone()[0]
    n_da_omologare = conn.execute(
        "SELECT COUNT(*) FROM partite WHERE disputata=1 AND numero_ufficiali!='1'"
    ).fetchone()[0]
    n_certificati_scadenza = conn.execute(
        "SELECT COUNT(*) FROM arbitri WHERE scadenza_certificato_medico!='' AND scadenza_certificato_medico<=?",
        (tra_30gg,),
    ).fetchone()[0]
    conn.close()

    return render_template(
        "home.html",
        active="home",
        n_da_disputare=n_da_disputare,
        n_da_designare=n_da_designare,
        n_in_scadenza=n_in_scadenza,
        n_indisponibilita_attive=n_indisponibilita_attive,
        n_arbitri=n_arbitri,
        n_inibizioni_attive=n_inibizioni_attive,
        n_da_omologare=n_da_omologare,
        n_certificati_scadenza=n_certificati_scadenza,
    )


@app.route("/partite")
def pagina_partite():
    return render_template("partite.html", active="partite")


@app.route("/arbitri")
def pagina_arbitri():
    return render_template("arbitri.html", active="arbitri")


@app.route("/indisponibilita")
def pagina_indisponibilita():
    return render_template("indisponibilita.html", active="indisponibilita")


@app.route("/inibizioni")
def pagina_inibizioni():
    return render_template("inibizioni.html", active="inibizioni")


@app.route("/designazioni")
def pagina_designazioni():
    return render_template("designazioni.html", active="designazioni")


@app.route("/disponibilita")
def pagina_disponibilita():
    return render_template("disponibilita.html", active="disponibilita")


@app.route("/campionati")
def pagina_campionati():
    return render_template("campionati.html", active="campionati")


@app.route("/societa")
def pagina_societa():
    return render_template("societa.html", active="societa")


@app.route("/riconoscimenti")
def pagina_riconoscimenti():
    return render_template("riconoscimenti.html", active="riconoscimenti")


@app.route("/report")
def pagina_report():
    return render_template("report.html", active="report")


@app.route("/dati")
def pagina_dati():
    return render_template("dati.html", active="dati")


@app.route("/rimborsi-km")
def pagina_rimborsi_km():
    return render_template("rimborsi_km.html", active="rimborsi_km")


# ---------- API: ARBITRI ----------

@app.route("/api/arbitri", methods=["GET"])
def get_arbitri():
    conn = db.get_db()
    rows = conn.execute("SELECT * FROM arbitri ORDER BY cognome_nome").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/arbitri", methods=["POST"])
def add_arbitro():
    data = request.json
    conn = db.get_db()
    conn.execute(
        "INSERT INTO arbitri (codice_fiscale, cognome_nome, matricola, comune, ruolo, scadenza_certificato_medico, cellulare, email, attivo) VALUES (?,?,?,?,?,?,?,?,?)",
        (data.get("codice_fiscale", ""), data.get("cognome_nome", ""), data.get("matricola", ""),
         data.get("comune", ""), data.get("ruolo", ""), data.get("scadenza_certificato_medico", ""),
         data.get("cellulare", ""), data.get("email", ""), int(data.get("attivo", 1))),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/arbitri/<int:id>", methods=["PUT"])
def update_arbitro(id):
    data = request.json
    conn = db.get_db()
    conn.execute(
        "UPDATE arbitri SET codice_fiscale=?, cognome_nome=?, matricola=?, comune=?, ruolo=?, scadenza_certificato_medico=?, cellulare=?, email=?, attivo=? WHERE id=?",
        (data.get("codice_fiscale", ""), data.get("cognome_nome", ""), data.get("matricola", ""),
         data.get("comune", ""), data.get("ruolo", ""), data.get("scadenza_certificato_medico", ""),
         data.get("cellulare", ""), data.get("email", ""), int(data.get("attivo", 1)), id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/arbitri/<int:id>", methods=["DELETE"])
def delete_arbitro(id):
    conn = db.get_db()
    conn.execute("DELETE FROM arbitri WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/arbitri/attivo-massivo", methods=["PUT"])
def imposta_attivo_massivo():
    """Imposta lo stato attivo/non attivo su più arbitri in un colpo solo (azione massiva
    dalla pagina Anagrafica arbitri)."""
    data = request.json
    ids = data.get("ids") or []
    attivo = int(data.get("attivo", 1))
    if not ids:
        return jsonify({"ok": False, "errore": "Nessun arbitro selezionato"}), 400
    conn = db.get_db()
    placeholders = ",".join(["?"] * len(ids))
    conn.execute(f"UPDATE arbitri SET attivo=? WHERE id IN ({placeholders})", (attivo, *ids))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "n_aggiornati": len(ids)})


@app.route("/api/arbitri/import", methods=["POST"])
def import_arbitri():
    return _import_generico("arbitri")


@app.route("/api/arbitri/import/anteprima", methods=["POST"])
def anteprima_import_arbitri():
    return _anteprima_import_generico("arbitri")


# ---------- API: PARTITE ----------

@app.route("/api/partite", methods=["GET"])
def get_partite():
    disputata = request.args.get("disputata", "0")
    conn = db.get_db()
    rows = conn.execute(
        "SELECT * FROM partite WHERE disputata=? ORDER BY data, ora", (disputata,)
    ).fetchall()
    mappa_tipo_fase = _carica_mappa_tipo_fase(conn)
    conn.close()
    risultato = [dict(r) for r in rows]
    for r in risultato:
        r["tipo_fase"] = mappa_tipo_fase.get(_norm_nome(r["campionato"]), "campionato")
    return jsonify(risultato)


@app.route("/api/partite", methods=["POST"])
def add_partita():
    data = request.json
    colonne = db.PARTITE_COLONNE + db.PARTITE_RIMBORSO_COLONNE
    valori = [data.get(c, "") for c in colonne] + [int(data.get("disputata", 0))]
    colonne_sql = ",".join(colonne + ["disputata"])
    placeholders = ",".join(["?"] * len(valori))
    conn = db.get_db()
    conn.execute(f"INSERT INTO partite ({colonne_sql}) VALUES ({placeholders})", valori)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/partite/<int:id>", methods=["PUT"])
def update_partita(id):
    data = request.json
    colonne = db.PARTITE_COLONNE + db.PARTITE_RIMBORSO_COLONNE
    valori = [data.get(c, "") for c in colonne] + [int(data.get("disputata", 0)), id]
    assegnazioni_sql = ",".join(f"{c}=?" for c in colonne + ["disputata"])
    conn = db.get_db()
    conn.execute(f"UPDATE partite SET {assegnazioni_sql} WHERE id=?", valori)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


def _salva_proposta_rimborso(conn, partita_id, modalita, km_manuale_arbitro, km_manuale_assistente1):
    """Salva la scelta di rimborso km appena fatta per questa gara in una tabella indipendente
    dalla riga 'partite' (indicizzata per campionato+numero gara, non per id di riga): così
    sopravvive anche se la gara viene cancellata e reimportata (es. import 'sostituisci' di
    da-disputare/disputate), e si può riproporre come suggerimento invece di andare persa.
    Se la gara viene ridesignata (cambia l'arbitro o il 2° arbitro), la voce qui viene
    sovrascritta con la scelta più recente: non resta mai un dato vecchio."""
    if not modalita:
        return
    riga = conn.execute("SELECT campionato, numero_gara, arbitro, assistente1 FROM partite WHERE id=?", (partita_id,)).fetchone()
    if not riga or not riga["campionato"] or not riga["numero_gara"]:
        return
    campionato_norm = _norm_confronto(riga["campionato"])
    numero_norm = _norm_confronto(riga["numero_gara"])
    esistente = None
    for r in conn.execute("SELECT id, campionato, numero_gara FROM rimborso_km_proposte").fetchall():
        if _norm_confronto(r["campionato"]) == campionato_norm and _norm_confronto(r["numero_gara"]) == numero_norm:
            esistente = r["id"]
            break
    valori = (riga["campionato"], riga["numero_gara"], riga["arbitro"], riga["assistente1"], modalita, km_manuale_arbitro, km_manuale_assistente1)
    if esistente:
        conn.execute(
            "UPDATE rimborso_km_proposte SET campionato=?, numero_gara=?, arbitro=?, assistente1=?, "
            "rimborso_km_modalita=?, rimborso_km_manuale_arbitro=?, rimborso_km_manuale_assistente1=? WHERE id=?",
            valori + (esistente,),
        )
    else:
        conn.execute(
            "INSERT INTO rimborso_km_proposte (campionato, numero_gara, arbitro, assistente1, "
            "rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1) VALUES (?,?,?,?,?,?,?)",
            valori,
        )


@app.route("/api/partite/<int:id>/rimborso-km", methods=["PUT"])
def update_rimborso_km(id):
    """Aggiorna solo l'accordo di trasferta/rimborso km di una gara, senza toccare nessun
    altro campo: a differenza della PUT generica su /api/partite/<id> (che richiede l'intero
    oggetto partita), questa è pensata per essere chiamata con un payload minimo dal popup di
    designazione e dalla scheda 'Rimborsi km', senza rischiare di svuotare altri campi."""
    data = request.json
    modalita = data.get("rimborso_km_modalita", "")
    km_manuale_arbitro = data.get("rimborso_km_manuale_arbitro", "")
    km_manuale_assistente1 = data.get("rimborso_km_manuale_assistente1", "")
    conn = db.get_db()
    conn.execute(
        "UPDATE partite SET rimborso_km_modalita=?, rimborso_km_manuale_arbitro=?, rimborso_km_manuale_assistente1=? WHERE id=?",
        (modalita, km_manuale_arbitro, km_manuale_assistente1, id),
    )
    _salva_proposta_rimborso(conn, id, modalita, km_manuale_arbitro, km_manuale_assistente1)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/partite/<int:id>", methods=["DELETE"])
def delete_partita(id):
    conn = db.get_db()
    conn.execute("DELETE FROM partite WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/partite/import", methods=["POST"])
def import_partite():
    # tipo = "disputate" oppure "da_disputare", determina il valore del campo 'disputata'
    tipo = request.args.get("tipo", "da_disputare")
    disputata_val = 1 if tipo == "disputate" else 0
    return _import_generico("partite", extra_fields={"disputata": disputata_val})


@app.route("/api/partite/import/anteprima", methods=["POST"])
def anteprima_import_partite():
    tipo = request.args.get("tipo", "da_disputare")
    disputata_val = 1 if tipo == "disputate" else 0
    return _anteprima_import_generico("partite", extra_fields={"disputata": disputata_val})


# ---------- API: INDISPONIBILITA ----------

@app.route("/api/indisponibilita", methods=["GET"])
def get_indisponibilita():
    conn = db.get_db()
    rows = conn.execute("SELECT * FROM indisponibilita ORDER BY data_inizio").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/indisponibilita", methods=["POST"])
def add_indisponibilita():
    data = request.json
    valori = [data.get(c, "") for c in db.INDISPONIBILITA_COLONNE]
    colonne_sql = ",".join(db.INDISPONIBILITA_COLONNE)
    placeholders = ",".join(["?"] * len(valori))
    conn = db.get_db()
    conn.execute(f"INSERT INTO indisponibilita ({colonne_sql}) VALUES ({placeholders})", valori)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/indisponibilita/<int:id>", methods=["PUT"])
def update_indisponibilita(id):
    data = request.json
    valori = [data.get(c, "") for c in db.INDISPONIBILITA_COLONNE] + [id]
    assegnazioni_sql = ",".join(f"{c}=?" for c in db.INDISPONIBILITA_COLONNE)
    conn = db.get_db()
    conn.execute(f"UPDATE indisponibilita SET {assegnazioni_sql} WHERE id=?", valori)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/indisponibilita/<int:id>", methods=["DELETE"])
def delete_indisponibilita(id):
    conn = db.get_db()
    conn.execute("DELETE FROM indisponibilita WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/indisponibilita/import", methods=["POST"])
def import_indisponibilita():
    return _import_generico("indisponibilita")


@app.route("/api/indisponibilita/import/anteprima", methods=["POST"])
def anteprima_import_indisponibilita():
    return _anteprima_import_generico("indisponibilita")


# ---------- API: NOTE E INIBIZIONI ----------

@app.route("/api/inibizioni", methods=["GET"])
def get_inibizioni():
    conn = db.get_db()
    rows = conn.execute("SELECT * FROM note_inibizioni ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/inibizioni", methods=["POST"])
def add_inibizione():
    data = request.json
    valori = [data.get(c, "") for c in db.NOTE_INIBIZIONI_COLONNE]
    colonne_sql = ",".join(db.NOTE_INIBIZIONI_COLONNE)
    placeholders = ",".join(["?"] * len(valori))
    conn = db.get_db()
    conn.execute(f"INSERT INTO note_inibizioni ({colonne_sql}) VALUES ({placeholders})", valori)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/inibizioni/<int:id>", methods=["PUT"])
def update_inibizione(id):
    data = request.json
    valori = [data.get(c, "") for c in db.NOTE_INIBIZIONI_COLONNE] + [id]
    assegnazioni_sql = ",".join(f"{c}=?" for c in db.NOTE_INIBIZIONI_COLONNE)
    conn = db.get_db()
    conn.execute(f"UPDATE note_inibizioni SET {assegnazioni_sql} WHERE id=?", valori)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/inibizioni/<int:id>", methods=["DELETE"])
def delete_inibizione(id):
    conn = db.get_db()
    conn.execute("DELETE FROM note_inibizioni WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- API: CAMPIONATI / SQUADRE / CODICI ----------
# Un "campionato" qui è il torneo logico (es. "2° Divisione Femminile"), che nel tempo può
# comparire nella tabella partite sotto più codici diversi (girone di andata/ritorno,
# poi playoff...). Collegando qui le squadre e i codici, le statistiche per squadra
# smettono di spezzarsi quando cambia il codice campionato.

@app.route("/api/campionati", methods=["GET"])
def get_campionati():
    conn = db.get_db()
    campionati = conn.execute("SELECT * FROM campionati ORDER BY nome").fetchall()
    risultato = []
    for c in campionati:
        n_squadre = conn.execute("SELECT COUNT(*) FROM squadre WHERE campionato_id=?", (c["id"],)).fetchone()[0]
        n_codici = conn.execute("SELECT COUNT(*) FROM campionati_codici WHERE campionato_id=?", (c["id"],)).fetchone()[0]
        risultato.append({
            "id": c["id"], "nome": c["nome"], "n_squadre": n_squadre, "n_codici": n_codici,
            "arbitrabile_da_associato": c["arbitrabile_da_associato"],
            "km_per_partita": c["km_per_partita"],
        })
    conn.close()
    return jsonify(risultato)


@app.route("/api/campionati", methods=["POST"])
def add_campionato():
    data = request.json
    conn = db.get_db()
    cur = conn.execute(
        "INSERT INTO campionati (nome, arbitrabile_da_associato, km_per_partita) VALUES (?,?,?)",
        (data.get("nome", ""), int(data.get("arbitrabile_da_associato", 1)), data.get("km_per_partita", "")),
    )
    conn.commit()
    nuovo_id = cur.lastrowid
    conn.close()
    return jsonify({"ok": True, "id": nuovo_id})


@app.route("/api/campionati/<int:id>", methods=["PUT"])
def update_campionato(id):
    data = request.json
    conn = db.get_db()
    conn.execute(
        "UPDATE campionati SET nome=?, arbitrabile_da_associato=?, km_per_partita=? WHERE id=?",
        (data.get("nome", ""), int(data.get("arbitrabile_da_associato", 1)), data.get("km_per_partita", ""), id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati/<int:id>", methods=["DELETE"])
def delete_campionato(id):
    conn = db.get_db()
    conn.execute("DELETE FROM squadre WHERE campionato_id=?", (id,))
    conn.execute("DELETE FROM campionati_codici WHERE campionato_id=?", (id,))
    conn.execute("DELETE FROM campionati WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati/<int:id>/dettaglio", methods=["GET"])
def dettaglio_campionato(id):
    conn = db.get_db()
    squadre = conn.execute("SELECT * FROM squadre WHERE campionato_id=? ORDER BY nome", (id,)).fetchall()
    codici = conn.execute("SELECT * FROM campionati_codici WHERE campionato_id=? ORDER BY codice", (id,)).fetchall()
    conn.close()
    return jsonify({
        "squadre": [dict(r) for r in squadre],
        "codici": [dict(r) for r in codici],
    })


@app.route("/api/squadre", methods=["POST"])
def add_squadra():
    data = request.json
    conn = db.get_db()
    conn.execute(
        "INSERT INTO squadre (campionato_id, nome) VALUES (?,?)",
        (data.get("campionato_id"), data.get("nome", "")),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/squadre/<int:id>", methods=["DELETE"])
def delete_squadra(id):
    conn = db.get_db()
    conn.execute("DELETE FROM squadre WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-codici", methods=["POST"])
def add_campionato_codice():
    data = request.json
    conn = db.get_db()
    conn.execute(
        "INSERT INTO campionati_codici (campionato_id, codice, tipo_fase) VALUES (?,?,?)",
        (data.get("campionato_id"), data.get("codice", ""), data.get("tipo_fase", "")),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-codici/<int:id>", methods=["PUT"])
def update_campionato_codice(id):
    """Aggiorna solo il tipo di fase (campionato/playoff/final four) di un codice già
    collegato: pensato per il cambio rapido dalla pagina Alias campionati, senza dover
    ricreare il codice."""
    data = request.json
    conn = db.get_db()
    conn.execute("UPDATE campionati_codici SET tipo_fase=? WHERE id=?", (data.get("tipo_fase", ""), id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-codici/<int:id>", methods=["DELETE"])
def delete_campionato_codice(id):
    conn = db.get_db()
    conn.execute("DELETE FROM campionati_codici WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- API: SOCIETÀ (anagrafica codice di affiliazione -> ragione sociale) ----------

@app.route("/api/societa", methods=["GET"])
def get_societa():
    conn = db.get_db()
    righe = conn.execute("SELECT * FROM societa ORDER BY ragione_sociale").fetchall()
    conn.close()
    return jsonify([dict(r) for r in righe])


@app.route("/api/societa", methods=["POST"])
def add_societa():
    data = request.json
    conn = db.get_db()
    cur = conn.execute(
        "INSERT INTO societa (codice_affiliazione, ragione_sociale) VALUES (?,?)",
        (data.get("codice_affiliazione", "").strip(), data.get("ragione_sociale", "").strip()),
    )
    conn.commit()
    nuovo_id = cur.lastrowid
    conn.close()
    return jsonify({"ok": True, "id": nuovo_id})


@app.route("/api/societa/<int:id>", methods=["PUT"])
def update_societa(id):
    data = request.json
    conn = db.get_db()
    conn.execute(
        "UPDATE societa SET codice_affiliazione=?, ragione_sociale=? WHERE id=?",
        (data.get("codice_affiliazione", "").strip(), data.get("ragione_sociale", "").strip(), id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/societa/<int:id>", methods=["DELETE"])
def delete_societa(id):
    conn = db.get_db()
    conn.execute("DELETE FROM societa WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/societa/importa", methods=["POST"])
def importa_societa():
    """Estrae dalle partite disputate i codici di affiliazione (aff_a/aff_b) non ancora
    presenti in anagrafica società, e li inserisce con la ragione sociale suggerita in modo
    automatico (il nome squadra più frequente per quel codice, dato che uno stesso codice
    di affiliazione compare su più squadre/categorie della stessa società con nomi diversi).
    Il nome suggerito va rivisto/corretto manualmente dalla pagina Società quando necessario."""
    conn = db.get_db()
    esistenti = {r["codice_affiliazione"] for r in conn.execute("SELECT codice_affiliazione FROM societa").fetchall()}
    righe = conn.execute(
        "SELECT aff_a AS cod, squadra_casa AS nome FROM partite WHERE aff_a!='' AND squadra_casa!='' "
        "UNION ALL "
        "SELECT aff_b AS cod, squadra_ospite AS nome FROM partite WHERE aff_b!='' AND squadra_ospite!=''"
    ).fetchall()

    conteggio = {}
    for r in righe:
        per_codice = conteggio.setdefault(r["cod"], {})
        per_codice[r["nome"]] = per_codice.get(r["nome"], 0) + 1

    inserite = 0
    for codice, nomi in conteggio.items():
        if codice in esistenti:
            continue
        ragione_sociale = max(nomi.items(), key=lambda kv: kv[1])[0]
        conn.execute("INSERT INTO societa (codice_affiliazione, ragione_sociale) VALUES (?,?)", (codice, ragione_sociale))
        inserite += 1

    conn.commit()
    conn.close()
    return jsonify({"ok": True, "inserite": inserite})


# ---------- API: STAGIONI (storico multi-stagione per le statistiche) ----------
# La stagione con dati_live=1 (sempre una sola) e' la stagione corrente: i suoi dati sono le
# tabelle live (partite/indisponibilita/campionati) usate da tutte le pagine operative, che
# restano invariate. Le altre stagioni sono storiche: i loro dati vivono nelle tabelle
# "_storiche"/"_storici" qui sotto, scoped per stagione_id, cosi' l'operativita' quotidiana
# non viene mai toccata da questa funzionalita'.

@app.route("/api/stagioni", methods=["GET"])
def get_stagioni():
    conn = db.get_db()
    righe = conn.execute("SELECT * FROM stagioni ORDER BY dati_live DESC, id DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in righe])


@app.route("/api/stagioni", methods=["POST"])
def add_stagione():
    data = request.json
    nome = (data.get("nome") or "").strip()
    if not nome:
        return jsonify({"ok": False, "errore": "Il nome della stagione è obbligatorio."}), 400
    conn = db.get_db()
    cur = conn.execute("INSERT INTO stagioni (nome, dati_live) VALUES (?, 0)", (nome,))
    conn.commit()
    nuovo_id = cur.lastrowid
    conn.close()
    return jsonify({"ok": True, "id": nuovo_id})


@app.route("/api/stagioni/<int:id>", methods=["DELETE"])
def delete_stagione(id):
    conn = db.get_db()
    stagione = conn.execute("SELECT * FROM stagioni WHERE id=?", (id,)).fetchone()
    if not stagione:
        conn.close()
        return jsonify({"ok": False, "errore": "Stagione non trovata."}), 404
    if stagione["dati_live"]:
        conn.close()
        return jsonify({"ok": False, "errore": "Non puoi eliminare la stagione corrente."}), 400

    campionati_storici_ids = [r["id"] for r in conn.execute(
        "SELECT id FROM campionati_storici WHERE stagione_id=?", (id,)
    ).fetchall()]
    for cid in campionati_storici_ids:
        conn.execute("DELETE FROM squadre_storiche WHERE campionato_storico_id=?", (cid,))
        conn.execute("DELETE FROM campionati_storici_codici WHERE campionato_storico_id=?", (cid,))
    conn.execute("DELETE FROM campionati_storici WHERE stagione_id=?", (id,))
    conn.execute("DELETE FROM partite_storiche WHERE stagione_id=?", (id,))
    conn.execute("DELETE FROM indisponibilita_storiche WHERE stagione_id=?", (id,))
    conn.execute("DELETE FROM stagioni WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/stagioni/<int:id>/riepilogo", methods=["GET"])
def riepilogo_stagione(id):
    conn = db.get_db()
    stagione = conn.execute("SELECT * FROM stagioni WHERE id=?", (id,)).fetchone()
    if not stagione:
        conn.close()
        return jsonify({"ok": False, "errore": "Stagione non trovata."}), 404

    if stagione["dati_live"]:
        n_partite = conn.execute("SELECT COUNT(*) FROM partite WHERE disputata=1").fetchone()[0]
        n_indisponibilita = conn.execute("SELECT COUNT(*) FROM indisponibilita").fetchone()[0]
        n_campionati = conn.execute("SELECT COUNT(*) FROM campionati").fetchone()[0]
    else:
        n_partite = conn.execute("SELECT COUNT(*) FROM partite_storiche WHERE stagione_id=?", (id,)).fetchone()[0]
        n_indisponibilita = conn.execute("SELECT COUNT(*) FROM indisponibilita_storiche WHERE stagione_id=?", (id,)).fetchone()[0]
        n_campionati = conn.execute("SELECT COUNT(*) FROM campionati_storici WHERE stagione_id=?", (id,)).fetchone()[0]

    conn.close()
    return jsonify({
        "id": stagione["id"],
        "nome": stagione["nome"],
        "dati_live": bool(stagione["dati_live"]),
        "n_partite": n_partite,
        "n_indisponibilita": n_indisponibilita,
        "n_campionati": n_campionati,
    })


@app.route("/api/stagioni/<int:id>/partite/import", methods=["POST"])
def import_partite_storiche(id):
    return _import_generico("partite_storiche", extra_fields={"stagione_id": id})


@app.route("/api/stagioni/<int:id>/partite/import/anteprima", methods=["POST"])
def anteprima_import_partite_storiche(id):
    return _anteprima_import_generico("partite_storiche", extra_fields={"stagione_id": id})


@app.route("/api/stagioni/<int:id>/indisponibilita/import", methods=["POST"])
def import_indisponibilita_storiche(id):
    return _import_generico("indisponibilita_storiche", extra_fields={"stagione_id": id})


@app.route("/api/stagioni/<int:id>/indisponibilita/import/anteprima", methods=["POST"])
def anteprima_import_indisponibilita_storiche(id):
    return _anteprima_import_generico("indisponibilita_storiche", extra_fields={"stagione_id": id})


# ---------- API: CAMPIONATI STORICI (alias per una stagione storica, stessa logica di
# /api/campionati ma su tabelle separate: vedi nota sopra) ----------

@app.route("/api/stagioni/<int:stagione_id>/campionati", methods=["GET"])
def get_campionati_storici(stagione_id):
    conn = db.get_db()
    campionati = conn.execute("SELECT * FROM campionati_storici WHERE stagione_id=? ORDER BY nome", (stagione_id,)).fetchall()
    risultato = []
    for c in campionati:
        n_squadre = conn.execute("SELECT COUNT(*) FROM squadre_storiche WHERE campionato_storico_id=?", (c["id"],)).fetchone()[0]
        n_codici = conn.execute("SELECT COUNT(*) FROM campionati_storici_codici WHERE campionato_storico_id=?", (c["id"],)).fetchone()[0]
        risultato.append({
            "id": c["id"], "nome": c["nome"], "n_squadre": n_squadre, "n_codici": n_codici,
            "km_per_partita": c["km_per_partita"],
        })
    conn.close()
    return jsonify(risultato)


@app.route("/api/stagioni/<int:stagione_id>/campionati", methods=["POST"])
def add_campionato_storico(stagione_id):
    data = request.json
    conn = db.get_db()
    cur = conn.execute(
        "INSERT INTO campionati_storici (stagione_id, nome, km_per_partita) VALUES (?,?,?)",
        (stagione_id, data.get("nome", ""), data.get("km_per_partita", "")),
    )
    conn.commit()
    nuovo_id = cur.lastrowid
    conn.close()
    return jsonify({"ok": True, "id": nuovo_id})


@app.route("/api/campionati-storici/<int:id>", methods=["PUT"])
def update_campionato_storico(id):
    data = request.json
    conn = db.get_db()
    conn.execute(
        "UPDATE campionati_storici SET nome=?, km_per_partita=? WHERE id=?",
        (data.get("nome", ""), data.get("km_per_partita", ""), id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-storici/<int:id>", methods=["DELETE"])
def delete_campionato_storico(id):
    conn = db.get_db()
    conn.execute("DELETE FROM squadre_storiche WHERE campionato_storico_id=?", (id,))
    conn.execute("DELETE FROM campionati_storici_codici WHERE campionato_storico_id=?", (id,))
    conn.execute("DELETE FROM campionati_storici WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-storici/<int:id>/dettaglio", methods=["GET"])
def dettaglio_campionato_storico(id):
    conn = db.get_db()
    squadre = conn.execute("SELECT * FROM squadre_storiche WHERE campionato_storico_id=? ORDER BY nome", (id,)).fetchall()
    codici = conn.execute("SELECT * FROM campionati_storici_codici WHERE campionato_storico_id=? ORDER BY codice", (id,)).fetchall()
    conn.close()
    return jsonify({
        "squadre": [dict(r) for r in squadre],
        "codici": [dict(r) for r in codici],
    })


@app.route("/api/squadre-storiche", methods=["POST"])
def add_squadra_storica():
    data = request.json
    conn = db.get_db()
    conn.execute(
        "INSERT INTO squadre_storiche (campionato_storico_id, nome) VALUES (?,?)",
        (data.get("campionato_storico_id"), data.get("nome", "")),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/squadre-storiche/<int:id>", methods=["DELETE"])
def delete_squadra_storica(id):
    conn = db.get_db()
    conn.execute("DELETE FROM squadre_storiche WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-storici-codici", methods=["POST"])
def add_campionato_storico_codice():
    data = request.json
    conn = db.get_db()
    conn.execute(
        "INSERT INTO campionati_storici_codici (campionato_storico_id, codice, tipo_fase) VALUES (?,?,?)",
        (data.get("campionato_storico_id"), data.get("codice", ""), data.get("tipo_fase", "")),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-storici-codici/<int:id>", methods=["PUT"])
def update_campionato_storico_codice(id):
    data = request.json
    conn = db.get_db()
    conn.execute("UPDATE campionati_storici_codici SET tipo_fase=? WHERE id=?", (data.get("tipo_fase", ""), id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/campionati-storici-codici/<int:id>", methods=["DELETE"])
def delete_campionato_storico_codice(id):
    conn = db.get_db()
    conn.execute("DELETE FROM campionati_storici_codici WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- API: CANDIDATI DESIGNAZIONE ----------

def _norm_nome(s):
    return (s or "").strip().lower()


def _norm_comune(s):
    """Normalizzazione più aggressiva di _norm_nome (rimuove anche accenti, apostrofi e spazi):
    serve a far corrispondere i nomi dei comuni tra anagrafica/partite e la tabella delle
    distanze importata da Excel, che non sono sempre scritti in modo identico (es. "Sant'
    Angelo In Vado" vs "Sant'angelo In Vado")."""
    return importer._normalize(s)


def _riga_ha_arbitro(riga, nome_norm):
    """Vero se il nome corrisponde al primo arbitro (campo 'arbitro') oppure al secondo
    arbitro (campo 'assistente1') di quella riga: per le statistiche/conflitti le due
    vesti contano allo stesso modo come 'designato'."""
    return _norm_nome(riga["arbitro"]) == nome_norm or _norm_nome(riga["assistente1"]) == nome_norm


# Segnaposto usati nei file di import quando la gara disputata non riporta un nominativo
# (vedi importer._mappa_filtro_gare): alcuni export mettono "Aaa" davanti per farlo comparire
# in cima alle liste alfabetiche. Vanno trattati come lo stesso "Arbitro Associato" ovunque.
_NOMI_PLACEHOLDER_ASSOCIATO_NORM = {_norm_nome("Arbitro Associato"), _norm_nome("Aaa Arbitro Associato")}


def _ruolo_in_riga(riga, nome_norm):
    """Etichetta del ruolo mostrata nelle schermate di Designazioni."""
    if _norm_nome(riga["arbitro"]) == nome_norm:
        return "Arbitro"
    if _norm_nome(riga["assistente1"]) == nome_norm:
        return "2° Arbitro"
    return ""


def _data_in_range(data_str, inizio, fine):
    if not data_str:
        return False
    try:
        d = datetime.date.fromisoformat(data_str)
    except ValueError:
        return False
    return inizio <= d <= fine


def _classifica_giorno(giorno_iso, periodi):
    """Per un giorno e l'elenco di indisponibilità di un arbitro, ritorna:
    'totale' se il giorno è bloccato per intero da almeno un periodo,
    'parziale' se è bloccato solo in parte (es. solo la sera), None se disponibile.
    Un periodo copre l'intero giorno se: è un giorno intermedio del periodo (non il primo
    né l'ultimo), oppure se sul primo/ultimo giorno l'ora coincide con inizio/fine giornata
    (00:00 / 23:59, o vuota)."""
    stato = None
    for p in periodi:
        if not (p["data_inizio"] <= giorno_iso <= p["data_fine"]):
            continue
        primo_giorno = p["data_inizio"] == giorno_iso
        ultimo_giorno = p["data_fine"] == giorno_iso
        if primo_giorno and ultimo_giorno:
            pieno = (not p["ora_inizio"] or p["ora_inizio"] <= "00:00") and (not p["ora_fine"] or p["ora_fine"] >= "23:59")
        elif primo_giorno:
            pieno = not p["ora_inizio"] or p["ora_inizio"] <= "00:00"
        elif ultimo_giorno:
            pieno = not p["ora_fine"] or p["ora_fine"] >= "23:59"
        else:
            pieno = True
        if pieno:
            return "totale"
        stato = "parziale"
    return stato


def _carica_mappa_campionati(conn):
    """Restituisce (mappa_codici, mappa_squadre) per collegare tra loro i gironi/fasi di uno
    stesso campionato logico (pagina Campionati), usate solo per le statistiche 'per nome'
    (quelle 'per codice di affiliazione' non ne hanno bisogno, funzionano già di per sé):
    - mappa_codici: {codice_campionato_normalizzato: campionato_id}
    - mappa_squadre: {campionato_id: {nome_squadra_normalizzato: squadra_id}}
    """
    righe_codici = conn.execute("SELECT codice, campionato_id FROM campionati_codici").fetchall()
    mappa_codici = {_norm_nome(r["codice"]): r["campionato_id"] for r in righe_codici}

    righe_squadre = conn.execute("SELECT id, campionato_id, nome FROM squadre").fetchall()
    mappa_squadre = {}
    for r in righe_squadre:
        mappa_squadre.setdefault(r["campionato_id"], {})[_norm_nome(r["nome"])] = r["id"]

    return mappa_codici, mappa_squadre


def _risolvi_squadra(nome_squadra, codice_campionato_raw, mappa_codici, mappa_squadre):
    """Risolve (nome squadra, codice campionato come compare in 'partite') in un id squadra
    valido attraverso tutti i codici campionato collegati allo stesso torneo logico nella
    pagina Campionati. None se il codice non è collegato o la squadra non è nel suo elenco:
    in quel caso i chiamanti ricadono sul confronto diretto campionato+nome di prima."""
    campionato_id = mappa_codici.get(_norm_nome(codice_campionato_raw))
    if campionato_id is None:
        return None
    return mappa_squadre.get(campionato_id, {}).get(_norm_nome(nome_squadra))


@app.route("/api/distanze-comuni", methods=["GET"])
def get_distanze_comuni():
    """Tabella distanze (comune_a_norm, comune_b_norm, km) così com'è, per i calcoli km lato
    frontend (es. km totali delle designazioni fatte in Designazioni)."""
    conn = db.get_db()
    righe = conn.execute("SELECT comune_a_norm, comune_b_norm, km FROM distanze_comuni").fetchall()
    conn.close()
    return jsonify([dict(r) for r in righe])


def _estrai_km_soglia(testo):
    """Estrae il primo numero (anche decimale) da un testo libero tipo 'max 30 km' -> 30.0.
    Se il campo non contiene nessun numero, non c'è una soglia da confrontare."""
    if not testo:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", testo)
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def _parse_km_manuale(valore):
    if valore in (None, ""):
        return None
    try:
        return float(str(valore).replace(",", "."))
    except ValueError:
        return None


def _km_auto_persona(nome, localita, arbitri_comuni, distanza_fn):
    """Km calcolato automaticamente (comune di residenza -> localita della gara) per una
    singola persona, senza applicare nessun accordo di trasferta dichiarato: usato sia dentro
    _calcola_km_coppia sia dove serve il valore 'pieno' per confronto (es. report tutoraggi)."""
    if not nome:
        return None
    comune = arbitri_comuni.get(_norm_nome(nome))
    if not comune:
        return None
    return distanza_fn(comune, localita)


def _calcola_km_coppia(p, arbitri_comuni, distanza_fn):
    """Km di rimborso per arbitro e 2° arbitro su una gara, rispettando l'eventuale accordo
    dichiarato tra i due designati:
    modalità '' (default) = ognuno la propria auto, calcolo automatico separato per ciascuno;
    'primo'/'secondo' = auto unica, ha guidato uno solo dei due: chi ha guidato prende il suo
    km calcolato normalmente, l'altro (passeggero) prende 0;
    'tutoraggio_primo'/'tutoraggio_secondo' = stesso azzeramento di km per uno dei due, ma per
    tutoraggio (l'arbitro tutorato non risulta in trasferta a sé) invece che auto unica: motivo
    distinto per i report/filtri, effetto sul calcolo identico;
    'manuale' = km inseriti a mano per ciascuno. Restituisce (km_arbitro, km_assistente1),
    ognuno None se non calcolabile (nome vuoto o comune/distanza sconosciuti)."""
    km_arbitro_auto = _km_auto_persona(p["arbitro"], p["localita"], arbitri_comuni, distanza_fn)
    km_assistente_auto = _km_auto_persona(p["assistente1"], p["localita"], arbitri_comuni, distanza_fn)
    modalita = (p["rimborso_km_modalita"] or "").strip()

    if modalita == "manuale":
        return _parse_km_manuale(p["rimborso_km_manuale_arbitro"]), _parse_km_manuale(p["rimborso_km_manuale_assistente1"])
    if modalita in ("primo", "tutoraggio_primo"):
        return km_arbitro_auto, 0.0
    if modalita in ("secondo", "tutoraggio_secondo"):
        return 0.0, km_assistente_auto
    return km_arbitro_auto, km_assistente_auto


def _carica_dati_km(conn):
    """Mappe comuni-arbitro e distanze, condivise dagli endpoint che calcolano km rimborso."""
    arbitri_comuni = {
        _norm_nome(r["cognome_nome"]): r["comune"]
        for r in conn.execute("SELECT cognome_nome, comune FROM arbitri").fetchall()
    }
    mappa_km = {
        (r["comune_a_norm"], r["comune_b_norm"]): r["km"]
        for r in conn.execute("SELECT comune_a_norm, comune_b_norm, km FROM distanze_comuni").fetchall()
    }

    def distanza(comune1, comune2):
        c1, c2 = _norm_comune(comune1), _norm_comune(comune2)
        if not c1 or not c2:
            return None
        if c1 == c2:
            return 0.0
        return mappa_km.get((c1, c2))

    return arbitri_comuni, distanza


@app.route("/api/designazioni/report-km", methods=["GET"])
def report_km_designazioni():
    """Per le partite ancora da disputare in un intervallo di date, raggruppa per campionato
    (alias da Alias campionati, fallback al codice grezzo se non collegato) e confronta la
    media dei km di trasferta degli arbitri già designati (rispettando l'eventuale accordo di
    trasferta condivisa dichiarato) con la soglia 'Km per partita da provare a rispettare'
    impostata in Alias campionati."""
    da = request.args.get("da", "")
    a = request.args.get("a", "")
    conn = db.get_db()
    mappa_codici, nomi_campionati = _carica_alias_campionati(conn)
    mappa_soglie = {r["id"]: r["km_per_partita"] for r in conn.execute("SELECT id, km_per_partita FROM campionati").fetchall()}
    arbitri_comuni, distanza = _carica_dati_km(conn)
    query = (
        "SELECT data, numero_gara, campionato, localita, squadra_casa, squadra_ospite, arbitro, assistente1, "
        "rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1 "
        "FROM partite WHERE disputata=0"
    )
    params = []
    if da:
        query += " AND data>=?"
        params.append(da)
    if a:
        query += " AND data<=?"
        params.append(a)
    partite = conn.execute(query, params).fetchall()
    conn.close()

    gruppi = {}
    for p in partite:
        campionato_id = mappa_codici.get(_norm_nome(p["campionato"])) if p["campionato"] else None
        if campionato_id is not None:
            chiave = f"c{campionato_id}"
            nome = nomi_campionati.get(campionato_id, p["campionato"])
            soglia_testo = mappa_soglie.get(campionato_id, "")
        else:
            chiave = f"raw:{p['campionato']}"
            nome = p["campionato"] or "(senza campionato)"
            soglia_testo = ""
        g = gruppi.setdefault(chiave, {"nome": nome, "soglia_testo": soglia_testo, "n_gare": 0, "km_valori": [], "gare": []})
        g["n_gare"] += 1
        km_arbitro, km_assistente1 = _calcola_km_coppia(p, arbitri_comuni, distanza)
        for km in (km_arbitro, km_assistente1):
            if km is not None:
                g["km_valori"].append(km)
        g["gare"].append({
            "data": p["data"], "numero_gara": p["numero_gara"],
            "squadra_casa": p["squadra_casa"], "squadra_ospite": p["squadra_ospite"],
            "arbitro": p["arbitro"], "assistente1": p["assistente1"],
            "km_arbitro": km_arbitro, "km_assistente1": km_assistente1,
        })

    risultati = []
    for g in gruppi.values():
        soglia = _estrai_km_soglia(g["soglia_testo"])
        media = round(sum(g["km_valori"]) / len(g["km_valori"]), 1) if g["km_valori"] else None
        confronto = None
        if soglia is not None and media is not None:
            confronto = "sopra" if media > soglia else ("sotto" if media < soglia else "pari")
        risultati.append({
            "nome": g["nome"],
            "n_gare": g["n_gare"],
            "n_designazioni_km": len(g["km_valori"]),
            "media_km": media,
            "soglia_testo": g["soglia_testo"],
            "soglia_km": soglia,
            "confronto": confronto,
            "gare": g["gare"],
        })
    risultati.sort(key=lambda r: r["nome"])
    return jsonify(risultati)


@app.route("/api/rimborsi-km", methods=["GET"])
def get_rimborsi_km():
    """Scheda 'Rimborsi km': tutte le gare disputate nel periodo scelto con sia arbitro che
    2° arbitro assegnati, coi km finali di ciascuno (rispettando l'eventuale accordo di
    trasferta condivisa) pronti per essere consultati o corretti — il rimborso si liquida a
    gara giocata, non su quelle ancora da disputare."""
    da = request.args.get("da", "")
    a = request.args.get("a", "")
    conn = db.get_db()
    arbitri_comuni, distanza = _carica_dati_km(conn)
    query = (
        "SELECT id, data, ora, campionato, numero_gara, squadra_casa, squadra_ospite, localita, "
        "arbitro, assistente1, rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1 "
        "FROM partite WHERE disputata=1 AND arbitro!='' AND assistente1!=''"
    )
    params = []
    if da:
        query += " AND data>=?"
        params.append(da)
    if a:
        query += " AND data<=?"
        params.append(a)
    query += " ORDER BY data, ora"
    partite = conn.execute(query, params).fetchall()
    # proposte di rimborso salvate in precedenza (sopravvivono a un reimport/cancellazione
    # della gara): indicizzate per campionato+numero gara normalizzati, da riproporre solo
    # sulle gare che non hanno già una modalità impostata.
    proposte = {
        (_norm_confronto(r["campionato"]), _norm_confronto(r["numero_gara"])): r
        for r in conn.execute("SELECT * FROM rimborso_km_proposte").fetchall()
    }
    conn.close()

    risultati = []
    for p in partite:
        km_arbitro, km_assistente1 = _calcola_km_coppia(p, arbitri_comuni, distanza)
        proposta = None
        if not p["rimborso_km_modalita"]:
            proposta = proposte.get((_norm_confronto(p["campionato"]), _norm_confronto(p["numero_gara"])))
        risultati.append({
            "id": p["id"], "data": p["data"], "ora": p["ora"], "campionato": p["campionato"],
            "numero_gara": p["numero_gara"], "squadra_casa": p["squadra_casa"], "squadra_ospite": p["squadra_ospite"],
            "localita": p["localita"],
            "arbitro": p["arbitro"], "assistente1": p["assistente1"],
            "comune_arbitro": arbitri_comuni.get(_norm_nome(p["arbitro"]), ""),
            "comune_assistente1": arbitri_comuni.get(_norm_nome(p["assistente1"]), ""),
            "rimborso_km_modalita": p["rimborso_km_modalita"] or "",
            "rimborso_km_manuale_arbitro": p["rimborso_km_manuale_arbitro"] or "",
            "rimborso_km_manuale_assistente1": p["rimborso_km_manuale_assistente1"] or "",
            "km_arbitro": km_arbitro, "km_assistente1": km_assistente1,
            "km_arbitro_auto": _km_auto_persona(p["arbitro"], p["localita"], arbitri_comuni, distanza),
            "km_assistente1_auto": _km_auto_persona(p["assistente1"], p["localita"], arbitri_comuni, distanza),
            "proposta_modalita": proposta["rimborso_km_modalita"] if proposta else "",
            "proposta_km_manuale_arbitro": proposta["rimborso_km_manuale_arbitro"] if proposta else "",
            "proposta_km_manuale_assistente1": proposta["rimborso_km_manuale_assistente1"] if proposta else "",
        })
    return jsonify(risultati)


@app.route("/api/designazioni/candidati/<int:partita_id>", methods=["GET"])
def get_candidati_designazione(partita_id):
    ruolo = request.args.get("ruolo", "arbitro")  # "arbitro" (1°) oppure "assistente1" (2°)
    conn = db.get_db()
    partita = conn.execute("SELECT * FROM partite WHERE id=?", (partita_id,)).fetchone()
    if not partita:
        conn.close()
        return jsonify({"ok": False, "errore": "Partita non trovata"}), 404

    # chi ha ruolo "ASS" in anagrafica non va proposto come candidato designabile: le sue gare
    # rientrano comunque nel conteggio "Arbitro Associato" nei report, ma non è un arbitro
    # federale assegnabile da questa griglia. Allo stesso modo, chi è segnato "non in attività"
    # non va proposto: è ancora in anagrafica per le statistiche ma non è designabile.
    arbitri = [
        a for a in conn.execute("SELECT * FROM arbitri ORDER BY cognome_nome").fetchall()
        if (a["ruolo"] or "").strip().upper() != "ASS" and a["attivo"]
    ]
    indisponibilita = conn.execute("SELECT * FROM indisponibilita").fetchall()
    note = conn.execute("SELECT * FROM note_inibizioni").fetchall()
    disputate = [dict(r) for r in conn.execute(
        "SELECT arbitro, assistente1, data, aff_a, aff_b, campionato, squadra_casa, squadra_ospite "
        "FROM partite WHERE disputata=1 AND (arbitro != '' OR assistente1 != '')"
    ).fetchall()]
    altre_gare_oggi = conn.execute(
        "SELECT campionato, numero_gara, arbitro, assistente1 FROM partite "
        "WHERE disputata=0 AND data=? AND id!=? AND (arbitro!='' OR assistente1!='')",
        (partita["data"], partita_id),
    ).fetchall()
    # gare di andata/ritorno: stesso campionato+girone di questa gara, squadra casa/ospite
    # invertite. Se un candidato ha già arbitrato quella gara (andata o ritorno che sia),
    # segnaliamo per evitare lo stesso arbitro su entrambe le sfide tra le stesse squadre.
    girone_match = (partita["girone"] or "").strip()
    gare_girone = conn.execute(
        "SELECT id, arbitro, assistente1, data, numero_gara, squadra_casa, squadra_ospite FROM partite "
        "WHERE campionato=? AND girone=? AND id!=?",
        (partita["campionato"], girone_match, partita_id),
    ).fetchall() if partita["campionato"] and girone_match else []
    mappa_codici, mappa_squadre = _carica_mappa_campionati(conn)
    localita_norm = _norm_comune(partita["localita"])
    mappa_distanze = {
        r["comune_a_norm"]: r["km"]
        for r in conn.execute(
            "SELECT comune_a_norm, km FROM distanze_comuni WHERE comune_b_norm=?", (localita_norm,)
        ).fetchall()
    }
    conn.close()

    match_dt = f"{partita['data']} {partita['ora'] or '00:00'}"
    aff_casa = partita["aff_a"]
    aff_osp = partita["aff_b"]
    campionato_match = partita["campionato"]
    nome_casa_norm = _norm_nome(partita["squadra_casa"])
    nome_osp_norm = _norm_nome(partita["squadra_ospite"])
    # chi è già nell'altro ruolo su questa stessa gara non va riproposto come candidato
    altro_ruolo_nome_norm = _norm_nome(partita["assistente1"] if ruolo == "arbitro" else partita["arbitro"])

    # tra le gare dello stesso girone, quella con squadra casa/ospite invertite è
    # l'andata/ritorno di questa stessa sfida: se un candidato l'ha già arbitrata, va segnalato.
    gare_andata_ritorno = [
        dict(p) for p in gare_girone
        if _norm_nome(p["squadra_casa"]) == nome_osp_norm and _norm_nome(p["squadra_ospite"]) == nome_casa_norm
    ]

    # Solo per le statistiche "per nome" (quelle per codice di affiliazione non ne hanno
    # bisogno): se il campionato di questa gara è collegato nella pagina Campionati, risolve
    # le squadre in un id valido su tutti i gironi/fasi collegati allo stesso torneo logico,
    # cosà da non spezzare il conteggio quando cambia il codice campionato (es. playoff).
    squadra_id_casa = _risolvi_squadra(partita["squadra_casa"], campionato_match, mappa_codici, mappa_squadre)
    squadra_id_osp = _risolvi_squadra(partita["squadra_ospite"], campionato_match, mappa_codici, mappa_squadre)
    for p in disputate:
        p["_sq_casa_id"] = _risolvi_squadra(p["squadra_casa"], p["campionato"], mappa_codici, mappa_squadre)
        p["_sq_osp_id"] = _risolvi_squadra(p["squadra_ospite"], p["campionato"], mappa_codici, mappa_squadre)

    candidati = []
    for a in arbitri:
        nome_norm = _norm_nome(a["cognome_nome"])
        if nome_norm and nome_norm == altro_ruolo_nome_norm:
            continue

        comune_arbitro_norm = _norm_comune(a["comune"])
        if not comune_arbitro_norm or not localita_norm:
            distanza_km = None
        elif comune_arbitro_norm == localita_norm:
            distanza_km = 0.0
        else:
            distanza_km = mappa_distanze.get(comune_arbitro_norm)

        disponibile = True
        indisp_dal_data = indisp_dal_ora = indisp_al_data = indisp_al_ora = indisp_motivo = ""
        for ind in indisponibilita:
            if _norm_nome(ind["arbitro"]) != nome_norm:
                continue
            inizio = f"{ind['data_inizio']} {ind['ora_inizio'] or '00:00'}"
            fine = f"{ind['data_fine']} {ind['ora_fine'] or '23:59'}"
            if inizio <= match_dt <= fine:
                disponibile = False
                indisp_dal_data = ind["data_inizio"]
                indisp_dal_ora = ind["ora_inizio"]
                indisp_al_data = ind["data_fine"]
                indisp_al_ora = ind["ora_fine"]
                indisp_motivo = ind["motivo"]
                break

        note_testo = []
        inibizione_testo = []
        inibito = False
        for n in note:
            if _norm_nome(n["arbitro"]) != nome_norm:
                continue
            if n["tipo"] == "nota" and n["descrizione"]:
                note_testo.append(n["descrizione"])
            elif n["tipo"] == "inibizione" and n["codice_affiliazione"] and n["codice_affiliazione"] in (aff_casa, aff_osp):
                inibito = True
                if n["descrizione"]:
                    inibizione_testo.append(n["descrizione"])

        ultima_casa_cod = ""
        ultima_osp_cod = ""
        ultima_casa_nome = ""
        ultima_osp_nome = ""
        n_casa_cod = 0
        n_casa_nome = 0
        n_osp_cod = 0
        n_osp_nome = 0
        for p in disputate:
            if not _riga_ha_arbitro(p, nome_norm):
                continue
            if aff_casa and (p["aff_a"] == aff_casa or p["aff_b"] == aff_casa):
                n_casa_cod += 1
                if p["data"] > ultima_casa_cod:
                    ultima_casa_cod = p["data"]
            if aff_osp and (p["aff_a"] == aff_osp or p["aff_b"] == aff_osp):
                n_osp_cod += 1
                if p["data"] > ultima_osp_cod:
                    ultima_osp_cod = p["data"]
            # "per nome": se la squadra è collegata nella pagina Campionati usa l'id squadra
            # (valido su tutti i codici campionato collegati); altrimenti ricade sul vecchio
            # confronto testuale campionato+nome, come prima di avere questa funzionalità.
            if squadra_id_casa is not None:
                casa_nome_match = squadra_id_casa in (p["_sq_casa_id"], p["_sq_osp_id"])
            else:
                casa_nome_match = bool(campionato_match) and p["campionato"] == campionato_match and bool(nome_casa_norm) and (
                    _norm_nome(p["squadra_casa"]) == nome_casa_norm or _norm_nome(p["squadra_ospite"]) == nome_casa_norm
                )
            if casa_nome_match:
                n_casa_nome += 1
                if p["data"] > ultima_casa_nome:
                    ultima_casa_nome = p["data"]

            if squadra_id_osp is not None:
                osp_nome_match = squadra_id_osp in (p["_sq_casa_id"], p["_sq_osp_id"])
            else:
                osp_nome_match = bool(campionato_match) and p["campionato"] == campionato_match and bool(nome_osp_norm) and (
                    _norm_nome(p["squadra_casa"]) == nome_osp_norm or _norm_nome(p["squadra_ospite"]) == nome_osp_norm
                )
            if osp_nome_match:
                n_osp_nome += 1
                if p["data"] > ultima_osp_nome:
                    ultima_osp_nome = p["data"]

        designazioni_oggi = [
            f"{g['campionato']}, gara n° {g['numero_gara']}"
            for g in altre_gare_oggi if _riga_ha_arbitro(g, nome_norm)
        ]

        gara_andata = next((g for g in gare_andata_ritorno if _riga_ha_arbitro(g, nome_norm)), None)

        candidati.append({
            "id": a["id"],
            "nome": a["cognome_nome"],
            "ruolo": a["ruolo"],
            "comune": a["comune"],
            "distanza_km": distanza_km,
            "disponibile": disponibile,
            "indisp_dal_data": indisp_dal_data,
            "indisp_dal_ora": indisp_dal_ora,
            "indisp_al_data": indisp_al_data,
            "indisp_al_ora": indisp_al_ora,
            "indisp_motivo": indisp_motivo,
            "note": " / ".join(note_testo),
            "inibito": inibito,
            "inibizione": " / ".join(inibizione_testo),
            "ultima_designazione_casa": ultima_casa_cod,
            "ultima_designazione_casa_nome": ultima_casa_nome,
            "ultima_designazione_ospite": ultima_osp_cod,
            "ultima_designazione_ospite_nome": ultima_osp_nome,
            "n_casa_codice": n_casa_cod,
            "n_casa_nome": n_casa_nome,
            "n_osp_codice": n_osp_cod,
            "n_osp_nome": n_osp_nome,
            "designato_oggi": bool(designazioni_oggi),
            "designato_info": " / ".join(designazioni_oggi),
            "ha_arbitrato_andata": gara_andata is not None,
            "andata_info": f"gara n° {gara_andata['numero_gara']} del {gara_andata['data']}" if gara_andata else "",
        })

    candidati.sort(key=lambda c: (not c["disponibile"], c["nome"].lower()))
    return jsonify(candidati)


@app.route("/api/designazioni/storico-squadra", methods=["GET"])
def storico_squadra():
    campionato = request.args.get("campionato", "")
    squadra = request.args.get("squadra", "")
    squadra_norm = _norm_nome(squadra)
    conn = db.get_db()
    rows = [dict(r) for r in conn.execute(
        "SELECT data, campionato, girone, numero_gara, squadra_casa, squadra_ospite, risultato, arbitro, assistente1 "
        "FROM partite WHERE disputata=1"
    ).fetchall()]
    mappa_codici, mappa_squadre = _carica_mappa_campionati(conn)
    conn.close()

    # se la squadra è collegata nella pagina Campionati, lo storico copre tutti i gironi/fasi
    # collegati allo stesso torneo logico (es. andata/ritorno + playoff con codice diverso);
    # altrimenti ricade sul vecchio confronto diretto campionato+nome.
    squadra_id = _risolvi_squadra(squadra, campionato, mappa_codici, mappa_squadre)

    storico = []
    for r in rows:
        casa_norm = _norm_nome(r["squadra_casa"])
        osp_norm = _norm_nome(r["squadra_ospite"])
        if squadra_id is not None:
            sq_casa_id = _risolvi_squadra(r["squadra_casa"], r["campionato"], mappa_codici, mappa_squadre)
            sq_osp_id = _risolvi_squadra(r["squadra_ospite"], r["campionato"], mappa_codici, mappa_squadre)
            if squadra_id not in (sq_casa_id, sq_osp_id):
                continue
            in_casa = sq_casa_id == squadra_id
        else:
            if r["campionato"] != campionato or squadra_norm not in (casa_norm, osp_norm):
                continue
            in_casa = casa_norm == squadra_norm
        r["avversario"] = r["squadra_ospite"] if in_casa else r["squadra_casa"]
        r["in_casa"] = in_casa
        storico.append(r)
    storico.sort(key=lambda r: r["data"], reverse=True)
    return jsonify(storico[:10])


@app.route("/api/designazioni/riepilogo-associati", methods=["GET"])
def riepilogo_associati():
    """Per una squadra della gara in designazione: quante gare (disputate, stagione corrente)
    sono state dirette da un arbitro federale rispetto a 'Arbitro Associato' (ruolo ASS incluso),
    con percentuali e data dell'ultima designazione federale — sia risolvendo la squadra per nome
    (alias/gironi collegati nella pagina Campionati) sia per codice di affiliazione societaria
    (valido su tutte le categorie in cui gioca la stessa società, non solo questo campionato)."""
    campionato = request.args.get("campionato", "")
    squadra = request.args.get("squadra", "")
    aff = request.args.get("aff", "")

    conn = db.get_db()
    righe_arbitri = conn.execute("SELECT cognome_nome, ruolo FROM arbitri").fetchall()
    nomi_ass_norm = {_norm_nome(r["cognome_nome"]) for r in righe_arbitri if (r["ruolo"] or "").strip().upper() == "ASS"}
    nomi_associato_norm = nomi_ass_norm | _NOMI_PLACEHOLDER_ASSOCIATO_NORM

    rows = conn.execute(
        "SELECT data, campionato, squadra_casa, squadra_ospite, aff_a, aff_b, arbitro, assistente1 "
        "FROM partite WHERE disputata=1"
    ).fetchall()
    mappa_codici, mappa_squadre = _carica_mappa_campionati(conn)
    mappa_arbitrabile = {r["id"]: bool(r["arbitrabile_da_associato"]) for r in conn.execute(
        "SELECT id, arbitrabile_da_associato FROM campionati"
    ).fetchall()}
    conn.close()

    def dirigibile_da_associato(codice_raw):
        """Un campionato non collegato a nessun alias non ha l'informazione: viene incluso
        per non perdere dati; un campionato collegato ma segnato 'non arbitrabile da
        associato' viene escluso dal calcolo delle percentuali (numeratore e denominatore)."""
        campionato_id = mappa_codici.get(_norm_nome(codice_raw))
        if campionato_id is None:
            return True
        return mappa_arbitrabile.get(campionato_id, True)

    def calcola(righe):
        # "n_gare" è il totale reale delle gare disputate (non si abbassa mai): le eventuali
        # gare di un campionato non arbitrabile da associato restano conteggiate lì, ma vengono
        # escluse solo dal sotto-conteggio federale/associato (e dalle sue percentuali), che ha
        # senso calcolare solo sulle gare dei campionati dove un associato può davvero dirigere.
        righe_valutabili = [r for r in righe if dirigibile_da_associato(r["campionato"])]
        n_federali = 0
        n_associato = 0
        ultima_federale = ""
        for r in righe_valutabili:
            for campo in ("arbitro", "assistente1"):
                nome_persona = r[campo]
                if not nome_persona:
                    continue
                if _norm_nome(nome_persona) in nomi_associato_norm:
                    n_associato += 1
                else:
                    n_federali += 1
                    if r["data"] > ultima_federale:
                        ultima_federale = r["data"]
        totale_designazioni = n_federali + n_associato
        return {
            "n_gare": len(righe),
            "n_gare_valutabili": len(righe_valutabili),
            "n_federali": n_federali,
            "pct_federali": round(n_federali / totale_designazioni * 100, 1) if totale_designazioni else 0,
            "n_associato": n_associato,
            "pct_associato": round(n_associato / totale_designazioni * 100, 1) if totale_designazioni else 0,
            "ultima_designazione_federale": ultima_federale or None,
        }

    squadra_id = _risolvi_squadra(squadra, campionato, mappa_codici, mappa_squadre)
    squadra_norm = _norm_nome(squadra)

    righe_nome = []
    for r in rows:
        if squadra_id is not None:
            sq_casa_id = _risolvi_squadra(r["squadra_casa"], r["campionato"], mappa_codici, mappa_squadre)
            sq_osp_id = _risolvi_squadra(r["squadra_ospite"], r["campionato"], mappa_codici, mappa_squadre)
            if squadra_id not in (sq_casa_id, sq_osp_id):
                continue
        else:
            if r["campionato"] != campionato or squadra_norm not in (_norm_nome(r["squadra_casa"]), _norm_nome(r["squadra_ospite"])):
                continue
        righe_nome.append(r)

    risultato = {"per_nome": calcola(righe_nome)}
    if aff:
        righe_codice = [r for r in rows if r["aff_a"] == aff or r["aff_b"] == aff]
        risultato["per_codice"] = calcola(righe_codice)
    else:
        risultato["per_codice"] = None

    return jsonify(risultato)


@app.route("/api/designazioni/riepilogo-arbitro", methods=["GET"])
def riepilogo_arbitro():
    nome = request.args.get("nome", "")
    nome_norm = _norm_nome(nome)
    oggi = datetime.date.today()
    inizio_15gg = oggi - datetime.timedelta(days=15)
    inizio_mese = oggi - datetime.timedelta(days=30)

    conn = db.get_db()
    tutte = conn.execute(
        "SELECT arbitro, assistente1 FROM partite WHERE arbitro != '' OR assistente1 != ''"
    ).fetchall()
    disputate = conn.execute(
        "SELECT arbitro, assistente1, data FROM partite WHERE disputata=1 AND (arbitro != '' OR assistente1 != '')"
    ).fetchall()
    conn.close()

    gare_designate = sum(1 for p in tutte if _riga_ha_arbitro(p, nome_norm))
    gare_15gg = sum(1 for p in disputate if _riga_ha_arbitro(p, nome_norm) and _data_in_range(p["data"], inizio_15gg, oggi))
    gare_mese = sum(1 for p in disputate if _riga_ha_arbitro(p, nome_norm) and _data_in_range(p["data"], inizio_mese, oggi))
    gare_anno = sum(1 for p in disputate if _riga_ha_arbitro(p, nome_norm))

    return jsonify({
        "gare_designate": gare_designate,
        "gare_15gg": gare_15gg,
        "gare_mese": gare_mese,
        "gare_anno": gare_anno,
    })


@app.route("/api/designazioni/gare-designate", methods=["GET"])
def gare_designate_arbitro():
    nome = request.args.get("nome", "")
    nome_norm = _norm_nome(nome)
    conn = db.get_db()
    rows = conn.execute(
        "SELECT data, campionato, girone, numero_gara, squadra_casa, squadra_ospite, risultato, arbitro, assistente1, disputata "
        "FROM partite WHERE arbitro != '' OR assistente1 != ''"
    ).fetchall()
    conn.close()
    gare = []
    for r in rows:
        if not _riga_ha_arbitro(r, nome_norm):
            continue
        g = dict(r)
        g["stato"] = "Disputata" if g["disputata"] else "Da disputare"
        g["ruolo_designazione"] = _ruolo_in_riga(r, nome_norm)
        gare.append(g)
    gare.sort(key=lambda r: r["data"], reverse=True)
    return jsonify(gare)


def _risolvi_stagione_report(conn):
    """Legge il parametro ?stagione_id= della request per i report/statistiche: se assente,
    o se punta alla stagione con dati_live=1, i report leggono le tabelle live esattamente
    come prima dell'introduzione delle stagioni storiche (nessun cambio di comportamento).
    Altrimenti restituisce l'id della stagione storica da cui leggere invece.
    Ritorna (live: bool, stagione_storica_id: int|None)."""
    stagione_id_param = request.args.get("stagione_id")
    if not stagione_id_param:
        return True, None
    stagione = conn.execute("SELECT * FROM stagioni WHERE id=?", (stagione_id_param,)).fetchone()
    if not stagione or stagione["dati_live"]:
        return True, None
    return False, stagione["id"]


def _carica_alias_campionati(conn, stagione_storica_id=None):
    """Come _carica_mappa_campionati ma per i report: legge dalle tabelle live (comportamento
    di sempre) oppure, se stagione_storica_id è dato, dalle tabelle storiche di quella
    stagione. Restituisce solo (mappa_codici, nomi_campionati): i report ne hanno bisogno
    solo per l'alias del nome, non per _risolvi_squadra (usato solo dall'operatività live)."""
    if stagione_storica_id is None:
        righe_codici = conn.execute("SELECT codice, campionato_id FROM campionati_codici").fetchall()
        nomi_campionati = {r["id"]: r["nome"] for r in conn.execute("SELECT id, nome FROM campionati").fetchall()}
    else:
        righe_codici = conn.execute(
            "SELECT cc.codice AS codice, cc.campionato_storico_id AS campionato_id "
            "FROM campionati_storici_codici cc JOIN campionati_storici c ON c.id = cc.campionato_storico_id "
            "WHERE c.stagione_id=?",
            (stagione_storica_id,),
        ).fetchall()
        nomi_campionati = {
            r["id"]: r["nome"]
            for r in conn.execute("SELECT id, nome FROM campionati_storici WHERE stagione_id=?", (stagione_storica_id,)).fetchall()
        }
    mappa_codici = {_norm_nome(r["codice"]): r["campionato_id"] for r in righe_codici}
    return mappa_codici, nomi_campionati


def _carica_mappa_tipo_fase(conn, stagione_storica_id=None):
    """Sotto-alias veloce (campionato/coppa/playoff/fasi finali) impostato sul singolo codice
    in Alias campionati: codice normalizzato -> tipo_fase (default 'campionato' se non impostato).
    Stessa scelta live/storico di _carica_alias_campionati."""
    if stagione_storica_id is None:
        righe = conn.execute("SELECT codice, tipo_fase FROM campionati_codici").fetchall()
    else:
        righe = conn.execute(
            "SELECT cc.codice AS codice, cc.tipo_fase AS tipo_fase FROM campionati_storici_codici cc "
            "JOIN campionati_storici c ON c.id = cc.campionato_storico_id WHERE c.stagione_id=?",
            (stagione_storica_id,),
        ).fetchall()
    return {_norm_nome(r["codice"]): (r["tipo_fase"] or "").strip() or "campionato" for r in righe}


@app.route("/api/arbitri/<int:id>/report", methods=["GET"])
def report_arbitro(id):
    """Report stagionale di un arbitro: km totali percorsi (comune di residenza -> località
    della gara) e l'elenco completo delle gare dirette disputate. Le altre statistiche
    (totali, per ruolo, per campionato con alias, per società) vengono calcolate lato
    frontend a partire da questo stesso elenco, così i conteggi restano tutti cliccabili
    senza bisogno di endpoint separati per ogni dettaglio."""
    conn = db.get_db()
    arbitro = conn.execute("SELECT * FROM arbitri WHERE id=?", (id,)).fetchone()
    if not arbitro:
        conn.close()
        return jsonify({"ok": False, "errore": "Arbitro non trovato"}), 404

    nome_norm = _norm_nome(arbitro["cognome_nome"])
    comune_arbitro = arbitro["comune"]
    comune_arbitro_norm = _norm_comune(comune_arbitro)

    live, stagione_storica_id = _risolvi_stagione_report(conn)
    mappa_codici, nomi_campionati = _carica_alias_campionati(conn, stagione_storica_id)
    mappa_tipo_fase = _carica_mappa_tipo_fase(conn, stagione_storica_id)

    if live:
        rows = conn.execute(
            "SELECT data, campionato, girone, numero_gara, localita, squadra_casa, squadra_ospite, "
            "aff_a, aff_b, risultato, arbitro, assistente1, "
            "rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1 "
            "FROM partite WHERE disputata=1"
        ).fetchall()
        arbitri_comuni_km, distanza_km = _carica_dati_km(conn)
    else:
        rows = conn.execute(
            "SELECT data, campionato, girone, numero_gara, localita, squadra_casa, squadra_ospite, "
            "aff_a, aff_b, risultato, arbitro, assistente1 FROM partite_storiche WHERE stagione_id=?",
            (stagione_storica_id,),
        ).fetchall()

    gare = []
    km_totali = 0.0
    n_km_calcolate = 0
    n_km_mancanti = 0

    for r in rows:
        if not _riga_ha_arbitro(r, nome_norm):
            continue
        g = dict(r)
        ruolo_designazione = _ruolo_in_riga(r, nome_norm)
        g["ruolo_designazione"] = ruolo_designazione

        # per il conteggio "per campionato" con alias: se il codice è collegato nella pagina
        # Campionati usa il nome logico (es. tutti i gironi di Terza Divisione insieme),
        # altrimenti ricade sul codice grezzo (un gruppo per ogni girone/fase).
        campionato_id = mappa_codici.get(_norm_nome(r["campionato"]))
        g["campionato_alias"] = nomi_campionati.get(campionato_id, r["campionato"])
        g["tipo_fase"] = mappa_tipo_fase.get(_norm_nome(r["campionato"]), "campionato")

        if live:
            # rispetta l'eventuale accordo di trasferta dichiarato in Designazioni/Rimborsi km
            # (auto unica: chi non ha guidato prende 0 km) invece del calcolo sempre separato.
            km_arbitro, km_assistente1 = _calcola_km_coppia(r, arbitri_comuni_km, distanza_km)
            km = km_arbitro if ruolo_designazione == "Arbitro" else km_assistente1
        else:
            localita_norm = _norm_comune(g["localita"])
            if not comune_arbitro_norm or not localita_norm:
                km = None
            elif comune_arbitro_norm == localita_norm:
                km = 0.0
            else:
                riga_km = conn.execute(
                    "SELECT km FROM distanze_comuni WHERE comune_a_norm=? AND comune_b_norm=?",
                    (comune_arbitro_norm, localita_norm),
                ).fetchone()
                km = riga_km["km"] if riga_km else None
        g["km"] = km
        if km is None:
            n_km_mancanti += 1
        else:
            km_totali += km
            n_km_calcolate += 1

        gare.append(g)

    # disponibilità: dalla prima gara disputata in assoluto nel sistema (stesso punto di
    # partenza per tutti gli arbitri, così i numeri sono confrontabili) fino all'ultima
    # gara disputata nel sistema (non la data odierna).
    if live:
        primo_giorno_globale = conn.execute("SELECT MIN(data) FROM partite WHERE disputata=1").fetchone()[0]
        ultimo_giorno_globale = conn.execute("SELECT MAX(data) FROM partite WHERE disputata=1").fetchone()[0]
        righe_indisp = conn.execute("SELECT arbitro, data_inizio, ora_inizio, data_fine, ora_fine FROM indisponibilita").fetchall()
    else:
        primo_giorno_globale = conn.execute("SELECT MIN(data) FROM partite_storiche WHERE stagione_id=?", (stagione_storica_id,)).fetchone()[0]
        ultimo_giorno_globale = conn.execute("SELECT MAX(data) FROM partite_storiche WHERE stagione_id=?", (stagione_storica_id,)).fetchone()[0]
        righe_indisp = conn.execute(
            "SELECT arbitro, data_inizio, ora_inizio, data_fine, ora_fine FROM indisponibilita_storiche WHERE stagione_id=?",
            (stagione_storica_id,),
        ).fetchall()
    indisp_arbitro = [i for i in righe_indisp if _norm_nome(i["arbitro"]) == nome_norm]

    conn.close()
    gare.sort(key=lambda r: r["data"], reverse=True)

    giorni_calendario = giorni_disponibili = giorni_indisponibili_totali = giorni_indisponibili_parziali = 0
    nomi_giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
    per_settimana = [{"disponibili": 0, "parziali": 0, "indisponibili": 0, "totale": 0} for _ in range(7)]
    per_mese = {}
    media_disponibilita = 0
    distribuzione_settimana = []
    distribuzione_mensile = []

    if primo_giorno_globale and ultimo_giorno_globale:
        fine = datetime.date.fromisoformat(ultimo_giorno_globale)
        giorno = datetime.date.fromisoformat(primo_giorno_globale)
        while giorno <= fine:
            iso = giorno.isoformat()
            stato = _classifica_giorno(iso, indisp_arbitro)
            giorni_calendario += 1
            wd = giorno.weekday()
            per_settimana[wd]["totale"] += 1
            chiave_mese = iso[:7]
            per_mese.setdefault(chiave_mese, {"disponibili": 0, "parziali": 0, "indisponibili": 0, "totale": 0})
            per_mese[chiave_mese]["totale"] += 1
            if stato == "totale":
                giorni_indisponibili_totali += 1
                per_settimana[wd]["indisponibili"] += 1
                per_mese[chiave_mese]["indisponibili"] += 1
            elif stato == "parziale":
                giorni_indisponibili_parziali += 1
                per_settimana[wd]["parziali"] += 1
                per_mese[chiave_mese]["parziali"] += 1
            else:
                giorni_disponibili += 1
                per_settimana[wd]["disponibili"] += 1
                per_mese[chiave_mese]["disponibili"] += 1
            giorno += datetime.timedelta(days=1)

        media_disponibilita = round(giorni_disponibili / giorni_calendario * 100, 1) if giorni_calendario else 0
        distribuzione_settimana = [
            {
                "giorno": nomi_giorni[i],
                "disponibili": per_settimana[i]["disponibili"],
                "parziali": per_settimana[i]["parziali"],
                "indisponibili": per_settimana[i]["indisponibili"],
                "totale": per_settimana[i]["totale"],
                "percentuale": round(per_settimana[i]["disponibili"] / per_settimana[i]["totale"] * 100, 1) if per_settimana[i]["totale"] else 0,
                "percentuale_parziale": round(per_settimana[i]["parziali"] / per_settimana[i]["totale"] * 100, 1) if per_settimana[i]["totale"] else 0,
                "percentuale_indisponibile": round(per_settimana[i]["indisponibili"] / per_settimana[i]["totale"] * 100, 1) if per_settimana[i]["totale"] else 0,
            }
            for i in range(7)
        ]
        distribuzione_mensile = [
            {
                "mese": k,
                "disponibili": v["disponibili"],
                "parziali": v["parziali"],
                "indisponibili": v["indisponibili"],
                "totale": v["totale"],
                "percentuale": round(v["disponibili"] / v["totale"] * 100, 1) if v["totale"] else 0,
                "percentuale_parziale": round(v["parziali"] / v["totale"] * 100, 1) if v["totale"] else 0,
                "percentuale_indisponibile": round(v["indisponibili"] / v["totale"] * 100, 1) if v["totale"] else 0,
            }
            for k, v in sorted(per_mese.items())
        ]

    return jsonify({
        "arbitro": arbitro["cognome_nome"],
        "comune": comune_arbitro,
        "km_totali": round(km_totali, 1),
        "n_km_calcolate": n_km_calcolate,
        "giorni_calendario": giorni_calendario,
        "giorni_disponibili": giorni_disponibili,
        "giorni_indisponibili_totali": giorni_indisponibili_totali,
        "giorni_indisponibili_parziali": giorni_indisponibili_parziali,
        "media_disponibilita": media_disponibilita,
        "distribuzione_settimana": distribuzione_settimana,
        "distribuzione_mensile": distribuzione_mensile,
        "primo_giorno_globale": primo_giorno_globale,
        "ultimo_giorno_globale": ultimo_giorno_globale,
        "n_km_mancanti": n_km_mancanti,
        "gare": gare,
    })


@app.route("/api/report/sezione", methods=["GET"])
def report_sezione():
    """Report d'insieme sulla sezione: per ogni arbitro, gare dirette e km percorsi nella
    stagione (gare disputate); aggregato anche per qualifica (NAZ/REG/TER)."""
    conn = db.get_db()
    live, stagione_storica_id = _risolvi_stagione_report(conn)
    risultato = _calcola_report_sezione(conn, live, stagione_storica_id)
    conn.close()
    return jsonify(risultato)


def _calcola_report_sezione(conn, live, stagione_storica_id):
    """Calcolo condiviso del report di sezione per UNA stagione (corrente o storica): usato
    sia dall'endpoint singolo /api/report/sezione sia dal confronto multi-stagione."""
    arbitri_tutti = conn.execute("SELECT id, cognome_nome, comune, ruolo FROM arbitri ORDER BY cognome_nome").fetchall()
    # gli arbitri con ruolo "ASS" non vengono trattati come arbitri federali a sé stanti:
    # le loro gare confluiscono nel conteggio "Arbitro Associato" (vedi sotto), non nella
    # classifica individuale né nella distribuzione per qualifica NAZ/REG/TER.
    arbitri = [a for a in arbitri_tutti if (a["ruolo"] or "").strip().upper() != "ASS"]
    nomi_ass_norm = {_norm_nome(a["cognome_nome"]) for a in arbitri_tutti if (a["ruolo"] or "").strip().upper() == "ASS"}
    if live:
        partite = conn.execute(
            "SELECT localita, arbitro, assistente1, "
            "rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1 "
            "FROM partite WHERE disputata=1"
        ).fetchall()
    else:
        partite = conn.execute(
            "SELECT localita, arbitro, assistente1 FROM partite_storiche WHERE stagione_id=?", (stagione_storica_id,)
        ).fetchall()
    mappa_km = {
        (r["comune_a_norm"], r["comune_b_norm"]): r["km"]
        for r in conn.execute("SELECT comune_a_norm, comune_b_norm, km FROM distanze_comuni").fetchall()
    }
    arbitri_comuni_km = {_norm_nome(a["cognome_nome"]): a["comune"] for a in arbitri_tutti}

    def distanza(comune1, comune2):
        a, b = _norm_comune(comune1), _norm_comune(comune2)
        if not a or not b:
            return None
        if a == b:
            return 0.0
        return mappa_km.get((a, b))

    risultati = []
    for a in arbitri:
        nome_norm = _norm_nome(a["cognome_nome"])
        n_gare = 0
        n_primo = 0
        n_secondo = 0
        km_tot = 0.0
        for p in partite:
            if not _riga_ha_arbitro(p, nome_norm):
                continue
            n_gare += 1
            if _norm_nome(p["arbitro"]) == nome_norm:
                n_primo += 1
            elif _norm_nome(p["assistente1"]) == nome_norm:
                n_secondo += 1
            if live:
                # rispetta l'eventuale accordo di trasferta dichiarato (auto unica: chi non
                # ha guidato prende 0 km) invece del calcolo sempre separato per persona.
                km_arbitro, km_assistente1 = _calcola_km_coppia(p, arbitri_comuni_km, distanza)
                km = km_arbitro if _norm_nome(p["arbitro"]) == nome_norm else km_assistente1
            else:
                km = distanza(a["comune"], p["localita"])
            if km is not None:
                km_tot += km
        risultati.append({
            "id": a["id"],
            "nome": a["cognome_nome"],
            "comune": a["comune"],
            "ruolo": a["ruolo"],
            "gare": n_gare,
            "n_primo": n_primo,
            "n_secondo": n_secondo,
            "pct_primo": round(n_primo / n_gare * 100, 1) if n_gare else 0,
            "pct_secondo": round(n_secondo / n_gare * 100, 1) if n_gare else 0,
            "km_totali": round(km_tot, 1),
        })

    # "arbitri" nella sezione conta solo chi ha diretto almeno una gara nella stagione: chi è
    # in anagrafica ma non ha mai arbitrato non è un "carico di lavoro" da mediare, altrimenti
    # la media/lo scostamento per arbitro risulterebbero diluiti da tante righe a zero.
    attivi = [r for r in risultati if r["gare"] > 0]
    n_arbitri = len(attivi)
    n_gare_sezione = sum(r["gare"] for r in risultati)
    media_gare = round(n_gare_sezione / n_arbitri, 1) if n_arbitri else 0
    km_totali_sezione = round(sum(r["km_totali"] for r in risultati), 1)

    per_ruolo = {}
    for r in attivi:
        chiave = r["ruolo"] or "N/D"
        d = per_ruolo.setdefault(chiave, {"arbitri": 0, "gare": 0, "km": 0.0, "n_primo": 0, "n_secondo": 0})
        d["arbitri"] += 1
        d["gare"] += r["gare"]
        d["km"] += r["km_totali"]
        d["n_primo"] += r["n_primo"]
        d["n_secondo"] += r["n_secondo"]

    ordine_ruoli = ["NAZ", "REG", "TER"]
    chiavi_ordinate = ordine_ruoli + sorted(k for k in per_ruolo if k not in ordine_ruoli)
    distribuzione_ruolo = [
        {
            "ruolo": chiave,
            "arbitri": per_ruolo[chiave]["arbitri"],
            "gare": per_ruolo[chiave]["gare"],
            "media_gare": round(per_ruolo[chiave]["gare"] / per_ruolo[chiave]["arbitri"], 1) if per_ruolo[chiave]["arbitri"] else 0,
            "km_totali": round(per_ruolo[chiave]["km"], 1),
            "pct_primo": round(per_ruolo[chiave]["n_primo"] / per_ruolo[chiave]["gare"] * 100, 1) if per_ruolo[chiave]["gare"] else 0,
            "pct_secondo": round(per_ruolo[chiave]["n_secondo"] / per_ruolo[chiave]["gare"] * 100, 1) if per_ruolo[chiave]["gare"] else 0,
        }
        for chiave in chiavi_ordinate if chiave in per_ruolo
    ]

    for r in risultati:
        r["scostamento"] = round(r["gare"] - media_gare, 1)
    risultati.sort(key=lambda r: r["gare"], reverse=True)

    # "Arbitro Associato" raggruppa due casi: il segnaposto scritto in import quando la gara
    # disputata non riporta un nominativo (vedi importer._mappa_filtro_gare), e le gare dirette
    # da persone in anagrafica con ruolo "ASS" (non sono arbitri federali veri e propri, quindi
    # non rientrano nel loop sopra né nella distribuzione per qualifica NAZ/REG/TER, ma in
    # questa riga a parte).
    nomi_associato_norm = nomi_ass_norm | _NOMI_PLACEHOLDER_ASSOCIATO_NORM
    n_gare_arbitro_associato = sum(
        1 for p in partite
        if _norm_nome(p["arbitro"]) in nomi_associato_norm or _norm_nome(p["assistente1"]) in nomi_associato_norm
    )
    if n_gare_arbitro_associato:
        distribuzione_ruolo.append({
            "ruolo": "Arbitro Associato",
            "arbitri": None,
            "gare": n_gare_arbitro_associato,
            "media_gare": None,
            "km_totali": None,
            "pct_primo": None,
            "pct_secondo": None,
        })

    # percentuale di copertura di ciascuna categoria sul totale di TUTTE le designazioni
    # (le 3 qualifiche vere + "Arbitro Associato"), così le percentuali sommano a 100%.
    totale_designazioni = n_gare_sezione + n_gare_arbitro_associato
    for d in distribuzione_ruolo:
        d["percentuale"] = round(d["gare"] / totale_designazioni * 100, 1) if totale_designazioni else 0

    # quante gare disputate hanno sia il 1° che il 2° arbitro assegnati (designazione doppia),
    # sul totale delle gare disputate; e come si dividono TUTTE le designazioni federali tra
    # ruolo di 1° e di 2° arbitro (non necessariamente 50/50, se molte gare hanno un solo
    # ufficiale di gara designato).
    n_gare_totali_disputate = len(partite)
    n_gare_doppia_designazione = sum(1 for p in partite if p["arbitro"] and p["assistente1"])
    pct_gare_doppia_designazione = round(n_gare_doppia_designazione / n_gare_totali_disputate * 100, 1) if n_gare_totali_disputate else 0
    n_primo_totale = sum(r["n_primo"] for r in risultati)
    n_secondo_totale = sum(r["n_secondo"] for r in risultati)
    pct_primo_totale = round(n_primo_totale / n_gare_sezione * 100, 1) if n_gare_sezione else 0
    pct_secondo_totale = round(n_secondo_totale / n_gare_sezione * 100, 1) if n_gare_sezione else 0

    return {
        "n_arbitri": n_arbitri,
        "n_gare_sezione": n_gare_sezione,
        "media_gare": media_gare,
        "km_totali_sezione": km_totali_sezione,
        "n_gare_totali_disputate": n_gare_totali_disputate,
        "n_gare_doppia_designazione": n_gare_doppia_designazione,
        "pct_gare_doppia_designazione": pct_gare_doppia_designazione,
        "pct_primo_totale": pct_primo_totale,
        "pct_secondo_totale": pct_secondo_totale,
        "distribuzione_ruolo": distribuzione_ruolo,
        "arbitri": risultati,
    }


@app.route("/api/report/confronto-stagioni", methods=["GET"])
def report_confronto_stagioni():
    """Confronto tra tutte le stagioni (corrente + storiche) sugli stessi numeri di sintesi
    del report di sezione, per una vista selezionabile anno su anno."""
    conn = db.get_db()
    stagioni = conn.execute("SELECT id, nome, dati_live FROM stagioni ORDER BY dati_live DESC, id DESC").fetchall()
    risultati = []
    for s in stagioni:
        live = bool(s["dati_live"])
        dati = _calcola_report_sezione(conn, live, None if live else s["id"])
        n_associato = next((d["gare"] for d in dati["distribuzione_ruolo"] if d["ruolo"] == "Arbitro Associato"), 0)
        risultati.append({
            "stagione_id": s["id"],
            "stagione_nome": s["nome"],
            "dati_live": live,
            "n_arbitri": dati["n_arbitri"],
            "n_gare_sezione": dati["n_gare_sezione"],
            "media_gare": dati["media_gare"],
            "km_totali_sezione": dati["km_totali_sezione"],
            "n_gare_arbitro_associato": n_associato,
            "distribuzione_ruolo": dati["distribuzione_ruolo"],
        })
    conn.close()
    return jsonify(risultati)


@app.route("/api/report/riconoscimenti", methods=["GET"])
def report_riconoscimenti():
    """Piccoli riconoscimenti scherzosi calcolati sugli stessi numeri del Report arbitro/
    di sezione (km, campionati/società diverse, comuni visitati, ruolo, andamento mensile,
    disponibilità, anzianità): un tocco di morale/riconoscimento per gli arbitri della
    sezione, non una metrica organizzativa."""
    conn = db.get_db()
    live, stagione_storica_id = _risolvi_stagione_report(conn)
    mappa_codici, nomi_campionati = _carica_alias_campionati(conn, stagione_storica_id)
    # chi ha ruolo "ASS" in anagrafica non compete per i riconoscimenti individuali: le sue
    # gare sono conteggiate altrove come "Arbitro Associato" (vedi report_sezione/campionati).
    arbitri = [
        a for a in conn.execute("SELECT id, cognome_nome, comune, ruolo FROM arbitri ORDER BY cognome_nome").fetchall()
        if (a["ruolo"] or "").strip().upper() != "ASS"
    ]
    if live:
        partite = conn.execute(
            "SELECT data, campionato, localita, aff_a, aff_b, arbitro, assistente1, "
            "rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1 "
            "FROM partite WHERE disputata=1"
        ).fetchall()
        indisponibilita = conn.execute(
            "SELECT arbitro, data_inizio, ora_inizio, data_fine, ora_fine FROM indisponibilita"
        ).fetchall()
        primo_giorno_globale = conn.execute("SELECT MIN(data) FROM partite WHERE disputata=1").fetchone()[0]
        ultimo_giorno_globale = conn.execute("SELECT MAX(data) FROM partite WHERE disputata=1").fetchone()[0]
    else:
        partite = conn.execute(
            "SELECT data, campionato, localita, aff_a, aff_b, arbitro, assistente1 FROM partite_storiche WHERE stagione_id=?",
            (stagione_storica_id,),
        ).fetchall()
        indisponibilita = conn.execute(
            "SELECT arbitro, data_inizio, ora_inizio, data_fine, ora_fine FROM indisponibilita_storiche WHERE stagione_id=?",
            (stagione_storica_id,),
        ).fetchall()
        primo_giorno_globale = conn.execute("SELECT MIN(data) FROM partite_storiche WHERE stagione_id=?", (stagione_storica_id,)).fetchone()[0]
        ultimo_giorno_globale = conn.execute("SELECT MAX(data) FROM partite_storiche WHERE stagione_id=?", (stagione_storica_id,)).fetchone()[0]
    mappa_km = {
        (r["comune_a_norm"], r["comune_b_norm"]): r["km"]
        for r in conn.execute("SELECT comune_a_norm, comune_b_norm, km FROM distanze_comuni").fetchall()
    }
    arbitri_comuni_km = {
        _norm_nome(r["cognome_nome"]): r["comune"]
        for r in conn.execute("SELECT cognome_nome, comune FROM arbitri").fetchall()
    }
    conn.close()

    def distanza(comune1, comune2):
        a, b = _norm_comune(comune1), _norm_comune(comune2)
        if not a or not b:
            return None
        if a == b:
            return 0.0
        return mappa_km.get((a, b))

    nomi_mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

    def formatta_mese(chiave):
        anno, mese = chiave.split("-")
        return f"{nomi_mesi[int(mese) - 1]} {anno}"

    risultati = []
    for a in arbitri:
        nome_norm = _norm_nome(a["cognome_nome"])
        gare = [p for p in partite if _riga_ha_arbitro(p, nome_norm)]
        if not gare:
            continue

        km_totali = 0.0
        km_massimo_singola = None
        n_km_zero = 0
        campionati_distinti = set()
        societa_distinte = set()
        comuni_distinti = set()
        per_mese = {}
        n_primo = 0
        n_secondo = 0
        for g in gare:
            campionato_id = mappa_codici.get(_norm_nome(g["campionato"]))
            campionati_distinti.add(nomi_campionati.get(campionato_id, g["campionato"]))
            if g["aff_a"]:
                societa_distinte.add(g["aff_a"])
            if g["aff_b"]:
                societa_distinte.add(g["aff_b"])
            if g["localita"]:
                comuni_distinti.add(_norm_comune(g["localita"]))

            if live:
                # rispetta l'eventuale accordo di trasferta dichiarato (auto unica: chi non
                # ha guidato prende 0 km) invece del calcolo sempre separato per persona.
                km_arbitro, km_assistente1 = _calcola_km_coppia(g, arbitri_comuni_km, distanza)
                km = km_arbitro if _norm_nome(g["arbitro"]) == nome_norm else km_assistente1
            else:
                km = distanza(a["comune"], g["localita"])
            if km is not None:
                km_totali += km
                if km == 0:
                    n_km_zero += 1
                if km_massimo_singola is None or km > km_massimo_singola:
                    km_massimo_singola = km

            chiave_mese = g["data"][:7]
            per_mese[chiave_mese] = per_mese.get(chiave_mese, 0) + 1

            if _norm_nome(g["arbitro"]) == nome_norm:
                n_primo += 1
            elif _norm_nome(g["assistente1"]) == nome_norm:
                n_secondo += 1

        indisp_arbitro = [i for i in indisponibilita if _norm_nome(i["arbitro"]) == nome_norm]
        giorni_calendario = giorni_disponibili = giorni_indisponibili_totali = 0
        if primo_giorno_globale and ultimo_giorno_globale:
            fine = datetime.date.fromisoformat(ultimo_giorno_globale)
            giorno = datetime.date.fromisoformat(primo_giorno_globale)
            while giorno <= fine:
                stato = _classifica_giorno(giorno.isoformat(), indisp_arbitro)
                giorni_calendario += 1
                if stato == "totale":
                    giorni_indisponibili_totali += 1
                elif stato is None:
                    giorni_disponibili += 1
                giorno += datetime.timedelta(days=1)

        # trend: media gare/mese nella seconda metà del periodo diretto rispetto alla prima
        # metà, per capire se il carico dell'arbitro sta crescendo o calando nel tempo.
        mesi_ordinati = sorted(per_mese.items())
        trend = 0.0
        if len(mesi_ordinati) >= 2:
            meta = max(1, len(mesi_ordinati) // 2)
            prima_meta = mesi_ordinati[:meta]
            seconda_meta = mesi_ordinati[meta:] or mesi_ordinati[-1:]
            media_prima = sum(v for _, v in prima_meta) / len(prima_meta)
            media_seconda = sum(v for _, v in seconda_meta) / len(seconda_meta)
            trend = media_seconda - media_prima

        date_gare = sorted(g["data"] for g in gare)

        risultati.append({
            "id": a["id"],
            "nome": a["cognome_nome"],
            "gare": len(gare),
            "km_totali": round(km_totali, 1),
            "km_massimo_singola": round(km_massimo_singola, 1) if km_massimo_singola is not None else None,
            "n_km_zero": n_km_zero,
            "n_campionati": len(campionati_distinti),
            "n_societa": len(societa_distinte),
            "n_comuni": len(comuni_distinti),
            "n_primo": n_primo,
            "n_secondo": n_secondo,
            "giorni_indisponibili_totali": giorni_indisponibili_totali,
            "pct_disponibilita": round(giorni_disponibili / giorni_calendario * 100, 1) if giorni_calendario else 0,
            "trend": round(trend, 2),
            "prima_gara": date_gare[0],
            "ultima_gara": date_gare[-1],
        })

    def vincitori(campo, direzione="max", soglia=None):
        candidati = risultati
        if soglia is not None:
            candidati = [r for r in candidati if r[campo] is not None and (r[campo] >= soglia if direzione == "max" else r[campo] <= soglia)]
        candidati = [r for r in candidati if r[campo] is not None]
        if not candidati:
            return {"nomi": [], "valore": None}
        val = max(r[campo] for r in candidati) if direzione == "max" else min(r[campo] for r in candidati)
        return {"nomi": [r["nome"] for r in candidati if r[campo] == val], "valore": val}

    maratoneta = vincitori("km_totali", "max", soglia=0.1)
    jolly_campionati = vincitori("n_campionati", "max", soglia=1)
    jolly_societa = vincitori("n_societa", "max", soglia=1)
    roccia_nomi = [r["nome"] for r in risultati if r["giorni_indisponibili_totali"] == 0]
    sempre_disponibile = vincitori("pct_disponibilita", "max")
    rookie = vincitori("trend", "max", soglia=0.01)
    in_frenata = vincitori("trend", "min", soglia=-0.01)
    local_hero = vincitori("n_km_zero", "max", soglia=1)
    globetrotter = vincitori("n_comuni", "max", soglia=1)
    viaggio_estremo = vincitori("km_massimo_singola", "max", soglia=0.1)
    instancabile = vincitori("gare", "max")
    direttore = vincitori("n_primo", "max", soglia=1)
    spalla_di_ferro = vincitori("n_secondo", "max", soglia=1)
    veterano = vincitori("prima_gara", "min")
    new_entry = vincitori("prima_gara", "max")

    if veterano["valore"] is not None:
        veterano["valore"] = formatta_mese(veterano["valore"][:7])
    if new_entry["valore"] is not None:
        new_entry["valore"] = formatta_mese(new_entry["valore"][:7])

    return jsonify({
        "maratoneta": maratoneta,
        "jolly_campionati": jolly_campionati,
        "jolly_societa": jolly_societa,
        "roccia": {"nomi": roccia_nomi},
        "sempre_disponibile": sempre_disponibile,
        "rookie": rookie,
        "in_frenata": in_frenata,
        "local_hero": local_hero,
        "globetrotter": globetrotter,
        "viaggio_estremo": viaggio_estremo,
        "instancabile": instancabile,
        "direttore": direttore,
        "spalla_di_ferro": spalla_di_ferro,
        "veterano": veterano,
        "new_entry": new_entry,
    })


@app.route("/api/report/copertura", methods=["GET"])
def report_copertura():
    """Copertura territoriale: per ogni comune dove si sono giocate gare, quanti arbitri
    risiedono li' o entro un raggio di zona (SOGLIA_KM), per individuare i comuni con
    tante gare ma pochi arbitri vicini (zone piu' scoperte/onerose da coprire)."""
    SOGLIA_KM = 15

    conn = db.get_db()
    live, stagione_storica_id = _risolvi_stagione_report(conn)
    # come in Designazioni: un arbitro "non in attività" o con ruolo ASS non è un candidato
    # designabile davvero, quindi non deve contare come copertura disponibile per la zona.
    arbitri = conn.execute(
        "SELECT cognome_nome, comune FROM arbitri WHERE comune!='' AND attivo=1 AND UPPER(TRIM(ruolo))!='ASS'"
    ).fetchall()
    if live:
        partite = conn.execute("SELECT localita FROM partite WHERE disputata=1 AND localita!=''").fetchall()
    else:
        partite = conn.execute(
            "SELECT localita FROM partite_storiche WHERE stagione_id=? AND localita!=''", (stagione_storica_id,)
        ).fetchall()
    mappa_km = {
        (r["comune_a_norm"], r["comune_b_norm"]): r["km"]
        for r in conn.execute("SELECT comune_a_norm, comune_b_norm, km FROM distanze_comuni").fetchall()
    }
    conn.close()

    gare_per_comune = {}
    for p in partite:
        norm = _norm_comune(p["localita"])
        if not norm:
            continue
        d = gare_per_comune.setdefault(norm, {"nome": p["localita"], "n_gare": 0})
        d["n_gare"] += 1

    arbitri_per_comune = {}
    for a in arbitri:
        norm = _norm_comune(a["comune"])
        if not norm:
            continue
        arbitri_per_comune.setdefault(norm, []).append(a["cognome_nome"])

    risultati = []
    for norm, info in gare_per_comune.items():
        arbitri_locali = arbitri_per_comune.get(norm, [])
        arbitri_vicini = set(arbitri_locali)
        for altro_norm, lista in arbitri_per_comune.items():
            if altro_norm == norm:
                continue
            km = mappa_km.get((norm, altro_norm))
            if km is not None and km <= SOGLIA_KM:
                arbitri_vicini.update(lista)

        n_vicini = len(arbitri_vicini)
        risultati.append({
            "comune": info["nome"],
            "n_gare": info["n_gare"],
            "n_arbitri_locali": len(arbitri_locali),
            "n_arbitri_vicini": n_vicini,
            "arbitri_vicini": sorted(arbitri_vicini),
            "rapporto": round(info["n_gare"] / n_vicini, 1) if n_vicini else None,
        })

    # i comuni senza nessun arbitro vicino (zone scoperte) vengono prima, ordinati per
    # numero di gare (i piu critici); poi gli altri per rapporto gare/arbitro decrescente.
    risultati.sort(key=lambda r: (r["n_arbitri_vicini"] > 0, -r["n_gare"] if r["n_arbitri_vicini"] == 0 else -r["rapporto"]))

    return jsonify({"soglia_km": SOGLIA_KM, "comuni": risultati})


def _punti_da_margine(set_vincente, set_perdente):
    """Punteggio classifica per un risultato a set: margine di 2 o piu' set vale 3 punti alla
    vincente e 0 alla perdente; margine di 1 set (quindi un set decisivo giocato) vale 2 punti
    alla vincente e 1 alla perdente. La stessa regola vale sia per il formato a 5 set degli
    adulti (3-0/3-1 = 3pt, 3-2 = 2/1pt) sia per quello a 3 set delle categorie giovanili
    (2-0 = 3pt, 2-1 = 2/1pt), senza dover sapere a priori quanti set si giocano in categoria."""
    return (3, 0) if (set_vincente - set_perdente) >= 2 else (2, 1)


def _parse_risultato_set(risultato):
    """'3-1' -> (3, 1). None se il testo non è nel formato atteso."""
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", risultato or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


def _parse_punti_set(parziali):
    """'25-15 25-17 25-18' (o separatori simili tipo '/') -> [(25,15), (25,17), (25,18)].
    Primo numero di ogni set = punti della squadra di casa, secondo = punti dell'ospite,
    stesso ordine usato dal campo 'risultato'. I pezzi non riconosciuti vengono ignorati."""
    if not parziali:
        return []
    risultato = []
    for parte in parziali.split():
        m = re.match(r"^(\d+)\D+(\d+)$", parte)
        if m:
            risultato.append((int(m.group(1)), int(m.group(2))))
    return risultato


def _calcola_classifica(gare):
    """Calcola la classifica (una riga per squadra) da un elenco di gare disputate con
    risultato non vuoto — le gare 'gialle' (disputata=1 ma non giocate davvero, risultato
    ancora vuoto) non vanno mai passate qui: il chiamante le esclude già a livello di query."""
    squadre = {}

    def riga(nome):
        return squadre.setdefault(nome, {
            "squadra": nome, "punti": 0, "gare": 0, "vinte": 0, "perse": 0,
            "set_vinti": 0, "set_persi": 0, "punti_fatti": 0, "punti_subiti": 0,
            "punti_set_completi": True,
        })

    for g in gare:
        set_risultato = _parse_risultato_set(g["risultato"])
        if not set_risultato or set_risultato[0] == set_risultato[1]:
            continue
        set_casa, set_osp = set_risultato
        r_casa, r_osp = riga(g["squadra_casa"]), riga(g["squadra_ospite"])

        r_casa["gare"] += 1
        r_osp["gare"] += 1
        r_casa["set_vinti"] += set_casa
        r_casa["set_persi"] += set_osp
        r_osp["set_vinti"] += set_osp
        r_osp["set_persi"] += set_casa

        vince_casa = set_casa > set_osp
        punti_vince, punti_perde = _punti_da_margine(*(  (set_casa, set_osp) if vince_casa else (set_osp, set_casa)  ))
        (r_casa if vince_casa else r_osp)["vinte"] += 1
        (r_osp if vince_casa else r_casa)["perse"] += 1
        r_casa["punti"] += punti_vince if vince_casa else punti_perde
        r_osp["punti"] += punti_perde if vince_casa else punti_vince

        punti_set = _parse_punti_set(g["parziali"])
        if punti_set:
            for pt_casa, pt_osp in punti_set:
                r_casa["punti_fatti"] += pt_casa
                r_casa["punti_subiti"] += pt_osp
                r_osp["punti_fatti"] += pt_osp
                r_osp["punti_subiti"] += pt_casa
        else:
            r_casa["punti_set_completi"] = False
            r_osp["punti_set_completi"] = False

    def quoziente(a, b):
        if b == 0:
            return "Max" if a > 0 else None
        return round(a / b, 2)

    risultati = []
    for r in squadre.values():
        completi = r.pop("punti_set_completi")
        risultati.append({
            **r,
            "quoziente_set": quoziente(r["set_vinti"], r["set_persi"]),
            "punti_fatti": r["punti_fatti"] if completi else None,
            "punti_subiti": r["punti_subiti"] if completi else None,
            "quoziente_punti": quoziente(r["punti_fatti"], r["punti_subiti"]) if completi else None,
        })

    def chiave_ordinamento(r):
        qs = r["quoziente_set"]
        qs_val = float("inf") if qs == "Max" else (qs if qs is not None else 0)
        qp = r["quoziente_punti"]
        qp_val = float("inf") if qp == "Max" else (qp if qp is not None else 0)
        return (-r["punti"], -qs_val, -qp_val, r["squadra"].lower())

    risultati.sort(key=chiave_ordinamento)
    for i, r in enumerate(risultati, start=1):
        r["posizione"] = i
    return risultati


@app.route("/api/report/classifica", methods=["GET"])
def report_classifica():
    """Classifica calcolata al volo per un codice campionato (un girone = un codice, senza
    passare dagli alias della pagina Campionati): solo le gare disputate con un risultato
    reale (esclude le gare 'gialle' pre-designate ma non ancora giocate davvero)."""
    campionato = request.args.get("campionato", "")
    if not campionato:
        return jsonify({"ok": False, "errore": "Parametro campionato mancante"}), 400
    conn = db.get_db()
    gare = conn.execute(
        "SELECT squadra_casa, squadra_ospite, risultato, parziali FROM partite "
        "WHERE campionato=? AND disputata=1 AND risultato!=''",
        (campionato,),
    ).fetchall()
    conn.close()
    return jsonify({"ok": True, "campionato": campionato, "classifica": _calcola_classifica(gare)})


@app.route("/api/report/classifica/gare-squadra", methods=["GET"])
def classifica_gare_squadra():
    """Tutte le gare (disputate e da disputare) di una squadra in un preciso codice campionato
    (lo stesso girone della classifica, non tutti i gironi collegati nella pagina Campionati)."""
    campionato = request.args.get("campionato", "")
    squadra = request.args.get("squadra", "")
    conn = db.get_db()
    righe = [dict(r) for r in conn.execute(
        "SELECT data, campionato, girone, numero_gara, squadra_casa, squadra_ospite, risultato, "
        "arbitro, assistente1, disputata FROM partite "
        "WHERE campionato=? AND (squadra_casa=? OR squadra_ospite=?) ORDER BY data",
        (campionato, squadra, squadra),
    ).fetchall()]
    conn.close()
    for r in righe:
        r["stato"] = "Disputata" if r["disputata"] else "Da disputare"
    return jsonify(righe)


@app.route("/api/report/campionati", methods=["GET"])
def report_campionati():
    """Report per campionato logico (gruppi definiti nella pagina Alias campionati, con
    fallback al codice grezzo per quelli non ancora collegati): quante designazioni sono
    di arbitri federali (in anagrafica) rispetto a 'Arbitro Associato', km totali/medi, ed
    elenco gare (per il drill-down squadra/arbitro lato frontend)."""
    conn = db.get_db()
    live, stagione_storica_id = _risolvi_stagione_report(conn)
    mappa_codici, nomi_campionati = _carica_alias_campionati(conn, stagione_storica_id)
    righe_arbitri = conn.execute("SELECT cognome_nome, comune, ruolo FROM arbitri").fetchall()
    # chi ha ruolo "ASS" in anagrafica non è un arbitro federale: le sue gare vanno contate
    # come "Arbitro Associato", non come federali (vedi uso di nomi_ass_norm più sotto).
    arbitri_comuni = {
        _norm_nome(r["cognome_nome"]): r["comune"]
        for r in righe_arbitri if (r["ruolo"] or "").strip().upper() != "ASS"
    }
    nomi_ass_norm = {_norm_nome(r["cognome_nome"]) for r in righe_arbitri if (r["ruolo"] or "").strip().upper() == "ASS"}
    if live:
        partite = conn.execute(
            "SELECT data, campionato, girone, numero_gara, localita, squadra_casa, squadra_ospite, "
            "risultato, arbitro, assistente1, "
            "rimborso_km_modalita, rimborso_km_manuale_arbitro, rimborso_km_manuale_assistente1 "
            "FROM partite WHERE disputata=1 AND campionato!=''"
        ).fetchall()
    else:
        partite = conn.execute(
            "SELECT data, campionato, girone, numero_gara, localita, squadra_casa, squadra_ospite, "
            "risultato, arbitro, assistente1 FROM partite_storiche WHERE stagione_id=? AND campionato!=''",
            (stagione_storica_id,),
        ).fetchall()
    mappa_km = {
        (r["comune_a_norm"], r["comune_b_norm"]): r["km"]
        for r in conn.execute("SELECT comune_a_norm, comune_b_norm, km FROM distanze_comuni").fetchall()
    }
    # "km da rispettare" impostato in Alias campionati (o nel suo equivalente storico): il
    # campionato_id nel gruppo e' l'id della tabella giusta a seconda della stagione.
    if live:
        mappa_soglie = {r["id"]: r["km_per_partita"] for r in conn.execute("SELECT id, km_per_partita FROM campionati").fetchall()}
    else:
        mappa_soglie = {
            r["id"]: r["km_per_partita"]
            for r in conn.execute("SELECT id, km_per_partita FROM campionati_storici WHERE stagione_id=?", (stagione_storica_id,)).fetchall()
        }
    mappa_tipo_fase = _carica_mappa_tipo_fase(conn, stagione_storica_id)
    conn.close()

    def distanza(comune1, comune2):
        a, b = _norm_comune(comune1), _norm_comune(comune2)
        if not a or not b:
            return None
        if a == b:
            return 0.0
        return mappa_km.get((a, b))

    nomi_associato_norm = nomi_ass_norm | _NOMI_PLACEHOLDER_ASSOCIATO_NORM

    gruppi = {}
    for p in partite:
        campionato_id = mappa_codici.get(_norm_nome(p["campionato"]))
        if campionato_id is not None:
            chiave = f"c{campionato_id}"
            nome = nomi_campionati.get(campionato_id, p["campionato"])
        else:
            chiave = f"raw:{p['campionato']}"
            nome = p["campionato"]
        g = gruppi.setdefault(chiave, {"nome": nome, "gare": [], "campionato_id": campionato_id})
        riga = dict(p)
        # nel drill-down squadra/arbitro (frontend): chi ha ruolo "ASS", e ogni variante del
        # segnaposto "Arbitro Associato" (es. "Aaa Arbitro Associato" usato per l'ordinamento
        # alfabetico in alcuni export), non deve comparire come persona a sé ma già qui
        # ricondotto alla stessa etichetta, così il conteggio per nome resta coerente col totale.
        if _norm_nome(riga["arbitro"]) in nomi_associato_norm:
            riga["arbitro"] = "Arbitro Associato"
        if _norm_nome(riga["assistente1"]) in nomi_associato_norm:
            riga["assistente1"] = "Arbitro Associato"
        # sotto-alias veloce (campionato/playoff/final four) impostato sul singolo codice in
        # Alias campionati: usato per il dettaglio per fase mostrato sotto la riga aggregata.
        riga["tipo_fase"] = mappa_tipo_fase.get(_norm_nome(riga["campionato"]), "campionato")
        g["gare"].append(riga)

    def _km_persona_storico(nome_persona, localita):
        if not nome_persona:
            return None
        nome_norm = _norm_nome(nome_persona)
        if nome_norm in nomi_associato_norm:
            return None
        comune = arbitri_comuni.get(nome_norm)
        if not comune:
            return None
        return distanza(comune, localita)

    def _calcola_stats(gare_sottoinsieme, soglia_testo):
        """Stesso calcolo aggregato (federali/associato/km) applicato a un sottoinsieme di
        gare: usato sia per il totale del gruppo sia per il dettaglio per fase (sotto-alias
        campionato/playoff/final four) sotto."""
        n_federali = 0
        n_associato = 0
        km_totali = 0.0
        for p in gare_sottoinsieme:
            for campo_ruolo, km_ruolo in (("arbitro", p["km_arbitro"]), ("assistente1", p["km_assistente1"])):
                nome_persona = p[campo_ruolo]
                if not nome_persona:
                    continue
                nome_norm = _norm_nome(nome_persona)
                if nome_norm in nomi_associato_norm:
                    n_associato += 1
                elif nome_norm in arbitri_comuni:
                    n_federali += 1
                    if km_ruolo is not None:
                        km_totali += km_ruolo
        totale_designazioni = n_federali + n_associato
        media_km_solo_federali = round(km_totali / n_federali, 1) if n_federali else 0
        soglia_km = _estrai_km_soglia(soglia_testo)
        scostamento_soglia = round(media_km_solo_federali - soglia_km, 1) if soglia_km is not None and n_federali else None
        return {
            "n_gare": len(gare_sottoinsieme),
            "n_federali": n_federali,
            "pct_federali": round(n_federali / totale_designazioni * 100, 1) if totale_designazioni else 0,
            "n_associato": n_associato,
            "pct_associato": round(n_associato / totale_designazioni * 100, 1) if totale_designazioni else 0,
            "km_totali": round(km_totali, 1),
            "media_km_gara": round(km_totali / totale_designazioni, 1) if totale_designazioni else 0,
            "media_km_solo_federali": media_km_solo_federali,
            "soglia_km": soglia_km,
            "scostamento_soglia": scostamento_soglia,
        }

    ETICHETTE_FASE = {"campionato": "Campionato", "coppa": "Coppa", "playoff": "Playoff/Play out", "final_four": "Fasi finali"}
    ORDINE_FASI = ["campionato", "coppa", "playoff", "final_four"]

    risultati = []
    for chiave, g in gruppi.items():
        for p in g["gare"]:
            if live:
                # rispetta l'eventuale accordo di trasferta dichiarato (auto unica: chi non
                # ha guidato prende 0 km) invece del calcolo sempre separato per persona.
                km_arbitro, km_assistente1 = _calcola_km_coppia(p, arbitri_comuni, distanza)
            else:
                # stesso calcolo per-persona usato per il totale/media qui sotto, cosi' anche
                # per le stagioni storiche il drill-down "sopra la media" ha i km da mostrare.
                km_arbitro = _km_persona_storico(p["arbitro"], p["localita"])
                km_assistente1 = _km_persona_storico(p["assistente1"], p["localita"])
            # esposti nel drill-down lato frontend (elenco gare sopra/sotto la media).
            p["km_arbitro"] = km_arbitro
            p["km_assistente1"] = km_assistente1

        soglia_testo = mappa_soglie.get(g["campionato_id"], "") if g["campionato_id"] is not None else ""
        stats = _calcola_stats(g["gare"], soglia_testo)

        # dettaglio per sotto-alias (campionato/playoff/final four): solo se nel gruppo
        # esiste piu' di una fase, altrimenti sarebbe una riga identica a quella totale.
        gare_per_fase = {}
        for p in g["gare"]:
            gare_per_fase.setdefault(p["tipo_fase"], []).append(p)
        dettaglio_fasi = []
        if len(gare_per_fase) > 1:
            for fase in ORDINE_FASI + sorted(k for k in gare_per_fase if k not in ORDINE_FASI):
                if fase not in gare_per_fase:
                    continue
                dettaglio_fasi.append({
                    "fase": fase,
                    "etichetta": ETICHETTE_FASE.get(fase, fase),
                    **_calcola_stats(gare_per_fase[fase], soglia_testo),
                })

        risultati.append({
            "chiave": chiave,
            "nome": g["nome"],
            "gare": g["gare"],
            "dettaglio_fasi": dettaglio_fasi,
            **stats,
        })

    risultati.sort(key=lambda r: r["n_gare"], reverse=True)
    return jsonify(risultati)


@app.route("/api/designazioni/dettaglio-conteggio", methods=["GET"])
def dettaglio_conteggio():
    """Elenco delle gare dietro ai conteggi 'P. dirette casa/ospite (cod./nome)' e
    'Ultima designazione casa/ospite' mostrati nella griglia dei candidati."""
    partita_id = request.args.get("partita_id", type=int)
    nome = request.args.get("nome", "")
    tipo = request.args.get("tipo", "")  # casa_cod, casa_nome, osp_cod, osp_nome
    nome_norm = _norm_nome(nome)

    conn = db.get_db()
    partita = conn.execute("SELECT * FROM partite WHERE id=?", (partita_id,)).fetchone()
    if not partita:
        conn.close()
        return jsonify([])
    rows = [dict(r) for r in conn.execute(
        "SELECT data, campionato, girone, numero_gara, squadra_casa, squadra_ospite, risultato, "
        "arbitro, assistente1, aff_a, aff_b FROM partite WHERE disputata=1 AND (arbitro != '' OR assistente1 != '')"
    ).fetchall()]
    mappa_codici, mappa_squadre = _carica_mappa_campionati(conn)
    conn.close()

    aff_casa = partita["aff_a"]
    aff_osp = partita["aff_b"]
    campionato_match = partita["campionato"]
    nome_casa_norm = _norm_nome(partita["squadra_casa"])
    nome_osp_norm = _norm_nome(partita["squadra_ospite"])

    # solo per "casa_nome"/"osp_nome": stessa risoluzione tramite Campionati usata in
    # get_candidati_designazione, con fallback al confronto campionato+nome se non collegato.
    squadra_id_casa = _risolvi_squadra(partita["squadra_casa"], campionato_match, mappa_codici, mappa_squadre)
    squadra_id_osp = _risolvi_squadra(partita["squadra_ospite"], campionato_match, mappa_codici, mappa_squadre)
    if tipo in ("casa_nome", "osp_nome"):
        for r in rows:
            r["_sq_casa_id"] = _risolvi_squadra(r["squadra_casa"], r["campionato"], mappa_codici, mappa_squadre)
            r["_sq_osp_id"] = _risolvi_squadra(r["squadra_ospite"], r["campionato"], mappa_codici, mappa_squadre)

    risultato = []
    for r in rows:
        if not _riga_ha_arbitro(r, nome_norm):
            continue
        if tipo == "casa_cod":
            match = bool(aff_casa) and (r["aff_a"] == aff_casa or r["aff_b"] == aff_casa)
        elif tipo == "osp_cod":
            match = bool(aff_osp) and (r["aff_a"] == aff_osp or r["aff_b"] == aff_osp)
        elif tipo == "casa_nome":
            if squadra_id_casa is not None:
                match = squadra_id_casa in (r["_sq_casa_id"], r["_sq_osp_id"])
            else:
                match = (bool(campionato_match) and r["campionato"] == campionato_match and bool(nome_casa_norm)
                         and (_norm_nome(r["squadra_casa"]) == nome_casa_norm or _norm_nome(r["squadra_ospite"]) == nome_casa_norm))
        elif tipo == "osp_nome":
            if squadra_id_osp is not None:
                match = squadra_id_osp in (r["_sq_casa_id"], r["_sq_osp_id"])
            else:
                match = (bool(campionato_match) and r["campionato"] == campionato_match and bool(nome_osp_norm)
                         and (_norm_nome(r["squadra_casa"]) == nome_osp_norm or _norm_nome(r["squadra_ospite"]) == nome_osp_norm))
        else:
            match = False
        if not match:
            continue
        d = dict(r)
        d.pop("_sq_casa_id", None)
        d.pop("_sq_osp_id", None)
        d["ruolo_designazione"] = _ruolo_in_riga(r, nome_norm)
        risultato.append(d)

    risultato.sort(key=lambda r: r["data"], reverse=True)
    return jsonify(risultato)


# ---------- HELPER IMPORT COMUNE ----------

TABLE_COLUMNS = {
    "arbitri": ["codice_fiscale", "cognome_nome", "matricola", "comune", "ruolo", "scadenza_certificato_medico", "cellulare", "email"],
    "partite": db.PARTITE_COLONNE + ["disputata"],
    "indisponibilita": db.INDISPONIBILITA_COLONNE,
    # tabelle storiche (import per una stagione passata, vedi sezione API STAGIONI):
    # stesse colonne dei corrispettivi live, piu' stagione_id passato via extra_fields.
    "partite_storiche": db.PARTITE_COLONNE + ["stagione_id"],
    "indisponibilita_storiche": db.INDISPONIBILITA_COLONNE + ["stagione_id"],
}

# Campi mostrati nella tabella di anteprima import, per tabella (solo quelli utili a
# riconoscere colpo d'occhio una riga, non tutte le colonne).
CAMPI_ANTEPRIMA_IMPORT = {
    "arbitri": ["cognome_nome", "codice_fiscale", "comune", "ruolo", "cellulare", "email"],
    "partite": ["data", "ora", "campionato", "girone", "numero_gara", "squadra_casa", "squadra_ospite"],
    "indisponibilita": ["arbitro", "data_inizio", "ora_inizio", "data_fine", "ora_fine", "motivo"],
    "partite_storiche": ["data", "ora", "campionato", "girone", "numero_gara", "squadra_casa", "squadra_ospite"],
    "indisponibilita_storiche": ["arbitro", "data_inizio", "ora_inizio", "data_fine", "ora_fine", "motivo"],
}


def _norm_confronto(s):
    return (s or "").strip().lower()


def _chiave_duplicato_import(tabella, riga):
    """Chiave usata per riconoscere se una riga dell'Excel corrisponde a un record già
    esistente (o a un'altra riga dello stesso file): non è un id tecnico ma i campi che,
    nella pratica, identificano lo stesso arbitro/gara/periodo di indisponibilità."""
    if tabella == "arbitri":
        cf = _norm_confronto(riga.get("codice_fiscale"))
        if cf:
            return ("cf", cf)
        return ("nome", _norm_confronto(riga.get("cognome_nome")))
    if tabella in ("partite", "partite_storiche"):
        # solo campionato + numero gara: identifica la stessa partita anche se rinviata
        # (giorno/orario cambiati), cosi' l'import la aggiorna invece di duplicarla o di
        # ignorare il nuovo giorno/orario. Per le storiche il confronto resta scoped alla
        # stagione perche' _indice_esistenti_import filtra gia' per stagione_id.
        return (
            _norm_confronto(riga.get("campionato")),
            _norm_confronto(riga.get("numero_gara")),
        )
    if tabella in ("indisponibilita", "indisponibilita_storiche"):
        return (
            _norm_confronto(riga.get("arbitro")),
            _norm_confronto(riga.get("data_inizio")),
            _norm_confronto(riga.get("ora_inizio")),
            _norm_confronto(riga.get("data_fine")),
            _norm_confronto(riga.get("ora_fine")),
        )
    return None


def _indice_esistenti_import(conn, tabella, extra_fields):
    """Mappa chiave -> id delle righe gia' presenti nel DB (stessa chiave di
    _chiave_duplicato_import), cosi' l'import puo' AGGIORNARE il record esistente invece di
    limitarsi a saltarlo o di duplicarlo (es. una gara rinviata: stesso campionato/numero
    gara, ma giorno/orario diversi da aggiornare)."""
    if tabella == "arbitri":
        indice = {}
        for r in conn.execute("SELECT id, codice_fiscale, cognome_nome FROM arbitri").fetchall():
            cf = _norm_confronto(r["codice_fiscale"])
            chiave = ("cf", cf) if cf else ("nome", _norm_confronto(r["cognome_nome"]))
            indice[chiave] = r["id"]
        return indice
    if tabella in ("partite", "partite_storiche"):
        condizioni, parametri = "", []
        if extra_fields:
            condizioni = "WHERE " + " AND ".join(f"{k}=?" for k in extra_fields)
            parametri = list(extra_fields.values())
        righe = conn.execute(f"SELECT id, campionato, numero_gara FROM {tabella} {condizioni}", parametri).fetchall()
        return {
            (_norm_confronto(r["campionato"]), _norm_confronto(r["numero_gara"])): r["id"]
            for r in righe
        }
    if tabella in ("indisponibilita", "indisponibilita_storiche"):
        condizioni, parametri = "", []
        if extra_fields:
            condizioni = "WHERE " + " AND ".join(f"{k}=?" for k in extra_fields)
            parametri = list(extra_fields.values())
        righe = conn.execute(
            f"SELECT id, arbitro, data_inizio, ora_inizio, data_fine, ora_fine FROM {tabella} {condizioni}", parametri
        ).fetchall()
        return {
            (_norm_confronto(r["arbitro"]), _norm_confronto(r["data_inizio"]), _norm_confronto(r["ora_inizio"]), _norm_confronto(r["data_fine"]), _norm_confronto(r["ora_fine"])): r["id"]
            for r in righe
        }
    return {}


def _anteprima_import_generico(tabella, extra_fields=None):
    """Legge il file come farebbe l'import vero, ma non scrive nulla nel DB: restituisce le
    righe che verrebbero inserite segnalando quelle che corrispondono a un record già
    esistente (che l'import AGGIORNERÀ, non salterà) o a un'altra riga ripetuta nel file."""
    if "file" not in request.files:
        return jsonify({"ok": False, "errore": "Nessun file ricevuto"}), 400
    file = request.files["file"]
    extra_fields = extra_fields or {}

    try:
        record = importer.leggi_excel(file, tabella)
    except Exception as e:
        return jsonify({"ok": False, "errore": f"Errore lettura file: {e}"}), 400

    if not record:
        return jsonify({"ok": False, "errore": "Nessuna colonna riconosciuta nel file. Controlla le intestazioni."}), 400

    conn = db.get_db()
    indice_esistenti = _indice_esistenti_import(conn, tabella, extra_fields)
    conn.close()

    campi_anteprima = CAMPI_ANTEPRIMA_IMPORT[tabella]
    chiavi_viste = set(indice_esistenti.keys())
    righe = []
    n_duplicate = 0
    for riga in record:
        chiave = _chiave_duplicato_import(tabella, riga)
        duplicato = chiave in chiavi_viste
        chiavi_viste.add(chiave)
        if duplicato:
            n_duplicate += 1
        righe.append({
            "duplicato": duplicato,
            "dati": {c: riga.get(c, extra_fields.get(c, "")) for c in campi_anteprima},
        })

    return jsonify({
        "ok": True,
        "totale": len(record),
        "duplicate": n_duplicate,
        "nuove": len(record) - n_duplicate,
        "righe": righe,
    })


# Campi di designazione di una gara. Sull'import delle DISPUTATE non vengono mai svuotati se
# il file non li contiene (altrimenti si perde chi ha arbitrato davvero); se il file porta un
# valore vince sempre quello. Sull'import delle DA DISPUTARE invece non si ripristinano MAI:
# quella scheda deve tornare sempre senza arbitro, anche se una designazione esisteva in
# precedenza sulla stessa gara (va designata di nuovo).
CAMPI_DESIGNAZIONE_PARTITE = [
    "arbitro", "residenza_arbitro", "assistente1", "residenza_assistente1",
    "osservatore_associato", "residenza_osservatore_associato",
    "segnapunti", "residenza_segnapunti",
    "assistente2", "residenza_assistente2", "osservatore", "residenza_osservatore",
]


def _importa_righe_partite(conn, record, disputata_target, modalita):
    """Import dedicato per la tabella 'partite' live (da disputare/disputate): la stessa gara
    (campionato+numero gara) resta la stessa gara indipendentemente da quale delle due
    tabelle la contiene in un dato momento, perché può passare da 'da disputare' a
    'disputata' (e anche tornare indietro, se il sistema principale la ripubblica come non
    ancora assegnata dopo un rinvio). Prima di un'eventuale cancellazione ("sostituisci") si
    salva un'istantanea di arbitro/2° arbitro/residenze di ogni gara corrente: dopo il
    reimport questi campi vengono rimessi sulla gara corrispondente SOLO se il file non porta
    un valore proprio."""
    snapshot = {
        (_norm_confronto(r["campionato"]), _norm_confronto(r["numero_gara"])): dict(r)
        for r in conn.execute("SELECT * FROM partite").fetchall()
    }

    if modalita == "sostituisci":
        conn.execute("DELETE FROM partite WHERE disputata=?", (disputata_target,))

    esistenti = {
        (_norm_confronto(r["campionato"]), _norm_confronto(r["numero_gara"])): r["id"]
        for r in conn.execute("SELECT id, campionato, numero_gara FROM partite").fetchall()
    }

    colonne = db.PARTITE_COLONNE + ["disputata"]
    inseriti = aggiornati = 0
    rinviate = []

    for riga in record:
        chiave = (_norm_confronto(riga.get("campionato")), _norm_confronto(riga.get("numero_gara")))
        precedente = snapshot.get(chiave)

        valori = {c: riga.get(c, "") for c in db.PARTITE_COLONNE}
        valori["disputata"] = disputata_target

        if precedente:
            # la designazione si ripristina solo diventando "disputata": la scheda "da
            # disputare" torna sempre senza arbitro, va designata di nuovo.
            if disputata_target == 1:
                for campo in CAMPI_DESIGNAZIONE_PARTITE:
                    if not valori[campo]:
                        valori[campo] = precedente[campo]
            if precedente["data"] != valori["data"] or precedente["ora"] != valori["ora"]:
                rinviate.append({
                    "campionato": riga.get("campionato", ""),
                    "numero_gara": riga.get("numero_gara", ""),
                    "data_prima": precedente["data"], "ora_prima": precedente["ora"],
                    "data_dopo": valori["data"], "ora_dopo": valori["ora"],
                })

        id_esistente = esistenti.get(chiave)
        if id_esistente is not None:
            assegnazioni_sql = ",".join(f"{c}=?" for c in colonne)
            conn.execute(f"UPDATE partite SET {assegnazioni_sql} WHERE id=?", [valori[c] for c in colonne] + [id_esistente])
            aggiornati += 1
        else:
            colonne_sql = ",".join(colonne)
            placeholders = ",".join(["?"] * len(colonne))
            cur = conn.execute(f"INSERT INTO partite ({colonne_sql}) VALUES ({placeholders})", [valori[c] for c in colonne])
            esistenti[chiave] = cur.lastrowid
            inseriti += 1

    conn.commit()
    return {"ok": True, "inseriti": inseriti, "aggiornati": aggiornati, "rinviate": rinviate}


def _import_generico(tabella, extra_fields=None):
    if "file" not in request.files:
        return jsonify({"ok": False, "errore": "Nessun file ricevuto"}), 400

    file = request.files["file"]
    modalita = request.args.get("modalita", "aggiungi")  # "aggiungi" oppure "sostituisci"

    try:
        record = importer.leggi_excel(file, tabella)
    except Exception as e:
        return jsonify({"ok": False, "errore": f"Errore lettura file: {e}"}), 400

    if not record:
        return jsonify({"ok": False, "errore": "Nessuna colonna riconosciuta nel file. Controlla le intestazioni."}), 400

    extra_fields = extra_fields or {}

    conn = db.get_db()

    # la tabella "partite" live (non le storiche) ha una logica di riconciliazione dedicata,
    # perché la stessa gara può muoversi tra "da disputare" e "disputata": vedi sopra.
    if tabella == "partite" and "disputata" in extra_fields:
        risultato = _importa_righe_partite(conn, record, extra_fields["disputata"], modalita)
        conn.close()
        return jsonify(risultato)

    colonne = TABLE_COLUMNS[tabella]

    if modalita == "sostituisci":
        if extra_fields:
            # sostituisce solo il sottoinsieme rilevante (es. solo le partite "disputate"
            # oppure solo quelle "da disputare"), senza toccare il resto della tabella
            condizioni = " AND ".join([f"{k}=?" for k in extra_fields.keys()])
            conn.execute(f"DELETE FROM {tabella} WHERE {condizioni}", list(extra_fields.values()))
        else:
            conn.execute(f"DELETE FROM {tabella}")

    # righe già presenti (calcolate DOPO l'eventuale sostituzione sopra): se una riga
    # importata corrisponde a un record esistente viene AGGIORNATA (es. una gara rinviata:
    # stesso campionato/numero gara, ma giorno/orario diversi da aggiornare) invece di
    # essere saltata o duplicata; altrimenti viene inserita come nuova.
    indice_esistenti = _indice_esistenti_import(conn, tabella, extra_fields)

    inseriti = 0
    aggiornati = 0
    for riga in record:
        chiave = _chiave_duplicato_import(tabella, riga)

        valori = {c: riga.get(c, extra_fields.get(c, "")) for c in colonne}
        for k, v in extra_fields.items():
            if k not in riga:
                valori[k] = v
        colonne_sql = ",".join(colonne)
        valori_ordinati = [valori[c] for c in colonne]

        id_esistente = indice_esistenti.get(chiave)
        if id_esistente is not None:
            assegnazioni_sql = ",".join(f"{c}=?" for c in colonne)
            conn.execute(f"UPDATE {tabella} SET {assegnazioni_sql} WHERE id=?", valori_ordinati + [id_esistente])
            aggiornati += 1
        else:
            placeholders = ",".join(["?"] * len(colonne))
            cur = conn.execute(f"INSERT INTO {tabella} ({colonne_sql}) VALUES ({placeholders})", valori_ordinati)
            indice_esistenti[chiave] = cur.lastrowid
            inseriti += 1

    conn.commit()
    conn.close()
    return jsonify({"ok": True, "inseriti": inseriti, "aggiornati": aggiornati})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
