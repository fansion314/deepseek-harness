# Arch Linux 和 CachyOS

[English](README.md) | 中文

## 概要

`dsh-electron` 从源码构建 DeepSeek Harness；`dsh-electron-bin` 安装预构建应用。两者均面向 x86_64，使用 Arch 的 `electron44`，不捆绑 Electron。这些是 [fansion314/deepseek-harness](https://github.com/fansion314/deepseek-harness) 提供的社区软件包，独立于上游桌面版发行。

## 目录

- [安装](#installation)
- [发行构建](#release-builds)
- [系统软件包](#system-packages)
- [运行环境](#runtime)

## 安装 {#installation}

GitHub 发行版包含可安装的 `.pkg.tar.zst` 文件、SHA-256 清单，以及包含 `PKGBUILD` 和 `.SRCINFO` 的 AUR 配方归档。二进制配方在打包前校验应用归档。这些配方已准备供 AUR 提交使用；工作流不会向 aur.archlinux.org 上传。

桌面启动命令为 `dsh-electron`；应用菜单名称为 DeepSeek Harness。两个软件包相互冲突。应用通过 pacman 或 AUR 助手更新；上游应用内更新器处于停用状态。系统 Electron 从 `~/.config/electron44-flags.conf`（或 `electron-flags.conf`）读取显示和 Chromium 选项。

## 发行构建 {#release-builds}

[工作流](../.github/workflows/arch-release.yml) 在 Arch 容器内以非特权用户构建。推送 `arch-v<upstream-version>-<pkgrel>` 标签后，运行检查和打包成功才会发布预发行版。手动运行仅生成 Actions 构建产物，不发布发行版。打标签前，两个配方的版本和发行编号必须一致。

构建使用仓库固定的 pnpm，编译桌面端和 Web 前端，并部署生产 JavaScript 依赖。运行时解释器和 Python 库由 pacman 提供。发布前执行原生模块、PTY、搜索、Host、前端、Office 转换和 Electron 窗口检查。发行配方写入实际归档校验和并生成 `.SRCINFO`；提交到 AUR 前，仓库内二进制配方必须与发布归档一致。

## 系统软件包 {#system-packages}

| 能力 | 运行时使用的 Arch 软件包 |
|---|---|
| 桌面界面 | `electron44` |
| Host 和 JavaScript 执行 | `nodejs>=24` |
| 插件包操作 | `pnpm` |
| Python 解释器 | `python` |
| 数据分析 | `python-numpy`, `python-pandas` |
| Word 和 PowerPoint 创作 | `python-docx`, `python-pptx` |
| Excel 创作 | `python-openpyxl`, `python-xlsxwriter` |
| 图像和 XML | `python-pillow`, `python-lxml` |
| Python 配套库 | `python-dateutil`, `python-six`, `python-tzdata`, `python-typing_extensions`, `python-et-xmlfile` |
| 文件搜索 | `ripgrep` |
| 原生库和桌面集成 | `glibc`, `gcc-libs`, `xdg-utils` |

两个配方均声明这些依赖。已安装的软件包可共享使用；发行包缩小并不免除缺失系统依赖所需的磁盘空间。仅构建时需要的工具包括 Git、Rust、Clang 和 CMake。

DSH 专用的 `libreoffice-kit-wasm` 引擎仍随包提供：文档预览和转换使用其 JavaScript/worker API，而非系统 `libreoffice` 命令。已验证的 npm 依赖图、原生 Node 绑定、语音引擎和 sharp/libvips 二进制也仍由应用软件包管理。通过现有桌面文件策略排除其他平台的 PTY 二进制、源码映射和 TypeScript 声明。

## 运行环境 {#runtime}

资源位于 `/usr/lib/dsh-electron`。启动器选择已有的非打包桌面资源入口，并关闭开发者工具。用户配置仍保存在常规 DSH 主目录。Electron 44 采用独立版本的软件包，因此 Arch 最新 Electron 元软件包升级时，不会将应用静默切换至新的主版本。

启动器为 Host 和包操作选择 `/usr/bin/node`。它读取当前系统 Python 分发包版本，仅在 `${XDG_CACHE_HOME:-~/.cache}/dsh-electron/runtimes` 下创建元数据和链接。Host 就地使用这些依赖，不将 `/usr` 或解释器复制到 `~/.dsh`。系统版本变化后更新元数据。缺少依赖时启动会报错。系统 Python 遵循 Arch 的外部管理环境策略；额外的系统库通过 pacman 安装，也可使用工作区虚拟环境。
