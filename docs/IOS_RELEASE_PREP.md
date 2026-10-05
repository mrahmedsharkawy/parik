# Bariq Gifts iOS release preparation

## Fixed values

- App name: Bariq Gifts
- Arabic name: بريق للهدايا
- Website: https://bariqgifts.com
- Support URL: https://bariqgifts.com/policy/support-faq
- Privacy URL: https://bariqgifts.com/policy
- Contact email: info@bariqgifts.com
- Recommended bundle ID: `com.bariqgifts.app`
- Initial version: `1.0.0`
- Initial build: `1`
- Primary category: Shopping
- Secondary category: Lifestyle
- Price: Free

## Must finish before App Review

- [ ] Apple Developer membership is Active.
- [ ] Register the final bundle ID in Apple Developer.
- [ ] Create the App Store Connect app record.
- [x] Add a secure, user-confirmed account deletion flow inside Account settings.
- [x] Confirm which customer data is deleted and which order records must be retained legally.
- [x] Create a non-transparent 1024x1024 App Store icon from the approved Bariq brand artwork (`assets/app-store-icon-1024.png`).
- [x] Prepare Arabic and English App Store metadata, review notes, permission copy, and provisional privacy answers (`docs/APP_STORE_METADATA.md`).
- [x] Publish-ready Arabic and English privacy policy content is available at `/policy`, including account deletion and data-retention details.
- [ ] Prepare iPhone screenshots using the final build.
- [ ] Complete App Privacy answers from the actual data flows.
- [ ] Add review notes and a working review account if login-only features need testing.
- [ ] Test registration, login, password reset, product browsing, cart, checkout, order tracking, image upload, camera/photo permissions, external links, RTL, and English.

## App Review risks already identified

1. The website supports account creation but currently has no complete in-account deletion flow. Apple requires apps with account creation to let users initiate deletion inside the app.
2. The current public manifest previously exposed an admin reports shortcut. It has been removed from the customer manifest.
3. Existing public icons are 96x96 and 202x202. App Store submission needs approved 1024x1024 artwork; do not upscale the small icon as the final master.
4. The iOS package should provide app-like value and reliable navigation rather than behaving as an unmodified browser tab.

## Work that specifically requires macOS/Xcode

- Create/open the native iOS project.
- Configure signing with the active Apple Developer team.
- Add the AppIcon asset catalog and launch screen.
- Build and test the archive.
- Validate and upload the build to App Store Connect.

Everything else in this checklist can be prepared before renting the cloud Mac.
