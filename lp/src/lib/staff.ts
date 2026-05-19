export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.CHAPPIE_STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
