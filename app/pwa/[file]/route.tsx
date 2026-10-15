import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

// Home-screen icons listed in app/manifest.ts. "any" icons keep the rounded
// corners; the maskable one is full-bleed for Android to crop.
const ICONS: Record<string, { size: number; corner: number }> = {
  "icon-192.png": { size: 192, corner: 112 },
  "icon-512.png": { size: 512, corner: 112 },
  "maskable-512.png": { size: 512, corner: 0 },
};

export async function GET(_: Request, { params }: RouteContext<"/pwa/[file]">) {
  const icon = ICONS[(await params).file];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={markDataUri(icon.corner)} width={icon.size} height={icon.size} alt="" />,
    { width: icon.size, height: icon.size },
  );
}
