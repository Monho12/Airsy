// «Яагаад?» шалгагч — төхөөрөмжийн сүүлийн `ControlDecision` (FR-C8, CLAUDE.md §6.8, D78). Мөрийн доор задарна.
// Бүх бичвэр Монгол (`RuleId`, `outcome` зэрэг дотоод нэрийг UI-д түүхий хэлбэрээр харуулахгүй, §8.9).
import { formatTimeMn, mn } from '@/domain/i18n/mn';
import type { ControlDecision } from '@/domain/types';

const text = mn.devices.inspector;

export function DecisionInspector({
  id,
  decision,
}: {
  id: string;
  decision: ControlDecision | null;
}) {
  if (decision === null) {
    return (
      <div id={id} className="decision-inspector">
        <p className="decision-inspector__empty">{text.noDecision}</p>
      </div>
    );
  }

  return (
    <div id={id} className="decision-inspector">
      <dl className="decision-inspector__facts">
        <div>
          <dt>{text.outcome}</dt>
          <dd>{mn.control.outcome[decision.outcome]}</dd>
        </div>
        {decision.winningRuleId !== null && (
          <div>
            <dt>{text.winningRule}</dt>
            <dd>{mn.control.ruleName[decision.winningRuleId]}</dd>
          </div>
        )}
        {decision.contributingRuleIds.length > 0 && (
          <div>
            <dt>{text.contributing}</dt>
            <dd>
              {decision.contributingRuleIds.map((ruleId) => mn.control.ruleName[ruleId]).join(', ')}
            </dd>
          </div>
        )}
        <div>
          <dt>{text.evaluatedAt}</dt>
          <dd>{formatTimeMn(decision.evaluatedAt)}</dd>
        </div>
      </dl>
      <p className="decision-inspector__reason">
        <span className="decision-inspector__label">{text.reason}: </span>
        {decision.reason}
      </p>
      {decision.constraintsApplied.length > 0 && (
        <p className="decision-inspector__note">
          <span className="decision-inspector__label">{text.constraints}: </span>
          {decision.constraintsApplied.map((c) => c.note).join(' ')}
        </p>
      )}
      {decision.minimumApplied !== null && (
        <p className="decision-inspector__note">
          <span className="decision-inspector__label">{text.minimum}: </span>
          {decision.minimumApplied.note}
        </p>
      )}
      <p className="decision-inspector__label">{text.requests}</p>
      <ul className="decision-inspector__requests">
        {decision.candidates.map((request, index) => (
          <li key={`${request.ruleId}-${index}`}>
            <span className="decision-inspector__rule">{mn.control.ruleName[request.ruleId]}</span>
            {' → '}
            <span className="decision-inspector__target">
              {mn.devices.stateLabel(request.target)}
            </span>
            {request.role !== 'demand' && (
              <span className="decision-inspector__role">
                {' '}
                ({request.role === 'minimum' ? text.roleMinimum : text.roleOverride})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
