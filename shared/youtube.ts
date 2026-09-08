/** Parse the host before using a regex so lookalike domains cannot pass validation. */
export function extractYouTubeId(input: string): string | null {
  if (
    typeof input !== "string" ||
    input.length > 2048 ||
    /[\u0000-\u001f\u007f\\]/.test(input)
  )
    return null;
  try {
    const url = new URL(input.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be")
      id = url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1] ?? null;
    else if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
    ) {
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : (url.pathname.match(
              /^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/,
            )?.[1] ?? null);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export const categories = [
  "Comercial",
  "Lifestyle",
  "Music video",
  "Documentário",
  "Social media",
] as const;
