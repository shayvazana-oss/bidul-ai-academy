#!/bin/bash
# SessionStart hook: install the Agent Reach CLI and its zero-config
# upstream tools so the agent-reach skill works in Claude Code cloud sessions.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi

log() { echo "[agent-reach hook] $*"; }

# 1. agent-reach CLI (git URL: the proxy blocks GitHub archive downloads)
if ! command -v agent-reach >/dev/null 2>&1; then
  log "installing agent-reach CLI"
  uv tool install "git+https://github.com/Panniantong/agent-reach.git" 2>&1 | grep -v UV_NATIVE_TLS | tail -1 \
    || log "WARN: agent-reach install failed"
fi

# 2. yt-dlp (YouTube transcripts)
if ! command -v yt-dlp >/dev/null 2>&1; then
  log "installing yt-dlp"
  uv tool install "yt-dlp[default]" 2>&1 | grep -v UV_NATIVE_TLS | tail -1 \
    || log "WARN: yt-dlp install failed"
fi

# yt-dlp needs a JS runtime for YouTube; node is preinstalled in cloud sessions
mkdir -p "$HOME/.config/yt-dlp"
grep -qxF -- '--js-runtimes node' "$HOME/.config/yt-dlp/config" 2>/dev/null \
  || printf '%s\n' '--js-runtimes node' >> "$HOME/.config/yt-dlp/config"

# 3. mcporter + Exa MCP (semantic web search)
if ! command -v mcporter >/dev/null 2>&1; then
  log "installing mcporter"
  npm install -g mcporter >/dev/null 2>&1 || log "WARN: mcporter install failed"
fi
if command -v mcporter >/dev/null 2>&1 && ! mcporter config list --scope home 2>/dev/null | grep -qi 'exa'; then
  mcporter config add exa https://mcp.exa.ai/mcp --scope home >/dev/null 2>&1 \
    || log "WARN: exa MCP registration failed"
fi

if command -v agent-reach >/dev/null 2>&1; then
  agent-reach install --env=auto 2>&1 | tail -3
fi

# 4. impeccable skill: pre-fetch its engine binary (downloaded on first run)
IMP="${CLAUDE_PROJECT_DIR:-$PWD}/.agents/skills/impeccable/scripts/impeccable"
if [ -x "$IMP" ] && [ ! -d "$HOME/.impeccable/bin" ]; then
  log "fetching impeccable engine"
  timeout 120 "$IMP" context >/dev/null 2>&1 || log "WARN: impeccable engine fetch failed"
fi
exit 0
