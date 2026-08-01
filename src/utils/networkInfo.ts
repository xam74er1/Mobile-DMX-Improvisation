import { Platform } from 'react-native'
import * as Network from 'expo-network'

export interface NetworkSnapshot {
  type: string              // 'WIFI' | 'CELLULAR' | 'NONE' | 'UNKNOWN' | ...
  isConnected: boolean
  isInternetReachable: boolean | null
  ipAddress: string | null  // e.g. 192.168.4.23 when joined to the FreeDMX AP
}

/**
 * Snapshot of the device's current network state. On Android this is the
 * one reliable in-app way to catch "phone silently routed this app's
 * traffic over mobile data instead of the no-internet WiFi it's joined
 * to" — if `type` comes back CELLULAR while the user believes they're on
 * the FreeDMX AP's WiFi, that's the bug, found without leaving the app.
 * Not available on Web (no native module there).
 */
export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  if (Platform.OS === 'web') {
    return { type: 'UNKNOWN', isConnected: true, isInternetReachable: null, ipAddress: null }
  }
  const [state, ip] = await Promise.all([
    Network.getNetworkStateAsync(),
    Network.getIpAddressAsync().catch(() => null),
  ])
  return {
    type: state.type ?? 'UNKNOWN',
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? null,
    ipAddress: ip,
  }
}
