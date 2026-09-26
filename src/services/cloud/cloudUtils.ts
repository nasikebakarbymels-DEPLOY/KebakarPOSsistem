/**
 * Utilitas untuk Layanan Cloud Firestore
 */

/**
 * Membersihkan objek payload dari properti bernilai `undefined`
 * agar Firestore SDK tidak melempar error "Unsupported field value: undefined".
 * Objek bersarang dan array objek juga dibersihkan dengan aman.
 */
export function sanitizePayload<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizePayload(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      clean[key] = value.map((item) => {
        if (item !== null && typeof item === 'object') {
          return sanitizePayload(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      clean[key] = value;
    }
  }

  return clean;
}
