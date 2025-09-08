# Architettura del progetto

Questo documento descrive passo passo tutto il codice presente nella
repository, spiegando le funzioni principali in modo comprensibile anche per
chi non conosce TypeScript o FFmpeg.

## Panoramica generale
1. **fetchAssets.ts** scarica immagini, tracce TTS, font e musica di
   background partendo dalla risposta JSON.
2. **template.ts** legge il file di template (layout delle slide) e le
   modifiche fornite dalla risposta.
3. **timeline.ts** combina template e risposta per calcolare la durata di ogni
   slide, le posizioni di testi e logo e i riempimenti nei vuoti temporali.
4. **renderers/composition.ts** genera i singoli video delle slide costruendo
   il comando `ffmpeg` con overlay, testi e audio.
5. **concat.ts** unisce i segmenti e sovrappone la musica di sottofondo.
6. **main.ts** orchestral l'intero processo eseguendo i passi precedenti.

Di seguito il dettaglio di ogni file.

## src/config.ts
Definisce costanti usate in più punti, come l'orientamento del video, i valori
predefiniti per testo e logo e i volumi audio di default【F:src/config.ts†L1-L50】.

## src/paths.ts
Calcola i percorsi delle cartelle usate dal progetto (download, temp, output,
... ) e individua l'eseguibile `ffmpeg` da utilizzare【F:src/paths.ts†L1-L28】.

## src/template.ts
Contiene le funzioni per:
- caricare il template grafico dal file `template/template_horizontal.json`
- caricare la risposta `risposta_horizontal.json`
- cercare elementi (slide, testo, logo) all'interno del template
- convertire valori percentuali in pixel
- ottenere un font di fallback se quello richiesto non è disponibile【F:src/template.ts†L1-L87】【F:src/template.ts†L88-L114】.

## src/fetchAssets.ts
Si occupa di scaricare tutti gli asset esterni:
- pulisce le cartelle di download
- scarica logo, audio di background, TTS e immagini
- analizza il template per trovare i nomi dei font e li scarica da Google Fonts【F:src/fetchAssets.ts†L1-L96】【F:src/fetchAssets.ts†L97-L150】.
Ogni file salvato viene mostrato a console con il percorso locale.

## src/timeline.ts
Trasforma template e risposta in una lista di **SlideSpec** che descrivono
ciascun segmento da renderizzare. Principali operazioni:
- ricerca delle immagini, del TTS e del font per ogni slide
- calcolo delle coordinate del testo e del logo partendo dai valori presenti
  nel template e convertendo le percentuali in pixel
- suddivisione del testo in più righe in base alla larghezza del box
- estensione della durata della slide se il TTS è più lungo
- inserimento di segmenti di riempimento con solo il logo quando ci sono
  buchi temporali tra una slide e la successiva
- generazione dell'eventuale slide di outro con logo e testo finale【F:src/timeline.ts†L1-L115】【F:src/timeline.ts†L116-L210】【F:src/timeline.ts†L211-L330】【F:src/timeline.ts†L331-L439】.

## src/renderers/composition.ts
Per ogni **SlideSpec** costruisce e lancia un comando `ffmpeg` che produce il
video corrispondente:
- crea un canvas nero
- sovrappone l'immagine di background scalata e ritagliata
- aggiunge il logo nella posizione richiesta
- disegna il testo usando il filtro `drawtext`
- inserisce la traccia TTS oppure un audio silenzioso
- codifica il tutto in H.264 con audio AAC【F:src/renderers/composition.ts†L1-L120】【F:src/renderers/composition.ts†L121-L181】.

## src/ffmpeg/filters.ts
Piccole utility per lavorare con FFmpeg:
- `toFFPath` normalizza i percorsi per Windows
- `escTextForDrawText` mette in escape i caratteri speciali
- `buildDrawText` genera la stringa di filtro `drawtext` pronta da inserire
  nel comando FFmpeg【F:src/ffmpeg/filters.ts†L1-L40】【F:src/ffmpeg/filters.ts†L41-L83】.

## src/ffmpeg/run.ts
Fornisce la funzione `runFFmpeg` che esegue l'eseguibile scelto,
stampa il comando, lo salva in `comandi.txt` e segnala eventuali errori.
Include anche `runPipe` (esecuzione con output catturato) e `ok` per controllare
l'esito dei processi【F:src/ffmpeg/run.ts†L1-L46】.

## src/ffmpeg/probe.ts
Funzione `probeDurationSec` che usa `ffprobe` per leggere la durata di un file
multimediale, utile per conoscere la lunghezza reale delle tracce TTS【F:src/ffmpeg/probe.ts†L1-L20】.

## src/concat.ts
Scrive l'elenco dei segmenti in `concat.txt` e invoca FFmpeg con il demuxer
`concat` per unirli. Se è presente una traccia di background la riproduce in
loop e la mescola con l'audio TTS. Il risultato finale viene salvato in
`src/output/final_output.mp4`【F:src/concat.ts†L1-L58】.

## src/main.ts
Punto d'ingresso dell'applicazione:
1. prepara le cartelle di lavoro
2. scarica gli asset
3. carica template e risposta
4. costruisce la timeline
5. renderizza ogni slide
6. concatena i segmenti con l'audio di sottofondo【F:src/main.ts†L1-L56】.

## src/tests/timeline.test.ts
Verifica le funzioni di `timeline.ts`, in particolare il parsing del template
e la generazione della sequenza di slide【F:src/tests/timeline.test.ts†L1-L40】.

Con queste informazioni un programmatore alle prime armi può orientarsi nel
codice e capire come viene generato il video finale.
