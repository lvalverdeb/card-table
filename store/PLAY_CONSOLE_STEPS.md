# Publishing Card Table to Google Play

Everything the Play Console asks for is in this folder. The steps below follow the console's own order. Budget a few days for identity verification and, for a new personal account, 14 days of closed testing before production is unlocked.

## What is ready

| Item | Where |
|---|---|
| Signed release bundle (versionCode 1, versionName 1.0, target API 36, min API 24) | `android/app/build/outputs/bundle/release/app-release.aab` |
| App icon, 512 × 512 PNG | `store/graphics/icon-512.png` |
| Feature graphic, 1024 × 500 PNG | `store/graphics/feature-graphic-1024x500.png` |
| Phone screenshots, 1080 × 1920, seven per language | `store/screenshots/{en,es,fr}/phone-*.png` |
| 7-inch tablet screenshots, 1200 × 1920 | `store/screenshots/{en,es,fr}/tablet7-*.png` |
| 10-inch tablet screenshots, 1600 × 2560 | `store/screenshots/{en,es,fr}/tablet10-*.png` |
| Listing text (name, short and full description) in English, Spanish and French | `store/listing-en.md`, `listing-es.md`, `listing-fr.md` |
| Privacy policy page in the three languages | `store/privacy-policy.html` |

Regenerate the screenshots and feature graphic after any visual change with `cd test && node store-screenshots.js`.

## 1. The privacy policy URL

The repository's GitHub Pages site serves the policy publicly at:

    https://lvalverdeb.github.io/card-table/store/privacy-policy.html

Paste that into the console. It stays live as long as the repository is public and Pages is on. The same site serves the playable web version at https://lvalverdeb.github.io/card-table/, which can go in the listing's Website field.

## 2. Create the developer account

1. Go to https://play.google.com/console and sign in with the Google account that will own the app.
2. Choose a **Personal** account, enter your legal name and address, and pay the one-time 25 USD fee.
3. Complete identity verification (government ID and phone). Wait for the approval email.

## 3. Create the app

1. **Create app**: name `Card Table: Six Games`, default language English (United States), type Game, Free. Accept the declarations.
2. The dashboard shows a **Set up your app** checklist. Work through it:
   - **Privacy policy**: paste the URL from step 1.
   - **App access**: all functionality is available without special access.
   - **Ads**: No, the app contains no ads.
   - **Content rating**: start the questionnaire, category Game. Answer No to everything (no violence, no gambling with real money, no user interaction, no purchases). Vegas scoring is simulated money with nothing to buy or win, which the questionnaire does not count as gambling. Expect a rating of Everyone / PEGI 3.
   - **Target audience**: 13 and over is the simplest choice. Choosing under 13 brings the Families policy and extra review. The app is suitable for children, but you are not required to target them.
   - **News app**: No. **COVID-19 app**: No. **Data safety**: declare that the app collects no data and shares no data; all data handling questions are No. Encryption and deletion questions do not apply once nothing is collected.
   - **Government app**: No. **Financial features**: No.
   - **Advertising ID**: No, the app does not use it.
   - **App category**: Game > Card. Add the contact email that will appear on the listing.
3. **Main store listing**: paste the name, short and full descriptions from `listing-en.md`, upload `icon-512.png`, `feature-graphic-1024x500.png`, the seven phone screenshots and the tablet screenshots from `screenshots/en/`.
4. **Translations**: under Store listing, add languages Spanish (Latin America) and French (France), paste the texts from `listing-es.md` and `listing-fr.md`, and upload the matching screenshot folders.

## 4. Upload the bundle to a closed test

1. Go to **Testing > Closed testing**, create a track (the default Alpha is fine), and **Create new release**.
2. Google asks you to opt in to **Play App Signing**. Accept it. Google then holds the final signing key and your keystore becomes the upload key.
3. Upload `app-release.aab`. Release name 1.0. Release notes, for example: "First release: Klondike, FreeCell, Rummy, Hearts, Crazy Eights and Sevens, in English, Spanish and French."
4. Under **Testers**, create an email list and add at least 12 Gmail addresses of friends and family with Android phones. Save, then **Review release** and **Start rollout**.
5. Copy the opt-in link from the track page and send it to the testers. They open it, tap **Become a tester**, then install from Play. They must stay opted in for the full period.

## 5. Apply for production access

After 14 continuous days with at least 12 opted-in testers, the dashboard offers **Apply for production**. Answer the short questionnaire about what was tested and what you learned. Approval normally takes a few days.

## 6. Release to production

1. **Production > Create new release**, upload the same bundle (or a newer one with a higher versionCode), add release notes, review and roll out.
2. **Countries**: choose all, or the ones you want.
3. First review takes from a few hours to a week. The app then appears at `https://play.google.com/store/apps/details?id=com.lvalverdeb.card_table`.

## Updating later

Every new upload needs a higher `versionCode` in `android/app/build.gradle` (2, 3, ...) and usually a new `versionName`. Then `npm run sync`, `cd android && ./gradlew bundleRelease`, and upload the new bundle to a release.

## Keep safe

- `android/keystore.properties` and the keystore file it names: these sign every upload. Back them up outside the project. Losing them means a slow upload-key reset with Google.
- The Google account that owns the console: ownership transfers are tedious.
