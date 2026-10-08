export const accountDomain = "fishy-fishy.com";

export function accountEmail(name: string) {
  const localPart = name.trim().toLowerCase().split("@")[0] ?? "";

  if (!/^[a-z0-9._-]+$/.test(localPart)) {
    return null;
  }

  return `${localPart}@${accountDomain}`;
}
