#!/usr/bin/env bash
# Legt die Workflow-Labels an (idempotent). Aufruf: scripts/setup-labels.sh [owner/repo]
set -euo pipefail
REPO="${1:-mgritsch04/fitness-coach}"

label() { # name farbe beschreibung
  gh api "repos/$REPO/labels" -f name="$1" -f color="$2" -f description="$3" >/dev/null 2>&1 \
    || gh api -X PATCH "repos/$REPO/labels/$(printf %s "$1" | jq -sRr @uri)" -f color="$2" -f description="$3" >/dev/null
  echo "ok: $1"
}

label "idea-inbox"     "c5def5" "Neue Idee, noch nicht übernommen"
label "planned"        "bfd4f2" "In docs/IDEAS.md aufgenommen"
label "in-progress"    "fbca04" "Wird umgesetzt"
label "user-test"      "0e8a16" "[USERTEST]: manuelle Prüfung durch den Nutzer offen"
label "needs-fix"      "d93f0b" "User-Test fehlgeschlagen"
label "done"           "ededed" "Vollständig abgeschlossen"
label "user-task"      "5319e7" "[AUFGABE]: Claude braucht etwas vom Nutzer"
label "priority: high" "b60205" "Blocker oder dringend"
label "info"           "1d76db" "Erledigt, enthält wichtige Info – Nutzer schließt"
label "blocked"        "000000" "Blockiert"
label "area: whoop"    "f9d0c4" "WHOOP-Anbindung"
label "area: wahoo"    "f9d0c4" "Wahoo-Anbindung"
label "area: mywhoosh" "f9d0c4" "MyWhoosh (FIT-Upload)"
label "area: dashboard" "f9d0c4" "Dashboard"
label "area: coach"    "f9d0c4" "Trainingscoach"
