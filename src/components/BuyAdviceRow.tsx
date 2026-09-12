import type { Position } from '@/api/kickbase';
import { positionLabels } from '@/theme/tokens';
import { bidVerdictLabels } from '@/utils/bidAdvice';
import { formatCountdown, formatCurrency, formatValueScore } from '@/utils/format';
import { marketMarkupPercent } from '@/utils/marketList';
import type { ReplacementOption } from '@/utils/replacementAdvice';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import styles from './BuyAdviceRow.module.css';

/** Minimale Feldmenge — von `MarketPlayer` erfüllt. */
export interface BuyAdviceRowPlayer {
  id: string;
  name: string;
  position: Position;
  imageUrl: string | null;
  marketValue: number;
  price: number;
  isBotListing: boolean;
  sellerName: string | null;
  expiresInSeconds: number | null;
  /** Mein eigenes Gebot, `null` ohne (`MarketPlayer.ownOfferPrice`). */
  ownOfferPrice: number | null;
}

interface BuyAdviceRowProps {
  player: BuyAdviceRowPlayer;
  option: ReplacementOption;
  /** Was der Zukauf mit der Elf macht — `describeReplacement`, siehe utils/replacementAdvice.ts. */
  note: string;
  /** Größter absoluter Zugewinn der Liste. */
  bestGain?: boolean;
  /** Größter Zugewinn je Mio der Liste. */
  bestEfficiency?: boolean;
  onClick?: (player: BuyAdviceRowPlayer) => void;
  /** Öffnet den Gebots-Dialog. Ohne Handler bleibt die Zeile reine Analyse. */
  onBid?: (player: BuyAdviceRowPlayer) => void;
}

/**
 * Zeile der Kaufempfehlung. Aufbau bewusst wie SellAdviceRow (Positions-Tag,
 * Bild, Info-Spalte, Badge-Spalte, Begründung darunter) — es ist dieselbe
 * Entscheidungsart, nur in die andere Richtung.
 *
 * Vier Zahlen, in dieser Reihenfolge, weil die Frage in dieser Reihenfolge
 * gestellt wird: Was bringt er (Zugewinn)? Was bringt er pro Million
 * (Effizienz)? Was kostet er (Angebotspreis, Aufschlag zum Marktwert)? Was
 * soll ich bieten (Empfehlung)? Die letzte ist die einzige, die eine Handlung
 * verlangt, und trägt deshalb den Knopf daneben.
 *
 * Wie SellAdviceRow ein `div role="button"` und kein `<button>`: der
 * „Bieten"-Knopf liegt darin, und ein Button im Button wäre ungültiges HTML.
 */
export function BuyAdviceRow({
  player,
  option,
  note,
  bestGain = false,
  bestEfficiency = false,
  onClick,
  onBid,
}: BuyAdviceRowProps) {
  const markup = marketMarkupPercent(player.price, player.marketValue);
  // Ausgeschrieben statt als „+10 %" wie in MarketRow: dort steht der Wert in
  // einer eigenen Zelle unter der Überschrift „Preis", hier mitten in einer
  // Metazeile, in der ein nacktes Vorzeichen nichts einordnet.
  const markupLabel =
    markup === null
      ? null
      : `${Math.abs(markup).toLocaleString('de-DE')} % ${markup > 0 ? 'über' : 'unter'} MW`;
  const { bid } = option;
  // Ein Spieler, auf den ich schon geboten habe, bleibt eine Empfehlung —
  // aber die Zeile muss es sagen, sonst liest sich „X bieten" wie eine
  // Aufforderung, ein zweites Mal zu bieten. Und der Knopf ändert dann das
  // Gebot, er gibt keines ab (Upsert, siehe endpoints.ts).
  const hasOwnOffer = player.ownOfferPrice != null;

  return (
    <div
      className={styles.row}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: () => onClick(player),
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick(player);
              }
            },
          }
        : {})}
    >
      <div className={styles.topRow}>
        <span className={styles.positionTag} data-position={player.position}>
          {positionLabels[player.position]}
        </span>

        {player.imageUrl ? (
          <img src={player.imageUrl} alt="" className={styles.image} loading="lazy" />
        ) : (
          <span className={cx(styles.image, styles.imageFallback)} />
        )}

        <span className={styles.info}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{player.name}</span>
            {/* Beide Auszeichnungen können auf verschiedenen Zeilen stehen —
                „am besten" und „am effizientesten" sind zwei Antworten. */}
            {bestGain && <span className={styles.tag}>★ bester Zugewinn</span>}
            {bestEfficiency && <span className={styles.tag}>⚡ effizientester</span>}
          </span>
          <span className={styles.gainRow}>
            <span className={styles.gain}>+{formatValueScore(option.gain)} Ø-Punkte</span>
            <span className={styles.meta}>
              {formatValueScore(option.gainPerMillion)} Ø-Pkt/Mio
            </span>
          </span>
          <span className={styles.meta}>
            {formatCurrency(player.price)}
            {markupLabel !== null && ` · ${markupLabel}`}
            {' · '}
            {player.isBotListing ? 'Kickbase' : (player.sellerName ?? 'Manager')}
            {player.expiresInSeconds != null &&
              ` · ${formatCountdown(player.expiresInSeconds * 1000)}`}
          </span>
          {hasOwnOffer && (
            <span className={styles.ownOffer}>
              Dein Gebot: {formatCurrency(player.ownOfferPrice!)}
            </span>
          )}
        </span>

        <span className={styles.badgeColumn}>
          <span className={styles.badge} data-verdict={bid.verdict}>
            {bidVerdictLabels[bid.verdict]}
          </span>
          {bid.bid !== null && <span className={styles.bid}>{formatCurrency(bid.bid)}</span>}
          {onBid && (
            <button
              type="button"
              // Die Zeile öffnet das Spieler-Detail — der Knopf darf das nicht
              // mitauslösen (siehe SellAdviceRow).
              onClick={(event) => {
                event.stopPropagation();
                onBid(player);
              }}
              className={cx(layout.pressable, layout.hitSlopSm, styles.bidButton)}
              aria-label={`Gebot für ${player.name} ${hasOwnOffer ? 'ändern' : 'abgeben'}`}
            >
              {hasOwnOffer ? 'Ändern' : 'Bieten'}
            </button>
          )}
        </span>
      </div>

      <p className={styles.reason}>
        {note} {bid.reason}
      </p>
    </div>
  );
}
