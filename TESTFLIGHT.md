# Pushing Side A to TestFlight

## Prerequisites

- **Apple Developer account** (paid, $99/year) — [developer.apple.com](https://developer.apple.com)
- **App in App Store Connect** with the same **Bundle ID** as your Xcode project (`com.ronny.sidea`)
- **Xcode 16 or later** — As of April 2025, Apple requires builds to be made with **Xcode 16+** and the iOS 18 SDK. Older Xcode versions will get “Unsupported SDK and Xcode version”. Install from the Mac App Store or [developer.apple.com](https://developer.apple.com/xcode/).

## 1. Set bundle ID and signing in Xcode

1. Open the workspace (not the `.xcodeproj`):
   ```bash
   open ios/RNBase.xcworkspace
   ```
2. In Xcode: select the **RNBase** project in the left sidebar → select the **RNBase** target.
3. **Signing & Capabilities** tab:
   - Check **Automatically manage signing**.
   - Choose your **Team** (your Apple Developer account).
   - Set **Bundle Identifier** to the same value you use in App Store Connect (e.g. `com.yourcompany.sidea`).  
     Default in the project is `org.reactjs.native.example.RNBase` — either create the app in App Store Connect with that ID, or change it here and in App Store Connect to something like `com.yourcompany.sidea`.

## 2. Create the app in App Store Connect (if needed)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**.
2. Platform: **iOS**.
3. **Bundle ID**: choose the same one you set in Xcode (e.g. `com.yourcompany.sidea`).
4. Fill name, SKU, etc. and create.

## 3. Build an archive

1. In Xcode, pick the **Any iOS Device (arm64)** (or a connected device) as the run destination — not a simulator.
2. Menu: **Product** → **Scheme** → **Edit Scheme…** → **Run** → **Info** → set **Build Configuration** to **Release** (optional; Archive uses Release by default).
3. **Product** → **Archive**.
4. Wait for the archive to finish. The **Organizer** window will open.

## 4. Upload to App Store Connect

1. In Organizer, select the new archive → **Distribute App**.
2. **App Store Connect** → **Next**.
3. **Upload** → **Next**.
4. Leave options as default (e.g. upload symbols) → **Next**.
5. Select your **distribution certificate** and **provisioning profile** (or **Automatically manage signing**).
6. **Upload**.
7. Wait for the upload to complete.

## 5. Submit to TestFlight

1. In [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → your app.
2. Open the **TestFlight** tab.
3. After processing (often 5–15 minutes), the new build appears under **iOS Builds**.
4. Add **Internal** testers (same team) and/or **External** testers (requires a short beta review the first time).
5. Testers get an email and install via the TestFlight app.

## 6. Version and build number (required)

- **Version** (e.g. 1.0): Xcode → RNBase target → **General** → **Version** (or `MARKETING_VERSION`).
- **Build**: **Each new upload must have a higher build number** than the last. If you get “Redundant binary upload”, the build number is already on App Store Connect — increment **Build** (e.g. 1 → 2) in Xcode (RNBase target → General) or in `ios/RNBase.xcodeproj` (`CURRENT_PROJECT_VERSION`), then archive and upload again.

## 7. App icon and Info.plist

- **Missing icon**: The project includes a placeholder 1024×1024 app icon (`ios/RNBase/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png`). Replace it with your real icon (1024×1024 PNG, no transparency) for release.
- **Missing Info.plist value**: Required keys are set (e.g. `NSPhotoLibraryUsageDescription`). If you add features that need new permissions (camera, microphone, etc.), add the matching usage description in **Info.plist** or Xcode will reject the build.

## Troubleshooting

- **“Unsupported SDK and Xcode version”** — Build with **Xcode 16 or later** (required as of April 2025). Select Xcode 16 in the command line: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (path may differ if you have multiple Xcodes).
- **“Redundant binary upload”** — The same version + build number is already on App Store Connect. Increment the **Build** number (e.g. 2 → 3) in Xcode → RNBase target → General, then archive and upload again.
- **“Missing icon file”** — Ensure `ios/RNBase/Images.xcassets/AppIcon.appiconset/AppIcon-1024.png` exists and is a 1024×1024 PNG. Replace the placeholder with your real app icon.
- **“Missing Info.plist value”** — Add or fix the required key (e.g. usage description strings must be non-empty). The project sets `NSPhotoLibraryUsageDescription` and `NSLocationWhenInUseUsageDescription`.
- **“No accounts with App Store Connect access”** — Add your Apple ID in Xcode (**Xcode** → **Settings** → **Accounts**) and ensure the account has App Store Connect access.
- **Signing errors** — Ensure the Bundle ID in Xcode matches an App ID in your developer account and that you have a valid distribution certificate and provisioning profile (or use automatic signing with the correct team).
- **“Could not find an option for code signing”** — In **Signing & Capabilities**, select your Team and a valid provisioning profile for the Bundle ID.
