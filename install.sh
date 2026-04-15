#!/bin/sh
set -e

REPO="railwise-cn/RAILWISE-CLI"
BINARY="railwise"
INSTALL_DIR="${RAILWISE_INSTALL_DIR:-/usr/local/bin}"

get_arch() {
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac
}

get_os() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux) echo "linux" ;;
    darwin) echo "darwin" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
}

get_ext() {
  case "$1" in
    linux) echo "tar.gz" ;;
    darwin) echo "zip" ;;
  esac
}

OS=$(get_os)
ARCH=$(get_arch)
EXT=$(get_ext "$OS")

if [ -n "$1" ]; then
  VERSION="$1"
else
  VERSION=$(curl -sI "https://github.com/$REPO/releases/latest" | grep -i "^location:" | sed 's|.*/v||' | tr -d '\r\n')
  if [ -z "$VERSION" ]; then
    echo "Failed to detect latest version. Specify version: $0 <version>" >&2
    exit 1
  fi
fi

URL="https://github.com/$REPO/releases/download/v${VERSION}/${BINARY}-${OS}-${ARCH}.${EXT}"
TMPDIR=$(mktemp -d)

echo "Installing railwise v${VERSION} (${OS}-${ARCH})..."
echo "Downloading $URL"

curl -fSL "$URL" -o "$TMPDIR/railwise.${EXT}"

case "$EXT" in
  tar.gz) tar -xzf "$TMPDIR/railwise.${EXT}" -C "$TMPDIR" ;;
  zip) unzip -qo "$TMPDIR/railwise.${EXT}" -d "$TMPDIR" ;;
esac

chmod +x "$TMPDIR/$BINARY"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMPDIR/$BINARY" "$INSTALL_DIR/$BINARY"
else
  echo "Need sudo to install to $INSTALL_DIR"
  sudo mv "$TMPDIR/$BINARY" "$INSTALL_DIR/$BINARY"
fi

rm -rf "$TMPDIR"

echo "railwise v${VERSION} installed to $INSTALL_DIR/$BINARY"
$INSTALL_DIR/$BINARY --version 2>/dev/null || true
