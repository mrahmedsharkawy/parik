# Bariq iOS release

The iOS project is configured with bundle identifier `com.bariqgifts.app` and Firebase project `bariq-gifts`.

## One-time setup on a Mac

1. Install the current stable Xcode and Flutter SDK.
2. Sign in to Xcode with the paid Apple Developer account.
3. Open `Runner.xcworkspace`, select the `Runner` target, then choose the correct Team under **Signing & Capabilities**.
4. Keep **Automatically manage signing** enabled.
5. Confirm that **Push Notifications** and **Background Modes > Remote notifications** are enabled.
6. In Firebase Console, upload the Apple Push Notification authentication key for the same Apple team.

## Create the App Store archive

Run from the `bariq_app` directory:

```sh
flutter clean
flutter pub get
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

The IPA will be generated under `build/ios/ipa/`. Upload it with Xcode Organizer or the Transporter app.

Before every upload, increase the build number in `pubspec.yaml` (the number after `+`).
