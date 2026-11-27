#!/bin/bash
# Iteration 75's mutation ladder for the deep-link table (F14). The guard this pass ships is a table of bands plus a scan
# that refuses a link the table does not grade, and a table is exactly the shape of instrument that passes while grading
# nothing: iteration 71's matrix and iteration 67's starved anchor scan (F15) both reported clean lists over an empty
# population. So each leg breaks one property the table is supposed to detect, runs the two guard files that read a deep
# link, and asserts the specific message fires - not merely that the suite went red, which an unrelated breakage would
# also supply. Two defences against that: every mutated JavaScript file is parsed with `node --check` before it is
# graded, so a leg cannot go red on a syntax error the mutation happened to create, and every mutated leg must name a
# failing test whose title contains "deep link".
#
# The shipped no-mutation leg runs first and its pass count becomes the denominator the closing leg is compared against,
# because a ladder whose control is red measures nothing and a ladder that quietly loses a guard file measures less.
# Both mutated files are md5-compared to the copy the leg opened, and the driver exits 6 rather than print a verdict if
# any restore differs.
# L9's second marker reads "8 rows waited" because iteration 75 grew the table from six rows to eight; a marker that
# tracked a floor rather than the defect it names is how a control leg turns into a talisman, so the floor and the marker
# move together only when a row is added on purpose, which is what the floors below are for.
# Usage: bash scripts/controls-deep-links.sh
set -u
export PATH="/opt/homebrew/bin:/usr/sbin:/sbin:$PATH"
cd "$(dirname "$0")/.." || exit 9
S=artifacts/scratch/deep-link-controls
M=scripts/exact-mutate.mjs
A=tests/documentation-citation-anchors.test.js
C=tests/documentation-citations.test.js
D=docs/validation.md
SELF_PGID=$(ps -o pgid= -p $$ | tr -d ' ')
echo "CONTROL75 SELF_PGID=$SELF_PGID PARENT_PGID=$(ps -o pgid= -p $PPID 2>/dev/null | tr -d ' ') DETACHED=${CLOSE75_DETACHED:-unset}"
[ "${CLOSE75_DETACHED:-}" = "yes" ] || echo "CONTROL75 WARNING launch did not declare CLOSE75_DETACHED=yes; a harness reaper can kill this leg mid-run"
mkdir -p $S/ctrl
cp $A $S/ctrl/A.pristine; cp $D $S/ctrl/D.pristine
A0=$(md5 -q $A); D0=$(md5 -q $D)
echo "CONTROL75 start_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ) anchors_md5=$A0 validation_md5=$D0 interpreter=$(node -v) head=$(git rev-parse HEAD)"

# Tab-separated, because a JavaScript anchor contains `||` and the first draft of this table used `|` as the field
# separator: that leg mutated a truncated string, took the file down with a syntax error and still reported red, which
# is a leg that proves nothing but looks like a leg that proves something. Markers inside one field are `;`-separated -
# the second draft put a tab between them, and the row-count preflight below found five rows with seven fields, which is
# the reason the preflight exists.
{
printf 'CTRL-shipped\tNONE\t0\tNONE\tNONE\tNONE\n'
printf 'L1-coordinate-label\tdocs/validation.md\t1\t, where `allowEponymousTown` also holds once a region filters the town list]\t]\tnames no identifier the cited band contains\n'
printf 'L2-row-spliced\ttests/documentation-citation-anchors.test.js\t1\t[\x27docs/validation.md:1007\x27, {\t[\x27docs/validation.md:9007\x27, {\twhich no DEEP_LINKS row grades;has a DEEP_LINKS row but no labelled deep link\n'
printf 'L3-quote-off-band\ttests/documentation-citation-anchors.test.js\t1\tnamedRegions.length === 0 || Boolean(regionFilter);\tnamedRegions.length === 1 || Boolean(regionFilter);\tbut no line in that band reads\n'
printf 'L4-anchor-on-comment\ttests/documentation-citation-anchors.test.js\t1\tto: 420, anchor: 420,\tto: 420, anchor: 415,\tcarries none of the quoted rule;while the row requires\n'
printf 'L5-target-missing\tdocs/validation.md\t1\t(../public/js/modules/workflow-assistant.js#L420)\t(../public/js/modules/workflow-assistantx.js#L420)\twhich is not a tracked file;cannot be read\n'
printf 'L6-anchor-outside-band\tdocs/validation.md\t1\tworkflow-assistant.js#L420\tworkflow-assistant.js#L421\twhile the row requires;but its anchor lands on line 421\n'
printf 'L7-label-band-narrowed\tdocs/validation.md\t1\tworkflow-assistant.js:472-477, where\tworkflow-assistant.js:472-476, where\tis not the 472-477 the row grades\n'
printf 'L8-floor-raised\ttests/documentation-citation-anchors.test.js\t1\tlinks.length >= 8\tlinks.length >= 9\tthe deep-link scan saw 8 clickable pointers\n'
printf 'L9-scan-blind\ttests/documentation-citation-anchors.test.js\t1\tfor (const doc of await trackedFiles(\x27*.md\x27))\tfor (const doc of await trackedFiles(\x27docs/nothing-matches-this.md\x27))\tthe deep-link scan saw 0 clickable pointers;8 rows waited for them\n'
printf 'CTRL-restored\tNONE\t0\tNONE\tNONE\tNONE\n'
} > $S/ctrl/legs.tsv
FIELDS=$(awk -F'\t' 'NF!=6 {bad++} END {print bad+0}' $S/ctrl/legs.tsv)
echo "CONTROL75 LEGS_TSV lines=$(wc -l < $S/ctrl/legs.tsv | tr -d ' ') rows_not_6_fields=$FIELDS"
[ "$FIELDS" = 0 ] || { echo "CONTROL75_ABORTED legs.tsv is not tab-separated in every row"; exit 8; }

