import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { paths } from "./paths";

export function GetLocalAsset(
  type: "img" | "tts" | "audio" | "logo",
  idx?: number
): string | null {
  try {
    if (type === "img") {
      const cands = [".jpg", ".jpeg", ".png", ".webp"].map((e) =>
        join(paths.images, `img${idx}${e}`)
      );
      const found = cands.find((f) => existsSync(f));
      if (found) return found;
    }
    if (type === "tts") {
      const f1 = join(paths.tts, `tts${idx}.mp3`);
      const f2 = join(paths.tts, `tts-${idx}.mp3`);
      if (existsSync(f1)) return f1;
      if (existsSync(f2)) return f2;
      const all = readdirSync(paths.tts).filter((n) => n.endsWith(".mp3"));
      const byIdx = all.find((n) => n.endsWith(`-${idx}.mp3`));
      if (byIdx) return join(paths.tts, byIdx);
    }
    if (type === "audio") {
      const f = join(paths.audio, "bg.mp3");
      return existsSync(f) ? f : null;
    }
    if (type === "logo") {
      const f = join(paths.images, "logo.png");
      return existsSync(f) ? f : null;
    }
  } catch {}
  return null;
}
