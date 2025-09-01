export interface Modifications { [key: string]: string | number | boolean; }

export interface FullData {
  modifications: Modifications;
  width: number; height: number; frame_rate: number; duration: number;
  output_format?: string; fill_color?: string;
}

export type SegType = "image" | "filler" | "outro";

export interface Segment {
  kind: SegType;
  index?: number;
  start: number;
  duration: number;
  text?: string;
  tts?: string | null;
  img?: string | null;
}
