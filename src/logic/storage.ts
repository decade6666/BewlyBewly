import { storage } from 'webextension-polyfill'

import { useStorageLocal } from '~/composables/useStorageLocal'
import { useStorageSync } from '~/composables/useStorageSync'
import type { wallpaperItem } from '~/constants/imgs'
import type { HomeSubPage } from '~/contentScripts/views/Home/types'
import type { AppPage } from '~/enums/appEnums'

import { cleanLegacySettingsStorageValue, hasLegacySettingsFields, migrateWebdavLegacyPath, removeLegacySettingsFields } from './settingsMigration'
import { DEFAULT_WEBDAV_PATH } from './webdavSettings'

const SETTINGS_STORAGE_KEY = 'settings'

export const storageDemo = useStorageLocal('webext-demo', 'Storage Demo')
export const accessKey = useStorageLocal('accessKey', '')

export interface Settings {
  touchScreenOptimization: boolean
  enableGridLayoutSwitcher: boolean
  enableHorizontalScrolling: boolean

  language: string
  customizeFont: 'default' | 'recommend' | 'custom'
  fontFamily: string
  overrideDanmakuFont: boolean
  removeTheIndentFromChinesePunctuation: boolean

  disableFrostedGlass: boolean
  reduceFrostedGlassBlur: boolean
  disableShadow: boolean

  enableVideoPreview: boolean

  // Link Opening Behavior
  videoCardLinkOpenMode: 'drawer' | 'newTab' | 'currentTab'
  topBarLinkOpenMode: 'currentTab' | 'currentTabIfNotHomepage' | 'newTab'
  searchBarLinkOpenMode: 'currentTab' | 'currentTabIfNotHomepage' | 'newTab'
  closeDrawerWithoutPressingEscAgain: boolean

  blockAds: boolean
  blockTopSearchPageAds: boolean

  enableVideoCtrlBarOnVideoCard: boolean
  hoverVideoCardDelayed: boolean

  // Desktop & Dock
  useOldTopBar: boolean
  autoHideTopBar: boolean
  showTopBarThemeColorGradient: boolean
  showBewlyOrBiliTopBarSwitcher: boolean
  showBewlyOrBiliPageSwitcher: boolean
  topBarIconBadges: 'number' | 'dot' | 'none'
  openNotificationsPageAsDrawer: boolean

  alwaysUseDock: boolean
  autoHideDock: boolean
  halfHideDock: boolean
  dockPosition: 'left' | 'right' | 'bottom'
  /** @deprecated use dockItemsConfig instead */
  dockItemVisibilityList: { page: AppPage, visible: boolean }[]
  dockItemsConfig: { page: AppPage, visible: boolean, openInNewTab: boolean, useOriginalBiliPage: boolean }[]
  disableDockGlowingEffect: boolean
  disableLightDarkModeSwitcherOnDock: boolean
  backToTopAndRefreshButtonsAreSeparated: boolean

  sidebarPosition: 'left' | 'right'
  autoHideSidebar: boolean

  theme: 'light' | 'dark' | 'auto'
  themeColor: string
  useLinearGradientThemeColorBackground: boolean
  wallpaperMode: 'buildIn' | 'byUrl'
  wallpaper: string
  enableWallpaperMasking: boolean
  wallpaperMaskOpacity: number
  wallpaperBlurIntensity: number
  locallyUploadedWallpaper: wallpaperItem | null

  customizeCSS: boolean
  customizeCSSContent: string

  searchPageDarkenOnSearchFocus: boolean
  searchPageBlurredOnSearchFocus: boolean
  searchPageLogoColor: 'white' | 'themeColor'
  searchPageLogoGlow: boolean
  searchPageShowLogo: boolean
  searchPageSearchBarFocusCharacter: string
  individuallySetSearchPageWallpaper: boolean
  searchPageWallpaperMode: 'buildIn' | 'byUrl'
  searchPageWallpaper: string
  searchPageEnableWallpaperMasking: boolean
  searchPageWallpaperMaskOpacity: number
  searchPageWallpaperBlurIntensity: number

  recommendationMode: 'web' | 'app'

  // filter setting
  disableFilterForFollowedUser: boolean
  filterOutVerticalVideos: boolean
  enableFilterByViewCount: boolean
  filterByViewCount: number
  enableFilterByDuration: boolean
  filterByDuration: number
  enableFilterByTitle: boolean
  filterByTitle: { keyword: string, remark: string }[]
  enableFilterByUser: boolean
  filterByUser: { keyword: string, remark: string }[]

  followingTabShowLivestreamingVideos: boolean

