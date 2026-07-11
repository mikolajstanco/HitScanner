import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSpotify } from '@/context/spotify-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

export default function HomeScreen() {
  const { 
    isAuthenticated, 
    isLoggingIn, 
    clientId, 
    login, 
    playTrack,
    pauseTrack,
    resumeTrack,
    wakeUpSpotify
  } = useSpotify();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);

  if (!clientId) {
    return (
      <ThemedView style={styles.container} type="background">
        <View style={styles.card}>
          <Text style={styles.spotifyLogo}>⚠️</Text>
          <ThemedText type="subtitle" style={styles.cardTitle}>Błąd konfiguracji</ThemedText>
          <ThemedText style={styles.cardText}>
            Brak Spotify Client ID w pliku `.env` projektu.
          </ThemedText>
          <ThemedText style={styles.cardTextSub}>
            Upewnij się, że plik `.env` istnieje w głównym katalogu projektu i zawiera poprawną wartość zmiennej `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container} type="background">
        <View style={styles.card}>
          <Text style={styles.spotifyLogo}>🎵</Text>
          <ThemedText type="subtitle" style={styles.cardTitle}>Połącz ze Spotify</ThemedText>
          <ThemedText style={styles.cardText}>
            Aplikacja HitScanner wymaga zalogowania do konta Spotify przed rozpoczęciem skanowania kodów QR.
          </ThemedText>
          <ThemedText style={styles.cardTextSub}>
            Muzyka będzie odtwarzana w tle na Twoim aktywnym urządzeniu Spotify (np. telefonie lub komputerze).
          </ThemedText>

          <Pressable 
            style={[styles.loginButton, isLoggingIn && styles.disabledButton]}
            onPress={login}
            disabled={isLoggingIn}>
            {isLoggingIn ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text style={styles.loginButtonText}>Zaloguj się przez Spotify</Text>
            )}
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (!permission) {
    // Camera permissions are still loading
    return (
      <ThemedView style={styles.container} type="background">
        <ActivityIndicator size="large" color="#1DB954" />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <ThemedView style={styles.container} type="background">
        <View style={styles.card}>
          <Text style={styles.cameraIcon}>📷</Text>
          <ThemedText type="subtitle" style={styles.cardTitle}>Dostęp do aparatu</ThemedText>
          <ThemedText style={styles.cardText}>
            HitScanner potrzebuje dostępu do Twojego aparatu, aby móc skanować kody QR z linkami do piosenek Spotify.
          </ThemedText>
          
          <Pressable style={styles.loginButton} onPress={requestPermission}>
            <Text style={styles.loginButtonText}>Zezwól na aparat</Text>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanStatus === 'processing' || scanStatus === 'success') return;
    
    setScanned(true);
    setScanStatus('processing');
    setErrorMessage('');

    console.log('QR Code Scanned data:', data);

    const result = await playTrack(data);

    if (result.success) {
      setIsPlaying(true);
      setScanStatus('success');
    } else {
      setScanStatus('error');
      setErrorMessage(result.message || 'Nieznany błąd podczas odtwarzania utworu.');
    }
  };

  const handleScanAgain = () => {
    setScanStatus('idle');
    setScanned(false);
    setErrorMessage('');
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      const res = await pauseTrack();
      if (res.success) {
        setIsPlaying(false);
      } else {
        Alert.alert('Błąd', res.message || 'Nie udało się zatrzymać odtwarzania.');
      }
    } else {
      const res = await resumeTrack();
      if (res.success) {
        setIsPlaying(true);
      } else {
        Alert.alert('Błąd', res.message || 'Nie udało się wznowić odtwarzania.');
      }
    }
  };

  // SUCCESS STATE (Now playing background player controls)
  if (scanStatus === 'success') {
    return (
      <ThemedView style={styles.container} type="background">
        <View style={styles.card}>
          <View style={styles.discContainer}>
            <Text style={styles.discSymbol}>{isPlaying ? '🎵' : '⏸️'}</Text>
          </View>

          <ThemedText type="subtitle" style={styles.cardTitle}>Odtwarzanie</ThemedText>
          {/* <ThemedText style={styles.cardText}>
            Piosenka została pomyślnie wysłana i gra w tle na Twoim koncie Spotify.
          </ThemedText> */}

          <Pressable 
            style={[
              styles.loginButton, 
              isPlaying ? styles.pauseButton : styles.playButton, 
              { marginBottom: 16 }
            ]}
            onPress={handlePlayPause}
          >
            <Text style={isPlaying ? styles.pauseButtonText : styles.loginButtonText}>
              {isPlaying ? 'Zatrzymaj muzykę ⏸️' : 'Wznów muzykę ▶️'}
            </Text>
          </Pressable>

          <Pressable 
            style={styles.settingsButton}
            onPress={handleScanAgain}
          >
            <Text style={styles.buttonText}>Skanuj kolejny kod 📷</Text>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Camera Viewport Overlay */}
      <View style={styles.overlayContainer}>
        <View style={styles.overlayTop}>
          <ThemedText type="smallBold" style={styles.scanInstruction}>
            Umieść kod QR Spotify w ramce
          </ThemedText>
        </View>
        
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {scanStatus === 'idle' && (
              <Animated.View 
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.scanLine} 
              />
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>
        
        <View style={styles.overlayBottom}>
          {/* <ThemedText type="small" style={styles.bgMusicHint}>
            Muzyka zacznie grać automatycznie w tle.
          </ThemedText> */}
        </View>
      </View>

      {/* Floating Status Overlays */}
      {scanStatus === 'processing' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.statusToast}>
          <ActivityIndicator color="#1DB954" style={{ marginRight: 10 }} />
          <Text style={styles.toastText}>Łączenie ze Spotify...</Text>
        </Animated.View>
      )}

      {scanStatus === 'error' && (
        <Animated.View 
          entering={FadeIn} 
          exiting={FadeOut} 
          layout={LinearTransition} 
          style={[styles.statusToast, styles.toastError]}
        >
          <Text style={styles.toastIcon}>🔴</Text>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.toastTitle}>Błąd odtwarzania</Text>
            <Text style={styles.toastSubtitleError}>{errorMessage}</Text>
          </View>
          
          <View style={styles.errorActions}>
            {errorMessage.includes('device') || errorMessage.includes('urządzenia') ? (
              <Pressable style={styles.wakeButton} onPress={wakeUpSpotify}>
                <Text style={styles.wakeButtonText}>Wzbudź Spotify</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.retryButton} onPress={handleScanAgain}>
              <Text style={styles.retryButtonText}>Skanuj ponownie</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#282828',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  logoIcon: {
    width: 64,
    height: 64,
    marginBottom: 16,
  },
  spotifyLogo: {
    fontSize: 64,
    marginBottom: 16,
  },
  cameraIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 15,
    color: '#b3b3b3',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  cardTextSub: {
    fontSize: 13,
    color: '#7f7f7f',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#156535',
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: '#282828',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Success state components
  discContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  discSymbol: {
    fontSize: 48,
    color: '#000000',
  },
  playButton: {
    backgroundColor: '#1DB954',
  },
  pauseButton: {
    backgroundColor: '#e91429',
    shadowColor: '#e91429',
  },
  pauseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Overlay Styles
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    flex: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  scanInstruction: {
    color: '#ffffff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 260,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  scanFrame: {
    width: 260,
    height: 260,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  overlayBottom: {
    flex: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    paddingTop: 30,
  },
  bgMusicHint: {
    color: '#b3b3b3',
    fontSize: 14,
    textAlign: 'center',
  },
  // Frame Corners
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#1DB954',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    height: 2,
    backgroundColor: '#1DB954',
    position: 'absolute',
    left: 10,
    right: 10,
    top: '50%',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  // Toast Overlays
  statusToast: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: '#181818',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282828',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  toastError: {
    borderColor: '#e91429',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  toastIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  toastTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toastSubtitleError: {
    color: '#ff7777',
    fontSize: 13,
    marginTop: 2,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  retryButton: {
    backgroundColor: '#3e3e3e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  wakeButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  wakeButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
  },
});