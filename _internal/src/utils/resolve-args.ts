import { mergeConfigs } from './merge-config'
import { normalize } from './normalize-args'
import { useSWRConfig } from './use-swr-config'
import { BUILT_IN_MIDDLEWARE } from './middleware-preset'

// It's tricky to pass generic types as parameters, so we just directly override
// the types here.
export const withArgs = <SWRType>(hook: any) => {
  return function useSWRArgs(...args: any) {
    // Get the default and inherited configuration.
    // 将 context 中的 config，和 defaultConfig 合并后的配置对象(fallbackConfig)。
    const fallbackConfig = useSWRConfig()

    // Normalize arguments.
    // useSWR hook 支持 key-fetcher-config 和 key-config 两种顺序的参数。
    // 这里将这两种顺序统一处理为 key-fetcher-config 的顺序。
    const [key, fn, _config] = normalize<any, any>(args)

    // Merge configurations.
    // 将用户传入的配置对象和默认的配置进行合并
    const config = mergeConfigs(fallbackConfig, _config)

    // Apply middleware
    // 应用内置的中间件
    let next = hook
    const { use } = config
    // 应用库自带的 middleware (devtools 相关内容)
    const middleware = (use || []).concat(BUILT_IN_MIDDLEWARE)
    // 从最后一个中间件(库自带)开始，从右往左应用中间件。
    // 用户的中间件会在库自带的中间件之后被调用。
    // 每个中间件会包裹上一个中间件。
    for (let i = middleware.length; i--; ) {
      next = middleware[i](next)
    }

    // 到这里 next 就是包裹完所有中间件后的最终 hook。
    // 将所有的用户参数传给这个 hook。
    return next(key, fn || config.fetcher || null, config)
  } as unknown as SWRType
}
