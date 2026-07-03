import browser from 'webextension-polyfill'

import type { WebDavConfig, WebDavResult } from '~/logic/webdav'
import { WEBDAV_MESSAGE, webdavDownload, webdavTest, webdavUpload } from '~/logic/webdav'

interface WebdavMessage {
  contentScriptQuery?: WEBDAV_MESSAGE
  config?: WebDavConfig
  data?: string
  [key: string]: unknown
}

function isWebdavMessage(message: unknown): message is WebdavMessage {
  if (typeof message !== 'object' || message === null)
    return false
  const query = (message as WebdavMessage).contentScriptQuery
  return query === WEBDAV_MESSAGE.TEST
    || query === WEBDAV_MESSAGE.UPLOAD
    || query === WEBDAV_MESSAGE.DOWNLOAD
}

/**
 * Runs the actual WebDAV network requests in the background/service worker so
 * they are not blocked by the linux.do content-script origin's CORS policy.
 * Returning a Promise lets webextension-polyfill deliver the result back to the
 * content script's `sendMessage` caller.
 */
function handleWebdavMessage(message: unknown): Promise<WebDavResult> | undefined {
  if (!isWebdavMessage(message) || !message.config)
    return undefined

  switch (message.contentScriptQuery) {
    case WEBDAV_MESSAGE.TEST:
      return webdavTest(message.config)
    case WEBDAV_MESSAGE.UPLOAD:
      return webdavUpload(message.config, message.data ?? '')
    case WEBDAV_MESSAGE.DOWNLOAD:
      return webdavDownload(message.config)
    default:
      return undefined
  }
}

export function setupWebdavMsgLstnrs() {
  browser.runtime.onMessage.removeListener(handleWebdavMessage)
  browser.runtime.onMessage.addListener(handleWebdavMessage)
}
