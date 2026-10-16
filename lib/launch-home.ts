/** Read by the static `/` launch page to jump straight to the user's home page. */
export const LAUNCH_HOME_COOKIE = "ff-home";

export function rememberLaunchHome(path: string) {
  document.cookie = `${LAUNCH_HOME_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function forgetLaunchHome() {
  document.cookie = `${LAUNCH_HOME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
