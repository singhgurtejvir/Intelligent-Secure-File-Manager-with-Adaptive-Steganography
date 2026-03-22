const MODIFIER_ORDER = ['Ctrl', 'Shift', 'Alt', 'Meta'] as const
const MODIFIER_KEYS = new Set<string>(MODIFIER_ORDER)

function normalizeSingleKey(key: string): string | null {
  const trimmed = key.trim()
  if (!trimmed) {
    return null
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'control' || lower === 'ctrl') {
    return 'Ctrl'
  }
  if (lower === 'shift') {
    return 'Shift'
  }
  if (lower === 'alt' || lower === 'option') {
    return 'Alt'
  }
  if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'win') {
    return 'Meta'
  }
  if (lower === ' ') {
    return 'Space'
  }
  if (lower === 'esc') {
    return 'Escape'
  }
  if (lower === 'arrowup' || lower === 'arrowdown' || lower === 'arrowleft' || lower === 'arrowright') {
    return trimmed[0].toUpperCase() + trimmed.slice(1)
  }
  if (lower === 'spacebar') {
    return 'Space'
  }
  if (trimmed.length === 1) {
    return trimmed.toUpperCase()
  }
  if (/^f\d{1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  return trimmed[0].toUpperCase() + trimmed.slice(1)
}

export function normalizeShortcutKeys(keys: Iterable<string>): string[] {
  const unique = new Set<string>()
  for (const key of keys) {
    const normalized = normalizeSingleKey(key)
    if (normalized) {
      unique.add(normalized)
    }
  }

  const modifiers = MODIFIER_ORDER.filter((modifier) => unique.has(modifier))
  const regularKeys = [...unique].filter((key) => !MODIFIER_KEYS.has(key)).sort((left, right) => left.localeCompare(right))
  return [...modifiers, ...regularKeys]
}

export function serializeShortcut(keys: Iterable<string>): string {
  return normalizeShortcutKeys(keys).join('+')
}

export function parseShortcut(shortcut: string): string[] {
  return normalizeShortcutKeys(shortcut.split('+'))
}

export function formatShortcut(shortcut: string): string {
  const keys = parseShortcut(shortcut)
  return keys.length > 0 ? keys.join(' + ') : 'Not set'
}

export function isShortcutValid(keys: Iterable<string>): boolean {
  const normalized = normalizeShortcutKeys(keys)
  if (normalized.length < 3 || normalized.length > 6) {
    return false
  }

  return normalized.includes('Ctrl') && normalized.includes('Shift') && normalized.some((key) => !MODIFIER_KEYS.has(key))
}

export function sanitizeStoredShortcut(shortcut: string | null | undefined, fallback: string): string {
  if (!shortcut) {
    return fallback
  }

  const normalized = serializeShortcut(parseShortcut(shortcut))
  return isShortcutValid(normalized.split('+')) ? normalized : fallback
}

export function getEventShortcutKey(event: KeyboardEvent): string | null {
  return normalizeSingleKey(event.key)
}

export function shortcutMatchesPressedKeys(shortcut: string, pressedKeys: Iterable<string>): boolean {
  const normalizedShortcut = parseShortcut(shortcut)
  const normalizedPressed = normalizeShortcutKeys(pressedKeys)

  if (normalizedShortcut.length !== normalizedPressed.length) {
    return false
  }

  return normalizedShortcut.every((key, index) => key === normalizedPressed[index])
}
