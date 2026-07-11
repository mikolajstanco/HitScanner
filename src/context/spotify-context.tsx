import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { Linking } from 'react-native';

// WebBrowser is required for AuthSession redirect flow
WebBrowser.maybeCompleteAuthSession();

// Keys for AsyncStorage
const ACCESS_TOKEN_KEY = '@spotify_access_token';
const REFRESH_TOKEN_KEY = '@spotify_refresh_token';
const EXPIRES_AT_KEY = '@spotify_expires_at';

// Read Spotify credentials from environment variables (with hardcoded fallbacks for caching safety)
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '53a45f938be0429bba6b0c0ef0fcf3e3';
const SPOTIFY_CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || '93e00bd839df43bfa7d76748d4b82425';

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export interface SpotifyPlayable {
  context_uri?: string;
  uris?: string[];
  type: 'track' | 'playlist' | 'album' | 'artist';
}

interface SpotifyContextType {
  clientId: string;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  playTrack: (scannedText: string) => Promise<{ success: boolean; message?: string }>;
  pauseTrack: () => Promise<{ success: boolean; message?: string }>;
  resumeTrack: () => Promise<{ success: boolean; message?: string }>;
  devices: SpotifyDevice[];
  refreshDevices: () => Promise<SpotifyDevice[]>;
  transferPlayback: (deviceId: string, play?: boolean) => Promise<boolean>;
  wakeUpSpotify: () => void;
  redirectUri: string;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

// Spotify Discovery Endpoint
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export const SpotifyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Generate redirect URI dynamically
  const redirectUri = makeRedirectUri({
    scheme: 'hitscanner',
  });

