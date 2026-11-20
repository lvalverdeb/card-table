#!/bin/zsh
# Boots a headless Android emulator, installs the release APK, launches it and saves a screenshot.
# Needs the SDK at ~/Library/Android/sdk with cmdline-tools, emulator and an API 36 arm64 system image
# (see BUILD_GUIDE.md, Packaging). Usage: test/android-emulator.sh [screenshot.png]
set -u
export ANDROID_HOME=$HOME/Library/Android/sdk JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}
ROOT=$(cd "$(dirname "$0")/.." && pwd); OUT=${1:-$ROOT/test/screenshots/11-android-menu.png}
ADB=$ANDROID_HOME/platform-tools/adb; AVDM=$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager
APK=$ROOT/android/app/build/outputs/apk/release/app-release.apk
IMG=$(ls -d $ANDROID_HOME/system-images/android-36/*/arm64-v8a 2>/dev/null | head -1); IMG="system-images;android-36;$(basename $(dirname $IMG));arm64-v8a"
if ! $AVDM list avd 2>/dev/null | grep -q "Name: cardtable"; then
  echo no | $AVDM create avd -n cardtable -k "$IMG" -d pixel_7 >/dev/null 2>&1 && echo "created the cardtable virtual device"
fi
$ADB start-server >/dev/null 2>&1
nohup $ANDROID_HOME/emulator/emulator -avd cardtable -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > /dev/null 2>&1 &
$ADB wait-for-device
for i in {1..120}; do [ "$($ADB shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break; sleep 2; done
echo "booted after ~$((i*2))s"
$ADB install -r "$APK" | tail -1
$ADB shell am start -n com.lvalverdeb.card_table/com.lvalverdeb.cardtable.MainActivity > /dev/null
sleep 7
$ADB exec-out screencap -p > "$OUT" && echo "screenshot: $OUT"
echo "the emulator stays up for manual checks; stop it with: $ADB emu kill"
