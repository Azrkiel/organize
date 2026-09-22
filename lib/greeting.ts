/** A time-of-day greeting for the dashboard header, from a 0–23 hour. */
export function getGreeting(hour: number): string {
  const h = ((hour % 24) + 24) % 24; // tolerate out-of-range input
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
