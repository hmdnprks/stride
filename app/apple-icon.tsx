import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

// iOS rounds home-screen icons itself, so this one is full-bleed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<img src={markDataUri(0)} width={180} height={180} alt="" />, size);
}
