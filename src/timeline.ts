import { MIN_FILLER_SEC, HOLD_EXTRA_MS } from "./config";
import { normalizeQuotes } from "./utils/text";
import { parseSec } from "./utils/time";
import { GetLocalAsset } from "./assets";
import { Modifications, Segment } from "./types";

/**
 * Costruisce la sequenza temporale dei segmenti a partire dalle
 * "modifiche" presenti nel template JSON. Inserisce automaticamente
 * segmenti di riempimento per eventuali gap e aggiunge l'outro finale.
 *
 * @param mods Mappa chiave/valore proveniente dal template.
 * @param totalDuration Durata complessiva desiderata del video. Eventuali
 *        spazi vuoti finali verranno riempiti con un segmento filler.
 * @returns Lista ordinata di segmenti da renderizzare.
 */
export function buildTimeline(
  mods: Modifications,
  totalDuration?: number,
): Segment[] {
  const slidesRaw: Segment[] = [];
  for (let i = 0; ; i++) {
    const imgKey = `Immagine-${i}`;
    if (!(imgKey in mods)) break;

    const tStart =
      parseSec(mods[`Slide_${i}.time`]) || parseSec(mods[`TTS-${i}.time`]) || 0;
    const tDur =
      parseSec(mods[`Slide_${i}.duration`]) ||
      parseSec(mods[`TTS-${i}.duration`]) ||
      3;
    if (tDur <= 0) continue;

    const text = normalizeQuotes(String(mods[`Testo-${i}`] ?? ""));
    const ttsLocal = GetLocalAsset("tts", i);
    const imgLocal = GetLocalAsset("img", i);

    slidesRaw.push({
      kind: "image",
      index: i,
      start: tStart,
      duration: tDur,
      text,
      tts: ttsLocal,
      img: imgLocal,
    });
  }
  slidesRaw.sort((a, b) => a.start - b.start);

  const timeline: Segment[] = [];
  let cursorSched = 0;

  slidesRaw.forEach((s) => {
    const gap = s.start - cursorSched;
    if (gap > MIN_FILLER_SEC) {
      timeline.push({
        kind: "filler",
        start: cursorSched,
        duration: gap,
        text: "",
        tts: null,
        img: null,
      });
      cursorSched += gap;
    } else if (gap > 0) cursorSched += gap;

    const dur = s.duration + HOLD_EXTRA_MS / 1000;
    timeline.push({ ...s, duration: dur });
    cursorSched += dur;
  });

  const outroText = normalizeQuotes(
    String(mods["Testo-outro"] ?? "LEGGI L'ARTICOLO INTEGRALE SU")
  );
  const outroTimePlanned = parseSec(mods["Outro.time"], cursorSched);
  if (outroTimePlanned > cursorSched + MIN_FILLER_SEC) {
    const g = outroTimePlanned - cursorSched;
    timeline.push({
      kind: "filler",
      start: cursorSched,
      duration: g,
      text: "",
      tts: null,
      img: null,
    });
    cursorSched = outroTimePlanned;
  }
  const outroDur = parseSec(mods["Outro.duration"], 5);
  timeline.push({
    kind: "outro",
    start: cursorSched,
    duration: outroDur,
    text: outroText,
  });
  cursorSched += outroDur;

  if (totalDuration && totalDuration > cursorSched + MIN_FILLER_SEC) {
    const tail = totalDuration - cursorSched;
    timeline.push({
      kind: "filler",
      start: cursorSched,
      duration: tail,
      text: "",
      tts: null,
      img: null,
    });
    cursorSched += tail;
  }

  return timeline;
}
