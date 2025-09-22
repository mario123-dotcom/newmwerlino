# Architettura del progetto

Questo documento descrive l'intero flusso di generazione video, evidenziando i
moduli TypeScript e le responsabilità di ciascuno. La pipeline parte dal
caricamento dei dati di template e delle modifiche richieste, costruisce una
sequenza strutturata di slide e conclude con la renderizzazione e il mixaggio
in FFmpeg.

## Flusso generale
1. `src/main.ts` prepara le cartelle di lavoro e avvia l'orchestrazione.
2. `src/fetchAssets.ts` scarica logo, immagini, font, clip TTS e musica in base
   alle modifiche ricevute.
3. `src/template.ts` carica il template Creatomate e le relative modifiche.
4. Il pacchetto `src/timeline/` combina template e dati in una serie di
   `SlideSpec` descrivendo ogni segmento da renderizzare.
5. `src/renderers/composition.ts` crea un MP4 temporaneo per ogni slide usando
   FFmpeg.
6. `src/concat.ts` concatena i segmenti e applica l'audio di sottofondo,
   producendo il video finale in `src/output/`.

## Moduli di configurazione e percorsi
- **`src/config.ts`** raccoglie tutte le costanti condivise. Contiene le
  impostazioni per orientamento, tipografia (wrap, line-height, scaling),
  parametri di ombreggiatura, layout del logo e valori audio di default.
- **`src/paths.ts`** centralizza i percorsi assoluti di cartelle e file.
  Determina dinamicamente l'eseguibile FFmpeg rispettando eventuali override
  tramite variabili d'ambiente o il pacchetto `ffmpeg-static`.
- **`src/fonts.ts`** normalizza i nomi dei font per individuare i file scaricati
  e verificare se un asset locale corrisponde alla famiglia richiesta.

## Gestione template e assets
- **`src/template.ts`** offre funzioni per leggere il template JSON, caricare le
  modifiche (`loadTemplate`, `loadModifications`), trovare composizioni o
  elementi specifici (`findComposition`, `findChildByName`) e convertire valori
  percentuali in pixel (`pctToPx`). Include inoltre utility per dedurre il box
  testo, il box logo e un font di fallback disponibile sul sistema.
- **`src/fetchAssets.ts`** ripulisce le cartelle di download, esegue richieste
  HTTP con gestione di redirect e caching condizionale, decomprime eventuali
  risposte compresse e salva logo, immagini, clip TTS, font Google e audio di
  background secondo le chiavi presenti nelle modifiche.

## Costruzione della timeline (`src/timeline/`)
Il namespace `timeline` esporta funzioni e tipi utilizzati dal resto
dell'applicazione (`src/timeline/index.ts`). I file principali sono:

- **`constants.ts`** definisce valori base per wrapping, durata delle wipe e
  dimensione minima dei font.
- **`types.ts`** espone i tipi strutturali (`SlideSpec`, `TextBlockSpec`,
  `ShapeBlockSpec`, `AnimationSpec`, ecc.) condivisi fra builder e renderer.
- **`utils.ts`** offre conversioni generiche: parsing di durate (`parseSec`),
  normalizzazione di lunghezze (`lenToPx`), percentuali, colori RGBA e valori
  utilizzati nelle ombre.
- **`templateHelpers.ts`** incapsula la logica di lettura dal template: calcolo
  dei box testo/logo, ricostruzione dei font, generazione di blocchi copyright
  e default text block. Applica le preferenze di allineamento, padding, wrapping
  e scrittura dei testi su file temporanei.
- **`text.ts`** contiene l'algoritmo di impaginazione del testo: wrapping,
  stima dell'ampiezza, calcolo dello spacing verticale, ricampionamento del
  font per rispettare il box disponibile e applicazione degli allineamenti.
- **`assets.ts`** gestisce path verso immagini, TTS e font scaricati, oltre a
  creare i file temporanei con le singole righe di testo (`writeTextFilesForSlide`).
- **`shapes.ts`** individua le forme vettoriali nel template, calcola colori e
  animazioni associate per sovrapporle come layer aggiuntivi.
- **`shadows.ts`** estrae parametri d'ombra dalle composizioni (gradienti,
  proprietà shadow_*, overrides nelle modifiche) e fornisce heuristics per
  determinare se abilitare l'ombreggiatura nel renderer.
- **`builders/`** ospita i costruttori di slide:
  - `timeline.ts` orchestra la costruzione sequenziale delle slide,
    identificando eventuali gap temporali e aggiungendo filler con solo il logo.
  - `standardSlide.ts` compone la slide principale: calcola durata reale usando
    `probeDurationSec`, individua testo, TTS, forme, ombre e immagini, genera i
    blocchi testuali e costruisce il `SlideSpec` finale.
  - `textBlocks.ts` trasforma il testo grezzo in blocchi renderizzabili,
    applicando wrapping, animazioni (fade/wipe), background e scrittura delle
    linee su file.
  - `gapSlide.ts` crea slide riempitive con il solo logo centrato.
  - `outroSlide.ts` gestisce la slide di chiusura, compresi eventuali gap
    precedenti e blocchi copyright dedicati.

## Rendering e strumenti FFmpeg
- **`src/renderers/composition.ts`** genera il comando FFmpeg per ogni slide:
  esegue crop/zoom delle immagini di background, applica ombre sintetiche,
  sovrappone forme, logo e testi (con animazioni), sincronizza l'audio TTS o
  crea una traccia silenziosa e produce un MP4 intermedio.
- **`src/ffmpeg/run.ts`** incapsula l'esecuzione sincrona di FFmpeg, loggando i
  comandi e propagando gli errori; include helper per eseguire comandi con
  output catturato e verificare l'esito.
- **`src/ffmpeg/filters.ts`** fornisce utility per convertire percorsi,
  eseguire escape dei testi e costruire stringhe `drawtext` complesse.
- **`src/ffmpeg/probe.ts`** utilizza `ffprobe` per leggere la durata delle clip,
  garantendo che la slide si estenda fino al termine del parlato.
- **`src/concat.ts`** scrive il file `concat.txt` e avvia il demuxer concat di
  FFmpeg, miscelando facoltativamente la musica di background con il parlato e
  producendo il file finale con codec e metadata corretti.

## Punto di ingresso
`src/main.ts` coordina le operazioni: prepara le cartelle temporanee, invoca il
fetch degli asset, carica template e modifiche, costruisce la timeline,
renderizza ogni segmento e infine concatena gli MP4 generati.

## Test automatizzati
`src/tests/timeline.test.ts` copre le utility della timeline verificando che i
box testo/loghi vengano estratti correttamente, che l'impaginazione del testo
rispetti gli allineamenti previsti e che la costruzione delle slide gestisca le
varie condizioni (durate, wrapping, visibilità, ecc.).
