#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Generate copy-pastable Codex CLI commands to analyze Playwright screenshots.

Usage:
  scripts/plan-e2e-image-commands.sh [OPTIONS] [DIR ...]

Options:
  -b, --batch SIZE     Max images per command (default: 6)
  -m, --max N          Limit total images (default: 60)
  -p, --pattern GLOB   Filename glob (default: *.png)
  -P, --prompt TEXT    Prompt text to pass to codex (default provided)
  -o, --output FILE    Also write commands to FILE (makes it executable)
  -v, --verbose        Comment each batch with the image list
  -h, --help           Show this help

Notes:
  - If no DIR is given, defaults to ./test-results.
  - Commands look like: codex --image img1.png,img2.png "<prompt>"
  - No execution happens; this only prints or writes the commands.
USAGE
}

batch_size=6
max_images=60
pattern='*.png'
verbose=0
outfile=""
prompt='Spot any visual inconsistencies or UX issues in these E2E screenshots and summarize concise fixes.'

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--batch) batch_size=${2:-6}; shift 2;;
    -m|--max) max_images=${2:-60}; shift 2;;
    -p|--pattern) pattern=${2:-'*.png'}; shift 2;;
    -P|--prompt) prompt=${2:-}; shift 2;;
    -o|--output) outfile=${2:-}; shift 2;;
    -v|--verbose) verbose=1; shift;;
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

# Resolve to absolute path portably
abspath() {
  local p=$1
  if [[ -d "$p" ]]; then
    (cd "$p" && pwd)
  else
    local d; d=$(dirname "$p")
    local f; f=$(basename "$p")
    (cd "$d" && printf '%s/%s' "$(pwd)" "$f")
  fi
}

# Collect images
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

count=0
for d in "${dirs[@]}"; do
  if [[ -d "$d" ]]; then
    while IFS= read -r -d '' f; do
      printf '%s\n' "$(abspath "$f")" >> "$tmpfile"
      count=$((count+1))
      (( count >= max_images )) && break
    done < <(find "$d" -type f -name "$pattern" \( -ipath '*test-failed*' -o -ipath '*failed*' -o -true \) -print0)
  fi
  (( count >= max_images )) && break
done

if [[ ! -s "$tmpfile" ]]; then
  echo "# No images found with pattern '$pattern' in: ${dirs[*]}" >&2
  exit 1
fi

emit() {
  local line=$1
  if [[ -n "$outfile" ]]; then
    printf '%s\n' "$line" >> "$outfile"
  fi
  printf '%s\n' "$line"
}

if [[ -n "$outfile" ]]; then
  : > "$outfile"
  chmod +x "$outfile"
  emit "#!/usr/bin/env bash"
  emit "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  emit "set -euo pipefail"
  emit ""
fi

emit "# Codex interactive commands for E2E screenshot review"
emit "# Total images: $count | Batch size: $batch_size | Pattern: $pattern"
emit ""

batch=()
bnum=0
while IFS= read -r img; do
  batch+=("$img")
  if (( ${#batch[@]} >= batch_size )); then
    bnum=$((bnum+1))
    csv=$(printf '%s,' "${batch[@]}" | sed 's/,$//')
    if [[ $verbose -eq 1 ]]; then
      emit "# Batch $bnum (${#batch[@]} images)"
      for f in "${batch[@]}"; do emit "#  - $f"; done
    fi
    emit "codex --image \"$csv\" \"$prompt\""
    emit ""
    batch=()
  fi
done < "$tmpfile"

if (( ${#batch[@]} > 0 )); then
  bnum=$((bnum+1))
  csv=$(printf '%s,' "${batch[@]}" | sed 's/,$//')
  if [[ $verbose -eq 1 ]]; then
    emit "# Batch $bnum (${#batch[@]} images)"
    for f in "${batch[@]}"; do emit "#  - $f"; done
  fi
  emit "codex --image \"$csv\" \"$prompt\""
  emit ""
fi

if [[ -n "$outfile" ]]; then
  echo "# Wrote commands to: $outfile" >&2
fi

