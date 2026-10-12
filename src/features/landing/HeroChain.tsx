import { useMemo } from 'react';
import { buildChainLayout } from './chain';
import { HERO_BEAD_RADIUS, HERO_BOX, HERO_EXAMPLE, HERO_WINDOW } from './config';
import { exampleEntry } from '../editor/examples';
import { useTranslation } from '../../i18n';

/** The signature of the page: a real profile drawn as a chain of residues, computed on load. */
export function HeroChain({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { t, formatNumber } = useTranslation();
  const layout = useMemo(() => {
    const sequence = HERO_EXAMPLE ? exampleEntry(HERO_EXAMPLE.fasta)?.sequence ?? '' : '';
    return buildChainLayout(sequence, HERO_WINDOW, HERO_BOX);
  }, []);
  const label = t('landing.artLabel');
  return (
    <figure className={compact ? 'hero-chain hero-chain-compact' : 'hero-chain'}>
      <svg
        className="hero-chain-canvas"
        viewBox={`0 0 ${String(HERO_BOX.width)} ${String(HERO_BOX.height)}`}
        role="img"
        aria-label={label}
      >
        <line className="hero-chain-zero" x1={HERO_BOX.paddingX} x2={HERO_BOX.width - HERO_BOX.paddingX} y1={layout.zeroY} y2={layout.zeroY} />
        <path className="hero-chain-path" d={layout.path} pathLength={1} />
        <g className="hero-chain-beads" style={{ '--n': layout.beads.length } as React.CSSProperties}>
          {layout.beads.map((bead, index) => (
            <circle
              key={bead.position}
              className={bead.hydrophobic ? 'hero-bead is-hydrophobic' : 'hero-bead is-hydrophilic'}
              cx={bead.x}
              cy={bead.y}
              r={HERO_BEAD_RADIUS}
              style={{ '--i': index } as React.CSSProperties}
            />
          ))}
        </g>
        <rect
          className="hero-chain-sweep"
          x={HERO_BOX.paddingX}
          y={0}
          width={HERO_BOX.paddingX * 2}
          height={HERO_BOX.height}
          style={{ '--sweep-distance': `${String(HERO_BOX.width - 4 * HERO_BOX.paddingX)}px` } as React.CSSProperties}
        />
      </svg>
      {!compact && HERO_EXAMPLE && (
        <figcaption className="hero-chain-caption">
          <span>{t('landing.artCaption', { accession: HERO_EXAMPLE.accession, count: formatNumber(HERO_WINDOW) })}</span>
          <span className="hero-legend" aria-hidden="true">
            <span className="hero-legend-item"><i className="hero-legend-bead is-hydrophobic" />{t('landing.legendHydrophobic')}</span>
            <span className="hero-legend-item"><i className="hero-legend-bead is-hydrophilic" />{t('landing.legendHydrophilic')}</span>
            <span className="hero-legend-item"><i className="hero-legend-line" />{t('landing.legendZero')}</span>
          </span>
        </figcaption>
      )}
    </figure>
  );
}
