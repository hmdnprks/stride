// The Stride mark: a running track in white on track blue, its outer lane
// drawn like a lap in progress. Generated icons use this; app/icon.svg and
// public/offline.html carry copies of the same SVG (static files can't
// import it). Drawn on a 512 grid so it holds up at 32px.
//
// The track stays inside the central 80% circle, the safe zone a maskable
// icon keeps when Android crops it to a circle or squircle.

export const TRACK_BLUE = "#1F47F5";

/**
 * Inner lane faint, outer lane drawn like a watch's progress ring: it starts
 * at the bottom-left of the home straight and stops short of closing.
 */
const MARK_LANES =
  '<rect x="170" y="226" width="172" height="60" rx="30" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="22"/>' +
  '<path d="M198 348A92 92 0 0 1 198 164H314A92 92 0 0 1 314 348H198" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round" stroke-dasharray="620 400"/>';

export function markSvg({ corner = 112 }: { corner?: number } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${corner}" fill="${TRACK_BLUE}"/>${MARK_LANES}</svg>`;
}

export const markDataUri = (corner?: number) => `data:image/svg+xml;base64,${Buffer.from(markSvg({ corner })).toString("base64")}`;
