/** Display ↔ canonical (cm / kg) helpers for onboarding biometrics. */

export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function cmToIn(cm: number): number {
  return cm / 2.54;
}

export function inToCm(inches: number): number {
  return inches * 2.54;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
