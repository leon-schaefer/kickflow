import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
import type { RefreshableProps } from './Refreshable.types';

const RESISTANCE = 0.5;
const THRESHOLD = 64;
const PARKED = 48;
const MAX_PULL = 96;
const SNAP_DURATION = 200;

/**
 * Pull-to-Refresh per Touch-Handler nachgebaut. `RefreshControl` aus
 * react-native ist auf react-native-web ein reines No-op (rendert nur ein
 * leeres `View`, verwirft `onRefresh` — siehe
 * node_modules/react-native-web/dist/exports/RefreshControl/index.js), und
 * die PWA-Shell setzt `body { overflow: hidden; overscroll-behavior: none }`
 * (public/index.html), sodass auch kein natives Browser-Pull-to-Refresh
 * greift.
 *
 * Nur Touch (kein Wheel/Trackpad) — deckt den eigentlichen PWA-Anwendungsfall
 * ab, ohne Trackpad-Scrollmomentum versehentlich als Pull zu interpretieren.
 *
 * Modals (OfferModal, LeagueSwitcher) portalt react-native-web nach
 * `document.body` (siehe ModalPortal.js) — Touches darin landen nie beim
 * Wrapper-Listener hier, ein Pull im Hintergrund ist also ausgeschlossen.
 */
export function Refreshable({ refreshing, onRefresh, children }: RefreshableProps) {
  const wrapperRef = useRef<View | null>(null);
  const scrollTopRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullValueRef = useRef(0);
  const pull = useRef(new Animated.Value(0)).current;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollTopRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const setPull = useCallback(
    (value: number) => {
      pullValueRef.current = value;
      pull.setValue(value);
    },
    [pull],
  );

  useEffect(() => {
    // rn-web forwardet den Ref eines `View` direkt auf den zugrunde liegenden
    // DOM-Knoten (ein `div`) — kein `getScrollableNode()` o.ä. nötig.
    const node = wrapperRef.current as unknown as HTMLElement | null;
    if (!node) return;

    function onTouchStart(e: TouchEvent) {
      if (refreshing || scrollTopRef.current > 0 || e.touches.length !== 1) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        // Kein Pull (mehr) — normales Scrollen/diagonale Geste, Browser übernimmt.
        startYRef.current = null;
        pullingRef.current = false;
        return;
      }
      pullingRef.current = true;
      e.preventDefault();
      setPull(Math.min(MAX_PULL, dy * RESISTANCE));
    }

    function onTouchEnd() {
      startYRef.current = null;
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullValueRef.current >= THRESHOLD) {
        setPull(PARKED);
        Animated.timing(pull, { toValue: PARKED, duration: SNAP_DURATION, useNativeDriver: false }).start();
        onRefresh();
      } else {
        setPull(0);
        Animated.timing(pull, { toValue: 0, duration: SNAP_DURATION, useNativeDriver: false }).start();
      }
    }

    // touchmove non-passive + capture, damit preventDefault() das
    // Browser-Scrollen zuverlässig vor dem inneren Scroller abfängt.
    node.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    node.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    node.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
    return () => {
      node.removeEventListener('touchstart', onTouchStart, true);
      node.removeEventListener('touchmove', onTouchMove, true);
      node.removeEventListener('touchend', onTouchEnd, true);
      node.removeEventListener('touchcancel', onTouchEnd, true);
    };
  }, [onRefresh, pull, refreshing, setPull]);

  // Query(s) fertig -> zurück auf 0 fahren (deckt sowohl den geparkten Zustand
  // nach eigenem Pull als auch ein von außen gesetztes `refreshing` ab).
  useEffect(() => {
    if (!refreshing) {
      setPull(0);
      Animated.timing(pull, { toValue: 0, duration: SNAP_DURATION, useNativeDriver: false }).start();
    }
  }, [refreshing, pull, setPull]);

  const opacity = pull.interpolate({ inputRange: [0, PARKED], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Animated.View style={[styles.indicator, { opacity }]} pointerEvents="none">
        <ActivityIndicator color={colors.accent} />
      </Animated.View>
      <Animated.View style={[styles.content, { transform: [{ translateY: pull }] }]}>
        {children({ onScroll: handleScroll, scrollEventThrottle: 16 })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
});
