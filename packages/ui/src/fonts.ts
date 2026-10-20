import { Anek_Bangla, Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";

/*
 * The Kriraghor type family (packages/tokens): Anek Bangla for headings in both scripts (variable
 * weight and width, condensed for scoreboards), Geist for text, Noto Sans Bengali for Bangla text,
 * Geist Mono for codes and money columns. Each app puts `fontVariables` on <html>.
 */
const anek = Anek_Bangla({ subsets: ["latin", "bengali"], variable: "--font-anek", axes: ["wdth"], display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
const notoBn = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-noto-bn", display: "swap" });

export const fontVariables = [anek.variable, geist.variable, geistMono.variable, notoBn.variable].join(" ");
