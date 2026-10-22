import { useTranslation } from '../../i18n';
import { required } from './config';
import type { LabDataset, LabDraft } from './types';

interface Props {
  dataset: LabDataset;
  drafts: Record<string, LabDraft>;
  activeId: string;
  busy: boolean;
  number: (value: number, digits?: number) => string;
  onSelect: (id: string) => void;
}

/** The three results side by side. An edited variant shows no figures from its past run. */
export function LabVariantsTable({ dataset, drafts, activeId, busy, number, onSelect }: Props): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="lab-variants" aria-labelledby="lab-variants-title">
      <div className="section-header">
        <h2 id="lab-variants-title" tabIndex={-1}>{t('lab.variantsTitle')}</h2>
        <p className="field-help">{t('lab.variantsNote')}</p>
      </div>
      <div className="lab-table-scroll">
        <table className="lab-table">
          <caption className="visually-hidden">{t('lab.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('lab.sampleHeader')}</th>
              <th scope="col" className="lab-table-optional">{t('lab.lengthHeader')}</th>
              <th scope="col">{t('lab.confidenceHeader')}</th>
              <th scope="col">{t('lab.rmsdHeader')}</th>
              <th scope="col" className="lab-table-optional">{t('lab.identityHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {dataset.variants.map(item => {
              const draft = required(drafts[item.id]);
              const changed = draft.sequence !== item.sequence;
              const identical = Array.from(draft.sequence).filter((residue, index) => residue === dataset.reference.sequence[index]).length;
              return (
                <tr key={item.id} data-active={activeId === item.id}>
                  <th scope="row">
                    <button type="button" className="button button-secondary" aria-pressed={activeId === item.id} disabled={busy} onClick={() => { onSelect(item.id); }}>
                      {t('lab.variant', { sample: item.sample })}
                    </button>
                    <span className="field-help">{t(changed ? 'lab.draftState' : 'lab.resultState')}</span>
                  </th>
                  <td className="numeric lab-table-optional">{item.sequence.length}</td>
                  <td className="numeric">{changed ? '—' : number(item.meanPlddt)}</td>
                  <td className="numeric">{changed ? '—' : `${number(item.rmsd, 3)} Å`}</td>
                  <td className="numeric lab-table-optional">{identical}/{item.sequence.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
