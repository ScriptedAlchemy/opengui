#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Analyze Playwright E2E screenshots with codex CLI.

Usage:
  scripts/analyze-e2e-images.sh [OPTIONS] [DIR ...]

Options:
  -b, --batch SIZE    Max images per codex call (default: 6)
  -m, --max N         Limit total images processed (default: 60)
  -p, --pattern GLOB  Filename glob (default: *.png)
  -n, --dry-run       Print codex commands without executing
  -q, --quiet         Suppress codex output (still runs)
  -h, --help          Show this help

Notes:
  - If no DIR is provided, defaults to ./test-results
  - Requires the 'codex' CLI on PATH (https://github.com/openai/codex-cli)
  - Images are batched and passed via: codex --image img1,img2,... "<prompt>"
USAGE
}

batch_size=6
max_images=60
pattern='*.png'
dry_run=0
quiet=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--batch) batch_size=${2:-6}; shift 2;;
    -m|--max) max_images=${2:-60}; shift 2;;
    -p|--pattern) pattern=${2:-'*.png'}; shift 2;;
    -n|--dry-run) dry_run=1; shift;;
    -q|--quiet) quiet=1; shift;;
    -h|--help) usage; exit 0;;
    --) shift; break;;
    -*) echo "Unknown option: $1" >&2; usage; exit 2;;
    *) break;;
  esac
done

dirs=("$@")
if [[ ${#dirs[@]} -eq 0 ]]; then
  dirs=("./test-results")
fi

# Verify codex availability
if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found on PATH. Install it or use --dry-run." >&2
  if [[ $dry_run -eq 0 ]]; then
    exit 127
  fi
fi

prompt='Spot any visual inconsistencies, errors, or UX issues in these E2E screenshots. Describe specific UI elements involved, likely root causes (e.g., overlays intercepting clicks, missing data, layout shifts), and suggested fixes. Be concise, bullet points OK.'

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# Collect images
count=0
for d in "${dirs[@]}"; do
  if [[ -d "$d" ]]; then
    # Use find for robustness, sort for stable order, prefer failed screenshots first
    while IFS= read -r -d '' f; do
      printf '%s\n' "$f" >> "$tmpfile"
      count=$((count+1))
      (( count >= max_images )) && break
    done < <(find "$d" -type f -name "$pattern" \( -ipath '*test-failed*' -o -ipath '*failed*' -o -true \) -print0 | sort -z)
  fi
  (( count >= max_images )) && break
done

if [[ ! -s "$tmpfile" ]]; then
  echo "No images found with pattern '$pattern' in: ${dirs[*]}" >&2
  exit 1
fi

# Run in batches
batch=()
idx=0
while IFS= read -r img; do
  batch+=("$img")
  if (( ${#batch[@]} >= batch_size )); then
    imgs_csv=$(printf '%s,' "${batch[@]}" | sed 's/,$//')
    cmd=(codex --image "$imgs_csv" "$prompt")
    echo "-> ${cmd[*]}"
    if [[ $dry_run -eq 0 ]]; then
      if [[ $quiet -eq 1 ]]; then
        "${cmd[@]}" >/dev/null || true
      else
        "${cmd[@]}" || true
      fi
    fi
    batch=()
  fi
  idx=$((idx+1))
done < "$tmpfile"

if (( ${#batch[@]} > 0 )); then
  imgs_csv=$(printf '%s,' "${batch[@]}" | sed 's/,$//')
  cmd=(codex --image "$imgs_csv" "$prompt")
  echo "-> ${cmd[*]}"
  if [[ $dry_run -eq 0 ]]; then
    if [[ $quiet -eq 1 ]]; then
      "${cmd[@]}" >/dev/null || true
    else
      "${cmd[@]}" || true
    fi
  fi
fi

echo "Done. Processed $idx image(s)." 

