import { useEffect, useState } from 'react';
import type { SquadPlayer } from '@/api/kickbase';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useListPlayerOnMarket } from '@/queries/hooks';
import { formatCurrency } from '@/utils/format';
import {
  applyMarkup,
  buildListingDraft,
  listingTotals,
  selectedListings,
  setEntryPrice,
  toggleEntry,
  validateListing,
  type ListingEntry,
} from '@/utils/marketListing';
import { formatCurrencyInputText } from '@/utils/offer';
import type { SellPlan } from '@/utils/sellPlan';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './MarketListingModal.module.css';
import { Checkbox } from './Checkbox';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import { TextField } from './TextField';

interface MarketListingModalProps {
  open: boolean;
  onClose: () => void;
  /** Der eigene Kader — Namen, Marktwerte und `onMarket` je vorgeschlagenem Spieler. */
  players: readonly SquadPlayer[];
  /** Pflichtverkaufsplan (utils/sellPlan.ts): bestimmt Auswahl UND Reihenfolge. */
  plan: SellPlan | null;
  /** Aktueller Kontostand — bei Pflichtverkäufen negativ. */
  budget: number;
}

/** Aufschläge der Schnellwahl. Kickbase zahlt exakt den Marktwert, Mitspieler oft mehr. */
const MARKUPS = [
  { markup: 0, label: 'MW' },
  { markup: 0.05, label: '+5 %' },
  { markup: 0.1, label: '+10 %' },
];

/** Ergebnis EINES Listings: erfolgreich, oder die Fehlermeldung der API. */
type ListingResult = 'done' | string;

/**
 * „Auf den Markt stellen" — stellt die Pflichtverkäufe des Aufstellungs-
 * Screens in einem Zug zum Verkauf ein.
 *
 * Der Dialog ist bewusst ein Modal und keine weitere Sektion auf dem
 * Aufstellungs-Screen: dort steht die Empfehlung, wer weg soll, ohnehin schon
 * (SellAdviceSection) — was fehlte, war die Ausführung, und die braucht ein
 * Preisfeld je Spieler. Als Panel bleibt der Screen so lang wie zuvor.
 *
 * Die Listings gehen NACHEINANDER raus, nicht parallel: bei einem Fehler
 * mittendrin ist dann eindeutig, wer schon steht und wer nicht (das Ergebnis
 * steht an jeder Zeile), und der Schwung Requests bleibt Cloudflare fern —
 * dieselbe Überlegung wie beim Concurrency-Gate in api/kickbase/limiter.ts.
 */
