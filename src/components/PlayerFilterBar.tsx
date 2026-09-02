import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Position, Team } from '@/api/kickbase';
import { colors, positionColors, positionLabels, radius, spacing, typography } from '@/theme/tokens';
import type { PlayerFilterCriteria } from '@/utils/playerFilter';
import { isPlayerFilterActive } from '@/utils/playerFilter';
import { TeamLogo } from './TeamLogo';

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

interface PlayerFilterBarProps {
  criteria: PlayerFilterCriteria;
  onChange: (criteria: PlayerFilterCriteria) => void;
  /** Vereins-Chips nur, wenn Teams bekannt sind — auf einigen Screens (noch) nicht geladen. */
  teams?: Team[];
}

/**
 * Suche + Positions-/Status-/Vereins-Chips für Kader und Transfermarkt.
 * Reiner Presenter — die eigentliche Filterlogik steckt in `filterPlayers`
 * (src/utils/playerFilter.ts), damit sie ohne UI testbar bleibt.
 */
export function PlayerFilterBar({ criteria, onChange, teams }: PlayerFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const active = isPlayerFilterActive(criteria);

  function togglePosition(position: Position) {
    const positions = criteria.positions.includes(position)
      ? criteria.positions.filter((p) => p !== position)
      : [...criteria.positions, position];
    onChange({ ...criteria, positions });
  }

  function toggleFitOnly() {
    onChange({ ...criteria, statuses: criteria.statuses.includes('fit') ? [] : ['fit'] });
  }

  function toggleTeam(teamId: string) {
    const teamIds = criteria.teamIds.includes(teamId)
      ? criteria.teamIds.filter((id) => id !== teamId)
      : [...criteria.teamIds, teamId];
    onChange({ ...criteria, teamIds });
  }

  function clear() {
    onChange({ query: '', positions: [], statuses: [], teamIds: [] });
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Spieler suchen…"
          placeholderTextColor={colors.textMuted}
          value={criteria.query}
          onChangeText={(query) => onChange({ ...criteria, query })}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={[styles.filterToggle, active && styles.filterToggleActive]}
        >
          <Text style={[styles.filterToggleText, active && styles.filterToggleTextActive]}>
            Filter{active ? ` · ${filterCount(criteria)}` : ''}
          </Text>
        </Pressable>
      </View>

      {expanded && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {POSITIONS.map((position) => {
            const selected = criteria.positions.includes(position);
            return (
              <Pressable
                key={position}
                onPress={() => togglePosition(position)}
                style={[
                  styles.chip,
                  selected && { backgroundColor: `${positionColors[position]}26`, borderColor: positionColors[position] },
                ]}
              >
                <Text style={[styles.chipText, selected && { color: positionColors[position], fontWeight: '700' }]}>
                  {positionLabels[position]}
                </Text>
              </Pressable>
            );
          })}

          <View style={styles.chipDivider} />

          <Pressable
            onPress={toggleFitOnly}
            style={[styles.chip, criteria.statuses.includes('fit') && styles.chipActive]}
          >
            <Text style={[styles.chipText, criteria.statuses.includes('fit') && styles.chipTextActive]}>
              Nur fit
            </Text>
          </Pressable>

          {teams && teams.length > 0 && (
            <>
              <View style={styles.chipDivider} />
              {teams.map((team) => {
                const selected = criteria.teamIds.includes(team.id);
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => toggleTeam(team.id)}
                    style={[styles.teamChip, selected && styles.chipActive]}
                  >
                    <TeamLogo uri={team.logoUrl} size={16} />
                  </Pressable>
                );
              })}
            </>
          )}

          {active && (
            <Pressable onPress={clear} style={styles.clearChip}>
              <Text style={styles.clearChipText}>Zurücksetzen</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function filterCount(criteria: PlayerFilterCriteria): number {
  return criteria.positions.length + criteria.statuses.length + criteria.teamIds.length;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterToggleActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  filterToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterToggleTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  // Gleicher Fix wie in SortChips (src/components/SortChips.tsx): ohne feste
  // Mindesthöhe schrumpft die ScrollView beim Scrollen auf reine Texthöhe.
  chipScroll: {
    flexGrow: 0,
    minHeight: 42,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: 42,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  teamChip: {
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  clearChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  clearChipText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
