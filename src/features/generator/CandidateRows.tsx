import { useTranslation } from '../../i18n';
import { residueClass } from '../chemistry/config';
import { CANDIDATE_GRAVY_FORMAT, CANDIDATE_MASS_FORMAT } from './config';
import type { Candidate } from './search';

/** Candidate sequences as rows of residue cells, so their chemistry can be compared at a glance. */
export function CandidateRows({ candidates, label }: { candidates: readonly Candidate[]; label: string }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  return (
    <ol className="candidate-rows" aria-label={label}>
      {candidates.map((candidate) => (
        <li key={candidate.sequence}>
          <span className="candidate-cells" style={{ '--ribbon-columns': candidate.sequence.length } as React.CSSProperties} aria-hidden="true">
            {Array.from(candidate.sequence, (residue, index) => <span key={index} className="residue" data-chem={residueClass(residue)}>{residue}</span>)}
          </span>
          <span className="visually-hidden">{candidate.sequence}</span>
          <span className="candidate-figures">{t('generator.rowFigures', {
            gravy: formatNumber(candidate.descriptors.gravy, CANDIDATE_GRAVY_FORMAT),
            mass: formatNumber(candidate.descriptors.massDa, CANDIDATE_MASS_FORMAT),
          })}</span>
        </li>
      ))}
    </ol>
  );
}
