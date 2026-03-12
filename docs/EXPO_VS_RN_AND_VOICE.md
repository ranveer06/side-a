# Expo vs bare React Native, and optional voice input

## Ditching Expo and going to “pure” React Native

You can move from Expo to a bare React Native app in two main ways:

1. **Eject / prebuild (recommended first step)**  
   - Run `npx expo prebuild` to generate `ios/` and `android/` native projects.  
   - You keep using Expo’s build and OTA tooling (EAS) but now have full control over native code.  
   - No need to “ditch” Expo entirely; many teams stay on Expo with prebuild.

2. **Full migration to `react-native init`**  
   - Create a new app with `npx react-native init SideABare` and move your JS/TS and most dependencies over.  
   - You lose Expo’s managed workflow, config plugins, and EAS integration unless you re-add them.  
   - You gain maximum control and can trim any Expo-specific code.

**When it’s worth it**

- **Stay with Expo (or prebuild)** if: you’re happy with EAS Build, OTA updates, and the current tooling. Prebuild is usually enough for native customizations.  
- **Go bare RN** if: you need native modules or configs Expo doesn’t support, or you explicitly want to own the entire native project.

**Practical suggestion:** Try `expo prebuild` first. If you still hit limits (e.g. a native module that doesn’t work with Expo), then consider a full bare RN migration.

---

## Optional voice interface for typing (low priority)

For “optional voice interface for typing” (e.g. speaking review text or search):

- **Expo:** You can use **`expo-speech`** for text-to-speech. For **speech-to-text** there is no first-party Expo API; you’d use a third-party library or native module.  
- **React Native:**  
  - **`@react-native-voice/voice`** (or community voice packages) for speech-to-text.  
  - **`expo-speech`** or a native TTS solution for reading text back.

Implementation sketch:

1. Add a mic button next to the review text input (or search bar).  
2. On press, start listening with the voice library.  
3. On result, set the input value to the transcribed text.  
4. Handle permissions (microphone) in `app.json` and at runtime.

Marking this **low priority** in the roadmap is reasonable; it’s a nice-to-have that can be added after core flows and album images are solid.
