# Real-Device Offline Probe Evaluation & Architecture Decision

**Date:** 2026-11-09  
**Reviewer:** Varun Karthic, Core Platform Lead / Developer A  
**Issue:** [#54](https://github.com/satvikp-coder/makarba-360/issues/54)  
**Status:** ACCEPTED / APPROVED

## Evaluation Summary
Real-device probe runs on Android (Pixel 7 / Chrome 130) and iOS (iPhone 13 / Safari 17.5) verified the critical offline capabilities:
1. **IndexedDB & Vault Persistence:** AES-GCM key derivation and protected draft storage persist across page reloads and process restarts.
2. **Draft Survival:** Draft data survives swipe-away process termination without corruption.
3. **Service Worker Offline Cache:** Offline reloads in airplane mode succeed via the service worker cache without network connectivity.
4. **Architecture Selection:** PWA approach selected; approved fallback path specified in `docs/architecture/offline-sync.md`.
5. **Security Limitations:** Explicitly documented that unencrypted browser storage is never claimed inherently safe; passphrase-derived key vault protects against casual device access.

