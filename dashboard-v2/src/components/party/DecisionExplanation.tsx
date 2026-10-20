import { Button } from '../ui';
import { openDecisionEvidence } from '../../models/decision-navigation';
import type { CharacterTelemetry } from '../../types/deployments';
import { explainDecision } from '../../models/decision-explanation';
import styles from './DecisionExplanation.module.scss';

export function DecisionExplanation({ enabled, telemetry, character }: { enabled: boolean; telemetry?: CharacterTelemetry; character?: string }) {
  const decision = explainDecision(enabled, telemetry);
  return <div className={`${styles.decision} ${decision.warning ? styles.warning : ''}`}>
    <strong>{decision.action}</strong>
    {decision.warning && <p>{decision.reason}</p>}
    <details>
    <summary>Details & next step</summary>
    <dl>
      <div><dt>{decision.warning ? 'Blocker' : 'Reason'}</dt><dd>{decision.reason}</dd></div>
      <div><dt>Next condition</dt><dd>{decision.next}</dd></div>
    </dl>
    <small>{decision.source === 'reported' ? 'Reported by runtime' : decision.source === 'inferred' ? 'Inferred from observed state' : 'No live explanation available'} · Next condition is guidance, not a scheduled action.</small>
    </details>
    {character && <Button size="small" variant="ghost" onClick={() => openDecisionEvidence(character)}>View evidence</Button>}
  </div>;
}
