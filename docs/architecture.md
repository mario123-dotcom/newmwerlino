# Architettura del progetto

Questo documento descrive l'intero flusso di generazione video, evidenziando i
moduli TypeScript e le responsabilità di ciascuno. La pipeline parte dal
caricamento dei dati di template e delle modifiche richieste, costruisce una
sequenza strutturata di slide e termina producendo un piano eseguibile da un
motore esterno (ad esempio FFmpeg) per ottenere il video finale.

## Flusso generale
1. `src/main.ts` prepara le cartelle di lavoro e avvia l'orchestrazione.
2. `src/fetchAssets.ts` scarica logo, immagini, font, clip TTS e musica in base
   alle modifiche ricevute.
3. `src/template.ts` carica il template Creatomate e le relative modifiche.
4. Il pacchetto `src/timeline/` combina template e dati in una serie di
   `SlideSpec` descrivendo ogni segmento da renderizzare.
5. `src/renderers/composition.ts` sintetizza un piano di rendering dettagliato
   per ciascuna slide descrivendo canvas, asset e sovrapposizioni richieste.
6. `src/concat.ts` produce le istruzioni per l'unione cronologica dei segmenti e
   dell'eventuale musica di sottofondo, salvando un piano completo in
   `src/output/pipeline-plan.json`.

## Moduli di configurazione e percorsi
- **`src/config.ts`** raccoglie tutte le costanti condivise. Contiene le
  impostazioni per orientamento, tipografia (wrap, line-height, scaling),
  parametri di ombreggiatura, layout del logo e valori audio di default.
- **`src/paths.ts`** centralizza i percorsi assoluti di cartelle e file,
  compreso l'output JSON che rappresenta il piano di rendering completo.
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
    - `standardSlide.ts` compone la slide principale: stima la durata partendo
      dalle indicazioni del backend, individua testo, TTS, forme, ombre e
      immagini, genera i blocchi testuali e costruisce il `SlideSpec` finale.
  - `textBlocks.ts` trasforma il testo grezzo in blocchi renderizzabili,
    applicando wrapping, animazioni (fade/wipe), background e scrittura delle
    linee su file.
  - `gapSlide.ts` crea slide riempitive con il solo logo centrato.
  - `outroSlide.ts` gestisce la slide di chiusura, compresi eventuali gap
    precedenti e blocchi copyright dedicati.

## Rendering e piano multimediale
- **`src/renderers/composition.ts`** genera per ogni slide un oggetto
  `SlideRenderPlan` che riepiloga dimensioni del canvas, background da impiegare
  (specificando se richiede animazioni di zoom), posizione e dimensioni del
  logo, blocchi di testo da disegnare (inclusi i filtri `drawtext` calcolati e
  le eventuali animazioni), forme vettoriali da stratificare e preferenze per la
  generazione dell'ombra sintetica.
- **`src/ffmpeg/filters.ts`** fornisce utility per convertire percorsi ed
  eseguire escape dei testi producendo le stringhe `drawtext` che vengono
  memorizzate nel piano di rendering.
- **`src/concat.ts`** costruisce un `ConcatPlan` con l'elenco ordinato dei
  segmenti, le direttive del demuxer da applicare e i parametri del mix con la
  musica di sottofondo; nessun processo viene invocato direttamente, il piano
  funge da contratto per l'esecuzione esterna.

## Punto di ingresso
`src/main.ts` coordina le operazioni: prepara le cartelle temporanee, invoca il
fetch degli asset, carica template e modifiche, costruisce la timeline,
richiede la generazione dei `SlideRenderPlan`, prepara il `ConcatPlan` finale e
salva tutto nel file `pipeline-plan.json`.

## Test automatizzati
La suite dei test automatici è suddivisa per area funzionale:
- `src/tests/ffmpeg/filters.test.ts` assicura la corretta generazione delle
  stringhe `drawtext` e la normalizzazione dei percorsi FFmpeg.
- `src/tests/timeline/*.test.ts` contiene casi specifici per tipologie di
  funzionalità della timeline (estrazione dei box testuali e del logo, layout
  del testo, assegnazione dei font scaricati, gestione delle ombre, forme e
  animazioni, flusso delle slide e wrapping). Ogni file isola un aspetto per
  facilitare la diagnosi dei regressi.
