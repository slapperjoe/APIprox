# Maintainer: Your Name <your@email.com>
pkgname=apiprox
pkgver=0.1.0
pkgrel=1
pkgdesc="HTTP/HTTPS Proxy and Mock Server for API Testing"
arch=('x86_64')
url="https://github.com/slapperjoe/APIprox"
license=('MIT')
depends=(
    'webkit2gtk-4.1'
    'gtk3'
    'libsoup3'
    'openssl'
)
# No makedepends needed - binary is pre-built by tauri:build
source=()
sha256sums=()

pkgver() {
    grep '^version' "$startdir/src-tauri/Cargo.toml" | head -1 | sed 's/version = "//;s/"//'
}

build() {
    # Binary is already compiled by `npm run tauri:build` - nothing to do here
    local _binary="$startdir/src-tauri/target/release/apiprox"
    if [ ! -f "$_binary" ]; then
        echo "ERROR: Binary not found at $_binary"
        echo "Run 'npm run tauri:build' first."
        return 1
    fi
}

package() {
    local _root="$startdir"
    local _binary="$_root/src-tauri/target/release/apiprox"
    local _icon_dir="$_root/src-tauri/icons"

    # Binary
    install -Dm755 "$_binary" "$pkgdir/usr/bin/apiprox"

    # Icons
    install -Dm644 "$_icon_dir/32x32.png"   "$pkgdir/usr/share/icons/hicolor/32x32/apps/apiprox.png"
    install -Dm644 "$_icon_dir/icon-64.png" "$pkgdir/usr/share/icons/hicolor/64x64/apps/apiprox.png"
    install -Dm644 "$_icon_dir/128x128.png" "$pkgdir/usr/share/icons/hicolor/128x128/apps/apiprox.png"

    # .desktop file
    install -Dm644 /dev/stdin "$pkgdir/usr/share/applications/apiprox.desktop" <<EOF
[Desktop Entry]
Name=APIprox
Comment=HTTP/HTTPS Proxy and Mock Server for API Testing
Exec=apiprox
Icon=apiprox
Terminal=false
Type=Application
Categories=Development;Network;
StartupWMClass=apiprox
EOF
}
