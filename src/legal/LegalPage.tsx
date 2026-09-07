import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AppHeader } from '@/shell/AppHeader';
import type { BackTarget, NavOrigin } from '@/shell/useBackTarget';
import styles from './LegalPage.module.css';

interface LegalPageProps {
  title: string;
  /** Datum der letzten inhaltlichen Änderung, als `YYYY-MM-DD`. */
  updated: string;
  children: ReactNode;
}

/**
 * Rahmen der beiden Rechtsseiten (Datenschutz, Nutzungsbedingungen).
 *
 * Beide Seiten sind ÖFFENTLICH, liegen also außerhalb von `RequireAuth`
 * (siehe routes.tsx). Das ist keine Bequemlichkeit: die
 * Datenschutzerklärung muss lesbar sein, BEVOR jemand seine
 * Kickbase-Zugangsdaten eintippt — hinter dem Auth-Gate käme sie zu spät.
 * Aus demselben Grund sind es die einzigen App-Routen, die in der
 * sitemap.xml stehen und die robots.txt nicht sperrt.
 *
 * Genau daraus folgt der Sonderfall beim Zurück-Weg unten: diese Seiten
 * erreicht man aus zwei Welten — vom Login-Fuß (nicht angemeldet) und aus dem
 * Mehr-Tab (angemeldet). `useBackTarget` passt dafür nicht, weil sein
 * Fallback eine Liga-ID braucht; hier entscheidet der Anmeldestatus.
 */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  const back = useLegalBackTarget();

  return (
    <>
      <AppHeader title={title} back={back} />
      <div className={styles.scroll}>
        {/*
         * `<article>` und nicht `<div>`: das ist ein zusammenhängendes
         * Dokument, und Screenreader bieten dafür eine eigene Navigation an.
         */}
        <article className={styles.content}>
          {children}
          {/*
           * Das Datum gehört zu einer Rechtsseite dazu — ohne es lässt sich
           * nicht sagen, welche Fassung jemand gelesen hat. `<time>` mit
           * `dateTime` macht es maschinenlesbar; der sichtbare Text bleibt
           * deutsch formatiert.
           */}
          <p className={styles.updated}>
            Stand:{' '}
            <time dateTime={updated}>
              {new Date(`${updated}T00:00:00Z`).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </time>
          </p>
        </article>
      </div>
    </>
  );
}

/**
 * Zurück-Weg einer Rechtsseite.
 *
 * Bevorzugt die Herkunft aus dem `state` (siehe `withOrigin`), damit „Zurück"
 * dorthin führt, wo der Link stand. Ohne Herkunft — also bei einem Deep Link
 * oder einem Treffer aus einer Suchmaschine, und das ist bei diesen beiden
 * Seiten der Normalfall — entscheidet der Anmeldestatus: angemeldet in die
 * Ligenliste, sonst auf den Login.
 *
 * Bewusst kein `navigate(-1)`: in einer aus der installierten PWA heraus
 * geöffneten History gibt es keinen Eintrag, auf den es zurückgehen könnte
 * (dieselbe Begründung wie in useBackTarget).
 */
function useLegalBackTarget(): BackTarget {
  const { state } = useLocation();
  const { token } = useAuth();
  const origin = (state ?? null) as NavOrigin | null;

  // Nur app-interne Pfade, aus demselben Grund wie in useBackTarget:
  // `location.state` überlebt einen Reload und lässt sich über die
  // History-API von außen setzen.
  const fromPath =
    origin?.fromPath?.startsWith('/') && !origin.fromPath.startsWith('//')
      ? origin.fromPath
      : null;

  if (fromPath) return { to: fromPath, label: origin?.fromTitle ?? 'Zurück' };
  // `undefined` heißt „wird noch geladen" (siehe AuthState.token) — dann wie
  // angemeldet behandeln, sonst blitzt für einen Frame der Login-Weg auf.
  return token === null
    ? { to: '/login', label: 'Anmelden' }
    : { to: '/leagues', label: 'Meine Ligen' };
}
