import { stableHash } from './hash'
import { isFunction } from './shared'

import type { Key, Arguments } from '../types'

export const serialize = (key: Key): [string, Arguments] => {
  // 支持通过一个函数返回 key
  if (isFunction(key)) {
    try {
      key = key()
    } catch (err) {
      // dependencies not ready
      key = ''
    }
  }

  // Use the original key as the argument of fetcher. This can be a string or an
  // array of values.
  const args = key

  // If key is not falsy, or not an empty array, hash it.
  key =
    typeof key == 'string'
      ? key
      : (Array.isArray(key) ? key.length : key)
      ? // https://github.com/shuding/stable-hash
        stableHash(key)
      : ''

  return [key, args]
}
