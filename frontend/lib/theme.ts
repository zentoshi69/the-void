export const DARK = {
  bg:         "#07070A",
  bgPanel:    "#08080C",
  bgInput:    "#0E0E14",
  bgAccent:   "#161620",
  bgRow:      "#0C0C12",
  border:     "#161620",
  borderMid:  "#1E1E28",
  text:       "#D8D8D0",
  textMid:    "#4A4A5A",
  textDim:    "#2E2E3A",
  textGhost:  "#1E1E28",
  textDeep:   "#161620",
  accent:     "#00E676",
  accentDim:  "rgba(0,230,118,0.025)",
  accentText: "#07070A",
  orange:     "#FF9100",
  blue:       "#40C4FF",
  red:        "#FF4444",
  yellow:     "#FFD740",
  statVal:    "#00E676",
} as const;

export const LIGHT = {
  bg:         "#F3F4F7",
  bgPanel:    "#ECEEF2",
  bgInput:    "#E4E6EB",
  bgAccent:   "#D8DBE2",
  bgRow:      "#E8EAF0",
  border:     "#CDD0D8",
  borderMid:  "#BCC0CA",
  text:       "#141520",
  textMid:    "#4A4D5C",
  textDim:    "#808494",
  textGhost:  "#AAADB8",
  textDeep:   "#C4C7D0",
  accent:     "#F06000",
  accentDim:  "rgba(240,96,0,0.07)",
  accentText: "#FFFFFF",
  orange:     "#C04800",
  blue:       "#005E8A",
  red:        "#BB2020",
  yellow:     "#886600",
  statVal:    "#F06000",
} as const;

export type Theme = {
  [K in keyof typeof DARK]: string;
};
