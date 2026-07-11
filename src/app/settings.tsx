import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Pressable, 
  ScrollView, 
  Platform,
  Alert,
  Share,
  Clipboard,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useSpotify } from '@/context/spotify-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

export default function SettingsScreen() {
  const { 
    clientId, 
    isAuthenticated, 
    isLoggingIn,
    login,
    logout, 
    redirectUri,
    playTrack,
    wakeUpSpotify
  } = useSpotify();

  const [testTrackUrl, setTestTrackUrl] = useState('');
  const [isTestingPlay, setIsTestingPlay] = useState(false);

  const handleCopyRedirectUri = () => {
    Clipboard.setString(redirectUri);
    Alert.alert('Skopiowano', 'Link redirect URI został skopiowany do schowka.');
  };

  const handleShareRedirectUri = async () => {
    try {
      await Share.share({
        message: redirectUri,
      });
    } catch (error: any) {
      console.error('Error sharing:', error.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Wyloguj się',
      'Czy na pewno chcesz wylogować się z konta Spotify?',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wyloguj', style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleTestPlay = async () => {
    if (!testTrackUrl.trim()) {
      Alert.alert('Błąd', 'Wklej poprawny link lub ID utworu Spotify.');
      return;
    }
    
    setIsTestingPlay(true);
    const res = await playTrack(testTrackUrl);
    setIsTestingPlay(false);

    if (res.success) {
      Alert.alert('Sukces', 'Utwór został wysłany do odtworzenia w tle na Spotify! 🎵');
    } else {
      if (res.message?.includes('device') || res.message?.includes('urządzenia')) {
        Alert.alert(
          'Brak aktywnego odtwarzacza',
          res.message,
          [
            { text: 'Anuluj', style: 'cancel' },
            { text: 'Wzbudź Spotify', onPress: wakeUpSpotify }
          ]
        );
      } else {
        Alert.alert('Błąd odtwarzania', res.message || 'Wystąpił nieznany błąd.');
      }
    }
  };

  return (
    <ThemedView style={styles.container} type="background">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="subtitle" style={styles.title}>Ustawienia</ThemedText>

        {/* Connection Status Card */}
        <View style={styles.card}>
          <ThemedText type="smallBold" style={styles.sectionHeader}>Status Spotify</ThemedText>
          
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, isAuthenticated ? styles.statusActive : styles.statusInactive]} />
            <ThemedText style={styles.statusText}>
              {isAuthenticated ? 'Zalogowano w Spotify' : 'Rozłączono'}
            </ThemedText>
          </View>

          {isAuthenticated ? (
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Wyloguj się ze Spotify</Text>
            </Pressable>
          ) : (
            <View>
              <ThemedText style={[styles.cardInfoText, { marginBottom: 12 }]}>
                Zaloguj się do swojego konta Spotify Premium, aby rozpocząć skanowanie kodów QR.
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
          )}
        </View>

        {/* Test Playback Card (only when logged in) */}
        {isAuthenticated && (
          <View style={styles.card}>
            <ThemedText type="smallBold" style={styles.sectionHeader}>Test Odtwarzania</ThemedText>
            <ThemedText style={styles.cardText}>
              Wklej link do utworu Spotify, aby przetestować odtwarzanie w tle bez używania kamery.
            </ThemedText>
            
            <TextInput
              style={styles.textInput}
              value={testTrackUrl}
              onChangeText={setTestTrackUrl}
              placeholder="np. https://open.spotify.com/track/..."
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable 
              style={[styles.testButton, isTestingPlay && styles.disabledButton]}
              onPress={handleTestPlay}
              disabled={isTestingPlay}>
              {isTestingPlay ? (
                <ActivityIndicator color="black" />
              ) : (
                <Text style={styles.testButtonText}>Przetestuj odtwarzanie w tle</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Configuration Card */}
        <View style={styles.card}>
          <ThemedText type="smallBold" style={styles.sectionHeader}>Konfiguracja Aplikacji</ThemedText>
          
          <View style={styles.configItem}>
            <ThemedText style={styles.label}>ID Klienta Spotify (z pliku .env):</ThemedText>
            <View style={styles.clientIdDisplay}>
              <Text style={styles.clientIdDisplayText} numberOfLines={1}>
                {clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 8)}` : 'Brak konfiguracji w .env'}
              </Text>
            </View>
          </View>

          <View style={styles.configItem}>
            <ThemedText style={styles.label}>Status Konfiguracji:</ThemedText>
            <Text style={[styles.statusBadge, clientId ? styles.badgeSuccess : styles.badgeError]}>
              {clientId ? 'Skonfigurowano dewelopersko' : 'Wymaga pliku .env'}
            </Text>
          </View>
        </View>

        {/* Setup Guide Card for Developers */}
        <View style={styles.card}>
          <ThemedText type="smallBold" style={styles.sectionHeader}>Konfiguracja w Spotify for Developers</ThemedText>
          <ThemedText style={styles.guideStep}>
            Aby logowanie użytkowników działało poprawnie, w ustawieniach Twojej aplikacji na **developer.spotify.com** w sekcji **Redirect URIs** musisz dodać poniższy adres:
          </ThemedText>

          <View style={styles.uriContainer}>
            <Text style={styles.uriText} numberOfLines={2}>
              {redirectUri}
            </Text>
            <View style={styles.uriButtons}>
              <Pressable style={styles.uriActionButton} onPress={handleCopyRedirectUri}>
                <Text style={styles.uriActionButtonText}>Kopiuj</Text>
              </Pressable>
              <Pressable style={styles.uriActionButton} onPress={handleShareRedirectUri}>
                <Text style={styles.uriActionButtonText}>Udostępnij</Text>
              </Pressable>
            </View>
          </View>

          <ThemedText style={styles.guideStepSub}>
            Wskazówka: Zarejestruj zarówno `hitscanner://spotify-auth` (dla gotowej aplikacji), dynamiczne adresy Metro IP (widoczne powyżej), jak i `http://localhost:8081` (jeśli debugujesz w wersji Web).
          </ThemedText>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Aplikacja steruje muzyką na Twoim aktywnym urządzeniu. Upewnij się, że masz subskrypcję Spotify Premium oraz włączoną aplikację Spotify w tle.
          </Text>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
    marginTop: Platform.OS === 'ios' ? 20 : 0,
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#282828',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1DB954',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusActive: {
    backgroundColor: '#1DB954',
  },
  statusInactive: {
    backgroundColor: '#888888',
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#e91429',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardText: {
    fontSize: 14,
    color: '#b3b3b3',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardInfoText: {
    fontSize: 14,
    color: '#7f7f7f',
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: '#1e1e1e',
    borderColor: '#3e3e3e',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#156535',
    opacity: 0.7,
  },
  configItem: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#b3b3b3',
    marginBottom: 8,
  },
  clientIdDisplay: {
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282828',
  },
  clientIdDisplayText: {
    color: '#888888',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    color: '#1DB954',
  },
  badgeError: {
    backgroundColor: 'rgba(233, 20, 41, 0.1)',
    color: '#e91429',
  },
  guideStep: {
    fontSize: 14,
    color: '#b3b3b3',
    lineHeight: 20,
    marginBottom: 12,
  },
  guideStepSub: {
    fontSize: 12,
    color: '#7f7f7f',
    lineHeight: 16,
    marginTop: 8,
  },
  uriContainer: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#3e3e3e',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  uriText: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  uriButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  uriActionButton: {
    backgroundColor: '#3e3e3e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  uriActionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 185, 84, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    color: '#a3a3a3',
    fontSize: 13,
    lineHeight: 18,
  }
});