import { defaultConfigOptions } from './web-preset'
import { IS_SERVER } from './env'
import { UNDEFINED, mergeObjects, noop } from './shared'
import { internalMutate } from './mutate'
import { SWRGlobalState } from './global-state'
import * as revalidateEvents from '../events'

import type {
  Cache,
  ScopedMutator,
  RevalidateEvent,
  RevalidateCallback,
  ProviderConfiguration,
  GlobalState
} from '../types'

const revalidateAllKeys = (
  revalidators: Record<string, RevalidateCallback[]>,
  type: RevalidateEvent
) => {
  for (const key in revalidators) {
    if (revalidators[key][0]) revalidators[key][0](type)
  }
}

export const initCache = <Data = any>(
  provider: Cache<Data>,
  options?: Partial<ProviderConfiguration>
):
  | [Cache<Data>, ScopedMutator, () => void, () => void]
  | [Cache<Data>, ScopedMutator]
  | undefined => {
  // The global state for a specific provider will be used to deduplicate
  // requests and store listeners. As well as a mutate function that is bound to
  // the cache.

  // The provider's global state might be already initialized. Let's try to get the
  // global state associated with the provider first.
  if (!SWRGlobalState.has(provider)) {
    const opts = mergeObjects(defaultConfigOptions, options)

    // If there's no global state bound to the provider, create a new one with the
    // new mutate function.
    // 类型是 key-revalidator。在一个事件发生后(比如 focus 和 reconnect)，对数据进行重新验证。
    // revalidator 会接受一个事件参数。
    const EVENT_REVALIDATORS = {}

    // internalMutate 是最为原始的 mutate 函数。
    // 这里使用 bind 来绑定缓存提供者，让后续的 mutate 调用可以少传一个参数。
    const mutate = internalMutate.bind(UNDEFINED, provider) as ScopedMutator
    let unmount = noop

    // 缓存变化的监听函数，key-callback。
    const subscriptions: Record<string, ((current: any, prev: any) => void)[]> =
      {}
    // 向 subscriptions 中添加某个 key 的监听函数，并返回解除监听的函数。
    const subscribe = (
      key: string,
      callback: (current: any, prev: any) => void
    ) => {
      const subs = subscriptions[key] || []
      subscriptions[key] = subs

      subs.push(callback)
      return () => subs.splice(subs.indexOf(callback), 1)
    }
    // 设置某个 key 的值，并调用对应 key 的监听函数。
    const setter = (key: string, value: any, prev: any) => {
      provider.set(key, value)
      const subs = subscriptions[key]
      if (subs) {
        for (const fn of subs) {
          fn(value, prev)
        }
      }
    }

    const initProvider = () => {
      if (!SWRGlobalState.has(provider)) {
        // Update the state if it's new, or if the provider has been extended.
        SWRGlobalState.set(provider, [
          EVENT_REVALIDATORS,
          {},
          {},
          {},
          mutate,
          setter,
          subscribe
        ])
        if (!IS_SERVER) {
          // When listening to the native events for auto revalidations,
          // we intentionally put a delay (setTimeout) here to make sure they are
          // fired after immediate JavaScript executions, which can be
          // React's state updates.
          // This avoids some unnecessary revalidations such as
          // https://github.com/vercel/swr/issues/1680.
          // 监听鼠标的 focus 事件，并返回一个解除监听 focus 事件的函数。
          const releaseFocus = opts.initFocus(
            setTimeout.bind(
              UNDEFINED,
              revalidateAllKeys.bind(
                UNDEFINED,
                EVENT_REVALIDATORS,
                revalidateEvents.FOCUS_EVENT
              )
            )
          )
          // 监听重连事件，并返回一个解除监听重连事件的函数。
          const releaseReconnect = opts.initReconnect(
            setTimeout.bind(
              UNDEFINED,
              revalidateAllKeys.bind(
                UNDEFINED,
                EVENT_REVALIDATORS,
                revalidateEvents.RECONNECT_EVENT
              )
            )
          )
          // 清理函数。解除 focus、reconnect 的监听，删除 provider 对应的全局状态。
          unmount = () => {
            releaseFocus && releaseFocus()
            releaseReconnect && releaseReconnect()
            // When un-mounting, we need to remove the cache provider from the state
            // storage too because it's a side-effect. Otherwise, when re-mounting we
            // will not re-register those event listeners.
            SWRGlobalState.delete(provider)
          }
        }
      }
    }
    initProvider()

    // This is a new provider, we need to initialize it and setup DOM events
    // listeners for `focus` and `reconnect` actions.

    // We might want to inject an extra layer on top of `provider` in the future,
    // such as key serialization, auto GC, etc.
    // For now, it's just a `Map` interface without any modifications.
    return [provider, mutate, initProvider, unmount]
  }

  // globalState 的 4 索引是绑定了 cache provider 的 mutate 函数。
  return [provider, (SWRGlobalState.get(provider) as GlobalState)[4]]
}
