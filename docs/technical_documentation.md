# Documentazione Tecnica del generatore Merlino

Questa documentazione descrive in dettaglio la struttura del progetto, i moduli TypeScript e le funzioni principali utilizzate per generare i video automatici. Ogni sezione è pensata per supportare un'analisi accademica del codice, con attenzione alle responsabilità, ai dati in ingresso e alle trasformazioni prodotte.

## 1. Struttura generale del repository
- **`src/`** – Contiene tutta la logica applicativa per scaricare gli asset, costruire la timeline e invocare FFmpeg.
- **`download/`** – Directory popolata a runtime con logo, immagini, clip TTS, musica e font scaricati.
- **`template/`** – Contiene il template Creatomate (`template_horizontal.json`) e il payload di modifiche (`risposta_horizontal.json`).
- **`scripts/`** – Utility ausiliarie (non modificate in questa revisione) per automazioni locali.
- **`docs/`** – Documentazione tecnica (questo file).
- **`src/tests/`** – Suite di test unitari per i moduli timeline e filtri FFmpeg.

## 2. Moduli principali in `src/`

### 2.1 `main.ts`
Punto di ingresso dell'applicazione. Le funzioni interne `ensureDir(dir)` e `clearDir(dir)` si occupano di creare o svuotare le cartelle di lavoro. L'IIFE finale orchestra l'intera pipeline:
1. Prepara cartelle temporanee e di output.
2. Invoca `fetchAssets()` per scaricare logo, immagini, audio e font.
3. Carica template e modifiche tramite `loadTemplate()` e `loadModifications()`.
4. Costruisce la timeline con `buildTimelineFromLayout()` ottenendo un array di `SlideSpec`.
5. Renderizza ogni slide con `renderSlideSegment()` e concatena i segmenti con `concatAndFinalizeDemuxer()`.

### 2.2 `config.ts`
Raccoglie costanti condivise (tipografia, animazioni, audio) e definisce `deriveOrientation(w, h)` che calcola l'orientamento video a partire dal rapporto d'aspetto o da un override esplicito.

### 2.3 `paths.ts`
Esporta l'oggetto `paths` con tutti i percorsi utilizzati dal progetto (download, output, template, binari FFmpeg). La funzione interna `resolveFFmpegBinary()` individua il comando FFmpeg consultando variabili d'ambiente (`FFMPEG_PATH`, `FFMPEG_BIN`, `FFMPEG`).

### 2.4 `fetchAssets.ts`
Modulo dedicato al download degli asset remoti.
- `ensureDir(dir)` e `clearDir(dir)` preparano e puliscono le cartelle.
- `decompressIfNeeded(buffer, headers)` gestisce manualmente risposte `gzip`, `deflate` o `br`.
- `httpGet(url, options)` effettua richieste HTTP/HTTPS seguendo redirect, impostando header "browser-like" e gestendo le risposte 304.
- `withCacheBuster(url)` aggiunge un query param per invalidare la cache.
- `downloadFile(url, outPath, options)` scarica un asset singolo, applica richieste condizionali (`If-Modified-Since`) e salva su disco.
- `fetchAssets()` legge le modifiche, ripulisce le cartelle di download e scarica logo, musica di background, clip TTS, immagini e font richiesti.

### 2.5 `concat.ts`
Definisce il tipo `ConcatArgs` e le funzioni per la fase finale di montaggio.
- `ffSafe(p)` normalizza i percorsi per il file `concat.txt`.
- `concatAndFinalizeDemuxer(args)` scrive `concat.txt`, concatena i segmenti con il demuxer di FFmpeg e mixa la musica di background con il parlato (amix) rispettando il volume relativo.

### 2.6 `fonts.ts`
Utility per la gestione dei font scaricati.
- `fontFamilyToFileBase(family)` normalizza i nomi font (rimozione di accenti e caratteri speciali).
- `fileNameMatchesFamily(fileName, family)` confronta un file scaricato con la famiglia richiesta.

### 2.7 `template.ts`
Wrapper attorno al template Creatomate.
- `loadTemplate()` legge e valida il JSON principale.
- `loadModifications()` recupera le modifiche da file dedicato o dal template stesso.
- `findComposition(tpl, name)` e `findChildByName(parent, name)` effettuano ricerche ricorsive.
- `pctToPx(val, base)` converte valori percentuali in pixel.
- `getDefaultFontPath()` individua un font di sistema disponibile.
Queste funzioni sono supportate dall'helper privato `findInElements(elements, predicate)`.

