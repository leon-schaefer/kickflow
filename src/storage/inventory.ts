import {
  APP_KEY_PREFIX,
  INSTALL_HINT_KEY,
  LAST_LEAGUE_KEY,
  SESSION_KEY,
  excludedFromSaleKey,
  leagueRulesKey,
} from './keys';

/**
 * Was kickflow auf dem Gerät ablegt — in Worten, für die
 * Datenschutzerklärung.
 *
 * Warum das Code ist und kein Absatz im Text der Rechtsseite: die Auskunft
 * „wir speichern X" ist nur so lange richtig, wie X stimmt. Ein neuer
 * localStorage-Schlüssel ist ein Zweizeiler in keys.ts, und niemand denkt
 * dabei an eine Rechtsseite in einem anderen Verzeichnis. Als Datenstruktur
 * mit Test daneben (inventory.test.ts) fällt genau das auf: der Test kennt
 * jeden exportierten Schlüssel aus keys.ts und verlangt für jeden einen
 * Eintrag hier.
 *
 * Das ist die eigentliche Arbeit hinter „was speichert die App": nicht der
 * Text, sondern dass er nicht veraltet. Ohne diese Kopplung ist eine
 * Speicher-Auskunft ein Schnappschuss vom Tag ihrer Formulierung.
 *
 * ABGRENZUNG: Diese Liste beschreibt LOKALEN Speicher, keine Cookies.
 * kickflow setzt keine. Das ist der Grund, warum die App kein Consent-Banner
 * trägt: § 25 Abs. 2 Nr. 2 TTDSG nimmt Speicherzugriffe aus, die für den
 * ausdrücklich gewünschten Dienst unbedingt erforderlich sind, und jeder
 * Eintrag unten ist genau das — er hält entweder die Anmeldung oder eine
 * Einstellung, die der Nutzer selbst gesetzt hat. Es gibt nichts, wozu ein
 * Banner eine Wahl anbieten könnte. Käme je etwas hinzu, das NICHT
 * erforderlich ist (Reichweitenmessung, Fremdinhalte), fällt diese Begründung
 * — dann braucht es Einwilligung, und zwar VOR dem Zugriff.
 */
export interface StorageEntry {
  /**
   * Der Schlüssel, wie er im localStorage steht. Für die pro-Liga-Schlüssel
   * mit `<Liga-ID>` als Platzhalter, weil es je Liga einen gibt.
   */
  key: string;
  /** Kurzname für die Tabelle. */
  label: string;
  /** Was drinsteht und warum — für Laien, nicht für Entwickler. */
  purpose: string;
  /** Wie lange es bleibt und was es entfernt. */
  lifetime: string;
  /**
   * Ob der Eintrag personenbezogene Daten enthält. Steuert nur den Hinweis in
   * der Tabelle; die Rechtsfolge steht im Text der Seite.
   */
  personal: boolean;
}

export const STORAGE_INVENTORY: readonly StorageEntry[] = [
  {
    key: SESSION_KEY,
    label: 'Anmeldung',
    purpose:
      'Dein Kickbase-Zugriffstoken, das Refresh-Token sowie deine Kickbase-Nutzer-ID und dein Anzeigename. Damit bleibst du angemeldet und die App erkennt, welche Zeile der Liga-Tabelle deine ist. Dein Passwort wird nicht gespeichert — es geht einmal an Kickbase und wird danach verworfen.',
    lifetime: 'Bis zum Abmelden oder bis du die lokalen Daten löschst.',
    personal: true,
  },
  {
    key: LAST_LEAGUE_KEY,
    label: 'Zuletzt genutzte Liga',
    purpose:
      'Die ID der Liga, die du zuletzt geöffnet hast — nur für die Markierung in der Ligen-Auswahl.',
    lifetime: 'Bis du die lokalen Daten löschst.',
    personal: false,
  },
  {
    key: leagueRulesKey('<Liga-ID>'),
    label: 'Aufstellungs-Regeln',
    purpose:
      'Deine Einstellungen für den Optimizer (Formation, Budgetgrenze, maximale Spieler pro Verein), je Liga getrennt.',
    lifetime: 'Bis du die lokalen Daten löschst.',
    personal: false,
  },
  {
    key: excludedFromSaleKey('<Liga-ID>'),
    label: 'Verkaufs-Ausschlüsse',
    purpose:
      'Welche Spieler du vom Verkaufsvorschlag ausgenommen hast, je Liga getrennt.',
    lifetime: 'Bis du die lokalen Daten löschst.',
    personal: false,
  },
  {
    key: INSTALL_HINT_KEY,
    label: 'Installations-Hinweis',
    purpose:
      'Ein einzelner Merker, dass der Hinweis zum Installieren der App einmal gezeigt wurde — damit er nicht wiederkehrt.',
    lifetime: 'Bis du die lokalen Daten löschst.',
    personal: false,
  },
];

/**
 * Das Präfix als Text für die Rechtsseite. Dort steht, dass „Lokale Daten
 * löschen" alles mit diesem Präfix entfernt — der Satz soll den echten Wert
 * nennen und nicht eine Kopie davon.
 */
export const STORAGE_KEY_PREFIX = APP_KEY_PREFIX;
