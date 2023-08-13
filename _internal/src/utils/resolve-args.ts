import { mergeConfigs } from './merge-config'
import { normalize } from './normalize-args'
import { useSWRConfig } from './use-swr-config'
import { BUILT_IN_MIDDLEWARE } from './middleware-preset'

// It's tricky to pass generic types as parameters, so we just directly override
// the types here.
export const withArgs = <SWRType>(hook: any) => {
  return function useSWRArgs(...args: any) {
    // Get the default and inherited configuration.
    const fallbackConfig = useSWRConfig()

    // Normalize arguments.
    const [key, fn, _config] = normalize<any, any>(args)

    // Merge configurations.
    const config = mergeConfigs(fallbackConfig, _config)

    // Apply middleware
    let next = hook
    const { use } = config
    // 应用库自带的 middleware
    const middleware = (use || []).concat(BUILT_IN_MIDDLEWARE)
    // 从最后一个中间件(库自带)开始，从右往左应用中间件。
    // 用户的中间件会在库自带的中间件之后被调用。
    // 每个中间件会包裹上一个中间件。
    for (let i = middleware.length; i--; ) {
      next = middleware[i](next)
    }

    return next(key, fn || config.fetcher || null, config)
  } as unknown as SWRType
}
