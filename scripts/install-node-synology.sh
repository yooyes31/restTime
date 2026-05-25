#!/bin/sh
# Synology NAS — 사용자 홈에 Node.js LTS 바이너리 설치 (패키지 센터 불필요)
# 사용: sh install-node-synology.sh
set -eu

NODE_VERSION="${NODE_VERSION:-v20.19.2}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/node}"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) NODE_ARCH="linux-x64" ;;
  aarch64|arm64) NODE_ARCH="linux-arm64" ;;
  *)
    echo "지원하지 않는 CPU: $ARCH"
    exit 1
    ;;
esac

TARBALL="node-${NODE_VERSION}-${NODE_ARCH}.tar.xz"
URL="https://nodejs.org/dist/${NODE_VERSION}/${TARBALL}"
TMP="${TMPDIR:-/tmp}/node-install-$$"

echo "==> Node ${NODE_VERSION} (${NODE_ARCH}) → ${INSTALL_DIR}"

mkdir -p "$TMP"
cd "$TMP"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TARBALL"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TARBALL" "$URL"
else
  echo "curl 또는 wget 이 필요합니다."
  exit 1
fi

tar -xJf "$TARBALL"
rm -rf "$INSTALL_DIR"
mv "node-${NODE_VERSION}-${NODE_ARCH}" "$INSTALL_DIR"
rm -rf "$TMP"

PATH_LINE='export PATH="$HOME/.local/node/bin:$PATH"'
for rc in "$HOME/.profile" "$HOME/.bashrc"; do
  if [ -f "$rc" ] && grep -q '.local/node/bin' "$rc" 2>/dev/null; then
    :
  elif [ -f "$rc" ]; then
    printf '\n# Node.js (restTime install script)\n%s\n' "$PATH_LINE" >> "$rc"
  fi
done
# profile 없으면 생성
if [ ! -f "$HOME/.profile" ]; then
  printf '# Node.js\n%s\n' "$PATH_LINE" > "$HOME/.profile"
fi

export PATH="$HOME/.local/node/bin:$PATH"

echo "==> 설치 완료"
"$INSTALL_DIR/bin/node" -v
"$INSTALL_DIR/bin/npm" -v
echo ""
echo "새 SSH 세션 또는:  source ~/.profile"
echo "확인:  node -v && npm -v"
