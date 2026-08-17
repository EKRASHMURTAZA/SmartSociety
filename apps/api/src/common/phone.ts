export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.length === 10) d = "92" + d;
  return "+" + d;
}