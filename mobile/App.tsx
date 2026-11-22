import React, {useState} from 'react';
import {Button, SafeAreaView, Text, Platform} from 'react-native';

const host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
async function call(path: string, body?: object, token?: string) {
  const response = await fetch('http://' + host + ':4177/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})},
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error('Request failed: '+response.status);
  return response.json();
}

export default function App() {
  const [status, setStatus] = useState('Start the local API, then check the connection.');
  const [busy, setBusy] = useState(false);
  async function checkConnection() {
    setBusy(true);
    try {
      const {challenge} = await call('challenges', {handle:'demo-a'});
      const {token} = await call('sessions', {challenge, code:'246810'});
      const profile = await call('me', undefined, token);
      setStatus('Connected as '+profile.name);
    } catch { setStatus('Could not reach the sandbox. Check the API and emulator networking.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={{padding:32, gap:16}}>
    <Text accessibilityRole="header" style={{fontSize:28}}>Assessment sandbox</Text>
    <Text accessibilityLiveRegion="polite">{status}</Text>
    <Button title="Check mock sign-in" disabled={busy} onPress={checkConnection}/>
  </SafeAreaView>;
}
