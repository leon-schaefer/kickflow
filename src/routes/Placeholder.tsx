import { AppHeader } from '@/shell/AppHeader';
import type { BackTarget } from '@/shell/useBackTarget';
import styles from './Placeholder.module.css';

interface PlaceholderProps {
  /** Erscheint im Header und als Kennung im Test. */
  name: string;
  back?: BackTarget;
}

/**
 * Steht so lange in einer Route, bis der echte Screen von React Native auf
 * DOM portiert ist.
 *
 * Existiert, damit der Route-Baum samt Auth-Gate, Tab-Leiste und
 * Zurück-Wegen VOR dem Bundler-Wechsel steht und getestet ist — der Cutover
 * schaltet dann keinen ungetesteten neuen Code scharf.
 */
export function Placeholder({ name, back }: PlaceholderProps) {
  return (
    <>
      <AppHeader title={name} back={back} />
      <div className={styles.body} data-placeholder={name}>
        <p className={styles.text}>Noch nicht portiert: {name}</p>
      </div>
    </>
  );
}