fail=0; legs=0; control_pass=unset
while IFS=$'\t' read -r name file count old new markers; do
  [ -n "$name" ] || continue
  legs=$((legs+1))
  cp $S/ctrl/A.pristine $A; cp $S/ctrl/D.pristine $D
  log=$S/ctrl/leg-$name.log
  : > "$log"
  parse=skipped
  if [ "$file" != "NONE" ]; then
    node "$M" "$file" "$count" "$old" "$new" >> "$log" 2>&1
    if [ $? -ne 0 ]; then echo "LEG $name MUTATION_REFUSED see $log"; fail=$((fail+1)); cat "$log"; continue; fi
    case "$file" in *.js) if node --check "$file" > "$log.check" 2>&1; then parse=ok; else parse=SYNTAX_ERROR; fi;; esac
  fi
  node --test $A $C >> "$log" 2>&1; rc=$?
  pass_now=$(grep -E "^ℹ pass" "$log" | awk '{print $3}')
  deep_fails=$(grep -cE "^✖ .*deep link" "$log")
  hits=0; total=0; missed=""
  if [ "$markers" != "NONE" ]; then
    IFS=';' read -r -a arr <<< "$markers"
    for m in "${arr[@]}"; do
      [ -n "$m" ] || continue
      total=$((total+1))
      if grep -qF -- "$m" "$log"; then hits=$((hits+1)); else missed="$missed |$m"; fi
    done
  fi
  cp $A $S/ctrl/leg-$name.anchors; cp $D $S/ctrl/leg-$name.validation
  verdict=PASS
  case "$name" in
    CTRL-shipped)
      [ "$rc" = "0" ] || verdict=FAIL
      [ -n "$pass_now" ] || verdict=FAIL
      control_pass=$pass_now;;
    CTRL-restored)
      [ "$rc" = "0" ] || verdict=FAIL
      [ "$pass_now" = "$control_pass" ] || verdict=FAIL;;
    *)
      [ "$rc" != "0" ] || verdict=FAIL
      # `skipped` is the state for a markdown file, which has no parser to ask; only a JavaScript leg that will not
      # compile is an invalid leg. The first draft required `ok` here and called its four prose legs INVALID on a tree
      # where every message had in fact fired.
      [ "$parse" != SYNTAX_ERROR ] || verdict=INVALID
      [ "$hits" = "$total" ] && [ "$total" -ge 1 ] || verdict=FAIL
      [ "$deep_fails" -ge 1 ] || verdict=FAIL;;
  esac
  [ "$verdict" = PASS ] || fail=$((fail+1))
  echo "LEG $name file=$file parse=$parse rc=$rc pass_lines=$pass_now control=$control_pass deep_link_failures=$deep_fails markers=$hits/$total missed:${missed:-none} anchors_md5=$(md5 -q $A) verdict=$verdict"
done < $S/ctrl/legs.tsv

cp $S/ctrl/A.pristine $A; cp $S/ctrl/D.pristine $D
A1=$(md5 -q $A); D1=$(md5 -q $D)
[ "$A0" = "$A1" ] && [ "$D0" = "$D1" ] && SAME=yes || SAME=NO
echo "CONTROLS75_FINAL anchors=$A1 validation=$D1 SAME=$SAME legs=$legs failed=$fail control_pass=$control_pass"
echo "CONTROLS75_DONE_UTC $(date -u +%Y-%m-%dT%H:%M:%SZ)"
[ "$SAME" = yes ] || { echo "CONTROLS75_ABORTED a mutated file was not delivered back byte-identical"; exit 6; }
[ "$fail" = 0 ] || { echo "CONTROLS75_FAILED $fail of $legs legs did not produce the message their mutation should force"; exit 7; }
