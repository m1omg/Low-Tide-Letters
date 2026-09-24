#!/usr/bin/env sh
# Starts the local server and opens the game in the default browser.
# Without Node.js the game still runs straight from the file (music then loops through <audio>).
cd "$(dirname "$0")" || exit 1

if command -v node >/dev/null 2>&1; then
  exec node serve.js --open "$@"
fi

echo "Node.js was not found - opening index.html directly instead."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "index.html"
elif command -v open >/dev/null 2>&1; then
  open "index.html"
else
  echo "Please open $(pwd)/index.html in your browser."
fi
