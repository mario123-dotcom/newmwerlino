# Generatore video Merlino

Questa applicazione Node.js genera video combinando un **template JSON** con asset scaricati
(immagini, tracce vocali TTS, logo e musica di sottofondo). Il progetto è stato
scritto pensando a chi non ha esperienza con TypeScript o FFmpeg: tutte le
invocazioni al motore video vengono costruite automaticamente.

## Dipendenze
- Node.js ≥ 18
- FFmpeg installato nel sistema oppure indicato tramite variabile
  d'ambiente `FFMPEG_PATH`

Installa i pacchetti del progetto con:

```bash
npm install
```

## Utilizzo rapido
1. Copia il tuo template e la risposta JSON nella cartella `template/`.
2. Lancia `npm start` per scaricare gli asset, costruire le slide, renderizzare i
   segmenti e concatenarli in `src/output/final_output.mp4`.

Per una spiegazione dettagliata di ogni modulo e della pipeline completa, consulta
[docs/technical_documentation.md](docs/technical_documentation.md).
