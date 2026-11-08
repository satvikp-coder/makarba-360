# Offline probe (issue #54)

A small static page that tests, on a real phone, what the Makarba 360 field app will depend on: IndexedDB storage and its limits, an AES-GCM vault with a passphrase-derived key, a non-extractable key kept across reloads, recovery after the app is killed, and offline reload through a service worker. **Synthetic data only; it sends nothing anywhere and never asks for your location.**

## Who and what
Someone with an **Android phone (Chrome)** and someone with an **iPhone (Safari)**. Newer and, if possible, an old low-end phone too. About 15 minutes each.

## How to open it on a phone
The page needs a secure context (HTTPS or localhost). Pick one:

1. **Android + USB cable (no accounts, nothing public):** on the computer run `python -m http.server 8080 --directory tools/offline-probe`, enable USB debugging, run `adb reverse tcp:8080 tcp:8080`, then open `http://localhost:8080/` in Chrome on the phone.
2. **Any phone, via GitHub Pages:** the repository owner can publish `tools/offline-probe` as a static page (a repository setting; the page contains no private data). Open the HTTPS address on each phone. Not done by Claude: enabling Pages is the owner's decision.
3. **iPhone without a Mac:** use option 2; Safari does not accept plain http addresses on the network for these features.

## Steps (per phone)
1. Open the page. Tap **Run all checks**. Read each row; green PASS, blue info, amber MANUAL.
2. **Reload recovery:** tap **Run all checks** again after reloading the page. The "key stored" row must turn green.
3. **Kill recovery:** fully close the browser app (swipe it away), reopen the page, tap **Run all checks**. The "Draft survives closing the browser" row should turn green; if it does not, write down exactly how you closed the app.
4. **Offline reload:** after the service-worker row says registered, turn on airplane mode, reload the page. The page must still open and say "served from the service worker cache". Turn airplane mode off.
5. **Low storage / private mode (optional):** repeat once in a private tab and note the quota shown.
6. Type your notes (phone model, OS version, browser version, what you did and saw), tap **Download report (JSON)**, and attach the file to issue #54. Tap **Clear probe data** when finished.

## How the result is used
The reports and notes from at least one Android and one iPhone decide, with the research lead, whether the custom offline PWA is acceptable or whether an approved ODK/KoboToolbox path is used. The probe does not decide this. A browser on a desktop passing is not evidence. IndexedDB is not encrypted by the browser: nothing stored unencrypted is ever called safe, and a key kept on the same device protects against casual copying only.
