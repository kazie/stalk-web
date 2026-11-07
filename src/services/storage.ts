export const readStorage = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}
