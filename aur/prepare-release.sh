#!/bin/bash
# Produce release-local AUR recipes with checksums and makepkg-owned metadata.
set -euo pipefail
cd "$(dirname "$0")/.."
source aur/dsh-electron/PKGBUILD
[[ ${ARCH_TAG:?ARCH_TAG is required} == "$_tag" ]]
binary_version=$(source aur/dsh-electron-bin/PKGBUILD; printf '%s %s %s' "$_version" "$pkgver" "$pkgrel")
[[ $binary_version == "$_version $pkgver $pkgrel" ]]
artifact="dsh-electron-${_version}-${pkgrel}-x86_64.tar.zst"
digest=$(sha256sum "release/$artifact")
digest=${digest%% *}
mkdir -p release/aur
for name in dsh-electron dsh-electron-bin; do
  mkdir -p "release/aur/$name"
  cp "aur/$name/PKGBUILD" "release/aur/$name/PKGBUILD"
  if [[ $name == dsh-electron-bin ]]; then
    sed -i "s/RELEASE_SHA256/$digest/" "release/aur/$name/PKGBUILD"
    # A previously pinned recipe is refreshed for every release build.
    sed -i "s/^sha256sums=.*/sha256sums=('$digest')/" "release/aur/$name/PKGBUILD"
  fi
  (cd "release/aur/$name" && makepkg --printsrcinfo > .SRCINFO)
done
