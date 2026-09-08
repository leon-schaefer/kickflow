#!/usr/bin/env bash
#
# Schützt `main` und `develop` gegen Löschen.
#
# Der Anlass ist passiert, nicht theoretisch: GitHubs "Automatically delete
# head branches" löscht nach einem Merge den Head-Branch des Pull Requests.
# Bei Feature-Branches ist das gewünscht — bei PR #22 (develop -> main) war
# der Head aber `develop`, und der ist damit weg. Beide Workflows filtern
# weiter auf PRs gegen develop und main (.github/workflows/pr.yml,
# vercel-qr.yml), der Branch dahinter existierte danach nicht mehr.
#
# Warum genau diese zwei: `main` ist der Default-Branch und damit das, was
# Vercel nach Production deployt — Production gegen Preview leitet Vercel aus
# dem Default-Branch ab. `develop` ist der Integrationsbranch, aus dem heraus
# nach `main` gemerged wird. Feature-Branches hängen darunter und sind
# Wegwerfware, für die das automatische Löschen genau richtig ist.
#
# Ein Branch, der gegen Löschen geschützt ist, wird von der Automatik
# übersprungen. Das Aufräumen der Feature-Branches bleibt also an, nur
# develop und main sind ausgenommen — deshalb ein Ruleset und nicht der
# Repo-Schalter.
#
# Erzwingen lässt sich das nur GitHub-seitig, nicht im Repository: dieses
# Skript schreibt das Ruleset aus .github/rulesets/protected-branches.json
# über die API. Das JSON ist die Quelle, das Skript nur der Weg dorthin —
# Änderungen gehören in die Datei, dann Skript erneut laufen lassen.
#
# Fehlt einer der beiden Branches trotzdem einmal, ist er nicht verloren,
# solange der Commit noch über `main` erreichbar ist:
#
#   git push origin <sha>:refs/heads/develop
#
# Voraussetzungen: gh (eingeloggt, Admin-Rechte auf dem Repo) und jq. Rulesets
# auf einem *privaten* Repo brauchen mindestens GitHub Pro; auf Free werden
# sie angelegt, aber nicht durchgesetzt. Dann bleibt --disable-auto-delete.
#
#   scripts/protect-branches.sh                       # anlegen/aktualisieren
#   scripts/protect-branches.sh --check               # nur berichten
#   scripts/protect-branches.sh --disable-auto-delete # Fallback ohne Pro
#
set -euo pipefail

RULESET_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.github/rulesets/protected-branches.json"

for tool in gh jq; do
  command -v "$tool" >/dev/null || { echo "Fehlt: $tool" >&2; exit 1; }
done

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
NAME="$(jq -r .name "$RULESET_FILE")"

# Rulesets lesen setzt Admin-Rechte voraus. Ohne die kommt ein 403, und das
# ist die eigentliche Antwort — nicht ein leeres Ergebnis.
ruleset_id() {
  local list
  list="$(gh api "repos/$REPO/rulesets" 2>&1)" || {
    echo "Rulesets von $REPO nicht lesbar — Admin-Rechte nötig:" >&2
    echo "$list" >&2
    exit 1
  }
  jq -r --arg name "$NAME" 'map(select(.name == $name)) | .[0].id // empty' <<<"$list"
}

report() {
  local id rules auto_delete branch
  auto_delete="$(gh api "repos/$REPO" --jq '.delete_branch_on_merge')"
  echo "$REPO"
  echo "  Head-Branch nach Merge automatisch löschen: $auto_delete"

  id="$(ruleset_id)"
  if [ -z "$id" ]; then
    echo "  Kein Ruleset \"$NAME\" — main und develop sind löschbar."
  else
    rules="$(gh api "repos/$REPO/rulesets/$id")"
    jq -r '
      "  Ruleset \"\(.name)\" (id \(.id))",
      "    Enforcement: \(.enforcement)",
      "    Branches:    \(.conditions.ref_name.include | join(", "))",
      "    Regeln:      \([.rules[].type] | join(", "))",
      "    Bypass:      \(if (.bypass_actors | length) == 0 then "niemand" else ([.bypass_actors[].actor_type] | join(", ")) end)"
    ' <<<"$rules"
    jq -e '[.rules[].type] | index("deletion")' >/dev/null <<<"$rules" \
      || echo "    WARNUNG: keine deletion-Regel — Löschen ist nicht blockiert."
  fi

  # Ein Ruleset auf einen Branch, den es nicht gibt, schützt nichts. Nach dem
  # Unfall mit #22 war genau das der Zustand, deshalb steht es im Report.
  for branch in $(jq -r '.conditions.ref_name.include[] | sub("^refs/heads/"; "")' "$RULESET_FILE"); do
    gh api "repos/$REPO/branches/$branch" --silent 2>/dev/null \
      || echo "  WARNUNG: Branch \"$branch\" existiert nicht."
  done
}

case "${1:-}" in
  --check)
    report
    exit 0
    ;;
  --disable-auto-delete)
    # Fallback, wenn Rulesets nicht durchgesetzt werden: dann bleiben auch die
    # Feature-Branches nach dem Merge stehen. Weniger Aufräumen gegen einen
    # verlorenen develop-Branch ist der bessere Tausch.
    gh api -X PATCH "repos/$REPO" -F delete_branch_on_merge=false >/dev/null
    echo "Automatisches Löschen von Head-Branches auf $REPO aus."
    report
    exit 0
    ;;
  "") ;;
  *)
    echo "Unbekannte Option: $1" >&2
    exit 1
    ;;
esac

id="$(ruleset_id)"
if [ -n "$id" ]; then
  # PUT ersetzt das Ruleset komplett. Erwünscht: das JSON im Repo soll
  # gewinnen, auch wenn jemand in der UI daran gedreht hat.
  gh api -X PUT "repos/$REPO/rulesets/$id" --input "$RULESET_FILE" >/dev/null
  echo "Ruleset \"$NAME\" aktualisiert."
else
  gh api -X POST "repos/$REPO/rulesets" --input "$RULESET_FILE" >/dev/null
  echo "Ruleset \"$NAME\" angelegt."
fi

report
