export namespace Template {
  export type ColorStop = { offset: string; color: string };
  export type AnimBase = { time: number; duration: number; easing?: string };
  export type Animation =
    | ({ type: "fade" } & AnimBase)
    | ({
        type: "wipe";
        x_anchor?: string;
        y_anchor?: string;
        start_angle?: string;
        end_angle?: string;
      } & AnimBase)
    | ({
        type: "pan";
        start_x?: string;
        start_y?: string;
        end_x?: string;
        end_y?: string;
        start_scale?: string;
        end_scale?: string;
        scope?: "element" | "composition";
      } & AnimBase)
    | ({
        type: "text-reveal";
        axis?: "x" | "y";
        split?: "line" | "word" | "char";
        x_anchor?: string;
        y_anchor?: string;
      } & AnimBase);

  export type Base = {
    id: string;
    name?: string;
    type: string;
    track?: number;
    time?: number;
    duration?: number | null;
    x?: string | number;
    y?: string | number;
    width?: string | number;
    height?: string | number;
    x_anchor?: string | number;
    y_anchor?: string | number;
    opacity?: string | number;
    loop?: boolean;
    dynamic?: boolean;
    animations?: Animation[];
    fill_color?: string | ColorStop[];
    fill_mode?: "linear" | "radial";
    fill_x1?: string | number;
    fill_y1?: string | number;
    shadow_color?: string;
    shadow_blur?: string | number;
    shadow_x?: string | number;
    shadow_y?: string | number;
  };

  export type Text = Base & {
    type: "text";
    text?: string; // default; sovrascrivibile da risposta.modifications[<name>]
    font_family?: string;
    font_weight?: string | number;
    line_height?: string | number;
    font_size_minimum?: string | number;
    font_size_maximum?: string | number;
    background_color?: string;
    x_alignment?: string;
    y_alignment?: string;
  };

  export type Image = Base & {
    type: "image";
    source: string;
    fit?: "contain" | "cover" | "fill";
  };
  export type Video = Base & { type: "video"; source: string };
  export type Audio = Base & {
    type: "audio";
    source: string;
    volume?: string;
    audio_fade_in?: number;
    audio_fade_out?: number;
  };
  export type Shape = Base & { type: "shape" };
  export type Element = Text | Image | Video | Audio | Shape;
  export type Composition = Base & {
    type: "composition";
    name?: string;
    elements: Element[];
    fill_color?: string;
  };
  export type Root = {
    output_format?: string;
    width: number;
    height: number;
    duration: number;
    fill_color?: string;
    elements: (Composition | Audio)[];
  };
}