  homePageTabVisibilityList: { page: HomeSubPage, visible: boolean }[]
  alwaysShowTabsOnHomePage: boolean
  useSearchPageModeOnHomePage: boolean
  searchPageModeWallpaperFixed: boolean
  hideHomePagePinnedTopics: boolean
  hideHomePageCommunityGuidelines: boolean
  showHomePageTopicTags: boolean

  adaptToOtherPageStyles: boolean
  showTopBar: boolean
  useOriginalBilibiliTopBar: boolean
  useOriginalBilibiliHomepage: boolean

  // WebDAV Sync
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  webdavLastSyncTime: number
  /**
   * Local-only WebDAV metadata recording the original remote single-file path
   * that was migrated into `webdavPath`. It must never be uploaded to or
   * downloaded from the remote envelope, and it is preserved across restores
   * so the legacy single-file candidate can still be listed/rotated until the
   * user chooses a different directory or the file is deleted/confirmed gone.
   */
  webdavLegacyFilePath: string
}

export const originalSettings: Settings = {
  touchScreenOptimization: false,
  enableGridLayoutSwitcher: true,
  enableHorizontalScrolling: false,

  language: '',
  customizeFont: 'recommend',
  fontFamily: '',
  overrideDanmakuFont: true,
  removeTheIndentFromChinesePunctuation: false,

  disableFrostedGlass: true,
  reduceFrostedGlassBlur: false,
  disableShadow: false,

  // Link Opening Behavior
  videoCardLinkOpenMode: 'newTab',
  topBarLinkOpenMode: 'currentTabIfNotHomepage',
  searchBarLinkOpenMode: 'currentTabIfNotHomepage',
  closeDrawerWithoutPressingEscAgain: false,

  blockAds: false,
  blockTopSearchPageAds: false,

  enableVideoPreview: true,
  enableVideoCtrlBarOnVideoCard: false,
  hoverVideoCardDelayed: false,

  // Desktop & Dock
  useOldTopBar: false,
  autoHideTopBar: false,
  showTopBarThemeColorGradient: true,
  showBewlyOrBiliTopBarSwitcher: true,
  showBewlyOrBiliPageSwitcher: true,
  topBarIconBadges: 'number',
  openNotificationsPageAsDrawer: true,

  alwaysUseDock: false,
  autoHideDock: false,
  halfHideDock: false,
  dockPosition: 'right',
  /** @deprecated use dockItemsConfig instead */
  dockItemVisibilityList: [],
  dockItemsConfig: [],
  disableDockGlowingEffect: false,
  disableLightDarkModeSwitcherOnDock: false,
  backToTopAndRefreshButtonsAreSeparated: true,

  sidebarPosition: 'right',
  autoHideSidebar: false,

  theme: 'auto',
  themeColor: '#00a1d6',
  useLinearGradientThemeColorBackground: false,
  wallpaperMode: 'buildIn',
  wallpaper: '',
  enableWallpaperMasking: false,
  wallpaperMaskOpacity: 80,
  wallpaperBlurIntensity: 0,
  locallyUploadedWallpaper: null,

  customizeCSS: false,
  customizeCSSContent: '',

  searchPageDarkenOnSearchFocus: true,
  searchPageBlurredOnSearchFocus: false,
  searchPageLogoColor: 'themeColor',
  searchPageLogoGlow: true,
  searchPageShowLogo: true,
  searchPageSearchBarFocusCharacter: '',
  individuallySetSearchPageWallpaper: false,
  searchPageWallpaperMode: 'buildIn',
  searchPageWallpaper: '',
  searchPageEnableWallpaperMasking: false,
  searchPageWallpaperMaskOpacity: 0,
  searchPageWallpaperBlurIntensity: 0,

  recommendationMode: 'web',

  // filter setting
  disableFilterForFollowedUser: false,
  filterOutVerticalVideos: false,
  enableFilterByViewCount: false,
  filterByViewCount: 10000,
  enableFilterByDuration: false,
  filterByDuration: 3600,
  enableFilterByTitle: false,
  filterByTitle: [],
  enableFilterByUser: false,
  filterByUser: [],

  followingTabShowLivestreamingVideos: false,

  homePageTabVisibilityList: [],
  alwaysShowTabsOnHomePage: false,
  useSearchPageModeOnHomePage: false,
  searchPageModeWallpaperFixed: false,
  hideHomePagePinnedTopics: true,
  hideHomePageCommunityGuidelines: false,
  showHomePageTopicTags: true,

  adaptToOtherPageStyles: true,
  showTopBar: true,
  useOriginalBilibiliTopBar: false,
  useOriginalBilibiliHomepage: false,

  // WebDAV Sync
  webdavEnabled: false,
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavPath: DEFAULT_WEBDAV_PATH,
  webdavLastSyncTime: 0,
  webdavLegacyFilePath: '',
}

