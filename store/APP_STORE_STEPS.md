# Publishing Card Table to the App Store

Apple's process has fewer forms than Google's but needs a paid membership and a Mac with Xcode. Budget a day or two for enrolment and one to three days for the first review.

## What is ready

| Item | Where |
|---|---|
| iOS project, bundle id `com.lvalverdeb.cardtable`, version 1.0 build 1, iOS 14 and later, iPhone and iPad | `ios/App/App.xcodeproj` |
| App icon (1024 × 1024, in the asset catalog) and splash | `ios/App/App/Assets.xcassets` |
| Screenshots, one named set per App Store Connect slot, in `store/apple/screenshots/{en,es,fr}/`: | |
| · iPhone with Dynamic Island (medium display), 1206 × 2622, **required**, seven shots | `iphone-dynamic-island-medium-*.png` |
| · iPhone with Dynamic Island (large display), 1320 × 2868, seven shots | `iphone-dynamic-island-large-*.png` |
| · iPhone with Face ID (large display), 1284 × 2778, three shots | `iphone-face-id-large-*.png` |
| · iPhone Duo inner display, 2007 × 2853, and outer display, 1398 × 2034, three shots each (optional until April 2027) | `iphone-duo-inner-*.png`, `iphone-duo-outer-*.png` |
| · iPad 13" display, 2064 × 2752, **required**, three shots | `ipad-13-*.png` |
| Mac App Store screenshots, 2880 × 1800 landscape, seven per language, from `node store-screenshots.js --mac`, for the macOS version served by the native Mac app in `mac/` | `store/apple/mac/screenshots/{en,es,fr}/mac-*.png` |
| iPad 13-inch screenshots, 2064 × 2752, three per language | `store/apple/screenshots/{en,es,fr}/ipad-13-*.png` |
| Listing text in English, Spanish and French (same copy as Google Play; Apple's limits are 30 characters for the name, 30 for the subtitle, 170 for the promotional text, 4000 for the description) | `store/listing-en.md`, `listing-es.md`, `listing-fr.md` |
| Privacy policy URL | https://lvalverdeb.github.io/card-table/store/privacy-policy.html |
| Support URL | https://github.com/lvalverdeb/card-table |
| Header and search results asset (optional, iOS 27 product pages): universal 16:9 PNG, 5244 × 2950, with the artwork inside the area both crops keep; regenerate with `cd test && node store-header.js` | `store/apple/graphics/universal-header-5244x2950.png` |
| Export compliance | `ITSAppUsesNonExemptEncryption` is `false` in `Info.plist`, so App Store Connect does not ask about encryption for each build |

Regenerate the screenshots after any visual change with `cd test && node store-screenshots.js --apple`.

## 1. Join the Apple Developer Program

1. Go to https://developer.apple.com/programs/enroll/ and sign in with the Apple ID you use in Xcode.
2. Enrol as an **Individual**. The fee is 99 USD per year. Apple verifies your identity, sometimes with a phone call or an ID upload; the confirmation email can take up to two days.
3. In Xcode, open Settings > Accounts and confirm the Apple ID now shows a team that is **not** marked "Personal Team". Only a paid team can upload to App Store Connect.

## 2. Create the app record

1. Go to https://appstoreconnect.apple.com, open **Apps**, and click **+** > **New App**.
2. Platform iOS. Name `Card Table: Six Games`. Primary language English (U.S.). Bundle ID: choose `com.lvalverdeb.cardtable` (register it first at https://developer.apple.com/account/resources/identifiers if it is not in the list; no capabilities are needed). SKU: `cardtable`. User access: Full access.

## 3. Upload the build

From the project folder:

```
npm run sync
cd ios/App
xcodebuild -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/CardTable.xcarchive -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/CardTable.xcarchive -exportOptionsPlist ../../store/apple/export-appstore.plist -exportPath build/export -allowProvisioningUpdates
```

The export both signs with your distribution certificate (Xcode creates it on first use) and uploads to App Store Connect. The build appears under the app's **TestFlight** tab ten to thirty minutes later, after Apple's processing.

The same can be done in Xcode: Product > Archive, then **Distribute App** > **App Store Connect** > Upload.

## 3b. The macOS version

The app record also has a macOS version, served by the native Mac app in `mac/` (same bundle identifier, so it is the same App Store record and a universal purchase). Build and upload it with:

```
npm run mac:gen
xcodebuild -project mac/CardTable.xcodeproj -scheme CardTable -configuration Release -destination 'generic/platform=macOS' -archivePath mac/build/CardTable.xcarchive -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath mac/build/CardTable.xcarchive -exportOptionsPlist mac/export-appstore.plist -exportPath mac/build/export -allowProvisioningUpdates
```

Before uploading, `mac/smoke.sh` should print a `smoke: loaded:` line with the page title. Each upload needs a higher `CURRENT_PROJECT_VERSION` in `mac/project.yml` (Mac build numbers are separate from iOS). On the macOS version page use the screenshots in `store/apple/mac/screenshots/{en,es,fr}` (2880 × 1800), the same descriptions and keywords, and the same App Privacy answers. The build appears under the macOS version's Build section after processing.

## 4. Fill in the App Store listing

Open the app in App Store Connect and work down the **1.0 Prepare for Submission** page:

- **Screenshots**: App Store Connect labels the slots by device family, and the first one shown is **iPhone Duo**, which is optional. Each slot accepts only its own pixel sizes, and a file dropped into the wrong one fails with "File dimensions are invalid". Read the slot's label, then drag the files whose name prefix matches it: `iphone-dynamic-island-medium-*` into **iPhone with Dynamic Island (medium display)**, the required slot; `ipad-13-*` into **iPad 13-inch display**, also required; the other prefixes into their slots if you want them. Apple scales the required sets for every other device.
- **Promotional text** (optional, 170 characters): "Six classic card games, fully offline, with no ads and no accounts."
- **Description**: the full description from `listing-en.md`. **Keywords** (100 characters): `solitaire,klondike,freecell,rummy,hearts,crazy eights,sevens,card games,offline`.
- **Support URL**: the GitHub repository. **Marketing URL** (optional): https://lvalverdeb.github.io/card-table/
- **Build**: select the uploaded build.
- **App Review information**: your name, phone and email; no sign-in required; notes can say "Fully offline card games; nothing to configure."
- **Version release**: automatically release after approval, or manual.
- **Header and Search Results** tab (optional): upload `store/apple/graphics/universal-header-5244x2950.png` as the product page header and tick the option to use it in search results too. Use the preview to confirm the title and cards stay inside the safe area in both placements. Without it, the App Store shows the screenshots as before.
- **Localisations**: use the language menu at the top right of the page to add Spanish (Mexico) and French, paste from `listing-es.md` and `listing-fr.md`, and drag the matching screenshot folders.

Then the app-level sections in the left column:

- **App Information**: subtitle `Six classic card games` (30 characters max), category Games, secondary category Card. Content rights: does not contain third-party content. Age rating: answer None to everything; Vegas scoring is simulated with nothing to buy, which Apple's "Simulated gambling" question does not count unless real currency or purchases are involved. Expect 4+.
- **Pricing and Availability**: Free, all countries.
- **App Privacy**: privacy policy URL as above; click **Get started** and choose **Data Not Collected**. Confirm. The listing then shows the "Data Not Collected" label.

## 5. Submit

Click **Add for Review**, then **Submit to App Review**. Apple normally answers within one to three days. If rejected, the reasons appear in **App Review** messages; most first-submission issues are missing metadata, which can be fixed and resubmitted without a new build.

## Updating later

Raise `MARKETING_VERSION` (the version people see) and `CURRENT_PROJECT_VERSION` (the build number, which must increase for every upload) in Xcode under the App target's General tab, or in `ios/App/App.xcodeproj/project.pbxproj`. Then repeat step 3 and create a new version in App Store Connect.
