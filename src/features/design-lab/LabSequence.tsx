import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from '../../i18n';
import { ChemistryLegend } from '../chemistry/ChemistryLegend';
import { RESIDUE_NAMES, residueClass } from '../chemistry/config';
import { LAB_CONFIG as C } from './config';

interface Props {sequence:string;reference:string;selected:number;protectedPositions:number[];disabled:boolean;onSelect:(index:number)=>void}
/** Bounded to 120 residues by import validation. One tab stop; 44px controls and spatial arrow navigation. */
export function LabSequence({sequence,reference,selected,protectedPositions,disabled,onSelect}:Props):React.JSX.Element {
  const {t}=useTranslation();const container=useRef<HTMLDivElement>(null);const buttons=useRef(new Map<number,HTMLButtonElement>());
  useEffect(()=>{
    const parent=container.current,button=buttons.current.get(selected);if(!parent||!button)return;
    const box=parent.getBoundingClientRect(),target=button.getBoundingClientRect();
    if(target.top<box.top)parent.scrollTop+=target.top-box.top;else if(target.bottom>box.bottom)parent.scrollTop+=target.bottom-box.bottom;
  },[selected]);
  function key(event:KeyboardEvent<HTMLButtonElement>,index:number):void {
    let next:number;
    if(event.key==='ArrowLeft')next=Math.max(0,index-1);else if(event.key==='ArrowRight')next=Math.min(sequence.length-1,index+1);
    else if(event.key==='Home')next=0;else if(event.key==='End')next=sequence.length-1;
    else if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      const current=event.currentTarget.getBoundingClientRect(),down=event.key==='ArrowDown';
      const candidates=[...buttons.current.entries()].map(([position,element])=>({position,box:element.getBoundingClientRect()})).filter(value=>down?value.box.top>current.top+1:value.box.top<current.top-1);
      candidates.sort((a,b)=>Math.abs(a.box.top-current.top)-Math.abs(b.box.top-current.top)||Math.abs(a.box.left-current.left)-Math.abs(b.box.left-current.left));next=candidates[0]?.position??index;
    }else return;
    event.preventDefault();onSelect(next);buttons.current.get(next)?.focus();
  }
  const blocks=Array.from({length:Math.ceil(sequence.length/C.sequenceBlock)},(_,i)=>i*C.sequenceBlock);
  return <section className="lab-sequence" aria-labelledby="lab-sequence-title">
    <div className="section-header"><h2 id="lab-sequence-title">{t('lab.sequenceTitle')}</h2><p className="field-help">{t('lab.changeCount',{count:Array.from(sequence).filter((aa,index)=>aa!==reference[index]).length})}</p></div>
    <div className="lab-sequence-reader" ref={container}>
      <div className="lab-sequence-blocks">{blocks.map(start=><div className="lab-sequence-block" key={start}><span className="lab-sequence-range" aria-hidden="true">{start+1}–{Math.min(start+C.sequenceBlock,sequence.length)}</span><div className="lab-sequence-residues">{Array.from(sequence.slice(start,start+C.sequenceBlock),(aa,offset)=>{const index=start+offset,isProtected=protectedPositions.includes(index);return <button type="button" key={index} ref={element=>{if(element)buttons.current.set(index,element);else buttons.current.delete(index);}} className="residue" data-chem={residueClass(aa)} data-position={index} data-selected={index===selected} data-changed={aa!==reference[index]} data-protected={isProtected} disabled={disabled} tabIndex={index===selected?0:-1} aria-pressed={index===selected} aria-label={t('lab.residueAction',{position:index+1,name:RESIDUE_NAMES[aa]??aa,protected:isProtected?t('lab.protectedSuffix'):''})} onClick={()=>{onSelect(index);}} onKeyDown={event=>{key(event,index);}}>{aa}</button>;})}</div></div>)}</div>
    </div>
    <ChemistryLegend/><p className="field-help">{t('lab.sequenceNote')}</p>
  </section>;
}
