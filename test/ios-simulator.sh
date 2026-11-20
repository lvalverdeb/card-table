#!/bin/zsh
# Builds the iOS app for the simulator, installs it fresh on an iPhone 17 simulator, launches it and
# saves a screenshot. Optional second argument sets the device language first (e.g. es-MX, fr-FR).
# Usage: test/ios-simulator.sh [screenshot.png] [language]
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd); OUT=${1:-$ROOT/test/screenshots/14-ios-menu.png}; LANG_TAG=${2:-}
APP=com.lvalverdeb.cardtable; BUILD=${TMPDIR:-/tmp}/cardtable-ios-build
U=$(xcrun simctl list devices available | grep -E "iPhone 17 \(" | head -1 | grep -oE '[0-9A-F-]{36}')
[ -z "$U" ] && { echo "no iPhone 17 simulator found; create one in Xcode > Window > Devices and Simulators"; exit 1; }
xcodebuild -project "$ROOT/ios/App/App.xcodeproj" -scheme App -configuration Debug -destination "id=$U" -derivedDataPath "$BUILD" build 2>&1 | grep -E "BUILD SUCCEEDED|BUILD FAILED|error:" | head -3
xcrun simctl boot "$U" 2>/dev/null; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1
xcrun simctl uninstall "$U" $APP 2>/dev/null   # a fresh install so no saved language or game carries over
if [ -n "$LANG_TAG" ]; then
  # defaults need a booted simulator to write, and a restart to apply
  xcrun simctl spawn "$U" defaults write "Apple Global Domain" AppleLanguages -array "$LANG_TAG"
  xcrun simctl shutdown "$U" >/dev/null; xcrun simctl boot "$U"; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1; sleep 3
  echo "device language: $LANG_TAG"
fi
xcrun simctl install "$U" "$BUILD/Build/Products/Debug-iphonesimulator/App.app" && echo installed
xcrun simctl launch "$U" $APP >/dev/null
sleep 9   # the first seconds show only the splash colour
xcrun simctl io "$U" screenshot "$OUT" >/dev/null 2>&1 && echo "screenshot: $OUT"
echo "the simulator stays up; stop it with: xcrun simctl shutdown $U"
