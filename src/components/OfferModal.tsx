import { useEffect, useState } from 'react';
import type { MarketPlayer } from '@/api/kickbase';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { usePlaceOffer, useRemoveOffer } from '@/queries/hooks';
import { formatCountdown, formatCurrency } from '@/utils/format';
import {
  formatCurrencyInput,
  formatCurrencyInputText,
  parseCurrencyInput,
  validateOffer,
} from '@/utils/offer';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './OfferModal.module.css';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import { TextField } from './TextField';

interface OfferModalProps {
  /** null = Dialog ist zu. */
  player: MarketPlayer | null;
  onClose: () => void;
}

/**
 * Gebots-Dialog aus dem Markt-Tab. Die Hülle ist das gemeinsame `Modal`
 * (Portal nach document.body + `<dialog>`), die Formularteile stammen aus dem
 * Login-Screen.
 */
export function OfferModal({ player, onClose }: OfferModalProps) {
  const leagueId = useLeagueId();
  const placeOffer = usePlaceOffer(leagueId);
  const removeOffer = useRemoveOffer(leagueId);
  // excludePlayerId: ein erneutes Gebot auf DIESEN Spieler ersetzt das
  // bestehende (Upsert, siehe endpoints.ts) statt es zu addieren.
  const limit = useBudgetLimit(player?.id);
  const [priceText, setPriceText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Feld bei jedem neu geöffneten Spieler neu vorbelegen — mit dem eigenen
  // Gebot, falls schon eins liegt, sonst mit dem Angebotspreis. Bewusst auf
  // player.id statt player selbst: ein Refetch während der Dialog offen ist
  // (z.B. Pull-to-Refresh im Hintergrund) darf die Eingabe nicht überschreiben.
  useEffect(() => {
    if (player) {
      setPriceText(formatCurrencyInput(player.ownOfferPrice ?? player.price));
      setError(null);
    }
  }, [player?.id]);

  if (!player) return null;

  const price = parseCurrencyInput(priceText);
  const hasOwnOffer = player.ownOfferPrice != null;
  const validationError = validateOffer({ price, available: limit?.available ?? null });
  const isSubmitting = placeOffer.isPending || removeOffer.isPending;
  // Kontostand danach, wenn alle offenen Gebote inkl. diesem angenommen würden —
  // rot erst, sobald die 33%-Untergrenze unterschritten wird, nicht schon bei < 0.
  const balanceAfter = limit && price !== null ? limit.balanceAfterPendingOffers - price : null;
  const balanceAfterBelowLimit =
    limit !== null && balanceAfter !== null && balanceAfter < limit.minBalance;

  function setQuickPrice(value: number) {
    setPriceText(formatCurrencyInput(Math.round(value)));
  }

  async function handleSubmit() {
    if (price === null) return;
    setError(null);
    try {
      await placeOffer.mutateAsync({ playerId: player!.id, price });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebot konnte nicht abgegeben werden.');
    }
  }

  async function handleRemove() {
    if (!player!.ownOfferId) return;
    setError(null);
    try {
      await removeOffer.mutateAsync({ playerId: player!.id, offerId: player!.ownOfferId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebot konnte nicht zurückgezogen werden.');
    }
  }

  const facts: { label: string; value: string }[] = [
    { label: 'Marktwert', value: formatCurrency(player.marketValue) },
    { label: 'Angebot', value: formatCurrency(player.price) },
    ...(player.expiresInSeconds != null
      ? [{ label: 'Läuft ab', value: formatCountdown(player.expiresInSeconds * 1000) }]
      : []),
    {
      label: 'Verkäufer',
      value: player.isBotListing ? 'Kickbase' : (player.sellerName ?? 'Unbekannt'),
    },
    ...(limit ? [{ label: 'Verfügbar', value: formatCurrency(limit.available) }] : []),
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`${hasOwnOffer ? 'Gebot ändern für' : 'Gebot für'} ${player.name}`}
    >
      {/* Beschreibungsliste statt Zeilen aus zwei Spans: Bezeichnung und Wert
          gehören inhaltlich zusammen, und ein Screenreader liest sie dann als
          Paar. */}
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.factRow}>
            <dt className={styles.factLabel}>{fact.label}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {limit && (
        <p className={styles.hint}>
          Rahmen {formatCurrency(limit.overdraftAllowance)} (33 % vom Kaderwert)
          {limit.pendingOffers > 0 &&
            ` · ${formatCurrency(limit.pendingOffers)} in offenen Geboten`}
        </p>
      )}

      <label className={styles.sectionLabel} htmlFor="offer-price">
        Mein Gebot
      </label>
      <TextField
        id="offer-price"
        className={styles.priceField}
        inputMode="numeric"
        value={priceText}
        onChange={(text) => setPriceText(formatCurrencyInputText(text))}
        placeholder="0"
        clearLabel="Gebot löschen"
        suffix={
          <span className={styles.inputSuffix} aria-hidden="true">
            €
          </span>
        }
      />

      <div className={styles.chipRow}>
        <button
          type="button"
          className={cx(layout.pressable, styles.chip)}
          onClick={() => setQuickPrice(player.marketValue)}
        >
          MW
        </button>
        <button
          type="button"
          className={cx(layout.pressable, styles.chip)}
          onClick={() => setQuickPrice(player.price * 1.05)}
        >
          +5%
        </button>
        <button
          type="button"
          className={cx(layout.pressable, styles.chip)}
          onClick={() => setQuickPrice(player.price * 1.1)}
        >
          +10%
        </button>
      </div>

      {balanceAfter !== null && (
        <p className={cx(styles.budgetHint, balanceAfterBelowLimit && styles.budgetHintNegative)}>
          Konto danach: {formatCurrency(balanceAfter)}
        </p>
      )}

      {/* role="alert": die Meldung erscheint erst nach einer Aktion. */}
      {(error ?? validationError) && (
        <p className={styles.error} role="alert">
          {error ?? validationError}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={cx(layout.pressable, styles.cancelButton)}
          onClick={onClose}
          disabled={isSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="button"
          className={cx(layout.pressable, styles.submitButton)}
          onClick={handleSubmit}
          disabled={!!validationError || isSubmitting}
        >
          {placeOffer.isPending ? (
            <Spinner color="currentColor" />
          ) : hasOwnOffer ? (
            'Gebot ändern'
          ) : (
            'Gebot abgeben'
          )}
        </button>
      </div>

      {hasOwnOffer && (
        <button
          type="button"
          className={cx(layout.pressableV, styles.removeAction)}
          onClick={handleRemove}
          disabled={isSubmitting}
        >
          {removeOffer.isPending ? <Spinner color="currentColor" /> : 'Gebot zurückziehen'}
        </button>
      )}
    </Modal>
  );
}
