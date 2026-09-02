import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MarketPlayer } from '@/api/kickbase';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { useBudgetLimit } from '@/leagues/useBudgetLimit';
import { usePlaceOffer, useRemoveOffer } from '@/queries/hooks';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatCountdown, formatCurrency } from '@/utils/format';
import { formatCurrencyInput, formatCurrencyInputText, parseCurrencyInput, validateOffer } from '@/utils/offer';

interface OfferModalProps {
  /** null = Modal ist zu. */
  player: MarketPlayer | null;
  onClose: () => void;
}

/**
 * Gebots-Dialog aus dem Markt-Tab: Shell aus LeagueSwitcher (transparentes
 * Modal, Backdrop-Pressable), Formularteile aus app/login.tsx.
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
  // player.id statt player selbst: ein Refetch während das Modal offen ist
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
  const balanceAfterBelowLimit = limit !== null && balanceAfter !== null && balanceAfter < limit.minBalance;

  function setQuickPrice(value: number) {
    setPriceText(formatCurrencyInput(Math.round(value)));
  }

  function handlePriceChange(text: string) {
    setPriceText(formatCurrencyInputText(text));
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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.avoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>
              {hasOwnOffer ? 'Gebot ändern für' : 'Gebot für'} {player.name}
            </Text>

            <View style={styles.facts}>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Marktwert</Text>
                <Text style={styles.factValue}>{formatCurrency(player.marketValue)}</Text>
              </View>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Angebot</Text>
                <Text style={styles.factValue}>{formatCurrency(player.price)}</Text>
              </View>
              {player.expiresInSeconds != null && (
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>Läuft ab</Text>
                  <Text style={styles.factValue}>{formatCountdown(player.expiresInSeconds * 1000)}</Text>
                </View>
              )}
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Verkäufer</Text>
                <Text style={styles.factValue}>
                  {player.isBotListing ? 'Kickbase' : (player.sellerName ?? 'Unbekannt')}
                </Text>
              </View>
              {limit && (
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>Verfügbar</Text>
                  <Text style={styles.factValue}>{formatCurrency(limit.available)}</Text>
                </View>
              )}
            </View>
            {limit && (
              <Text style={styles.hint}>
                Rahmen {formatCurrency(limit.overdraftAllowance)} (33 % vom Kaderwert)
                {limit.pendingOffers > 0 && ` · ${formatCurrency(limit.pendingOffers)} in offenen Geboten`}
              </Text>
            )}

            <Text style={styles.sectionLabel}>Mein Gebot</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={priceText}
                onChangeText={handlePriceChange}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.inputSuffix}>€</Text>
            </View>

            <View style={styles.chipRow}>
              <Pressable style={styles.chip} onPress={() => setQuickPrice(player.marketValue)}>
                <Text style={styles.chipText}>MW</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => setQuickPrice(player.price * 1.05)}>
                <Text style={styles.chipText}>+5%</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => setQuickPrice(player.price * 1.1)}>
                <Text style={styles.chipText}>+10%</Text>
              </Pressable>
            </View>

            {balanceAfter !== null && (
              <Text style={[styles.budgetHint, balanceAfterBelowLimit && styles.budgetHintNegative]}>
                Konto danach: {formatCurrency(balanceAfter)}
              </Text>
            )}

            {(error ?? validationError) && <Text style={styles.error}>{error ?? validationError}</Text>}

            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} onPress={onClose} disabled={isSubmitting}>
                <Text style={styles.cancelButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={[styles.submitButton, (!!validationError || isSubmitting) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!!validationError || isSubmitting}
              >
                {placeOffer.isPending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.submitButtonText}>{hasOwnOffer ? 'Gebot ändern' : 'Gebot abgeben'}</Text>
                )}
              </Pressable>
            </View>

            {hasOwnOffer && (
              <Pressable onPress={handleRemove} disabled={isSubmitting} style={styles.removeAction}>
                {removeOffer.isPending ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={styles.removeActionText}>Gebot zurückziehen</Text>
                )}
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoider: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  facts: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  factLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  factValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.small,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputSuffix: {
    ...typography.body,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  budgetHint: {
    ...typography.small,
    color: colors.textMuted,
  },
  budgetHintNegative: {
    color: colors.negative,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
  removeAction: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  removeActionText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
});
