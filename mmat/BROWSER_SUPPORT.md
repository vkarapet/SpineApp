# Browser Support Matrix

## Supported Browsers

| Browser | Version | Support Level | Notes |
|---------|---------|--------------|-------|
| Chrome (Android) | 90+ | **Full** | Primary target. All APIs supported. |
| Edge (Android) | 90+ | **Full** | Chromium-based, equivalent to Chrome. |
| Safari (iOS) | 15.4+ | **Supported with known limitations** | See iOS Safari Limitations below |
| Chrome (iOS) | Any | **Via Safari** | iOS Chrome uses WebKit, same as Safari |
| Samsung Internet | 15+ | **Supported** | Chromium-based |
| Firefox (Android) | Not supported | **Not supported** | Limited PWA support |
| Desktop browsers | Any | **Not targeted** | App functions but is designed for mobile |

## iOS Safari Limitations & Workarounds

| Feature | iOS Safari Status | Workaround |
|---------|------------------|------------|
| Push Notifications | Supported iOS 16.4+ | In-app reminders as fallback |
| Background Sync API | **Not supported** | Sync on app open; surface pending count |
| IndexedDB eviction | Aggressive under storage pressure | `navigator.storage.persist()`; sync-first design |
| `screen.orientation.lock()` | **Not supported** | CSS media query + UI overlay warning in landscape |
| Web Audio autoplay | Blocked until user gesture | Create `AudioContext` on "I'm Ready" button tap |
| Vibration API | **Not supported** | Visual-only feedback on iOS; haptic toggle hidden in Settings |
| `performance.now()` precision | ~1ms (Spectre mitigation) | Acceptable for screening; documented as known limitation |
| Service Worker lifetime | Killed after ~30s inactivity | Design for re-registration on each open |
| Add to Home Screen | No automatic prompt | Custom install guidance overlay |

## IndexedDB Cross-Browser Notes

- **Safari transaction auto-commit:** All IndexedDB operations avoid spreading a single transaction across multiple async operations.
- **Error handling:** All IndexedDB operations wrapped in try/catch for Safari `DOMException` handling.
- **Storage limits:** ~1GB for installed PWAs on Safari; much less for non-installed web pages.

## Audio Cross-Browser Notes

- `AudioContext` created/resumed within user gesture call stack (required by all browsers, especially iOS Safari).
- All audio buffers pre-decoded before countdown.
- `window.AudioContext || window.webkitAudioContext` for Safari compatibility.

## Touch Event Handling

- **Pointer Events API** used as primary abstraction.
- **Safari `pointercancel`:** Handled as equivalent to `pointerup` (Safari fires on notification banners, control center swipe).
- **Coordinate normalization:** All positions computed relative to target via `getBoundingClientRect()`.
