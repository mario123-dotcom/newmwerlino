import { existsSync, writeFileSync } from "fs";
import { runFFmpeg } from "./ffmpeg/run";

type ConcatArgs = {
  /** Percorsi dei segmenti MP4 da concatenare nell'ordine di riproduzione. */
  segments: string[];
  /** Percorso facoltativo di una traccia musicale da mixare in loop. */
  bgAudioPath?: string | null;
  /** Destinazione del file MP4 finale prodotto da FFmpeg. */
  outPath: string;
  /** Percorso del file concat.txt generato per il demuxer concat. */
  concatTxtPath: string;
  /** Frequenza dei fotogrammi da forzare sull'output finale. */
  fps: number;
  /** Volume relativo (0..1) della musica di sottofondo rispetto al parlato. */
  bgVolume?: number; // 0..1
};

/**
 * Converte un percorso di filesystem in una forma compatibile con il file
 * `concat.txt`, sostituendo i backslash con slash forward per evitare errori
 * di parsing su Windows.
 *
 * @param p Percorso assoluto o relativo di un file video.
 * @returns Il percorso normalizzato compatibile con il file concat.txt.
 */
function ffSafe(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Genera il file `concat.txt`, concatena i segmenti video tramite demuxer
 * `concat` e, se presente, mixa una traccia musicale di sottofondo.
 *
 * @param args Oggetto con segmenti da concatenare, audio opzionale e
 *             parametri di output (percorso finale, FPS e volume BG).
 * @returns Una Promise risolta quando FFmpeg termina con successo.
 */
export async function concatAndFinalizeDemuxer(args: ConcatArgs) {
  const { segments, bgAudioPath, outPath, concatTxtPath, fps, bgVolume = 0.15 } = args;

  const hasBgAudio = !!(bgAudioPath && existsSync(bgAudioPath));

  // Scrivi concat.txt (una riga per file)
  const lines = segments.map((s) => `file '${ffSafe(s)}'`);
  writeFileSync(concatTxtPath, lines.join("\n"), "utf8");

  const ffargs: string[] = [
    "-y",
    "-fflags", "+genpts",
    "-f", "concat",
    "-safe", "0",
    "-i", concatTxtPath,
  ];

  if (hasBgAudio) {
    ffargs.push("-stream_loop", "-1", "-i", bgAudioPath!);
    ffargs.push(
      "-filter_complex",
      [
        "[0:a:0]aformat=channel_layouts=stereo:sample_rates=44100[tts]",
        `[1:a:0]aformat=channel_layouts=stereo:sample_rates=44100,volume=${bgVolume}[bg]`,
        "[tts][bg]amix=inputs=2:normalize=0:duration=longest:dropout_transition=0[mix]",
      ].join(";"),
      "-map", "0:v:0",
      "-map", "[mix]"
    );
  } else {
    ffargs.push("-map", "0:v:0", "-map", "0:a:0");
  }

  ffargs.push(
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "18",
    "-r", String(fps),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-ac", "2",
    "-movflags", "+faststart",
    "-shortest",
    outPath
  );

  await runFFmpeg(ffargs, "FFmpeg FINAL (demuxer concat)");
}