export function MarketListingModal({ open, onClose, players, plan, budget }: MarketListingModalProps) {
  const leagueId = useLeagueId();
  const listPlayer = useListPlayerOnMarket(leagueId);
  const [entries, setEntries] = useState<ListingEntry[]>([]);
  const [markup, setMarkup] = useState(0);
  const [results, setResults] = useState<Record<string, ListingResult>>({});
  const [submitting, setSubmitting] = useState(false);

  // Nur beim Öffnen vorbelegen, nicht bei jeder Planänderung: ein Refetch im
  // Hintergrund (Marktwert-Update, Pull-to-Refresh) darf eingetippte Preise
  // und abgewählte Spieler nicht überschreiben — dieselbe Überlegung wie beim
  // `player?.id`-Effekt im OfferModal.
  useEffect(() => {
    if (!open) return;
    setEntries(buildListingDraft(players, plan?.sell.map((entry) => entry.playerId) ?? []));
    setMarkup(0);
    setResults({});
  }, [open]);

  if (!open) return null;

  const totals = listingTotals(entries, budget);
  const validationError = validateListing(entries);
  const failures = Object.values(results).filter((result) => result !== 'done').length;

  function chooseMarkup(next: number) {
    setMarkup(next);
    setEntries((current) => applyMarkup(current, next));
  }

  async function handleSubmit() {
    const listings = selectedListings(entries);
    if (listings.length === 0) return;
    setSubmitting(true);

    const next: Record<string, ListingResult> = {};
    for (const listing of listings) {
      try {
        await listPlayer.mutateAsync(listing);
        next[listing.playerId] = 'done';
        // Erledigte Zeile sofort entschärfen: ein zweiter Anlauf nach einem
        // Fehler weiter unten soll sie nicht erneut listen.
        setEntries((current) =>
          current.map((entry) =>
            entry.playerId === listing.playerId
              ? { ...entry, selected: false, alreadyListed: true }
              : entry,
          ),
        );
      } catch (err) {
        next[listing.playerId] =
          err instanceof Error ? err.message : 'Konnte nicht auf den Markt gestellt werden.';
      }
      setResults({ ...next });
    }

    setSubmitting(false);
    if (Object.values(next).every((result) => result === 'done')) onClose();
  }

  /** Zweitzeile der Checkbox: erst das Ergebnis, sonst der Zustand des Spielers. */
  function entryHint(entry: ListingEntry): string {
    const result = results[entry.playerId];
    if (result === 'done') return 'Steht jetzt am Markt.';
    if (result) return result;
    if (entry.alreadyListed) return 'Steht bereits am Markt.';
    return `Marktwert ${formatCurrency(entry.marketValue)}`;
  }

  return (
    <Modal open onClose={onClose} title="Auf den Markt stellen">
      {entries.length === 0 ? (
        <p className={styles.hint}>Kein Spieler zum Verkauf vorgeschlagen.</p>
      ) : (
        <>
          <p className={styles.intro}>
            Konto {formatCurrency(budget)} — vorgeschlagen sind die Pflichtverkäufe in der
            empfohlenen Reihenfolge. Preise sind Angebotspreise, nicht der erzielte Erlös.
          </p>

          <div className={styles.chipRow} role="group" aria-label="Angebotspreis">
            {MARKUPS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={markup === option.markup}
                className={cx(layout.pressable, styles.chip)}
                onClick={() => chooseMarkup(option.markup)}
                disabled={submitting}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.list}>
            {entries.map((entry) => (
              <div key={entry.playerId} className={styles.row}>
                <span className={styles.rowLabel}>
                  <Checkbox
                    label={entry.name}
                    hint={entryHint(entry)}
                    checked={entry.selected}
                    disabled={entry.alreadyListed || submitting}
                    onChange={() => setEntries((current) => toggleEntry(current, entry.playerId))}
                  />
                </span>
                <TextField
                  className={styles.priceField}
                  inputMode="numeric"
                  aria-label={`Preis für ${entry.name}`}
                  value={entry.priceText}
                  onChange={(text) =>
                    setEntries((current) =>
                      setEntryPrice(current, entry.playerId, formatCurrencyInputText(text)),
                    )
                  }
                  disabled={entry.alreadyListed || submitting}
                  clearLabel={`Preis für ${entry.name} löschen`}
                  suffix={
                    <span className={styles.inputSuffix} aria-hidden="true">
                      €
                    </span>
                  }
                />
              </div>
            ))}
          </div>

          <p className={cx(styles.summary, !totals.covers && styles.summaryNegative)}>
            {totals.count === 1 ? '1 Spieler' : `${totals.count} Spieler`} ·{' '}
            {formatCurrency(totals.proceeds)} → Konto {formatCurrency(totals.balanceAfter)}
            {!totals.covers && ` · es fehlen ${formatCurrency(totals.shortfall)}`}
          </p>
          <p className={styles.hint}>
            Erlös geschätzt zum Angebotspreis — ob und zu welchem Preis verkauft wird, entscheidet
            der Markt.
          </p>
        </>
      )}

      {/* role="alert": die Meldung erscheint erst nach einer Aktion. */}
      {failures > 0 && (
        <p className={styles.error} role="alert">
          {failures === 1
            ? '1 Spieler konnte nicht gelistet werden — Grund steht an der Zeile.'
            : `${failures} Spieler konnten nicht gelistet werden — Gründe stehen an den Zeilen.`}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={cx(layout.pressable, styles.cancelButton)}
          onClick={onClose}
          disabled={submitting}
        >
          {failures > 0 ? 'Schließen' : 'Abbrechen'}
        </button>
        <button
          type="button"
          className={cx(layout.pressable, styles.submitButton)}
          onClick={handleSubmit}
          disabled={!!validationError || submitting}
        >
          {submitting ? <Spinner color="currentColor" /> : 'Auf den Markt stellen'}
        </button>
      </div>

      {validationError && entries.length > 0 && <p className={styles.hint}>{validationError}</p>}
    </Modal>
  );
}
