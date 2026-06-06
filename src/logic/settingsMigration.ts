const LEGACY_SETTINGS_KEYS = ['hideHomePageGuidelineBanner'] as const

type LegacySettingKey = typeof LEGACY_SETTINGS_KEYS[number]

export function hasLegacySettingsFields(value: object): boolean {
  return LEGACY_SETTINGS_KEYS.some(key => Object.prototype.hasOwnProperty.call(value, key))
}

export function removeLegacySettingsFields<T extends object>(value: T): Omit<T, LegacySettingKey> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !isLegacySettingKey(key)),
  ) as Omit<T, LegacySettingKey>
}

export function cleanLegacySettingsStorageValue(value: unknown): unknown {
  if (typeof value === 'string')
    return cleanSerializedSettingsValue(value)

  if (isRecord(value) && hasLegacySettingsFields(value))
    return JSON.stringify(removeLegacySettingsFields(value))

  return value
}

function cleanSerializedSettingsValue(value: string): string {
  try {
    const parsedValue: unknown = JSON.parse(value)

    if (!isRecord(parsedValue) || !hasLegacySettingsFields(parsedValue))
      return value

    return JSON.stringify(removeLegacySettingsFields(parsedValue))
  }
  catch {
    return value
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLegacySettingKey(key: string): key is LegacySettingKey {
  return LEGACY_SETTINGS_KEYS.includes(key as LegacySettingKey)
}
