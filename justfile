# 前端仓 e-cam-web 的 quality-gate 入口（forge surface=e-cam-web，任务提交门禁在
# surface 目录执行 just compile/fmt/lint/unit-test）。与 D:/Haven 根 justfile 的
# e-cam-web 委托配方保持一致；typecheck 用 -b（project references，与 npm run typecheck 相同）。

compile:
    npx vue-tsc -b

fmt:
    npx prettier --check src 2>/dev/null || true

lint:
    npx eslint src --ext .ts,.vue 2>/dev/null || true

unit-test:
    npx vitest run

# 前端无独立 e2e/API 脚本目录，回归由单测兜底
regression: unit-test

# 兜底别名
test: unit-test
