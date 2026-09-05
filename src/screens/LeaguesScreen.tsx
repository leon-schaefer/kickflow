import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { LeagueSummary } from '@/api/kickbase';
import { LogoutButton } from '@/auth/LogoutButton';
import { QueryState } from '@/components/QueryState';
import { Refreshable } from '@/components/Refreshable';
import { getLastLeagueId, setLastLeagueId } from '@/leagues/lastLeague';
import { useLeagues } from '@/queries/hooks';
import { useRefresh } from '@/queries/useRefresh';
import { AppHeader } from '@/shell/AppHeader';
import { formatCurrency } from '@/utils/format';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './LeaguesScreen.module.css';

/**
 * Der Liga-Picker. Einstiegspunkt nach dem Login und über den Fuß des
 * LeagueSwitchers erreichbar.
 *
 * Das „Zuletzt genutzt"-Badge las den Wert vorher in einem `useFocusEffect`,
 * weil der Screen unter React Navigation montiert blieb und der Wert nach
 * einem Liga-Wechsel im Header-Switcher veraltet gewesen wäre. React Router
 * montiert den Screen bei jeder Navigation neu — ein Lesen beim Mount genügt
 * also, und weil `getLastLeagueId()` synchron auf localStorage sitzt, reicht
 * dafür der useState-Initializer ganz ohne Effect.
 */
export function LeaguesScreen() {
  const leaguesQuery = useLeagues();
  const { data: leagues } = leaguesQuery;
  const refresh = useRefresh(leaguesQuery);
  const [lastLeagueId] = useState(getLastLeagueId);
  const navigate = useNavigate();

  async function handleSelect(league: LeagueSummary) {
    await setLastLeagueId(league.id);
    navigate(`/${league.id}/lineup`);
  }

  return (
    <>
      <AppHeader title="Meine Ligen" right={<LogoutButton compact />} />

      {!leagues ? (
        <QueryState query={leaguesQuery} label="Ligen" refresh={refresh} />
      ) : (
        <Refreshable {...refresh}>
          {(p) => (
            <div {...p} className={styles.scroll}>
              {leagues.length === 0 ? (
                <div className={styles.center}>
                  <p className={styles.emptyText}>Keine Ligen gefunden.</p>
                </div>
              ) : (
                <ul className={styles.list}>
                  {leagues.map((league) => (
                    <li key={league.id}>
                      <button
                        type="button"
                        className={cx(layout.pressableV, styles.card)}
                        onClick={() => handleSelect(league)}
                      >
                        <span className={styles.cardHeader}>
                          <span className={styles.leagueName}>{league.name}</span>
                          {league.id === lastLeagueId && (
                            <span className={styles.lastBadge}>Zuletzt genutzt</span>
                          )}
                        </span>
                        <span className={styles.statsRow}>
                          <span className={styles.statText}>
                            Teamwert {formatCurrency(league.teamValue)}
                          </span>
                          {league.memberCount !== null && (
                            <span className={styles.statText}>{league.memberCount} Manager</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Refreshable>
      )}
    </>
  );
}
