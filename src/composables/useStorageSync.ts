import type {
  MaybeRef,
  RemovableRef,
  StorageLikeAsync,
  UseStorageAsyncOptions,
} from '@vueuse/core'
import {
  useStorageAsync,
} from '@vueuse/core'
import { storage } from 'webextension-polyfill'

const storageSync: StorageLikeAsync = {
  removeItem(key: string) {
    return storage.sync.remove(key)
  },

  setItem(key: string, value: string) {
    return storage.sync.set({ [key]: value })
  },

  async getItem(key: string) {
    return (await storage.sync.get(key))[key]
  },
}

export function useStorageSync<T>(key: string, initialValue: MaybeRef<T>, options?: UseStorageAsyncOptions<T>): RemovableRef<T> {
  return useStorageAsync(key, initialValue, storageSync, options)
}
