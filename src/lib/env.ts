export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getCountries(): string[] {
  return (process.env.DEFAULT_AD_COUNTRIES ?? "US,MY,SG")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);
}

export function getBooleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
