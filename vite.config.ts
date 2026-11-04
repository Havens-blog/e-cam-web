import vue from '@vitejs/plugin-vue'
import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
import type { ComponentResolver } from 'unplugin-vue-components'

/**
 * 收集 element-plus 各组件的按需样式入口（`element-plus/es/components/<name>/style/css`）。
 *
 * 【为什么需要】`unplugin-vue-components` + `ElementPlusResolver` 会在**每个页面首次访问时**
 * 才 import 该页用到的组件样式。Vite 的依赖预构建一旦发现"新依赖"，就会重新打包，并让
 * 引用旧 hash 的产物请求返回 **504 Outdated Optimize Dep** —— 表现为部分页面偶发空白。
 * 把全部组件的样式入口静态写进 `optimizeDeps.include`，启动时一次性预构建完毕，
 * 运行期不再触发重新预构建，也就不会再出现这类 504。
 *
 * 【为什么动态扫描而不是硬编码】element-plus 组件增删随版本变化，硬编码列表会漂移；
 * 直接读 node_modules 目录可自适应，且用 existsSync 逐个校验 `style/css.mjs` 是否存在
 * （121 个组件里有 4 个没有该入口，写进 include 会导致解析失败）。
 */
function elementPlusStyleEntries(): string[] {
  const compDir = resolve(__dirname, 'node_modules/element-plus/es/components')
  if (!existsSync(compDir)) return []

  return readdirSync(compDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(compDir, d.name, 'style/css.mjs')))
    .map((d) => `element-plus/es/components/${d.name}/style/css`)
    .sort()
}

/**
 * 平台共享组件（@haven/ui）：模板中直接写 <IconFont> / <ManagerHeader> /
 * <AssetExportDialog> / <CustomIconSelect> 即可，无需逐文件 import。
 *
 * 这几个组件原先由 Components 插件扫描 src/components 自动注册；迁到 @haven/ui 后
 * 本地已无文件可扫描，故显式声明来源，保持“模板内直接用组件名”的既有写法不变。
 *
 * 注意：ProviderIcon 已随其依赖的平台级厂商数据一并下沉到 @haven/ui
 * （见 src/utils/icon-mapping.ts 的 re-export），故一并列入本表。
 */
const SHARED_COMPONENTS: Record<string, string> = {
  IconFont: '@haven/ui/IconFont',
  ManagerHeader: '@haven/ui/ManagerHeader',
  AssetExportDialog: '@haven/ui/AssetExportDialog',
  CustomIconSelect: '@haven/ui/CustomIconSelect',
  ProviderIcon: '@haven/ui/ProviderIcon',
}

const havenUiResolver: ComponentResolver = {
  type: 'component',
  resolve: (name) => {
    const from = SHARED_COMPONENTS[name]
    return from ? { name, from } : undefined
  },
}
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd())

  return {
    // 设置 base URL 为 /cam/，用于微服务集成
    base: '/cam/',

    // 插件配置
    plugins: [
      vue(),
      // 自动导入 Vue、Vue Router、Pinia 等 API
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
        eslintrc: {
          enabled: false,
        },
      }),
      // 自动导入组件
      Components({
        resolvers: [ElementPlusResolver(), havenUiResolver],
        dts: 'src/components.d.ts',
      }),
    ],

    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
      // 平台共享组件包 @haven/ui 自带 node_modules（其单测需要 element-plus/vue）。
      // 不去重时，包内 `import { ElDialog } from 'element-plus'` 会解析到
      // haven-ui/node_modules 下**另一份物理副本**，与主应用各持一份，后果：
      //   1) 产物里出现重复的 element-plus / vue 代码（实测多出 2 个 chunk）；
      //   2) 两套 provide/inject 上下文，ElCheckboxGroup 等父子协作会静默失效。
      // 故强制这三者只解析到本应用这一份。
      dedupe: ['vue', 'element-plus', '@element-plus/icons-vue'],
    },

    // 开发服务器配置
    server: {
      port: Number(env.VITE_PORT) || 5173,
      host: true, // 监听所有地址
      // 不自动打开浏览器：测试/多实例（同一端口被反复拉起、CI、自动化验收）下
      // 每次启动都弹窗会持续干扰使用者（实测：3333 验证实例反复打开 /cam/dashboard）。
      // 需要时显式用 `vite --open`（临时验证场景由自动化脚本自行导航，无需弹窗）。
      open: false,
      cors: true, // 允许跨域
      // API 代理配置
      proxy: {
        // eiam 统一身份: /api/iam/* -> eiam /api/*（对齐 nginx.dev.conf，
        // 缺此规则时 eiamAxios 的 /api/iam/user/profile 会落到 CAM 后端 404，
        // 路由守卫 fetchUserInfo 失败 → 5173 直连必跳登录）
        '/api/iam': {
          target: 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/iam/, '/api'),
        },
        // e-cmdb-service: /api/v1/cmdb/* -> CMDB 独立服务（拆分后路由前缀 /api/v1/cmdb）
        '/api/v1/cmdb': {
          target: 'http://localhost:8002',
          changeOrigin: true,
        },
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8001',
          changeOrigin: true,
          // 不重写路径，保持 /api/v1/cam/* 的完整路径
          // 配置代理日志
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('proxy error', err)
            })
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('Sending Request:', req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Received Response:', proxyRes.statusCode, req.url)
            })
          },
        },
      },
      // 预热常用文件
      warmup: {
        clientFiles: ['./src/main.ts', './src/App.vue'],
      },
    },

    // CSS 配置
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/assets/styles/variables.scss"; @import "@/assets/styles/mixins.scss";`,
          javascriptEnabled: true,
          // 静默 Sass 弃用警告
          silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
        },
      },
      // 开发环境启用 source map
      devSourcemap: mode === 'development',
    },

    // 构建配置
    build: {
      target: 'es2015',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development', // 开发环境生成 source map
      minify: 'esbuild',
      chunkSizeWarningLimit: 1500,
      // Rollup 配置
      rollupOptions: {
        output: {
          // 代码分割
          // echarts 按需注册后走子路径（echarts/core|charts|components|renderers，
          // 见 src/utils/echarts.ts）；zrender 仅被 echarts 引用，自动并入该 chunk。
          // ⚠ 不可写回 'echarts': ['echarts']——全量 barrel 会让按需引入白做。
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus'],
            'echarts': ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          },
          // 静态资源分类
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: '[ext]/[name]-[hash].[ext]',
        },
      },
      // esbuild 不支持 terserOptions，使用 esbuild 的 drop 选项
      esbuild: mode === 'production' ? {
        drop: ['console', 'debugger'],
      } : undefined,
    },

    // 优化配置
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'element-plus',
        'echarts',
        'axios',
        'dayjs',
        // element-plus 各组件按需样式的入口：提前预构建，避免运行期发现新依赖后重构建引发 504
        ...elementPlusStyleEntries(),
      ],
    },

    // 预览服务器配置
    preview: {
      port: 4173,
      host: true,
      // 同 server：不自动打开（需要时 `vite preview --open`）
      open: false,
    },

    // 日志级别
    logLevel: mode === 'development' ? 'info' : 'warn',
  }
})
