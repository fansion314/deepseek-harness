# Arch Linux and CachyOS

English | [中文](README.zh.md)

## Summary

`dsh-electron` builds DeepSeek Harness from source; `dsh-electron-bin` installs the prebuilt application. Both target x86_64 and use Arch's `electron44`, without bundling Electron. These are community packages from [fansion314/deepseek-harness](https://github.com/fansion314/deepseek-harness), independent of upstream Desktop releases.

## Contents

- [Installation](#installation)
- [Release builds](#release-builds)
- [System packages](#system-packages)
- [Runtime](#runtime)

## Installation

The GitHub release includes installable `.pkg.tar.zst` files, a SHA-256 manifest, and AUR recipe archives containing `PKGBUILD` and `.SRCINFO`. The binary recipe verifies the application archive before packaging it. The recipes are prepared for AUR submission; the workflow does not upload them to aur.archlinux.org.

The desktop command is `dsh-desktop`; the sidebar, window title, and application menu entry use DeepSeek Harness Desktop. The packages conflict with each other. Application updates use pacman or an AUR helper; the upstream in-app updater is inactive. System Electron reads `~/.config/electron44-flags.conf` (or `electron-flags.conf`) for display and Chromium options.

## Release builds

The [workflow](../.github/workflows/arch-release.yml) builds in an Arch container as an unprivileged user. An `arch-v<upstream-version>-<pkgrel>` tag publishes a prerelease after runtime checks and packaging succeed. Manual runs create Actions artifacts without publishing. Both recipes must have matching versions and release numbers before tagging.

The build uses the repository's pinned pnpm, compiles the desktop and Web frontend, and deploys production JavaScript dependencies. Runtime interpreters and Python libraries come from pacman. Native-module, PTY, search, Host, frontend, Office-conversion, and Electron-window checks run before publication. Release recipes receive the actual archive checksum and generated `.SRCINFO`; the checked-in binary recipe must match the published archive before AUR submission.

## System packages

| Capability | Arch packages used at runtime |
|---|---|
| Desktop shell | `electron44` |
| Host and JavaScript execution | Node supplied by `electron44` |
| Plugin package operations | Bundled pnpm, run by Electron Node |
| Python interpreter | `python` |
| Data analysis | `python-numpy`, `python-pandas` |
| Word and PowerPoint authoring | `python-docx`, `python-pptx` |
| Excel authoring | `python-openpyxl`, `python-xlsxwriter` |
| Images and XML | `libvips`, `python-pillow`, `python-lxml` |
| Python supporting libraries | `python-dateutil`, `python-six`, `python-tzdata`, `python-typing_extensions`, `python-et-xmlfile` |
| File search | `ripgrep` |
| Native libraries and desktop integration | `glibc`, `gcc-libs`, `xdg-utils` |

Both recipes declare these dependencies. Existing installations are shared; package-size reduction does not remove the disk space required by missing system dependencies. Build-only tools include Git, Rust, Clang, CMake, Node.js, pnpm, node-gyp, and pkgconf.

The DSH-specific `libreoffice-kit-wasm` engine remains bundled: document preview and conversion use its JavaScript/worker API, not the system `libreoffice` command. The qualified npm graph, native Node bindings, and speech engine remain package-owned. Sharp is compiled against system libvips; its bundled libvips binaries are omitted. Other-platform PTY binaries, source maps, and TypeScript declarations are omitted using the existing Desktop file policy.

## Runtime

Resources live under `/usr/lib/dsh-electron`. The launcher selects the existing unpackaged Desktop resource inputs and disables development tools. User profiles remain in the normal DSH home. Electron 44 is versioned separately so an upgrade of Arch's latest-electron metapackage cannot silently switch the application to a new major release.

The launcher uses Electron Node for Host, package operations, and the primary JavaScript runtime. It reads current system Python distribution versions and creates only metadata and links under `${XDG_CACHE_HOME:-~/.cache}/dsh-electron/runtimes`. The Host uses these dependencies in place; it does not copy `/usr` or interpreters into `~/.dsh`. Metadata is refreshed after system versions change. Missing dependencies stop startup with an error. System Python follows Arch's externally managed environment policy; install additional system libraries with pacman or use a workspace virtual environment.

Linux keeps an application tray icon. Activating it restores the window; its context menu contains Open, About, Check for Updates, Reload Page, Restart App and Host, and Quit. Closing the workspace or welcome window hides it while tasks continue. A desktop environment with a system tray is required. If tray creation fails, closing exits instead. Linux tray activation follows the desktop environment and may require a double click.

The Arch build applies a small [compatibility patch](require-builtin.patch) to the deployed internal-module helper: an explicit `--expose-internals` uses Node’s builtin loader without probing Electron’s V8 memory layout. Workspace and upstream dependency sources remain unchanged. Runtime smoke checks exercise this helper and the rebuilt sharp addon under the installed Electron version.
