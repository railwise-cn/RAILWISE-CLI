#!/bin/sh
set -e

REPO="railwise-cn/RAILWISE-CLI"
BINARY="railwise"
ALIAS="rw"
SKILL_DIR="skill"
INSTALL_DIR="${RAILWISE_INSTALL_DIR:-/usr/local/bin}"
SHARE_DIR="${RAILWISE_SHARE_DIR:-$(dirname "$INSTALL_DIR")/share/railwise}"

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
if [ -f "$TMPDIR/$ALIAS" ]; then
  chmod +x "$TMPDIR/$ALIAS"
fi

install_file() {
  source="$1"
  target="$2"
  if [ -w "$INSTALL_DIR" ]; then
    rm -f "$target"
    mv "$source" "$target"
  else
    sudo rm -f "$target"
    sudo mv "$source" "$target"
  fi
}

link_alias() {
  target="$INSTALL_DIR/$ALIAS"
  if [ -w "$INSTALL_DIR" ]; then
    rm -f "$target"
    ln -s "$BINARY" "$target"
  else
    sudo rm -f "$target"
    sudo ln -s "$BINARY" "$target"
  fi
}

install_tree() {
  source="$1"
  target="$2"
  parent=$(dirname "$target")
  if [ ! -d "$parent" ]; then
    if mkdir -p "$parent" 2>/dev/null; then
      :
    else
      sudo mkdir -p "$parent"
    fi
  fi

  if [ -w "$parent" ]; then
    rm -rf "$target"
    cp -R "$source" "$target"
  else
    sudo rm -rf "$target"
    sudo cp -R "$source" "$target"
  fi
}

if [ ! -d "$INSTALL_DIR" ]; then
  if mkdir -p "$INSTALL_DIR" 2>/dev/null; then
    :
  else
    sudo mkdir -p "$INSTALL_DIR"
  fi
fi

install_file "$TMPDIR/$BINARY" "$INSTALL_DIR/$BINARY"

if [ -f "$TMPDIR/$ALIAS" ]; then
  install_file "$TMPDIR/$ALIAS" "$INSTALL_DIR/$ALIAS"
else
  link_alias
fi

if [ -d "$TMPDIR/$SKILL_DIR" ]; then
  install_tree "$TMPDIR/$SKILL_DIR" "$SHARE_DIR/$SKILL_DIR"
  echo "built-in skills installed to $SHARE_DIR/$SKILL_DIR"
fi

rm -rf "$TMPDIR"

echo "railwise v${VERSION} installed to $INSTALL_DIR/$BINARY"
echo "rw alias installed to $INSTALL_DIR/$ALIAS"
$INSTALL_DIR/$BINARY --version 2>/dev/null || true
