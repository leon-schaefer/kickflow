import { describe, expect, it } from 'vitest';
import {
  type InstallHintInput,
  installHintKind,
  isAndroidDevice,
  isIosDevice,
} from './installHint';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_OS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0';

function input(overrides: Partial<InstallHintInput> = {}): InstallHintInput {
  return {
    standalone: false,
    seen: false,
    hasPrompt: false,
    userAgent: IPHONE,
    maxTouchPoints: 5,
    ...overrides,
  };
}

describe('isIosDevice', () => {
  it('erkennt iPhone und iPad', () => {
    expect(isIosDevice(IPHONE, 5)).toBe(true);
    // iPadOS 13+ gibt sich als Macintosh aus — nur die Touchpunkte
    // unterscheiden es noch vom Mac.
    expect(isIosDevice(IPAD_OS, 5)).toBe(true);
  });

  it('hält den Mac für einen Mac', () => {
    expect(isIosDevice(IPAD_OS, 0)).toBe(false);
    expect(isIosDevice(DESKTOP_FIREFOX, 0)).toBe(false);
  });
});

describe('isAndroidDevice', () => {
  it('erkennt Android', () => {
    expect(isAndroidDevice(ANDROID)).toBe(true);
    expect(isAndroidDevice(IPHONE)).toBe(false);
  });
});

describe('installHintKind', () => {
  it('schweigt in der installierten PWA', () => {
    // Dort ist die Frage schon beantwortet; ein Vorschlag wäre nur Lärm.
    expect(installHintKind(input({ standalone: true }))).toBeNull();
    expect(installHintKind(input({ standalone: true, hasPrompt: true }))).toBeNull();
  });

  it('schweigt, wenn der Hinweis schon einmal da war', () => {
    expect(installHintKind(input({ seen: true }))).toBeNull();
    expect(installHintKind(input({ seen: true, hasPrompt: true }))).toBeNull();
  });

  it('bevorzugt den Browser-Dialog vor jeder Anleitung', () => {
    // Der Button ist der kürzere Weg — wo Chromium ihn anbietet, ist eine
    // Klickanleitung durch Menüs schlechter.
    expect(installHintKind(input({ userAgent: ANDROID, hasPrompt: true }))).toBe('native');
    expect(installHintKind(input({ userAgent: DESKTOP_FIREFOX, hasPrompt: true }))).toBe(
      'native',
    );
  });

  it('gibt iOS die Teilen-Anleitung', () => {
    // WebKit kennt `beforeinstallprompt` nicht; ohne Anleitung findet den Weg
    // über das Teilen-Menü praktisch niemand.
    expect(installHintKind(input({ userAgent: IPHONE }))).toBe('ios');
    expect(installHintKind(input({ userAgent: IPAD_OS, maxTouchPoints: 5 }))).toBe('ios');
  });

  it('gibt Android ohne Event die Menü-Anleitung', () => {
    // Firefox für Android installiert über sein Menü, feuert aber kein Event.
    expect(installHintKind(input({ userAgent: ANDROID }))).toBe('android');
  });

  it('schweigt, wo es nichts zu installieren gibt', () => {
    // Desktop-Firefox/Safari ohne Event: ein Hinweis ohne Weg dahinter wäre
    // schlechter als keiner.
    expect(installHintKind(input({ userAgent: DESKTOP_FIREFOX, maxTouchPoints: 0 }))).toBeNull();
  });
});
