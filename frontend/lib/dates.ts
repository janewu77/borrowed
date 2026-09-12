const fullFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

const shortFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Formats a backend ISO date; it intentionally performs no date arithmetic. */
export function fmtDay(iso: string): string {
  return fullFormatter.format(utcDate(iso));
}

/** Formats two backend ISO dates; it intentionally performs no date arithmetic. */
export function fmtRange(from: string, to: string): string {
  return `${shortFormatter.format(utcDate(from))}–${shortFormatter.format(utcDate(to))}`;
}
