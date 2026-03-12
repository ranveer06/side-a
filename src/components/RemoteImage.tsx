// RemoteImage – retry + safe placeholder. StyleSheet styles are numeric IDs:
// style.width/height are undefined → was producing NaN icon size and broken UI.
import React, { useState, useCallback, useMemo } from 'react';
import { View, Image, ImageStyle, ViewStyle, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type PlaceholderIcon = 'disc-outline' | 'person' | 'person-circle-outline';

interface RemoteImageProps {
  uri: string | null | undefined;
  style: ImageStyle;
  placeholderStyle?: ViewStyle;
  placeholderIcon?: PlaceholderIcon;
}

function isValidUri(uri: string | null | undefined): uri is string {
  if (typeof uri !== 'string' || uri.trim().length === 0) return false;
  const u = uri.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('file://') || u.startsWith('content://');
}

// Dark placeholder matches app (#000/#111) so missing art doesn’t flash light gray blocks
const PLACEHOLDER_BG = '#1a1a1a';
const PLACEHOLDER_BORDER = '#2a2a2a';
const PLACEHOLDER_ICON_COLOR = '#1DB954';

export default function RemoteImage({
  uri,
  style,
  placeholderStyle,
  placeholderIcon = 'disc-outline',
}: RemoteImageProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => {
    if (retryCount < 1) {
      setTimeout(() => setRetryCount((c) => c + 1), 400);
    } else {
      setFailed(true);
    }
  }, [retryCount]);

  const placeholderIconSize = useMemo(() => {
    const flat = StyleSheet.flatten(style) as ImageStyle | undefined;
    const w = typeof flat?.width === 'number' ? flat.width : 40;
    const h = typeof flat?.height === 'number' ? flat.height : 40;
    const base = Math.min(w, h);
    const n = Math.round(Math.max(base * 0.5, 18));
    return Number.isFinite(n) ? n : 22;
  }, [style]);

  if (!isValidUri(uri) || failed) {
    return (
      <View
        style={[
          style,
          placeholderStyle,
          {
            backgroundColor: PLACEHOLDER_BG,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: PLACEHOLDER_BORDER,
          },
        ]}
      >
        <Ionicons name={placeholderIcon} size={placeholderIconSize} color={PLACEHOLDER_ICON_COLOR} />
      </View>
    );
  }

  return (
    <Image
      key={retryCount}
      source={{ uri: uri.trim() }}
      style={style}
      resizeMode="cover"
      onError={handleError}
    />
  );
}
