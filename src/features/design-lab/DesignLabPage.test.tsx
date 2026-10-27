import {fireEvent,render,screen} from '@testing-library/react';
import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {AuthContext} from '../auth/authContext';
import {signedInFixture} from '../../test/authFixture';
import {LocaleProvider} from '../../i18n';
import {spanish as es} from '../../i18n/es';
import {translate} from '../../i18n/translate';
import {LabContext} from './context';
import type {LabState} from './context';
import {DesignLabPage} from './DesignLabPage';
import {loadExample} from './validate';
import {initialDrafts} from './state';
import {downloadLabFile} from './download';
import {required} from './config';
import type {LabImportResult} from './types';
import type {ResidueSelection} from '../structure/BackboneView';

vi.mock('./LabProjectControls',()=>({LabProjectControls:()=>null}));
vi.mock('./download',()=>({downloadLabFile:vi.fn()}));
vi.mock('../structure/BackboneView',()=>({BackboneView:({label,onSelect,reference}:{label:string;onSelect?:(key:ResidueSelection)=>void;reference?:unknown})=><div role="group" aria-label={label} data-testid="trace" data-overlay={Boolean(reference)}><button type="button" disabled={!onSelect} onClick={()=>{onSelect?.({chain:'A',number:2});}}>pick structure residue</button></div>}));
let example:LabImportResult;
beforeAll(async()=>{example=await loadExample();});
beforeEach(()=>{vi.mocked(downloadLabFile).mockReset();});
function value():LabState{return {dataset:example.dataset,drafts:initialDrafts(example.dataset,null),activeId:required(example.dataset.variants[0]).id,selected:0,status:'ready',error:null,progress:null,dirty:false,exported:false,replaceable:true,openExample:vi.fn(),openFile:vi.fn(),cancel:vi.fn(),selectVariant:vi.fn(),selectResidue:vi.fn(),substitute:vi.fn(),protect:vi.fn(),undo:vi.fn(),restore:vi.fn(),save:vi.fn(),revision:0,document:vi.fn(),openDocument:vi.fn(),markSaved:vi.fn()};}
function page(state:LabState,locale:'es'|'en'='es') {return render(<MemoryRouter><LocaleProvider locale={locale}><AuthContext.Provider value={signedInFixture}><LabContext.Provider value={state}><DesignLabPage/></LabContext.Provider></AuthContext.Provider></LocaleProvider></MemoryRouter>);}
describe('approved structure workbench',()=>{
  it('distinguishes historical executed constraints from protection prepared for the next redesign',()=>{
    const state=value(),dataset=required(state.dataset);
    state.dataset={...dataset,variants:dataset.variants.map((variant,index)=>index===0?{...variant,constraints:{draftSha256:'0'.repeat(64),seedSequence:variant.sequence,protectedPositions:[1]}}:variant)};
    state.drafts=initialDrafts(state.dataset,null);state.selected=1;page(state);
    fireEvent.click(screen.getByRole('tab',{name:es['lab.provenanceTab']}));
    expect(screen.getByText(translate('es','lab.executedConstraints',{count:1}))).toBeVisible();
    expect(screen.queryByText(es['lab.editScope'])).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:es['workbench.structure']}));expect(screen.getByRole('button',{name:es['lab.unprotect']})).toBeVisible();
  });
  it('opens the three actual variants, synchronizes selection and supports keyboard and reference overlay',()=>{
    const state=value(),view=page(state);expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Variantes de ubiquitina');fireEvent.click(screen.getByRole('tab',{name:es['lab.comparisonTab']}));expect(screen.getAllByRole('row')).toHaveLength(4);fireEvent.click(screen.getByRole('tab',{name:es['workbench.structure']}));
    fireEvent.click(screen.getByRole('button',{name:'pick structure residue'}));expect(state.selectResidue).toHaveBeenCalledWith(1);
    const first=required(view.container.querySelector<HTMLButtonElement>('[data-position="0"]'));fireEvent.keyDown(first,{key:'ArrowRight'});expect(state.selectResidue).toHaveBeenCalledWith(1);expect(view.container.querySelector('[data-position="1"]')).toHaveFocus();
    fireEvent.keyDown(first,{key:'End'});expect(state.selectResidue).toHaveBeenCalledWith(75);fireEvent.keyDown(first,{key:'Home'});expect(state.selectResidue).toHaveBeenCalledWith(0);fireEvent.keyDown(first,{key:'ArrowDown'});fireEvent.keyDown(first,{key:'x'});
    fireEvent.click(screen.getByRole('checkbox',{name:es['lab.overlay']}));expect(screen.getByTestId('trace')).toHaveAttribute('data-overlay','false');fireEvent.click(screen.getByRole('button',{name:es['lab.resetView']}));
    fireEvent.click(screen.getByRole('button',{name:'Variante 3'}));expect(state.selectVariant).toHaveBeenCalledWith(required(example.dataset.variants[2]).id);
  });
  it('blocks editing a protected position and exposes the protection in the sequence',()=>{const state=value();required(state.drafts[state.activeId]).protectedPositions=[0];page(state);expect(screen.getByRole('combobox',{name:es['lab.replaceWith']})).toBeDisabled();expect(screen.getByRole('button',{name:es['lab.applyReplacement']})).toBeDisabled();expect(screen.getByRole('button',{name:'Residuo 1, Met, posición protegida'})).toHaveAttribute('data-protected','true');fireEvent.click(screen.getByRole('button',{name:es['lab.unprotect']}));expect(state.protect).toHaveBeenCalled();});
  it('hides coordinates, confidence, pTM and structural export when the sequence changes',()=>{
    const state=value(),draft=required(state.drafts[state.activeId]);draft.sequence='A'+draft.sequence.slice(1);draft.history=[{sequence:required(example.dataset.variants[0]).sequence,protectedPositions:[]}];state.dirty=true;const view=page(state);
    expect(screen.queryByTestId('trace')).not.toBeInTheDocument();expect(screen.getByText(es['lab.draftTitle'])).toBeVisible();expect([...view.container.querySelectorAll('.lab-metrics strong')].map(element=>element.textContent)).toEqual(['—','—']);expect(screen.getByRole('button',{name:es['lab.exportTrace']})).toBeDisabled();expect(screen.queryByText(/pTM:/)).not.toBeInTheDocument();
    fireEvent.click(required(screen.getAllByRole('button',{name:es['lab.restore']})[0]));expect(state.restore).toHaveBeenCalled();expect(screen.getByRole('button',{name:es['lab.undo']})).toHaveFocus();
  });
  it('exports the complete imported source unchanged and sends substitutions to the draft',()=>{
    const state=value(),variant=required(example.dataset.variants[0]);state.dataset={...example.dataset,source:'import',variants:[{...variant,pdb:'ORIGINAL PDB TEST SENTINEL'}]};state.drafts=initialDrafts(state.dataset,null);page(state);
    fireEvent.click(screen.getByRole('button',{name:es['lab.exportPdb']}));expect(downloadLabFile).toHaveBeenCalledWith('ORIGINAL PDB TEST SENTINEL',expect.stringContaining('variant-1.pdb'),'chemical/x-pdb');fireEvent.change(screen.getByRole('combobox',{name:es['lab.replaceWith']}),{target:{value:'R'}});fireEvent.click(screen.getByRole('button',{name:es['lab.applyReplacement']}));expect(state.substitute).toHaveBeenCalledWith('R');
    fireEvent.click(screen.getByRole('tab',{name:es['lab.provenanceTab']}));fireEvent.click(screen.getByRole('button',{name:es['lab.downloadDraft']}));expect(downloadLabFile).toHaveBeenLastCalledWith(expect.stringContaining('"not-executed"'),expect.any(String),'application/json');
  });
  it('requires a deliberate replacement and restores focus when the user keeps the current draft',()=>{
    const state=value();state.dirty=true;const view=page(state),input=required(view.container.querySelector<HTMLInputElement>('input[type="file"]')),opener=screen.getByRole('button',{name:es['lab.openFile']}),file=new File(['{}'],'workspace.json');opener.focus();fireEvent.change(input,{target:{files:[file]}});expect(screen.getByRole('dialog',{name:es['lab.dialogTitle']})).toBeVisible();expect(state.openFile).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:es['lab.keepCurrent']}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(opener).toHaveFocus();
    fireEvent.change(input,{target:{files:[file]}});fireEvent.click(screen.getByRole('button',{name:es['lab.confirmOpen']}));expect(state.openFile).toHaveBeenCalledWith(file);
  });
  it('confirms replacement of the example and cancels the dialog with Escape',()=>{const state=value();state.dirty=true;page(state);fireEvent.click(screen.getByRole('tab',{name:es['lab.provenanceTab']}));fireEvent.click(screen.getByRole('button',{name:es['lab.openExample']}));fireEvent(screen.getByRole('dialog'),new Event('cancel',{bubbles:true,cancelable:true}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:es['lab.openExample']}));fireEvent.click(screen.getByRole('button',{name:es['lab.confirmOpen']}));expect(state.openExample).toHaveBeenCalled();});
  it('shows cancellation, errors and progress while preserving the previous result',()=>{const state=value();state.status='loading';state.progress={completed:1,total:3};page(state);expect(screen.getByRole('progressbar')).toHaveAttribute('value','1');expect(screen.getByRole('button',{name:es['lab.saveFile']})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:es['lab.cancel']}));expect(state.cancel).toHaveBeenCalled();});
  it('renders the complete workbench in English',()=>{page(value(),'en');expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Ubiquitin variants');expect(screen.getByRole('button',{name:'Save laboratory file'})).toBeVisible();expect(screen.getByText('Mean local confidence / 100')).toBeVisible();});
  it('starts an example once and offers retry after a loading failure',()=>{const state=value();state.dataset=null;state.status='idle';state.drafts={};page(state);expect(state.openExample).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:es['lab.saveFile']})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:es['lab.openExample']}));expect(state.openExample).toHaveBeenCalledTimes(2);});
});
