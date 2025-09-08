# Generatore video Merlino

Questa applicazione Node.js crea brevi video partendo da un *template* JSON e da alcuni asset (immagini, audio e font).  
È pensata per essere usata anche da chi non ha familiarità con FFmpeg: tutto il lavoro "sporco" viene svolto da script già pronti.

## Prerequisiti
- **Node.js** >= 18
- **npm** per installare le dipendenze
- **FFmpeg** installato e raggiungibile dal PATH (in alternativa impostare
  la variabile d'ambiente `FFMPEG_PATH` con il percorso completo dell'eseguibile)
- Facoltativo: variabili d'ambiente SMTP per l'invio automatico del video finale via email

## Installazione
```bash
npm install
```

Assicurarsi che `ffmpeg` funzioni lanciando `ffmpeg -version` dal terminale.

## Struttura del progetto
- `src/` – codice TypeScript.
  - `main.ts` orchestratore principale.
  - `renderers/` genera i segmenti video (immagini, filler, outro).
  - `ffmpeg/` wrapper e filtri personalizzati.
  - `timeline.ts`, `concat.ts`, `validate.ts` gestiscono l'ordine dei segmenti e l'unione finale.
- `template/` – esempi di template JSON con la descrizione degli asset da scaricare.
- `fonts/` – font usati per il testo.
- `download/` – cartella dove vengono salvati gli asset scaricati.
- `comandi.txt` – log con tutti i comandi FFmpeg eseguiti.

## Flusso di lavoro
1. **Fetch degli asset** – `src/fetchAssets.ts` legge il template e scarica immagini, audio e TTS nella cartella `download/`.
2. **Timeline** – `src/timeline.ts` converte il template in una sequenza di segmenti (intro, slide con immagine+testo, filler, outro).
3. **Rendering segmenti** – ogni segmento viene trasformato in un piccolo video con `renderers/image.ts`, `renderers/filler.ts` o `renderers/outro.ts`.  
   Ogni funzione costruisce internamente un comando `ffmpeg` con filtri come `drawtext`, `overlay` e animazioni di transizione.  I comandi vengono lanciati da `runFFmpeg` (src/ffmpeg/run.ts), che salva anche il comando su `comandi.txt`.
4. **Validazione** – `validate.ts` controlla che ogni segmento generato sia valido e, se necessario, tenta di ripararlo.
5. **Concatenazione** – `concat.ts` usa il demuxer `ffmpeg` per unire tutti i segmenti, aggiungendo l'eventuale musica di sottofondo.
6. **Condivisione** – `share.ts` può inviare il video finale tramite email se sono impostate le variabili SMTP.

## Esecuzione
```bash
npm start               # build + esecuzione completa
npm start -- --reuse-segs     # riusa segmenti esistenti in src/temp
npm start -- --template tmp2  # usa il template alternativo
npm start -- --barColor blue  # imposta il colore della barretta del testo

```
I flag aggiuntivi sono descritti in `src/cli.ts`.

Il risultato finale viene salvato in `download/final.mp4`.

## FFmpeg in breve
FFmpeg è il motore che elabora audio e video. In questo progetto viene usato per:
- ridimensionare le immagini a tutto schermo (`scale` + `crop`)
- applicare zoom e sfumature (`zoompan`, `geq`)
- scrivere testo con animazioni (`drawtext`, `xfade`)
- sovrapporre il logo (`overlay`)
- unire audio e video e codificarli (`libx264`, `aac`)

Non è necessario conoscere in dettaglio i comandi: `runFFmpeg` si occupa di costruirli e lanciarli.  In caso di problemi si può consultare `comandi.txt` per vedere i comandi completi eseguiti.

## Troubleshooting
- **Manca FFmpeg** – installarlo dal sito ufficiale o tramite il gestore pacchetti del proprio sistema. È possibile specificare il percorso esatto tramite la variabile d'ambiente `FFMPEG_PATH`.
- **Font non trovato** – assicurarsi di mettere almeno un file `.ttf` o `.otf` dentro `fonts/`.
- **Errore di concatenazione** – verificare che ogni segmento abbia audio (anche silenzioso) e che il file audio di background esista.
- **Email non inviata** – controllare le variabili `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` e `EMAIL_FROM`.

Con questa base si possono creare video personalizzati modificando il template o sostituendo gli asset.  Le parti complesse di FFmpeg sono già incapsulate, per cui puoi concentrarti sul contenuto.

Per una descrizione dettagliata di ogni funzione vedi [docs/funzioni.md](docs/funzioni.md).
