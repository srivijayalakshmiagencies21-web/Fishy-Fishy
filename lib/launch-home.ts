/** Remembered landing page so the static launch screen at `/` can skip the server redirect hop. */
export const LAUNCH_HOME_KEY = "fishy-fishy:home";

export function rememberLaunchHome(path: string) {
  try {
    localStorage.setItem(LAUNCH_HOME_KEY, path);
  } catch {}
}

export function forgetLaunchHome() {
  try {
    localStorage.removeItem(LAUNCH_HOME_KEY);
  } catch {}
}

/** Runs inline before hydration; falls back to `/enter`, which resolves the role server-side. */
export const launchRedirectScript = `(function(){var h;try{h=localStorage.getItem(${JSON.stringify(
  LAUNCH_HOME_KEY,
)})}catch(e){}if(!h||h.charAt(0)!=="/"||h.charAt(1)==="/")h="/enter";location.replace(h)})();`;
