export const LAUNCH_HOME_COOKIE = "ff-home";

/** Only same-site absolute paths; anything else falls back to `/enter`, which resolves the role server-side. */
export function safeLaunchHome(value: string | undefined) {
  if (!value || value.charAt(0) !== "/" || value.charAt(1) === "/" || value.charAt(1) === "\\") {
    return "/enter";
  }
  return value;
}

export function rememberLaunchHome(path: string) {
  document.cookie = `${LAUNCH_HOME_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function forgetLaunchHome() {
  document.cookie = `${LAUNCH_HOME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
