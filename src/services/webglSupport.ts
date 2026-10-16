/**
 * Whether the browser can create a WebGL context, which the map renderer requires.
 * Some browsers expose the API but refuse a context (blocklisted GPU, disabled in settings),
 * so this actually tries to create one rather than checking for `WebGLRenderingContext`.
 */
export const hasWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Where to send browsers without WebGL, or undefined when no classic version is deployed. */
export const fallbackUrl = (): string | undefined =>
  import.meta.env.VITE_FALLBACK_URL?.trim() || undefined
