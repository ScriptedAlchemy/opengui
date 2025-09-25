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
  -o, --output FILE   Append AI output to FILE (default: e2e-image-analysis-<ts>.log)
  -n, --dry-run       Print codex commands without executing
  -q, --quiet         Suppress codex output (still runs)
  -v, --verbose       Extra progress logging (batches, filenames)
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
verbose=0
outfile=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--batch) batch_size=${2:-6}; shift 2;;
    -m|--max) max_images=${2:-60}; shift 2;;
    -p|--pattern) pattern=${2:-'*.png'}; shift 2;;
    -o|--output) outfile=${2:-}; shift 2;;
    -n|--dry-run) dry_run=1; shift;;
    -q|--quiet) quiet=1; shift;;
    -v|--verbose) verbose=1; shift;;
    -h|--help) usage; exit 0;;
    --) shift; break;;
    -*) echo "Unknown option: $1" >&2; usage; exit 2;;
    *) break;;
  esac
done

dirs=("$@")
## Ensure output file is initialized early for logging
if [[ -z "$outfile" ]]; then
  ts=$(date +%Y%m%d-%H%M%S)
  outfile="e2e-image-analysis-$ts.log"
fi
if [[ ${#dirs[@]} -eq 0 ]]; then
  dirs=("./test-results")
fi

# Resolve codex binary
CODEX_BIN_ENV=${CODEX_BIN:-}
if [[ -n "$CODEX_BIN_ENV" && -x "$CODEX_BIN_ENV" ]]; then
  CODEX_BIN="$CODEX_BIN_ENV"
else
  CODEX_BIN=$(command -v codex 2>/dev/null || true)
fi

if [[ -z "${CODEX_BIN:-}" ]]; then
  echo "codex CLI not found on PATH. Install it, or set CODEX_BIN=/absolute/path/to/codex, or use --dry-run." >&2
  if [[ $dry_run -eq 0 ]]; then
    exit 127
  fi
else
  if [[ $verbose -eq 1 ]]; then echo "Using codex at: $CODEX_BIN" | tee -a "$outfile"; fi
fi

# Favor non-interactive, auto-approve execution
export CODEX_APPROVAL=${CODEX_APPROVAL:-never}
export CODEX_AUTOMATION=${CODEX_AUTOMATION:-1}
common_args=(exec --full-auto)

prompt='You are in non-interactive batch analysis mode. IMPORTANT: Do NOT run shell commands, open files, or modify anything. ONLY analyze the provided screenshots and return concise bullet points. Task: Spot visual inconsistencies, errors, and UX issues in these E2E screenshots. Name specific UI elements, likely causes (e.g., overlays intercepting clicks, missing data, layout shifts), and practical fixes. Keep it focused and short.'

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
echo "# E2E image analysis" | tee -a "$outfile" >/dev/null
echo "# Directories: ${dirs[*]}" | tee -a "$outfile" >/dev/null
echo "# Images: $count | Batch: $batch_size | Pattern: $pattern" | tee -a "$outfile" >/dev/null

batch=()
idx=0
bnum=0
while IFS= read -r img; do
  batch+=("$img")
  if (( ${#batch[@]} >= batch_size )); then
    imgs_csv=$(printf '%s,' "${batch[@]}" | sed 's/,$//')
    cmd=("$CODEX_BIN" "${common_args[@]}" --image "$imgs_csv")
    bnum=$((bnum+1))
    echo; echo "=== Batch $bnum (${#batch[@]} images) ===" | tee -a "$outfile"
    if [[ $verbose -eq 1 ]]; then printf ' - %s\n' "${batch[@]}" | tee -a "$outfile"; fi
    echo "-> ${cmd[*]}" | tee -a "$outfile"
    if [[ $dry_run -eq 0 ]]; then
      if [[ $quiet -eq 1 ]]; then
        printf '%s' "$prompt" | "${cmd[@]}" 2>&1 | tee -a "$outfile" >/dev/null || true
      else
        printf '%s' "$prompt" | "${cmd[@]}" 2>&1 | tee -a "$outfile" || true
      fi
    fi
    batch=()
  fi
  idx=$((idx+1))
done < "$tmpfile"

if (( ${#batch[@]} > 0 )); then
  imgs_csv=$(printf '%s,' "${batch[@]}" | sed 's/,$//')
  cmd=("$CODEX_BIN" "${common_args[@]}" --image "$imgs_csv")
  bnum=$((bnum+1))
  echo; echo "=== Batch $bnum (${#batch[@]} images) ===" | tee -a "$outfile"
  if [[ $verbose -eq 1 ]]; then printf ' - %s\n' "${batch[@]}" | tee -a "$outfile"; fi
  echo "-> ${cmd[*]}  # prompt via stdin" | tee -a "$outfile"
  if [[ $dry_run -eq 0 ]]; then
    if [[ $quiet -eq 1 ]]; then
      printf '%s' "$prompt" | "${cmd[@]}" 2>&1 | tee -a "$outfile" >/dev/null || true
    else
      printf '%s' "$prompt" | "${cmd[@]}" 2>&1 | tee -a "$outfile" || true
    fi
  fi
fi

echo; echo "Done. Processed $idx image(s). Output logged to: $outfile" | tee -a "$outfile"
