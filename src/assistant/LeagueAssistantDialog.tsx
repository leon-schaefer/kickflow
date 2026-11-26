import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { useLineupDraftContext } from '@/lineup/LineupDraftContext';
import { useTransferData } from '@/lineup/useTransferData';
import { TransferAssistant } from './TransferAssistant';
import { transferContext } from './transferContext';
import styles from './TransferAssistant.module.css';

export default function LeagueAssistantDialog({ onClose }: { onClose: () => void }) {
  const {
    leagueId, competitionId, lineupQuery, data, marketQuery, league, budgetLimit,
    matchdayState, fixtureDifficultyByTeam, optimizer, comparisonSquad,
    comparisonMarket, replacement, openDeadlineMs, displayMatchday,
  } = useTransferData();
  const { editing, formation, draftIds } = useLineupDraftContext();

  if (!data) {
    return (
      <Modal open onClose={onClose} title="KI-Transferassistent">
        {lineupQuery.error ? (
          <>
            <p className={styles.error} role="alert">Der Kader konnte nicht geladen werden.</p>
            <button className={styles.button} type="button" onClick={() => void lineupQuery.refetch()}>
              Erneut versuchen
            </button>
          </>
        ) : <Spinner />}
        <button className={styles.button} type="button" onClick={onClose}>Schließen</button>
      </Modal>
    );
  }

  return (
    <TransferAssistant
      leagueId={leagueId}
      competitionId={competitionId}
      onClose={onClose}
      getContext={() => transferContext({
        squad: comparisonSquad,
        market: marketQuery.data ? comparisonMarket : null,
        lineup: data.players.filter((player) => editing ? draftIds.includes(player.id) : player.inLineup),
        formation: editing ? formation : data.formation,
        matchday: matchdayState?.open?.day ?? displayMatchday,
        deadlineMinutes: openDeadlineMs === null ? null : Math.max(0, Math.ceil(openDeadlineMs / 60_000)),
        balance: league?.budget ?? null,
        budget: budgetLimit,
        constraints: optimizer.constraints,
        metric: optimizer.metric,
        difficulty: fixtureDifficultyByTeam,
        buy: replacement,
        sell: optimizer.sellAdvice,
        sellPlan: optimizer.budgetPlan,
      })}
    />
  );
}
