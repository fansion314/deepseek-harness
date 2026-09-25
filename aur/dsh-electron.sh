#!/bin/bash
# System Electron renders the shell; system Node runs the Host.
set -euo pipefail
app=$(realpath -- "$(dirname -- "${BASH_SOURCE[0]}")/../lib/dsh-electron")
export DSH_DESKTOP_DSH_DIR="$app/dsh"
system_runtime=$(/usr/bin/node "$app/system-runtime.mjs" "$app" "${XDG_CACHE_HOME:-$HOME/.cache}/dsh-electron/runtimes")
export DSH_DESKTOP_PNPM_ENTRY=/usr/lib/node_modules/pnpm/bin/pnpm.mjs
export DSH_DESKTOP_PRIMARY_RUNTIME_DIR="$system_runtime/primary-runtime"
export DSH_DESKTOP_PRIMARY_RUNTIME_IN_PLACE=1
export DSH_DESKTOP_HOST_NODE=/usr/bin/node
export DSH_DESKTOP_OPEN_DEVTOOLS=0
export ELECTRON_FORCE_IS_PACKAGED=false
unset ELECTRON_RUN_AS_NODE
exec /usr/bin/electron44 --class=dsh-electron "$app" "$@"