  // Setup AuthSession request hook
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID || 'temp-id', // useAuthRequest requires non-empty string on init
      scopes: [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
      ],
      redirectUri,
      usePKCE: true,
    },
    discovery
  );

  // Load saved credentials on startup
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedAccessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        const savedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        const savedExpiresAt = await AsyncStorage.getItem(EXPIRES_AT_KEY);

        if (savedAccessToken) setAccessToken(savedAccessToken);
        if (savedRefreshToken) setRefreshToken(savedRefreshToken);
        if (savedExpiresAt) setExpiresAt(parseInt(savedExpiresAt, 10));
      } catch (err) {
        console.error('Error loading Spotify credentials:', err);
      }
    };
    loadCredentials();
  }, []);

  // Watch for auth flow response redirect
  useEffect(() => {
    const handleAuthResponse = async () => {
      if (response?.type === 'success' && response.params.code && request?.codeVerifier) {
        try {
          setIsLoggingIn(true);
          const code = response.params.code;
          const codeVerifier = request.codeVerifier;

          console.log('Exchanging auth code for tokens with Redirect URI:', redirectUri);

          // Exchange auth code for tokens using client ID and Client Secret
          const bodyParams = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}&client_secret=${encodeURIComponent(SPOTIFY_CLIENT_SECRET)}&code_verifier=${encodeURIComponent(codeVerifier)}`;

          const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyParams,
          });

          if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            throw new Error(`Failed to exchange code: ${errText}`);
          }

          const data = await tokenResponse.json();
          const tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

          await saveSession(data.access_token, data.refresh_token, tokenExpiresAt);
        } catch (err) {
          console.error('Error in Spotify auth code exchange:', err);
          alert('Auth error: Spróbuj zalogować się ponownie. Upewnij się, że Redirect URI jest poprawnie skonfigurowane w konsoli deweloperskiej.');
        } finally {
          setIsLoggingIn(false);
        }
      } else if (response?.type === 'error' || response?.type === 'cancel') {
        setIsLoggingIn(false);
        console.log('Spotify Auth cancelled or failed:', response);
      }
    };

    handleAuthResponse();
  }, [response]);

  const saveSession = async (accToken: string, refToken: string, expAt: number) => {
    setAccessToken(accToken);
    setRefreshToken(refToken);
    setExpiresAt(expAt);

    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refToken);
    await AsyncStorage.setItem(EXPIRES_AT_KEY, expAt.toString());
  };

  const logout = async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setExpiresAt(0);
    setDevices([]);

    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(EXPIRES_AT_KEY);
  };

  // Helper: ensures token is valid, refreshes if expired
  const getValidAccessToken = async (): Promise<string | null> => {
    if (!accessToken || !refreshToken) return null;

    // Refresh if token is expired or close to expiring (within 60 seconds)
    if (Date.now() >= expiresAt - 60000) {
      console.log('Spotify token is expiring. Refreshing...');
      try {
        const bodyParams = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}&client_secret=${encodeURIComponent(SPOTIFY_CLIENT_SECRET)}`;

        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams,
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('Failed to refresh token response:', errText);
          // If refresh token fails (e.g. revoked), force logout
          await logout();
          return null;
        }

        const data = await response.json();
        const nextExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        const nextRefreshToken = data.refresh_token || refreshToken;

        await saveSession(data.access_token, nextRefreshToken, nextExpiresAt);
        return data.access_token;
      } catch (err) {
        console.error('Error refreshing Spotify token:', err);
        return null;
      }
    }

    return accessToken;
  };

  const login = async () => {
    if (!SPOTIFY_CLIENT_ID) {
      alert('Spotify Client ID nie jest skonfigurowane w pliku .env!');
      return;
    }
    setIsLoggingIn(true);
    try {
      await promptAsync();
    } catch (err) {
      console.error('Failed to prompt login:', err);
      setIsLoggingIn(false);
    }
  };

  // Get active devices from Spotify
  const refreshDevices = async (): Promise<SpotifyDevice[]> => {
    const token = await getValidAccessToken();
    if (!token) return [];

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to get devices');

      const data = await res.json();
      setDevices(data.devices || []);
      return data.devices || [];
    } catch (err) {
      console.error('Error fetching Spotify devices:', err);
      return [];
    }
  };

  // Transfer playback to a device
  const transferPlayback = async (deviceId: string, play: boolean = true): Promise<boolean> => {
    const token = await getValidAccessToken();
    if (!token) return false;

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play,
        }),
      });

      return res.status === 204 || res.status === 202;
    } catch (err) {
      console.error('Error transferring playback:', err);
      return false;
    }
  };

  // Parse a QR code text into playable Spotify object
  const parseSpotifyLink = (scannedText: string): SpotifyPlayable | null => {
    if (scannedText.startsWith('spotify:')) {
      const parts = scannedText.split(':');
      if (parts.length >= 3) {
        const type = parts[1];
        if (type === 'track') {
          return { uris: [scannedText], type: 'track' };
        } else if (['playlist', 'album', 'artist'].includes(type)) {
          return { context_uri: scannedText, type: type as any };
        }
      }
    }

    // Match URL: open.spotify.com/track/xxx, open.spotify.com/playlist/xxx, etc.
    const regex = /open\.spotify\.com\/(?:[a-zA-Z-]+\/)?(track|playlist|album|artist)\/([a-zA-Z0-9]+)/;
    const match = scannedText.match(regex);
    if (match) {
      const type = match[1];
      const id = match[2];
      const uri = `spotify:${type}:${id}`;
      if (type === 'track') {
        return { uris: [uri], type: 'track' };
      } else {
        return { context_uri: uri, type: type as any };
      }
    }

    // Match plain 22-char track ID
    if (/^[a-zA-Z0-9]{22}$/.test(scannedText)) {
      return { uris: [`spotify:track:${scannedText}`], type: 'track' };
    }

    return null;
  };

  // Play track in background
  const playTrack = async (scannedText: string): Promise<{ success: boolean; message?: string }> => {
    const token = await getValidAccessToken();
    if (!token) {
      return { success: false, message: 'Zaloguj się najpierw do Spotify' };
    }

    const playable = parseSpotifyLink(scannedText);
    if (!playable) {
      return { success: false, message: 'Niepoprawny kod QR (brak linku Spotify)' };
    }

    const playBody = playable.type === 'track'
      ? { uris: playable.uris }
      : { context_uri: playable.context_uri };

    const makePlayCall = async (deviceId?: string): Promise<Response> => {
      const url = deviceId 
        ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` 
        : 'https://api.spotify.com/v1/me/player/play';
      
      return fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(playBody),
      });
    };

    try {
      let response = await makePlayCall();

      // If no active device found (404), try to transfer to available device
      if (response.status === 404) {
        console.log('No active device. Fetching available devices...');
        const availableDevices = await refreshDevices();

        if (availableDevices.length > 0) {
          // Select the first device
          const targetDevice = availableDevices[0];
          console.log(`Transferring playback to device: ${targetDevice.name}`);
          
          const transferred = await transferPlayback(targetDevice.id, true);
          if (transferred) {
            // Wait brief moment for playback transfer to take effect
            await new Promise(resolve => setTimeout(resolve, 800));
            // Retry playing
            response = await makePlayCall(targetDevice.id);
          }
        } else {
          return {
            success: false,
            message: 'Brak aktywnego urządzenia Spotify. Otwórz aplikację Spotify na swoim telefonie, aby wzbudzić odtwarzacz.',
          };
        }
      }

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Spotify Playback error response:', errorData);
        const errorMsg = errorData.error?.message || `API Error (${response.status})`;
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      console.error('Error playing track on Spotify:', err);
      return { success: false, message: err.message || 'Błąd sieci' };
    }
  };

  // Pause playback
  const pauseTrack = async (): Promise<{ success: boolean; message?: string }> => {
    const token = await getValidAccessToken();
    if (!token) return { success: false, message: 'Zaloguj się najpierw do Spotify' };

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `API Error (${response.status})`;
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      console.error('Error pausing track on Spotify:', err);
      return { success: false, message: err.message || 'Błąd sieci' };
    }
  };

  // Resume playback
  const resumeTrack = async (): Promise<{ success: boolean; message?: string }> => {
    const token = await getValidAccessToken();
    if (!token) return { success: false, message: 'Zaloguj się najpierw do Spotify' };

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `API Error (${response.status})`;
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      console.error('Error resuming track on Spotify:', err);
      return { success: false, message: err.message || 'Błąd sieci' };
    }
  };

  const wakeUpSpotify = () => {
    // Attempt to wake up Spotify by launching it in the background / foreground
    Linking.openURL('spotify:').catch(err => {
      console.error('Failed to open Spotify app scheme:', err);
      Linking.openURL('https://open.spotify.com');
    });
  };

  const isAuthenticated = !!accessToken;

  return (
    <SpotifyContext.Provider
      value={{
        clientId: SPOTIFY_CLIENT_ID,
        accessToken,
        isAuthenticated,
        isLoggingIn,
        login,
        logout,
        playTrack,
        pauseTrack,
        resumeTrack,
        devices,
        refreshDevices,
        transferPlayback,
        wakeUpSpotify,
        redirectUri,
      }}>
      {children}
    </SpotifyContext.Provider>
  );
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (context === undefined) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
};
