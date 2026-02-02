/**
 * Generates a deterministic HSL color from a username string
 * Uses a hash-based approach to ensure the same username always gets the same color
 * Returns visually distinct, saturated hues with good white-text contrast
 */

const AVATAR_HUES = [
  { name: 'emerald', hue: 160 },
  { name: 'blue', hue: 210 },
  { name: 'purple', hue: 270 },
  { name: 'rose', hue: 340 },
  { name: 'amber', hue: 45 },
  { name: 'teal', hue: 180 },
  { name: 'indigo', hue: 240 },
  { name: 'orange', hue: 30 },
  { name: 'cyan', hue: 190 },
  { name: 'fuchsia', hue: 300 },
  { name: 'lime', hue: 80 },
  { name: 'red', hue: 0 },
];

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic HSL color for a given username
 * @param username - The username to generate a color for
 * @returns A CSS HSL color string like 'hsl(210, 70%, 45%)'
 */
export function getAvatarColor(username: string): string {
  const hash = hashString(username);
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length].hue;

  // Use high saturation (70%) and medium-dark lightness (45%) for good contrast with white text
  return `hsl(${hue}, 70%, 45%)`;
}
