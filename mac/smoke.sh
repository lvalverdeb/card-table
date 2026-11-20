#!/bin/sh
# Builds the Mac app (Debug) and runs it in smoke mode: the page must load through the cardtable:// scheme,
# request its fonts, and report its title and saved-state keys. Exit status is the app's (0 = loaded).
set -e
cd "$(dirname "$0")/.."
npm run mac:gen >/dev/null
xcodebuild -project mac/CardTable.xcodeproj -scheme CardTable -configuration Debug -derivedDataPath mac/build/derived build -quiet
"mac/build/derived/Build/Products/Debug/Card Table.app/Contents/MacOS/Card Table" --smoke 2>/dev/null | grep smoke
