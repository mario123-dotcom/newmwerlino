# Riepilogo problemi risolti su `main`

## Copertura incompleta della timeline
- **Descrizione:** la sequenza di slide terminava prima del termine effettivo dei contenuti, non inseriva gap tra slide distanziate e ignorava le slide rese invisibili via modifiche.
- **Soluzione:** la costruzione della timeline ora rileva l'ultima slide realmente popolata, calcola le durate dagli hint TTS, inserisce filler quando esistono buchi e scarta gli elementi marcati come nascosti; i test automatici coprono i casi di filler, gap, durate forzate e visibilità.【F:src/timeline/builders/timeline.ts†L10-L118】【F:src/tests/timeline/slidesFlow.test.ts†L4-L135】

## Outro fuori sincrono e disallineato
- **Descrizione:** l'outro appariva in ritardo o senza recuperare il gap finale e il box di testo non risultava allineato al logo.
- **Soluzione:** la generazione dell'outro calcola eventuali gap prima della chiusura, centra il box testo rispetto al logo, rispetta durata e visibilità richieste e incorpora eventuali copy e ombre derivate dal template.【F:src/timeline/builders/outroSlide.ts†L115-L189】

## Box di testo non aderenti al template
- **Descrizione:** i box venivano posizionati con offset errati, ignoravano larghezze minime e potevano uscire dall'area video.
- **Soluzione:** l'estrazione del box dal template normalizza ancore e percentuali, applica una larghezza minima relativa al canvas e clamp-a la posizione all'interno dell'inquadratura prima di usarla nelle slide.【F:src/timeline/templateHelpers.ts†L34-L139】

## Tipografia e wrapping incoerenti
- **Descrizione:** il testo superava i limiti impostati dal template, perdeva l'interlinea corretta e non rispettava gli allineamenti.
- **Soluzione:** i builder del testo calcolano lo scaling dalla larghezza del template, ricomputano font e interlinea, gestiscono manualmente il wrapping e applicano padding, allineamenti e letter spacing derivati dalle impostazioni del template.【F:src/timeline/builders/standardSlide.ts†L112-L168】【F:src/timeline/builders/textBlocks.ts†L58-L289】

## Copyright e testo accessorio mancanti
- **Descrizione:** gli elementi di copyright definiti nel template non venivano renderizzati, lasciando immagini prive di attribuzione.
- **Soluzione:** i builder arricchiscono automaticamente le slide e l'outro con blocchi copyright estratti dal template o dalle modifiche, applicando dimensioni e sfondi coerenti.【F:src/timeline/templateHelpers.ts†L209-L382】【F:src/timeline/builders/standardSlide.ts†L77-L95】

## Slide filler con logo fuori centro
- **Descrizione:** le slide senza testo o TTS mostravano il logo fuori centro e con dimensioni incoerenti.
- **Soluzione:** durante la costruzione della slide i filler vengono riconosciuti e il logo è centrato e scalato con sfondo statico per evitare animazioni spurie.【F:src/timeline/builders/standardSlide.ts†L171-L182】

## Ombre di fondo non rispettate
- **Descrizione:** gli shader di sfondo configurati nei template e nelle modifiche venivano ignorati, generando video privi del gradiente atteso.
- **Soluzione:** il codice estrae hint da elementi e modifiche per dedurre colore, opacità e dimensioni delle ombre e abilita l'overlay dedicato nel renderer video.【F:src/timeline/shadows.ts†L14-L226】【F:src/renderers/composition.ts†L112-L169】

## Animazioni di forme e testi ignorate
- **Descrizione:** forme vettoriali e testi con animazioni wipe/fade definite dal template risultavano statici in output.
- **Soluzione:** le forme vengono estratte con colori e animazioni temporizzate, mentre il renderer applica i relativi filtri FFmpeg; allo stesso modo, i blocchi di testo generano file per linea e associano animazioni trasformate in transizioni video.【F:src/timeline/shapes.ts†L12-L223】【F:src/renderers/composition.ts†L172-L326】【F:src/timeline/builders/textBlocks.ts†L103-L286】

## Gestione asset incompleta
- **Descrizione:** il progetto non puliva le cartelle di lavoro tra esecuzioni né scaricava sistematicamente logo, immagini, TTS e musica.
- **Soluzione:** la routine di fetch ripulisce le directory temporanee, gestisce caching HTTP, scarica logo, audio, TTS e immagini slide con estensioni sicure e segnala eventuali anomalie di content-type.【F:src/fetchAssets.ts†L9-L214】

## Output finale senza mix audio affidabile
- **Descrizione:** la concatenazione dei segmenti non applicava correttamente l'audio di background e non imponeva parametri coerenti di encoding.
- **Soluzione:** la fase finale crea un file di lista sicuro, mixa la traccia TTS con l'audio opzionale tramite `amix` e produce il master con preset video/audio consistenti.【F:src/concat.ts†L13-L66】

## Invocazione FFmpeg fragile
- **Descrizione:** l'esecuzione di FFmpeg non controllava l'exit code e non permetteva di sostituire il binario.
- **Soluzione:** l'helper `runFFmpeg` stampa il comando, gestisce errori/exit code e usa un path risolvibile tramite variabili d'ambiente dedicate.【F:src/ffmpeg/run.ts†L4-L39】【F:src/paths.ts†L6-L40】

## Test end-to-end mancanti
- **Descrizione:** le regressioni sulla timeline passavano inosservate per l'assenza di test automatizzati e script di esecuzione.
- **Soluzione:** il progetto espone uno script `npm test` che compila TypeScript ed esegue la suite Node Test, coprendo costruzione timeline, wrap del testo, ombre e filtri FFmpeg.【F:package.json†L6-L12】【F:src/tests/timeline/slidesFlow.test.ts†L8-L135】
