# HitScanner 🎵📱

A cross-platform mobile companion app for music-based timeline board games. 

This app allows players to expand their game library by scanning custom QR codes to trigger background music playback. To preserve the core gameplay mechanics (where players place songs chronologically on a timeline), the app deliberately hides all song metadata (title, artist, and cover art) from the screen. This ensures fair play and a seamless experience without requiring manual interaction with streaming platforms.

---

## ✨ Features

- **🔍 QR Code Scanner**: Quick and responsive camera integration to scan QR codes linked to Spotify tracks.
- **🤫 Zero-Spoiler UI**: Completely conceals the song title, artist, and album artwork during playback to prevent spoiling the release year.
- **🎵 Spotify Web API Integration**: Connects directly to your Spotify account (requires Spotify Premium on your active playing device) and controls playback in the background.
- **🎛️ Minimalist Playback Controls**: Simple play, pause, and next-scan buttons designed for quick, distraction-free board game rounds.
- **🎨 Premium Dark Theme**: A sleek, modern user interface built using smooth animations and themed components.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev/) (React Native)
- **Language**: TypeScript
- **State & Animations**: React Native Reanimated (for smooth UI transitions)
- **APIs & SDKs**: Spotify Web API & `expo-auth-session` for secure OAuth authentication
- **Hardware Integration**: `expo-camera` for real-time QR code scanning
- **Styling**: Tailwind CSS / Native styling with custom themed components