### 2.8 `renderers/composition.ts`
Contiene `renderSlideSegment(slide)` che costruisce gli argomenti FFmpeg per renderizzare una singola slide. Gestisce layer di background (inclusa animazione `zoompan`), ombre sintetiche, overlay di forme, logo e blocchi di testo (`drawtext`), oltre a preparare l'audio (TTS o silenzio) e produrre il segmento MP4.

### 2.9 `ffmpeg/run.ts`
- `runFFmpeg(args, label)` esegue il binario FFmpeg con log descrittivo e gestisce errori/exit code.
- `runPipe(cmd, args, label)` lancia comandi generici restituendo stdout/stderr buffered.
- `ok(res)` verifica il successo di un comando.

### 2.10 `ffmpeg/filters.ts`
Utility per la costruzione dei filtri FFmpeg.
- `toFFPath(p)` normalizza i percorsi (compatibilità Windows).
- `escTextForDrawText(s)` esegue l'escape del testo per `drawtext`.
- `buildDrawText(opts)` genera la stringa filtro completa, includendo box, colore, file esterni o testo inline.

## 3. Modulo Timeline (`src/timeline`)
Questo namespace converte template e modifiche in `SlideSpec` pronti per il renderer.

### 3.1 `index.ts`
Riesporta funzioni e tipi principali per semplificare gli import dal resto dell'applicazione.

### 3.2 `constants.ts`
Contiene costanti per le animazioni (`LINE_WIPE_DURATION`, `LINE_WIPE_OVERLAP`), il numero predefinito di caratteri per riga e altri parametri tipografici.

### 3.3 `types.ts`
Definisce i tipi TypeScript condivisi: `SlideSpec`, `TextBlockSpec`, `ShapeBlockSpec`, `AnimationSpec`, `ShadowInfo`, `FontSizingInfo`, `TextLayoutResult`, ecc. Questi tipi descrivono le informazioni utilizzate dal renderer e dai builder.

### 3.4 `utils.ts`
Raccolta di utility generiche:
- `parseSec(value, fallback)` interpreta stringhe temporali (`"1.2s"`, `"800ms"`).
- `lenToPx(value, width, height)` traduce lunghezze CSS-like in pixel.
- `clampRect(x, y, w, h, maxW, maxH)` limita rettangoli dentro il canvas.
- `parseAlpha`, `parseBooleanish`, `parsePercent`, `parseAngleDeg`, `normalizeAngle` normalizzano valori di opacità, boolean, percentuali e angoli.
- `parseRGBA`, `parseShadowColor`, `parseShadowLength`, `parseShapeColor` convertono stringhe colore in strutture tipizzate.
- `uniqueNames(names)` pulisce e deduplica liste di nomi per la ricerca di layer nel template.

### 3.5 `assets.ts`
Gestisce file temporanei e asset scaricati.
- `ensureTempDir()` crea la cartella `src/temp`.
- `writeTextFilesForSlide(index, lines)` salva le righe di testo su file per il filtro `drawtext`.
- `findImageForSlide(index)` e `findTTSForSlide(index)` individuano le risorse di una slide.
- `findFontPath(family)` trova il file TTF corrispondente alla famiglia richiesta.

### 3.6 `templateHelpers.ts`
Funzioni di supporto per interpretare il template.
- `defaultTextBlock(x, y)` fornisce un blocco testo neutro.
- `getTextBoxFromTemplate(tpl, slide, textName, opts)` restituisce il box testo in pixel gestendo anchor e limiti.
- `getLogoBoxFromTemplate(tpl, slide, logoName)` calcola la posizione del logo.
- `getFontFamilyFromTemplate(tpl, slide, textName)` individua la famiglia font di default.
- `buildCopyrightBlock(template, mods, compName, elementName, videoW, videoH)` costruisce il blocco copyright completo di font, allineamento e background.
- Funzioni interne come `isExplicitlyFalse` supportano la gestione dei flag di visibilità.

### 3.7 `text.ts`
Implementa l'intero motore tipografico.
- `wrapText`, `clampMaxChars`, `maxCharsForWidth` gestiscono il wrapping e i limiti di caratteri.
- `computeLineSpacingForBox` calcola l'interlinea ideale per un box.
- `deriveFontSizing` e `computeWidthScaleFromTemplate` determinano font iniziali e fattori di scala.
- `parseLineHeightFactor`, `parseLetterSpacing`, `parseAlignmentFactor` traducono i valori tipografici del template.
- `estimateLineWidth`, `estimateTextWidth`, `applyHorizontalAlignment` calcolano ingombri e posizionamenti.
- `resolveTextLayout` e `fitTextWithTargetFont` cercano il layout che rispetta box, interlinea e limiti di overflow.
- `applyExtraBackgroundPadding` espande il background per evitare tagli con font grandi.

