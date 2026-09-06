import { Modal } from '@/components/Modal';
import { MenuIcon } from '@/components/icons/MenuIcon';
import { ShareIcon } from '@/components/icons/ShareIcon';
import { cx } from '@/utils/cx';
import layout from '@/theme/layout.module.css';
import type { InstallHintKind } from './installHint';
import styles from './InstallHintView.module.css';

interface InstallHintViewProps {
  kind: InstallHintKind;
  /** Nur für `native`: löst den Installationsdialog des Browsers aus. */
  onInstall: () => void;
  onDismiss: () => void;
}

/**
 * Rein präsentational: der Hinweis selbst, ohne die Entscheidung, ob er
 * überhaupt erscheint (die steckt in useInstallHint.ts).
 *
 * Die Hülle ist das gemeinsame `Modal` und damit ein Portal an
 * `document.body` — hier nicht optional: der Hinweis erscheint über dem
 * Ligen-Picker, und der hängt in einem `Refreshable`, dessen Touch-Listener
 * mit `capture` am Wrapper sitzen. Im Baum gerendert würde ein Wisch im
 * Dialog dahinter ein Pull-to-Refresh auslösen (Begründung in Modal.tsx).
 *
 * Warum die Schritte als `<ol>` und nicht als Fließtext: eine Anleitung, die
 * man am Gerät nebenher abarbeitet, braucht abzählbare Schritte — und ein
 * Screenreader kündigt „Liste mit 3 Einträgen" an, was der Fließtext nicht
 * hergibt.
 */
export function InstallHintView({ kind, onInstall, onDismiss }: InstallHintViewProps) {
  return (
    <Modal open onClose={onDismiss} title="kickflow installieren">
      <p className={styles.body}>
        Vom Startbildschirm startet kickflow im Vollbild — ohne Browserleisten, mit eigenem
        Symbol und schneller zur Hand.
      </p>

      {kind === 'ios' && (
        <ol className={styles.steps}>
          <li className={styles.step}>
            Unten in der Browserleiste auf Teilen{' '}
            <ShareIcon size={15} />
            <span className={styles.srOnly}> (Teilen-Symbol)</span> tippen.
          </li>
          <li className={styles.step}>In der Liste „Zum Home-Bildschirm" wählen.</li>
          <li className={styles.step}>Oben rechts mit „Hinzufügen" bestätigen.</li>
        </ol>
      )}

      {kind === 'android' && (
        <ol className={styles.steps}>
          <li className={styles.step}>
            Oben rechts das Browser-Menü{' '}
            <MenuIcon size={15} />
            <span className={styles.srOnly}> (Menü-Symbol)</span> öffnen.
          </li>
          <li className={styles.step}>
            „App installieren" bzw. „Zum Startbildschirm hinzufügen" wählen.
          </li>
          <li className={styles.step}>Bestätigen — fertig.</li>
        </ol>
      )}

      <div className={styles.actions}>
        {/*
         * Nur der Chromium-Zweig bekommt einen Installieren-Button: dort
         * liegt ein abgefangenes `beforeinstallprompt` bereit, das den
         * Browser-Dialog öffnet. Ein Button ohne dieses Event täte nichts.
         */}
        {kind === 'native' && (
          <button
            type="button"
            className={cx(layout.pressableH, styles.primary)}
            onClick={onInstall}
          >
            Installieren
          </button>
        )}
        <button
          type="button"
          className={cx(layout.pressableH, styles.secondary)}
          onClick={onDismiss}
        >
          {kind === 'native' ? 'Später' : 'Verstanden'}
        </button>
      </div>

      {/*
       * Ehrliche Ansage statt „Nicht mehr anzeigen"-Kästchen: der Hinweis
       * kommt so oder so nur dieses eine Mal. Ein Vorschlag, der bei jedem
       * Start wiederkommt, ist eine Belästigung — und installieren lässt sich
       * die App danach jederzeit über den Browser selbst.
       */}
      <p className={styles.footnote}>
        Dieser Hinweis erscheint nur einmal. Installieren geht später jederzeit über den
        Browser.
      </p>
    </Modal>
  );
}
