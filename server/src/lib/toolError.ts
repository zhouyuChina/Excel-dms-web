export function toolError(
  error: string,
  message: string,
  details?: Record<string, unknown>
): { error: string; message: string; details?: Record<string, unknown> } {
  return details ? { error, message, details } : { error, message };
}
