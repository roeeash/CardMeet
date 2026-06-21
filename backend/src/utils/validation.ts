/**
 * Utility functions for validating and parsing query parameters
 */

/**
 * Parse and validate a latitude value
 * @param value - The value to parse (string or number)
 * @returns Parsed latitude or null if invalid
 * @throws Error if validation fails
 */
export function parseLatitude(value: any): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    throw new Error('latitude must be a valid number');
  }

  if (num < -90 || num > 90) {
    throw new Error('latitude must be between -90 and 90');
  }

  return num;
}

/**
 * Parse and validate a longitude value
 * @param value - The value to parse (string or number)
 * @returns Parsed longitude or null if invalid
 * @throws Error if validation fails
 */
export function parseLongitude(value: any): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    throw new Error('longitude must be a valid number');
  }

  if (num < -180 || num > 180) {
    throw new Error('longitude must be between -180 and 180');
  }

  return num;
}

/**
 * Parse and validate a radius value (in kilometers)
 * @param value - The value to parse (string or number)
 * @param maxKm - Maximum allowed radius (default 500)
 * @returns Parsed radius or null if invalid
 * @throws Error if validation fails
 */
export function parseRadiusKm(value: any, maxKm: number = 500): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    throw new Error('radiusKm must be a valid number');
  }

  if (num <= 0) {
    throw new Error('radiusKm must be greater than 0');
  }

  if (num > maxKm) {
    throw new Error(`radiusKm must be at most ${maxKm}`);
  }

  return num;
}
