import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
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
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts',
      }),
    ],

    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },

    // 开发服务器配置
    server: {
      port: Number(env.VITE_PORT) || 5173,
      host: true, // 监听所有地址
      open: true, // 自动打开浏览器
      cors: true, // 允许跨域
      // API 代理配置
      proxy: {
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
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus'],
            'echarts': ['echarts'],
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
      ],
    },

    // 预览服务器配置
    preview: {
      port: 4173,
      host: true,
      open: true,
    },

    // 日志级别
    logLevel: mode === 'development' ? 'info' : 'warn',
  }
})
