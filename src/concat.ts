export type ConcatPlan = {
  kind: "concat";
  outputPath: string;
  fps: number;
  segments: { path: string; demuxerEntry: string }[];
  backgroundAudio?: {
    path: string;
    available: boolean;
    volume: number;
  };
  concatInstructions: {
    format: "demuxer";
    requiresGenPts: boolean;
    safeMode: boolean;
  };
};

type ConcatArgs = {
  segments: string[];
  bgAudioPath?: string | null;
  outPath: string;
  fps: number;
  bgVolume?: number;
};

function ffSafe(p: string): string {
  return p.replace(/\\/g, "/");
}

export async function concatAndFinalizeDemuxer(args: ConcatArgs): Promise<ConcatPlan> {
  const { segments, bgAudioPath, outPath, fps, bgVolume = 0.15 } = args;

  const segmentEntries = segments.map((s) => ({ path: s, demuxerEntry: `file '${ffSafe(s)}'` }));
  const hasBgAudio = typeof bgAudioPath === "string" && bgAudioPath.length > 0;

  return {
    kind: "concat",
    outputPath: outPath,
    fps,
    segments: segmentEntries,
    backgroundAudio: hasBgAudio
      ? {
          path: bgAudioPath!,
          available: hasBgAudio,
          volume: bgVolume,
        }
      : undefined,
    concatInstructions: {
      format: "demuxer",
      requiresGenPts: true,
      safeMode: false,
    },
  };
}
