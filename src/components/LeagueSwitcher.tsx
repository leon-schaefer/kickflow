import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { LeagueSummary } from '@/api/kickbase';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { setLastLeagueId } from '@/leagues/lastLeague';
import { useCurrentLeague } from '@/leagues/useCurrentLeague';
import { useLeagues } from '@/queries/hooks';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './LeagueSwitcher.module.css';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

/**
 * Ersetzt den Tab-Header-Titel: zeigt die aktuelle Liga und öffnet per Tap
 * einen Dialog zum Wechseln, ohne den Picker (`/leagues`) betreten zu müssen.
 * Vorher gab es aus einer Liga heraus keinen Weg zurück, weil der
 * `[leagueId]`-Screen keinen Header hatte.
 */
export function LeagueSwitcher() {
  const leagueId = useLeagueId();
  const currentLeague = useCurrentLeague();
  const { data: leagues } = useLeagues();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function selectLeague(league: LeagueSummary) {
    setOpen(false);
    if (league.id === leagueId) return;
    await setLastLeagueId(league.id);
    // `replace`: der Liga-Wechsel soll keinen History-Eintrag hinterlassen,
    // sonst führt Zurück in die alte Liga.
    navigate(`/${league.id}/lineup`, { replace: true });
  }

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      <button
        type="button"
        className={cx(layout.pressableH, layout.hitSlop, styles.trigger)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={styles.triggerText}>{currentLeague?.name ?? 'Liga'}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Liga wechseln">
        {!leagues ? (
          <span className={styles.loading}>
            <Spinner />
          </span>
        ) : (
          <ul className={styles.list}>
            {leagues.map((league) => (
              <li key={league.id}>
                <button
                  type="button"
                  className={cx(layout.pressableH, styles.row)}
                  onClick={() => selectLeague(league)}
                  // Die aktuelle Liga bleibt anwählbar (sie schließt dann nur
                  // den Dialog), ist aber als aktiv angekündigt — der Haken
                  // war vorher die einzige Auszeichnung.
                  aria-current={league.id === leagueId ? 'true' : undefined}
                >
                  <span className={styles.rowText}>{league.name}</span>
                  {league.id === leagueId && (
                    <span className={styles.checkmark} aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.footerRow}>
          <button
            type="button"
            className={cx(layout.pressableV, styles.footer)}
            onClick={() => go('/leagues')}
          >
            Meine Ligen
          </button>
          <button
            type="button"
            className={cx(layout.pressableV, styles.footer)}
            onClick={() => go('/settings')}
          >
            Einstellungen
          </button>
        </div>
      </Modal>
    </>
  );
}
