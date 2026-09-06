import { useAuth } from '@/auth/AuthProvider';
import { InstallHintView } from './InstallHintView';
import { useInstallHint } from './useInstallHint';

/**
 * Der Installations-Hinweis nach dem ersten Login.
 *
 * „Erster Login" heißt hier: das erste Mal, dass die App eine angemeldete
 * Sitzung hat UND der Merker aus useInstallHint.ts noch nicht steht. Das ist
 * absichtlich etwas weiter gefasst als „genau im Moment des Anmeldens" — wer
 * schon eingeloggt war, als es den Hinweis noch nicht gab, soll ihn auch
 * einmal sehen. Danach nie wieder, auf keinem Weg.
 *
 * Warum an den Login gekoppelt und nicht an den Start: vor dem Login sieht
 * man einen Anmeldedialog und weiß noch nicht, ob die App etwas taugt. Ein
 * Installationsvorschlag ist dort eine Frage an jemanden, der die Antwort
 * nicht haben kann.
 *
 * Warum überhaupt eine Aufforderung: In der installierten PWA lädt die App
 * schneller, startet im Vollbild und bekommt vom Browser den ganzen
 * Bildschirm — der Layout-Code der App (iOS-Statusband, Tab-Leiste über dem
 * Home-Indicator) ist genau darauf ausgelegt. Ohne Hinweis findet den Weg
 * dorthin auf iOS praktisch niemand, weil er im Teilen-Menü versteckt ist.
 */
export function InstallHint() {
  const { token } = useAuth();
  const { kind, install, dismiss } = useInstallHint(typeof token === 'string');

  if (!kind) return null;

  return (
    <InstallHintView
      kind={kind}
      // `install()` ist async (es wartet auf den Browser-Dialog), der Handler
      // darf es nicht sein: ein zurückgegebenes Promise fängt hier niemand.
      onInstall={() => void install()}
      onDismiss={dismiss}
    />
  );
}
