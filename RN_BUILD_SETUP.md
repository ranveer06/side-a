# React Native build setup (Expo removed)

This project is now **plain React Native** with no Expo. Use Xcode and Android Studio to build.

## 1. Install dependencies

```bash
npm install
```

## 2. iOS: Get a clean native project (if needed)

Your `ios` folder may be from Expo and missing the full Xcode project. To get a **clean React Native iOS app**:

```bash
# From the PARENT of your SideA project (e.g. if project is ~/SideA, run from ~)
npx @react-native-community/cli@latest init RNBase --version 0.81.5 --skip-install

# Copy the native iOS project into your SideA project (from inside SideA folder)
rm -rf ios
cp -R ../RNBase/ios ./ios

# Install CocoaPods dependencies
cd ios && pod install && cd ..
```

- In the copied **ios** project, the app target is named **RNBase**. So open **`ios/RNBase.xcworkspace`** in Xcode.
- **Important:** So the app loads the right JS bundle, change the module name to **SideA**:  
  In Xcode, open **AppDelegate.mm** (or **AppDelegate.swift**). Find where the bundle is loaded (e.g. `moduleName: "RNBase"`) and change **RNBase** to **SideA** (must match `app.json` → `"name": "SideA"`).
- In Xcode: set your **Team** and **Bundle Identifier** (e.g. `com.ronny.sidea`) under Signing & Capabilities.
- **Ionicons font:** Add `node_modules/react-native-vector-icons/Fonts/Ionicons.ttf` to the Xcode project (drag into the project tree), and in **Info.plist** add **Fonts provided by application** → item **Ionicons.ttf**.

Then build: **Product → Run** (or Archive for TestFlight).

## 3. Run from terminal

```bash
# Start Metro
npm start

# In another terminal: run on iOS
npm run ios
```

## 4. Android

If you use the same temp project above, you can copy **android** from SideATemp too. Otherwise keep your existing **android** folder and run:

```bash
npm run android
```

---

**Summary:** Expo packages and config are removed. Entry is `index.js` (AppRegistry). Icons use `react-native-vector-icons`, images use `react-native-image-picker`. Use a fresh `react-native init` iOS (and optionally Android) project if your current native folders were from Expo.
