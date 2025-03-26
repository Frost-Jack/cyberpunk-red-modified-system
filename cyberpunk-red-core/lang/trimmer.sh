#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

langfile="en.json"

strings=$(grep CPR "${langfile}" | awk -F "\"" '{print $2}')
for str in ${strings}; do
  if ! grep -rq --exclude="${langfile}" --exclude-dir=node_modules "${str}" ../*; then
    sed -i /"${str}"/d "${langfile}"
  fi
done
echo "Trimming done."
