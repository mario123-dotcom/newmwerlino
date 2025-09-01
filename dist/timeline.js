"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTimeline = buildTimeline;
const config_1 = require("./config");
const text_1 = require("./utils/text");
const time_1 = require("./utils/time");
const assets_1 = require("./assets");
function buildTimeline(mods) {
    const slidesRaw = [];
    for (let i = 0;; i++) {
        const imgKey = `Immagine-${i}`;
        if (!(imgKey in mods))
            break;
        const tStart = (0, time_1.parseSec)(mods[`Slide_${i}.time`]) || (0, time_1.parseSec)(mods[`TTS-${i}.time`]) || 0;
        const tDur = (0, time_1.parseSec)(mods[`Slide_${i}.duration`]) ||
            (0, time_1.parseSec)(mods[`TTS-${i}.duration`]) ||
            3;
        if (tDur <= 0)
            continue;
        const text = (0, text_1.normalizeQuotes)(String(mods[`Testo-${i}`] ?? ""));
        const ttsLocal = (0, assets_1.GetLocalAsset)("tts", i);
        const imgLocal = (0, assets_1.GetLocalAsset)("img", i);
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
    const timeline = [];
    let cursorSched = 0;
    slidesRaw.forEach((s) => {
        const gap = s.start - cursorSched;
        if (gap > config_1.MIN_FILLER_SEC) {
            timeline.push({
                kind: "filler",
                start: cursorSched,
                duration: gap,
                text: "",
                tts: null,
                img: null,
            });
            cursorSched += gap;
        }
        else if (gap > 0)
            cursorSched += gap;
        const dur = s.duration + config_1.HOLD_EXTRA_MS / 1000;
        timeline.push({ ...s, duration: dur });
        cursorSched += dur;
    });
    const outroText = (0, text_1.normalizeQuotes)(String(mods["Testo-outro"] ?? "LEGGI L'ARTICOLO INTEGRALE SU"));
    const outroTimePlanned = (0, time_1.parseSec)(mods["Outro.time"], cursorSched);
    if (outroTimePlanned > cursorSched + config_1.MIN_FILLER_SEC) {
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
    timeline.push({
        kind: "outro",
        start: cursorSched,
        duration: (0, time_1.parseSec)(mods["Outro.duration"], 5),
        text: outroText,
    });
    return timeline;
}
