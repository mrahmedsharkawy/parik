# Bariq App

Flutter/Dart mobile app prototype for Bariq Gifts.

## What is included

- Arabic RTL shopping home screen.
- Amazon/SHEIN-inspired mobile commerce layout.
- Supabase product catalog service using the same Bariq backend.
- Product cards, flash sale strip, category chips, daily picks, and cart badge UI.
- App shell with Home, Categories, Offers, Cart, and Account tabs.
- Local browser preview at `preview.html` for quick design review before Flutter SDK is installed.

## Requirements

Install Flutter SDK first, then run:

```powershell
cd bariq_app
flutter create --platforms=android,ios .
flutter pub get
flutter run
```

`flutter create --platforms=android,ios .` generates the native Android/iOS folders around the Dart code already created here.

## Notes

The app reads from the same Supabase project used by the website. Admin changes in the current web admin panel can be reflected here because the app uses the shared `products` table.

## Quick Preview Without Flutter

The current machine does not have Flutter/Dart in PATH. To see the app direction immediately, open:

```text
http://127.0.0.1:5500/bariq_app/preview.html
```

The preview reads live products from Supabase and includes tabs, categories, cart, offers, account, and product details.
