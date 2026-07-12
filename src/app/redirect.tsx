import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

// Complete the authentication session (closes the browser sheet on native platforms)
WebBrowser.maybeCompleteAuthSession();

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Safety fallback: if the browser sheet didn't close or user is stuck, 
    // redirect them back to the main screen after 1 second.
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <ActivityIndicator size="large" color="#1DB954" />
    </View>
  );
}
