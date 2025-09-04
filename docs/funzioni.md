# Documentazione delle funzioni

Questa guida elenca le funzioni principali del progetto e spiega in modo
semplice cosa fanno e quali parametri accettano.

## `src/assets.ts`
- **`GetLocalAsset(type, idx?)`**
  - Cerca nelle sottocartelle di `download/` un asset già presente.
  - `type`: tipo di asset (`"img"`, `"tts"`, `"audio"`, `"logo"`).
  - `idx`: indice numerico usato per immagini e file TTS.

## `src/fetchAssets.ts`
- **`fetchAssets()`**
  - Legge il template JSON e scarica logo, audio, immagini, TTS **e font**
    dalle URL fornite, salvandoli nelle rispettive cartelle.
- Funzioni di supporto interne:
  - `ensureDir(dir)` crea una cartella se mancante.
  - `downloadFile(url, outPath)` scarica un singolo file.

## `src/cli.ts`
- **`hasFlag(name)`**
  - Ritorna `true` se il flag `--name` è presente sugli argomenti o nelle
    variabili d'ambiente.
- **`getOpt(name, def?)`**
  - Restituisce il valore associato al flag `--name` seguendo un ordine di
    priorità (CLI → env → `npm_config_argv` → default).

## `src/config.ts`
- **`deriveOrientation(w, h)`**
  - Determina se usare layout `landscape` o `portrait` a partire dalle
    dimensioni del template.

## `src/timeline.ts`
- **`buildTimeline(mods)`**
  - Trasforma le modifiche del template in una lista ordinata di segmenti,
    aggiungendo filler e outro dove necessario.

## `src/template.ts`
- **`loadTemplate()`**
  - Carica il file di template `risposta_*.json` (orizzontale o verticale).

## `src/templateLayout.ts`
- **`loadSlideLayouts()`**
  - Estrae dal template la disposizione degli elementi `image` e `text`
    per ogni slide, restituendo un array di oggetti posizionati.

## `src/concat.ts`
- **`concatAndFinalizeDemuxer(opts)`**
  - Unisce i segmenti generati e, se presente, mixa l'audio di sottofondo
    applicando un effetto di ducking.
  - Parametri principali:
    - `segments`: array di file video.
    - `bgAudioPath`: audio di background opzionale.
    - `outPath`: file MP4 finale.
    - `fps`: frame rate di output.
    - `bgVolume`: volume relativo del background.

## `src/renderers`
- **`renderTemplateSlide(elements, dur, out, opts)`**
  - Componi una slide leggendo gli elementi posizionati dal template JSON.
  - Supporta elementi `image` e `text` in ordine di sovrapposizione,
    usando il font indicato da ciascun elemento.

- **`renderFillerSegment(seg, outPath, opts)`**
  - Crea un segmento di colore pieno (con logo opzionale) per colmare i gap.
- **`renderOutroSegment(seg, outPath, opts)`**
  - Genera l'outro finale con testo centrale e logo.

## `src/share.ts`
- **`sendFinalVideo(filePath)`**
  - Invia il video finale via email utilizzando le credenziali SMTP
    definite nelle variabili d'ambiente; se assenti, registra un avviso.

## `src/validate.ts`
- **`ffprobeJson(file)`**
  - Restituisce le informazioni del file usando `ffprobe`.
- **`canOpenMp4(file)`**
  - Controlla se l'MP4 ha tracce video e audio valide.
- **`tryRepairSegment(path)`**
  - Tenta un remux o re-encode di un segmento corrotto.
- **`validateAndRepairSegments(inputs)`**
  - Filtra l'elenco dei segmenti tenendo solo quelli validi; prova a ripararli
    se necessario.

## `src/ffmpeg/run.ts`
- **`runFFmpeg(args, label?)`**
  - Esegue `ffmpeg` mostrando il comando e salvandolo in `comandi.txt`.
- **`runPipe(cmd, args, label)`**
  - Esegue un comando e cattura l'output.
- **`ok(res)`**
  - Ritorna `true` se il comando è terminato con exit code 0.

## `src/ffmpeg/filters.ts`
- **`shadeChain(...)`**
  - Crea la catena di filtri che produce l'ombra laterale.
- **`zoomExprFullClip(dur, fps)`**
  - Espressione di zoom per il filtro `zoompan`.
- **`buildFirstSlideTextChain(...)`**
  - Catena di filtri per la prima slide con doppio bordo e wipe. Se la
    transizione è `wiperight` usa `barColor` per disegnare la barretta laterale.
- **`buildRevealTextChain_XFADE(...)`**
  - Catena per le slide successive basata su `xfade`; gestisce `barColor` per
    la barretta verticale nelle transizioni `wiperight`.


## `src/utils`
- **`autosizeAndWrap(text, opts)`**
  - Calcola dimensione carattere e spezzatura testo in modo adattivo.
- **`wrapParagraph(text, width?)`**
  - Suddivide un paragrafo in righe bilanciate.
- **`normalizeQuotes(s)`**
  - Converte gli apici in caratteri compatibili con FFmpeg.
- **`escDrawText(s)`**
  - Escapa una stringa per il filtro `drawtext`.
- **`ffmpegSafePath(p)`**
  - Normalizza un percorso file sostituendo i caratteri problematici
    (backslash, due punti, parentesi quadre) con equivalenti compatibili con
    le catene `filter_complex` di FFmpeg.
- **`parseSec(v, def?)`**
  - Converte valori in secondi numerici.
- **`lineOffset(i, segDur, animDur)`**
  - Calcola lo sfasamento temporale per le animazioni di testo.
- **`ensureDir(dir)`**
  - Crea una cartella se non esiste.

