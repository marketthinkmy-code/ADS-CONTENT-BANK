export function toIsoDate(value: string | number | undefined): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && value.trim().match(/^\d+$/)) {
    return new Date(numericValue * 1000).toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function todayIso(): string {
  return new Date().toISOString();
}
