#!/bin/sh
# Écrit dans sw.js un numéro de version qui change dès que le moindre fichier du site change.
# Le numéro vient des empreintes Git des fichiers (hors sw.js lui-même) : même contenu = même numéro.
cd "$(git rev-parse --show-toplevel)" || exit 1
V=$(git ls-files -s | grep -v ' sw\.js$' | shasum | cut -c1-10)
sed -i '' "s/^const VERSION = '.*';/const VERSION = '$V';/" sw.js
echo "sw.js : version $V"
