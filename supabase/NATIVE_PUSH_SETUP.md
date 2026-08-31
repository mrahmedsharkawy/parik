# Bariq native push setup

Native notifications are implemented with Firebase Cloud Messaging and Supabase.
The following deployment secrets must stay outside the Flutter source code.

1. Create Android and iOS apps in Firebase using the final production package IDs.
   The repository currently still uses the Flutter template IDs
   `com.example.bariq_app` and `com.example.bariqApp`; replace them before the
   store release or register those exact IDs while testing.
2. Apply `migrations/20260830010000_app_device_tokens.sql` to Supabase.
3. Create a Firebase service account and save the complete JSON as the Supabase
   secret `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Deploy `functions/send-native-push` and the existing `functions/send-push`.
5. Build the mobile app with these non-secret Firebase client values:

```text
--dart-define=FIREBASE_API_KEY=...
--dart-define=FIREBASE_APP_ID=...
--dart-define=FIREBASE_MESSAGING_SENDER_ID=...
--dart-define=FIREBASE_PROJECT_ID=...
--dart-define=FIREBASE_IOS_BUNDLE_ID=...
```

For iOS, also enable Push Notifications and Background Modes > Remote
notifications in Xcode, then upload the APNs authentication key to Firebase.

