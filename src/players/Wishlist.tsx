import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import '@/app/zodConfig';
import { z } from 'zod';
import type { MarketPlayer, PlayerDetail } from '@/api/kickbase';
import { useAuth } from '@/auth/AuthProvider';
import { useLeagueId } from '@/leagues/LeagueIdContext';
import { wishlistKey } from '@/storage/keys';
import localStore from '@/storage/local';
import { formatCountdown, formatCurrency } from '@/utils/format';
import { withOrigin } from '@/shell/useBackTarget';
import { TextField } from '@/components/TextField';

const wishes = z.array(z.object({ id: z.string(), name: z.string(), limit: z.number().int().positive() }));
type Wish = z.infer<typeof wishes>[number];

function subscribe(update: () => void) {
  window.addEventListener('storage', update);
  window.addEventListener('wishlist-change', update);
  return () => {
    window.removeEventListener('storage', update);
    window.removeEventListener('wishlist-change', update);
  };
}

function read(raw: string | null): Wish[] {
  try {
    return wishes.parse(JSON.parse(raw ?? '[]'));
  } catch {
    return [];
  }
}

function useWishes() {
  const leagueId = useLeagueId();
  const { userId } = useAuth();
  const key = userId ? wishlistKey(leagueId, userId) : null;
  const raw = useSyncExternalStore(subscribe, () => key && localStore.getItemSync(key));
  function change(id: string, wish?: Wish) {
    if (!key) return false;
    const next = read(localStore.getItemSync(key)).filter((entry) => entry.id !== id);
    if (wish) next.push(wish);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event('wishlist-change'));
      return true;
    } catch {
      return false;
    }
  }
  return { list: read(raw), change, available: !!key, leagueId };
}

export function WishEditor({ player }: { player: PlayerDetail }) {
  const { list, change, available } = useWishes();
  const current = list.find((p) => p.id === player.id);
  const [limit, setLimit] = useState(String(current?.limit ?? player.marketValue));
  const [error, setError] = useState(false);
  const valid = /^\d+$/.test(limit) && Number.isSafeInteger(Number(limit)) && Number(limit) > 0;
  if (!available) return <p>Für die persönliche Wunschliste bitte erneut anmelden.</p>;
  return <details>
    <summary>{current ? 'Auf deiner Wunschliste' : 'Auf die Wunschliste'}</summary>
    <TextField aria-label="Höchstpreis in Euro" value={limit} onChange={setLimit} inputMode="numeric" suffix="€" />
    <button type="button" disabled={!valid} onClick={() => setError(!change(player.id, {
      id: player.id, name: player.name, limit: Number(limit),
    }))}>{current ? 'Höchstpreis speichern' : 'Spieler merken'}</button>
    {current && <button type="button" onClick={() => setError(!change(player.id))}>Von Wunschliste entfernen</button>}
    {error && <p role="alert">Die Wunschliste konnte auf diesem Gerät nicht gespeichert werden.</p>}
  </details>;
}

export function MarketWishlist({ market, updatedAt }: { market: MarketPlayer[]; updatedAt: number }) {
  const { list, leagueId } = useWishes();
  if (!list.length) return null;
  return <details open>
    <summary>Wunschliste ({list.length})</summary>
    <ul>{list.map((wish) => {
      const offer = market.find((p) => p.id === wish.id);
      const remaining = offer?.expiresInSeconds == null ? null : updatedAt + offer.expiresInSeconds * 1000 - Date.now();
      return <li key={wish.id}>
        <Link to={`/${leagueId}/player/${wish.id}`} state={withOrigin(`/${leagueId}/market`, 'Markt').state}>{wish.name}</Link>
        {' · Limit '}{formatCurrency(wish.limit)}{' · '}
        {offer ? <>{formatCurrency(offer.price)} · {offer.price <= wish.limit ? 'im Limit' : 'über Limit'}
          {' · '}{remaining == null ? 'ohne Ablaufzeit' : formatCountdown(remaining)}</> : 'Kein Angebot'}
      </li>;
    })}</ul>
  </details>;
}
