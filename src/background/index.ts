import browser from 'webextension-polyfill'

import { setupTabMsgLstnrs } from './messageListeners/tabs'
import { setupWebdavMsgLstnrs } from './messageListeners/webdav'

browser.runtime.onInstalled.addListener(async () => {
  // eslint-disable-next-line no-console
  console.log('Extension installed')
})

// Setup all message listeners
setupTabMsgLstnrs()
setupWebdavMsgLstnrs()
