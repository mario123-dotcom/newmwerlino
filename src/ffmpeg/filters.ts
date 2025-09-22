// Utility dedicate alla costruzione di filtri FFmpeg per i testi.

// Converte un percorso di filesystem nel formato accettato da FFmpeg su ogni piattaforma.
// Example: `C:\foo\bar` -> `C\:/foo/bar`
export function toFFPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
}

// Effettua l'escape dei caratteri che interromperebbero il filtro drawtext.
export function escTextForDrawText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");
}

export type DrawTextOpts = {
  label: string;        // Nome del buffer intermedio generato dal filtro (es. "tx_0").
  textFile?: string;    // Percorso di un file con il testo da visualizzare.
  text?: string;        // Testo inline alternativo se non si usa un file.
  fontFile: string;
  fontSize: number;
  fontColor: string;    // Colore del testo (es. "white").
  xExpr: string;        // Espressione che determina la coordinata X.
  yExpr: string;        // Espressione che determina la coordinata Y.
  lineSpacing?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;    // Trasparenza della box, normalizzata 0..1.
  boxBorderW?: number;  // Spessore del bordo in pixel.
  enableExpr?: string;  // Espressione che abilita/disabilita il disegno nel tempo.
};

// Costruisce la stringa del filtro drawtext in base alle opzioni ricevute.
export function buildDrawText(opts: DrawTextOpts): string {
  const {
    label,
    textFile,
    text,
    fontFile,
    fontSize,
    fontColor,
    xExpr,
    yExpr,
    lineSpacing = 0,
    box = false,
    boxColor = "black",
    boxAlpha = 0.0,
    boxBorderW = 0,
    enableExpr,
  } = opts;

  const ffFont = toFFPath(fontFile);
  const parts = [
    `fontfile='${ffFont}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `x=${xExpr}`,
    `y=${yExpr}`,
    `line_spacing=${lineSpacing}`,
    `box=${box ? 1 : 0}`,
    `boxcolor=${boxColor}@${boxAlpha}`,
    `boxborderw=${boxBorderW}`,
  ];
  const common = parts.join(":");

  if (textFile) {
    const ffTxt = toFFPath(textFile);
    return (
      `[${label}_in]drawtext=textfile='${ffTxt}':${common}` +
      (enableExpr ? `:enable='${enableExpr}'` : "") +
      `[${label}]`
    );
  }

  const inline = escTextForDrawText(text ?? "");
  return (
    `[${label}_in]drawtext=text='${inline}':${common}` +
    (enableExpr ? `:enable='${enableExpr}'` : "") +
    `[${label}]`
  );
}

