#!/bin/sh
# Synology NAS — 사용자 홈에 Node.js LTS 바이너리 설치 (패키지 센터 불필요)
# x64 / arm64 / ppc64le 지원. uname=ppc(빅엔디안) 구형 Synology 는 공식 Node 미지원.
# 사용: sh install-node-synology.sh
set -eu

NODE_VERSION="${NODE_VERSION:-v20.19.2}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/node}"

detect_node_arch() {
  RAW="$(uname -m)"
  case "$RAW" in
    x86_64|amd64) printf '%s' "linux-x64"; return 0 ;;
    aarch64|arm64) printf '%s' "linux-arm64"; return 0 ;;
    ppc64le|powerpc64le) printf '%s' "linux-ppc64le"; return 0 ;;
    ppc64)
      # 일부 환경은 ppc64le 을 ppc64 로 보고
      printf '%s' "linux-ppc64le"; return 0 ;;
    ppc|powerpc)
      if grep -qiE 'byte order.*little|ppc64le|ELFv2' /proc/cpuinfo 2>/dev/null; then
        printf '%s' "linux-ppc64le"; return 0
      fi
      if grep -qi 'ppc64' /proc/cpuinfo 2>/dev/null; then
        # 빅엔디안 ppc64 — Node 공식 tarball 없음
        return 1
      fi
      # 32-bit 또는 구형 big-endian PowerPC (Synology RS 시리즈 등)
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

if ! NODE_ARCH="$(detect_node_arch)"; then
  echo "지원하지 않는 CPU: $(uname -m)"
  echo ""
  echo "이 NAS 는 구형 PowerPC(ppc) 로 보입니다."
  echo "Node.js 공식 Linux 바이너리는 x64 / arm64 / ppc64le 만 제공합니다."
  echo "빅엔디안 ppc 에서는 NAS 에 Node 를 깔기 어렵습니다."
  echo ""
  echo "restTime 배포 (권장):"
  echo "  Mac 에서  npm run build"
  echo "  dist/ 내용만 NAS /volume2/web/resttime/ 등에 복사 (scp -P 2202 또는 SMB)"
  echo "  Web Station 으로 해당 폴더 서빙"
  echo ""
  echo "진단 (지원팀/본인 확인용):"
  echo "  uname -m"
  echo "  grep -i 'cpu\\|platform\\|endian' /proc/cpuinfo | head -5"
  if [ -r /etc/synoinfo.conf ]; then
    grep -E '^productversion|^upnpmodelname|^unique' /etc/synoinfo.conf 2>/dev/null || true
  fi
  exit 1
fi

TARBALL="node-${NODE_VERSION}-${NODE_ARCH}.tar.xz"
URL="https://nodejs.org/dist/${NODE_VERSION}/${TARBALL}"
TMP="${TMPDIR:-/tmp}/node-install-$$"

echo "==> Node ${NODE_VERSION} (${NODE_ARCH}, uname=$(uname -m)) → ${INSTALL_DIR}"

mkdir -p "$TMP"
cd "$TMP"

if command -v curl >/dev/null 2>&1; then
  if ! curl -fsSL "$URL" -o "$TARBALL"; then
    echo "다운로드 실패: $URL"
    echo "해당 아키텍처용 Node 배포판이 없을 수 있습니다."
    exit 1
  fi
elif command -v wget >/dev/null 2>&1; then
  if ! wget -qO "$TARBALL" "$URL"; then
    echo "다운로드 실패: $URL"
    exit 1
  fi
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
if [ ! -f "$HOME/.profile" ]; then
  printf '# Node.js\n%s\n' "$PATH_LINE" > "$HOME/.profile"
fi

export PATH="$HOME/.local/node/bin:$PATH"

echo "==> 설치 완료"
"$INSTALL_DIR/bin/node" -v
"$INSTALL_DIR/bin/npm" -v
echo ""
echo "새 SSH 세션 또는:  source ~/.profile"
