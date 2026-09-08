/** Configuration is public, but only navigation-safe schemes should reach href. */
export function safeContactLink(value: string, allowEmail = false): string {
  if (
    value.length > 2048 ||
    /[\u0000-\u0020\u007f]/.test(value) ||
    /%0[ad]/i.test(value)
  )
    return "";
  try {
    const url = new URL(value);
    if (url.username || url.password) return "";
    if (url.protocol === "https:") return url.href;
    if (
      allowEmail &&
      url.protocol === "mailto:" &&
      /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(url.pathname)
    )
      return url.href;
  } catch {
    /* Invalid or relative URLs are not configured links. */
  }
  return "";
}
