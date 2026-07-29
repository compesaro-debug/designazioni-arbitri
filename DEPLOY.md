# Guida al deploy su Oracle Cloud (VM gratuita "Always Free")

Questa guida ti porta dall'account Oracle a sito online, sempre acceso, senza limiti di CPU.

## Parte 1 — Cose che devi fare tu (account e VM)

Queste richiedono il tuo account personale, non posso farle al posto tuo.

1. Vai su **cloud.oracle.com** e crea un account gratuito ("Always Free"). Serve una carta di credito solo per verifica identità: non viene addebitato nulla sul piano free.
2. Nella dashboard, vai su **Compute → Instances → Create Instance**.
3. Dai un nome all'istanza (es. `designazioni-arbitri`).
4. In **Image and shape**: scegli **Ampere (ARM), Always Free eligible** come shape (è la più potente tra le opzioni gratuite). Come sistema operativo scegli **Ubuntu** (l'ultima versione LTS disponibile, es. 22.04 o 24.04).
5. In **Networking**: lascia la VCN di default che Oracle propone (va bene, include già una subnet pubblica).
6. In **Add SSH keys**: lascia che Oracle generi la coppia di chiavi e **scarica la chiave privata** (un file tipo `ssh-key-....key`). Ti servirà per collegarti. Conservala con cura, non è recuperabile se la perdi.
7. Clicca **Create**. Attendi un paio di minuti che l'istanza risulti "Running" e annotati il suo **Public IP Address** (visibile nella pagina dell'istanza).

## Parte 2 — Apri la porta 5000 nel firewall di rete di Oracle

1. Dalla pagina dell'istanza, clicca sul link della sua **Subnet**, poi sulla **Security List** associata (di solito "Default Security List for...").
2. **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port Range: `5000`
3. Salva.

## Parte 3 — Collegati alla VM e prepara l'ambiente

Da Windows, apri PowerShell nella cartella dove hai salvato la chiave `.key` e collegati (sostituisci `<IP_PUBBLICO>`):

```
ssh -i .\ssh-key-....key ubuntu@<IP_PUBBLICO>
```

Una volta dentro, esegui in sequenza:

```bash
sudo apt update && sudo apt install -y python3-venv python3-pip

mkdir ~/designazioni-arbitri
```

## Parte 4 — Carica il progetto sulla VM

Dal tuo PC (in una nuova finestra PowerShell, non quella collegata via SSH), dalla cartella del progetto:

```
scp -i .\ssh-key-....key -r .\* ubuntu@<IP_PUBBLICO>:~/designazioni-arbitri/
```

Questo copia tutti i file (compreso `data/designazioni.db` con tutti i tuoi dati) sulla VM.

## Parte 5 — Installa le dipendenze e testa

Torna nella finestra SSH collegata alla VM:

```bash
cd ~/designazioni-arbitri
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# test rapido
python app.py
```

Se vedi il server partire senza errori, premi Ctrl+C per fermarlo e passa alla parte 6 (per tenerlo sempre acceso, non lo lasciamo così).

## Parte 6 — Rendilo permanente con systemd

Sempre nella SSH, crea il file di servizio:

```bash
sudo nano /etc/systemd/system/designazioni.service
```

Incolla questo contenuto:

```ini
[Unit]
Description=Designazioni Arbitri
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/designazioni-arbitri
ExecStart=/home/ubuntu/designazioni-arbitri/venv/bin/gunicorn --bind 0.0.0.0:5000 --workers 3 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Salva (Ctrl+O, Invio, Ctrl+X), poi attiva il servizio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable designazioni
sudo systemctl start designazioni
sudo systemctl status designazioni
```

Deve risultare "active (running)".

## Parte 7 — Apri il firewall interno della VM

Ubuntu su Oracle a volte ha anche `iptables`/`netfilter-persistent` attivo oltre alla Security List di Oracle. Se il sito non è raggiungibile dopo la Parte 2, esegui:

```bash
sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT
sudo netfilter-persistent save
```

## Fatto

Il sito è ora raggiungibile su `http://<IP_PUBBLICO>:5000` da qualunque posto, sempre acceso.

**Se qualcosa si blocca in uno di questi passaggi**, incollami l'errore esatto che vedi nel terminale e ti aiuto a risolverlo.

## Prossimo passo consigliato

Aggiungere una password condivisa d'accesso al sito, visto che ora è raggiungibile da chiunque abbia il link. Fammelo sapere quando vuoi procedere.