export async function cleanupLegacySettingsStorage(): Promise<void> {
  try {
    const storedSettings = (await storage.local.get(SETTINGS_STORAGE_KEY))[SETTINGS_STORAGE_KEY]
    const cleanedSettings = cleanLegacySettingsStorageValue(storedSettings)

    if (cleanedSettings === storedSettings)
      return

    await storage.local.set({ [SETTINGS_STORAGE_KEY]: cleanedSettings })
  }
  catch (error) {
    console.error('Failed to clean legacy settings storage:', error)
  }
}

export const settings = useStorageLocal(SETTINGS_STORAGE_KEY, ref<Settings>(originalSettings), { mergeDefaults: true })

void cleanupLegacySettingsStorage()

/**
 * Homepage blocked words live in `storage.sync` (not `storage.local`) so they
 * survive extension uninstall/reinstall and roam across devices via the
 * browser's account sync. Kept as a small isolated object to stay well within
 * the `storage.sync` per-item quota.
 */
export interface BlockedWordsState {
  enabled: boolean
  words: string[]
}

export const BLOCKED_WORDS_MAX_BYTES = 7000

const BLOCKED_WORDS_STORAGE_KEY = 'blockedWords'
const BLOCKED_WORDS_MIGRATION_FLAG = 'blockedWordsMigratedToSync'

export const blockedWords = useStorageSync(
  BLOCKED_WORDS_STORAGE_KEY,
  ref<BlockedWordsState>({ enabled: false, words: [] }),
  { mergeDefaults: true },
)

/**
 * One-time migration: users upgrading from a version that stored blocked words
 * inside local `settings` keep their list by copying it into `storage.sync`.
 * Runs once (guarded by a local flag) and never overwrites existing sync data
 * that may already have arrived from another device.
 */
export async function migrateBlockedWordsToSync(): Promise<void> {
  try {
    const alreadyMigrated = (await storage.local.get(BLOCKED_WORDS_MIGRATION_FLAG))[BLOCKED_WORDS_MIGRATION_FLAG]
    if (alreadyMigrated)
      return

    const storedSettings = (await storage.local.get(SETTINGS_STORAGE_KEY))[SETTINGS_STORAGE_KEY]
    const parsedSettings = typeof storedSettings === 'string' ? JSON.parse(storedSettings) : storedSettings
    const legacyWords: string[] = Array.isArray(parsedSettings?.homePageBlockedWords) ? parsedSettings.homePageBlockedWords : []
    const legacyEnabled = Boolean(parsedSettings?.enableHomePageBlockedWords)

    if (legacyWords.length > 0 || legacyEnabled) {
      const existing = (await storage.sync.get(BLOCKED_WORDS_STORAGE_KEY))[BLOCKED_WORDS_STORAGE_KEY]
      const parsedExisting = typeof existing === 'string' ? JSON.parse(existing) : existing
      const syncHasWords = Array.isArray(parsedExisting?.words) && parsedExisting.words.length > 0
      const syncIsEmpty = !parsedExisting || (!syncHasWords && !parsedExisting.enabled)

      if (syncIsEmpty) {
        await storage.sync.set({
          [BLOCKED_WORDS_STORAGE_KEY]: JSON.stringify({ enabled: legacyEnabled, words: legacyWords }),
        })
      }
    }

    await storage.local.set({ [BLOCKED_WORDS_MIGRATION_FLAG]: true })
  }
  catch (error) {
    console.error('Failed to migrate blocked words to sync storage:', error)
  }
}

void migrateBlockedWordsToSync()

function normalizeInMemorySettings(value: Settings): Settings {
  let next = value
  if (hasLegacySettingsFields(value))
    next = removeLegacySettingsFields(value) as Settings
  // Migrate any legacy single-file `webdavPath` into the directory semantics
  // and record the original path in `webdavLegacyFilePath`. Idempotent: a path
  // that is already a directory is returned unchanged, so this is safe to run
  // on every settings change without erasing a recorded locator.
  next = migrateWebdavLegacyPath(next) as Settings
  return next
}

watch(
  () => settings.value,
  (value) => {
    const next = normalizeInMemorySettings(value)
    if (next === value)
      return

    settings.value = next
  },
  { deep: true, immediate: true },
)

export type GridLayoutType = 'adaptive' | 'twoColumns' | 'oneColumn'

export interface GridLayout {
  home: GridLayoutType
}

export const gridLayout = useStorageLocal('gridLayout', ref<GridLayout>({
  home: 'adaptive',
}), { mergeDefaults: true })

export const sidePanel = useStorageLocal('sidePanel', ref<{
  home: boolean
}>({
  home: true,
}), { mergeDefaults: true })