### 3.8 `shapes.ts`
Estrae le forme vettoriali da renderizzare come overlay.
- `resolveShapeColor(element, mods, compName, globalIndex)` combina template e overrides per determinare colore/alpha.
- `extractShapeAnimations(element, rect)` converte animazioni Creatomate (fade, wipe) in strutture interne.
- `extractShapesFromComposition(comp, mods, width, height, startIndex)` visita la composition e restituisce i `ShapeBlockSpec` con posizione, dimensioni, colore e animazioni.

### 3.9 `shadows.ts`
Ricostruisce le impostazioni di ombra.
- Helper privati (`isShadowCandidate`, `hasShadowHintElement`, `isGradientShadowElement`, ecc.) individuano elementi rilevanti.
- `extractShadow(source, width, height)` combina gradienti e proprietà shadow_*.
- `extractShadowFromMods(mods, prefix, width, height)` interpreta le modifiche del backend.
- `findShadowSource(comp, candidates)` cerca l'elemento da cui ereditare l'ombra.
- `slideBackgroundNameCandidates(index)` e `outroBackgroundNameCandidates()` forniscono le liste di nomi per individuare background utili al calcolo dell'ombra.

### 3.10 `assets.ts`, `text.ts`, `shapes.ts`, `shadows.ts` (interazione)
Questi moduli cooperano per tradurre template e modifiche in blocchi testuali, forme e ombre coerenti, che saranno poi consumati dal renderer.

### 3.11 `builders/`
Sottodirectory con i costruttori di slide.
- **`timeline.ts`** – `buildTimelineFromLayout(modifications, template, opts)` è il cuore dell'orchestrazione: determina il numero di slide, inserisce eventuali gap con `createGapSlide`, costruisce ogni segmento standard e genera l'outro.
- **`standardSlide.ts`** – `buildStandardSlide(params)` aggrega testo, TTS, immagini, forme e ombre per una slide; include helper come `computeSlideDuration`, `collectShadowSources`, `enrichTextsWithCopyright`.
- **`gapSlide.ts`** – `createGapSlide(template, target, videoW, videoH, fps, durationSec)` produce slide filler con il solo logo.
- **`outroSlide.ts`** – `buildOutroSegment(params)` crea la slide finale con eventuale gap precedente, testo outro centrato e blocco copyright.
- **`textBlocks.ts`** – `buildTextBlocks(params)` trasforma il testo grezzo in blocchi `drawtext`, calcolando colori, background, animazioni (fade/wipe) e scrivendo i file temporanei. Include helper come `buildLineAnimations` e `applyTemplateBackground` per armonizzare layout e grafica.

## 4. Rendering finale
Il modulo `renderers/composition.ts` combina le informazioni provenienti dalla timeline con le utility FFmpeg (`ffmpeg/filters.ts`, `ffmpeg/run.ts`). Ogni `SlideSpec` produce un filtro complesso che sovrappone:
- Layer base nero.
- Background statico o animato con `zoompan`.
- Ombra sintetica calcolata dal modulo shadows.
- Forme vettoriali animate.
- Logo aziendale non deformato.
- Blocchi di testo generati dal motore tipografico, con eventuali wipe/animazioni.
- Traccia audio (TTS o silenzio) mantenendo sincronizzazione con la durata slide.

La fase conclusiva è gestita da `concat.ts`, che concatenando i segmenti con audio mixato produce `src/output/final_output.mp4` pronto per la distribuzione.

## 5. Flusso complessivo riassunto
1. **Preparazione** – `main.ts` pulisce le cartelle temporanee e di output.
2. **Download asset** – `fetchAssets.ts` scarica tutte le risorse necessarie.
3. **Caricamento template** – `template.ts` fornisce il documento Creatomate e il payload di modifiche.
4. **Costruzione timeline** – I moduli in `src/timeline/` trasformano template+mods in `SlideSpec` con testi, immagini, forme, ombre e audio.
5. **Rendering segmenti** – `renderers/composition.ts` invoca FFmpeg per ogni slide.
6. **Concatenazione** – `concat.ts` unisce i segmenti e mixa la musica di sottofondo.

Questa documentazione può essere utilizzata come base per un'analisi accademica, evidenziando le responsabilità di ciascun file e la cooperazione tra i moduli per ottenere il risultato finale.
