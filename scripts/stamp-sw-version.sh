#!/bin/sh
# Écrit dans sw.js un numéro de version qui change dès que le moindre fichier du site change.
# Le numéro vient des empreintes Git des fichiers (hors sw.js lui-même) : même contenu = même numéro.
# Lancé automatiquement par .github/workflows/pages.yml à chaque publication sur main.
# Fonctionne sur Mac et sur Linux (GitHub).
cd "$(git rev-parse --show-toplevel)" || exit 1
V=$(git ls-files -s | grep -v ' sw\.js$' | shasum | cut -c1-10)
sed -i.bak "s/^const VERSION = '.*';/const VERSION = '$V';/" sw.js && rm -f sw.js.bak
echo "sw.js : version $V"
