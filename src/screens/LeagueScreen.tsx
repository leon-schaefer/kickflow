import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { LeagueRankingEntry } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { LeagueSwitcher } from '@/components/LeagueSwitcher';
import { MaxPerTeamRuleCard } from '@/components/MaxPerTeamRuleCard';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { leagueTabTitles } from '@/leagues/leagueTabs';
import { useCompetitionId } from '@/leagues/useCompetitionId';
import { useLeagueRulesContext } from '@/lineup/LeagueRulesContext';
import { DEFAULT_RULES, type MaxPerTeamRule } from '@/lineup/rules';
import { useLeagueRanking, useMatchdays } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { withOrigin } from '@/shell/useBackTarget';
import { cx } from '@/utils/cx';
import { formatCurrency, formatPoints } from '@/utils/format';
import { resolveMatchdayState } from '@/utils/matchday';
import layout from '@/theme/layout.module.css';
import styles from './LeagueScreen.module.css';

/**
 * Liga-Tabelle über `/v4/leagues/{id}/ranking`. Zeigt Platzierung, Punkte und
 * Teamwert jedes Managers; ein Antippen öffnet dessen Startelf. Season-Ansicht
 * only — ein Spieltags-Umschalter (dayNumber) ist bewusst nicht Teil dieser
 * ersten Version.
 *
 * Kopfbereich zeigt zusätzlich, sofern vorhanden: das aktuelle Duell (Kickbases
 * Kopf-an-Kopf-Modus, `hhoui` auf LeagueRankingEntry) und die liga-eigene
 * maxPerTeam-Regel (sonst nur über den Regel-Screen erreichbar) — beides
 * betrifft die ganze Liga, nicht nur den eigenen Kader, gehört also hierher.
 */
export function LeagueScreen() {
  const leagueId = useLeagueId();
  const competitionId = useCompetitionId();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const rankingQuery = useLeagueRanking(leagueId);
  const { data } = rankingQuery;
  const matchdaysQuery = useMatchdays(competitionId);
  const { rules, updateRule, loaded, leagueMax } = useLeagueRulesContext();
  const refresh = useRefresh(rankingQuery);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.entries].sort((a, b) => a.seasonPlace - b.seasonPlace);
  }, [data]);

  // Anders als im Restprogramm und im Aufstellungs-Tab zählt hier der
  // LAUFENDE Spieltag zuerst, nicht der nächste offene — das Duell
  // interessiert während des Spieltags, nicht erst danach.
  const matchdayState = useMemo(() => {
    if (!matchdaysQuery.data) return null;
    return resolveMatchdayState(matchdaysQuery.data, Date.now());
  }, [matchdaysQuery.data]);
  const matchday =
    matchdayState?.running?.day ??
    matchdayState?.open?.day ??
    matchdaysQuery.data?.currentDay ??
    null;

  const maxPerTeamRule = (rules.find((rule): rule is MaxPerTeamRule => rule.kind === 'maxPerTeam') ??
    DEFAULT_RULES[0]) as MaxPerTeamRule;

  function openManager(entry: LeagueRankingEntry) {
    navigate(
      `/${leagueId}/manager/${entry.userId}`,
      withOrigin(`/${leagueId}/league`, leagueTabTitles.league),
    );
  }

  const header = <AppHeader title={<LeagueSwitcher />} />;

  if (!data) {
    return (
      <>
        {header}
        <QueryState query={rankingQuery} label="Liga-Tabelle" refresh={refresh} />
      </>
    );
  }

  const own = data.entries.find((e) => e.userId === userId) ?? null;
  // `h2hOpponentUserId` fehlt in Ligen ohne Duell-Modus komplett (siehe
  // LeagueRankingEntry) — Karte und Zeilen-Hervorhebung entfallen dann lautlos.
  const opponent = own?.h2hOpponentUserId
    ? (data.entries.find((e) => e.userId === own.h2hOpponentUserId) ?? null)
    : null;

  return (
    <>
      {header}
      <Refreshable {...refresh}>
        {(p) => (
          <div {...p} className={styles.scroll}>
            {((own && opponent) || loaded) && (
              <div className={styles.headerCards}>
                {own && opponent && (
                  <DuelCard
                    own={own}
                    opponent={opponent}
                    matchday={matchday}
                    onClick={() => openManager(opponent)}
                  />
                )}
                {loaded && (
                  <MaxPerTeamRuleCard
                    rule={maxPerTeamRule}
                    onChange={(patch) => updateRule('maxPerTeam', patch)}
                    leagueMax={leagueMax}
                  />
                )}
              </div>
            )}

            {rows.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyText}>Keine Liga-Tabelle gefunden.</p>
              </div>
            ) : (
              <ol className={styles.list}>
                {rows.map((entry) => (
                  <li key={entry.userId} className={styles.rowSlot}>
                    <ManagerRow
                      entry={entry}
                      isOwn={entry.userId === userId}
                      isOpponent={opponent !== null && entry.userId === opponent.userId}
                      onClick={openManager}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Refreshable>
    </>
  );
}

function DuelCard({
  own,
  opponent,
  matchday,
  onClick,
}: {
  own: LeagueRankingEntry;
  opponent: LeagueRankingEntry;
  matchday: number | null;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cx(layout.pressableV, styles.duelCard)} onClick={onClick}>
      <span className={styles.duelTitle}>
        {matchday ? `Dein Duell · Spieltag ${matchday}` : 'Dein Duell'}
      </span>
      <span className={styles.duelRow}>
        <span className={styles.duelScore}>
          Du {formatPoints(own.matchdayPoints)} : {formatPoints(opponent.matchdayPoints)}{' '}
          {opponent.userName}
        </span>
        <Avatar url={opponent.userImageUrl} className={styles.duelAvatar} />
      </span>
      {own.h2hPlace > 0 && <span className={styles.duelPlace}>Duell-Platz {own.h2hPlace}</span>}
    </button>
  );
}

function ManagerRow({
  entry,
  isOwn,
  isOpponent,
  onClick,
}: {
  entry: LeagueRankingEntry;
  isOwn: boolean;
  isOpponent: boolean;
  onClick: (entry: LeagueRankingEntry) => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        layout.pressableH,
        styles.row,
        isOpponent && styles.rowOpponent,
        isOwn && styles.rowOwn,
      )}
      onClick={() => onClick(entry)}
    >
      <span className={styles.place}>{entry.seasonPlace || '—'}</span>

      <Avatar url={entry.userImageUrl} className={styles.avatar} />

      <span className={styles.info}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{entry.userName}</span>
          {entry.isAdmin && <span className={styles.adminTag}>Admin</span>}
          {isOpponent && <span className={styles.duelTag}>Duell</span>}
        </span>
        <span className={styles.subText}>
          {entry.hasLineupSet ? 'Aufstellung steht' : 'Aufstellung offen'} ·{' '}
          {formatCurrency(entry.teamValue)}
        </span>
      </span>

      <span className={styles.scores}>
        <span className={styles.seasonPoints}>{formatPoints(entry.seasonPoints)}</span>
        <span className={styles.matchdayPoints}>ST {formatPoints(entry.matchdayPoints)}</span>
      </span>
    </button>
  );
}

/** Managerbild oder ein Platzhalter gleicher Größe, damit die Zeile nicht springt. */
function Avatar({ url, className }: { url: string | null; className: string }) {
  if (!url) return <span className={cx(className, styles.avatarFallback)} />;
  return <img src={url} alt="" className={className} loading="lazy" />;
}
