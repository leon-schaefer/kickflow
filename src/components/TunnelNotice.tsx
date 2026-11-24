import { useSyncExternalStore } from 'react';
import { isTunnelStarting, subscribeTunnel } from '@/api/kickbase/tunnel';
import styles from './TunnelNotice.module.css';

export function TunnelNotice() {
  const starting = useSyncExternalStore(subscribeTunnel, isTunnelStarting, () => false);
  return starting ? <p role="status" className={styles.notice}>
    Sichere Verbindung wird aufgebaut. Der erste Start kann bis zu einer Minute dauern.
  </p> : null;
}
