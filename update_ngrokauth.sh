#!/bin/bash
cp -f lib/ngrokauth.js lib/ngrokauth.js.orig
grep -En ' error [0-9]+\.")); //__LINE__$' lib/ngrokauth.js | \
  sed -re 's/^([0-9]+):.* error ([0-9]+)\."\)\); \/\/__LINE__$/\1 s@( error )([0-9]+)(.*)@\\1\1\\3@/' | \
  sed -rf - -i lib/ngrokauth.js
colordiff -su lib/ngrokauth.js.orig lib/ngrokauth.js
