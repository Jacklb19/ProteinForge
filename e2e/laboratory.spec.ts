import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {spanish as es} from '../src/i18n/es';
import {english as en} from '../src/i18n/en';
import {ROUTES} from '../src/shared/navigation';
import {chooseTheme,message} from './helpers';
import {LAB_CONFIG as C} from '../src/features/design-lab/config';
import {required} from '../src/features/design-lab/config';
import {superpose} from '../src/features/design-lab/geometry';
import {traceModel} from '../src/features/design-lab/presentation';
import {layoutBackbone} from '../src/features/structure/backbone';
import {INITIAL_YAW,INITIAL_PITCH} from '../src/features/structure/config';
import fixture from '../src/features/design-lab/fixtures/ubiquitin.json' with {type:'json'};

test('exports the public edited draft with explicit fixed residue mapping',async({page})=>{
  await page.goto(ROUTES.laboratory);await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await page.locator('[data-position="1"]').click();await page.getByRole('combobox',{name:es['lab.replaceWith']}).selectOption('R');await page.getByRole('button',{name:es['lab.applyReplacement']}).click();
  for(const index of [1,6,41]){await page.locator(`[data-position="${String(index)}"]`).click();await page.getByRole('button',{name:es['lab.protect'],exact:true}).click();}
  const promise=page.waitForEvent('download');await page.getByRole('tab', { name: es['lab.provenanceTab'] }).click();await page.getByRole('button',{name:es['lab.downloadDraft']}).click();const download=await promise;await download.saveAs('artifacts/laboratory-public-draft-v2.json');
  const draft=JSON.parse(readFileSync('artifacts/laboratory-public-draft-v2.json','utf8')) as {schemaVersion:number;sequence:string;source:{variantSequence:string;variantSequenceSha256:string};protectedPositions:{chainPosition:number;residue:string;referenceKey:{chain:string;number:number;insertion:string}}[];constraintStatus:string};
  expect(draft.schemaVersion).toBe(2);expect(draft.sequence).toBe(required(fixture.samples[0]).sequence.slice(0,1)+'R'+required(fixture.samples[0]).sequence.slice(2));
  expect(createHash('sha256').update(draft.source.variantSequence).digest('hex')).toBe(draft.source.variantSequenceSha256);expect(draft.constraintStatus).toBe('not-executed');
  expect(draft.protectedPositions.map(entry=>[entry.chainPosition,entry.residue,entry.referenceKey.number])).toEqual([[2,'R',2],[7,'F',7],[42,'R',42]]);
  const notebookPromise=page.waitForEvent('download');await page.getByRole('link',{name:es['lab.downloadNotebook']}).click();const notebook=await notebookPromise;await notebook.saveAs('artifacts/laboratory-downloaded.ipynb');
  expect(readFileSync('artifacts/laboratory-downloaded.ipynb').equals(readFileSync('notebooks/proteinforge-design-lab.ipynb'))).toBe(true);
});

for(const width of [360,1280])test(`laboratory A selection, drafts and themes at ${String(width)}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:900});await page.goto(ROUTES.laboratory);
  await expect(page.getByRole('heading',{level:1})).toHaveText(message('lab.title',{reference:es['lab.ubiquitin']}));await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await page.locator('[data-position="41"]').click();await expect(page.locator('.lab-residue-readout strong')).toHaveText('Arg · A42');
  await page.getByRole('button',{name:es['lab.protect'],exact:true}).click();await expect(page.getByRole('combobox',{name:es['lab.replaceWith']})).toBeDisabled();await expect(page.locator('[data-position="41"]')).toHaveAttribute('data-protected','true');
  await page.getByRole('button',{name:es['lab.unprotect'],exact:true}).click();await page.getByRole('combobox',{name:es['lab.replaceWith']}).selectOption('A');await page.getByRole('button',{name:es['lab.applyReplacement']}).click();
  await expect(page.getByText(es['lab.draftTitle'],{exact:true})).toBeVisible();await expect(page.locator('.lab-metrics strong')).toHaveText(['—','—']);await expect(page.getByRole('button',{name:es['lab.exportTrace']})).toBeDisabled();
  await page.getByRole('button',{name:message('lab.variant',{sample:2}),exact:true}).click();await expect(page.locator('.lab-figure canvas')).toHaveCount(1);await page.getByRole('button',{name:message('lab.variant',{sample:1}),exact:true}).click();await expect(page.getByText(es['lab.draftTitle'],{exact:true})).toBeVisible();
  await page.getByRole('button',{name:es['lab.undo'],exact:true}).click();await expect(page.locator('.lab-figure canvas')).toHaveCount(1);await expect(page.locator('.lab-metrics strong').first()).toHaveText('93,39');
  await page.locator('[data-position="41"]').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-position="42"]')).toBeFocused();await expect(page.locator('.lab-residue-readout strong')).toHaveText('Leu · A43');
  const canvas=page.locator('.lab-figure canvas');await canvas.scrollIntoViewIfNeeded();
  const sample=required(fixture.samples[0]),box=required(await canvas.boundingBox());
  const model=traceModel(sample.sequenceSha256,sample.sequence,sample.keys,superpose(fixture.reference.ca,sample.ca).aligned);
  const first=required(layoutBackbone(model,{width:box.width,height:box.height,yaw:INITIAL_YAW,pitch:INITIAL_PITCH}).anchors.find(anchor=>anchor.residue.number===1));
  await canvas.click({position:{x:first.x,y:first.y}});await expect(page.locator('[data-position="0"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.lab-residue-readout strong')).toHaveText('Met · A1');
  const before=await canvas.screenshot();await page.locator('.backbone-view').focus();await page.keyboard.press('ArrowRight');expect(Buffer.compare(before,await canvas.screenshot())).not.toBe(0);
  for(const theme of ['light','dark'] as const){
    await chooseTheme(page,theme);await page.evaluate(()=>{window.scrollTo(0,0);});await page.evaluate(async()=>{await document.fonts.ready;});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    expect(await page.locator('.lab-page').evaluate(root=>[...root.querySelectorAll('button, a.button, select, .checkbox-option')].filter(element=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0&&(box.width<43.9||box.height<43.9);}).map(element=>element.textContent))).toEqual([]);
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations,JSON.stringify(axe.violations)).toEqual([]);
    await page.screenshot({path:`artifacts/laboratory-a-${String(width)}-${theme}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);
});

test('laboratory file reopens every draft and rejects an invalid replacement atomically',async({page})=>{
  await page.goto(ROUTES.laboratory);await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  await page.locator('[data-position="2"]').click();await page.getByRole('combobox',{name:es['lab.replaceWith']}).selectOption('R');await page.getByRole('button',{name:es['lab.applyReplacement']}).click();await page.getByRole('button',{name:es['lab.protect'],exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:es['lab.saveFile']}).click();const download=await downloadPromise;const savedPath='artifacts/laboratory-workspace.json';await download.saveAs(savedPath);
  const saved=JSON.parse(readFileSync(savedPath,'utf8')) as {kind:string;state:{drafts:Record<string,{sequence:string;protectedPositions:number[]}>}};
  expect(saved.kind).toBe('proteinforge-laboratory');expect(Object.values(saved.state.drafts).some(draft=>draft.sequence[2]==='R'&&draft.protectedPositions.includes(2))).toBe(true);
  await expect(page.getByText(es['lab.exportReady'])).toBeVisible();await page.reload();await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);await expect(page.locator('.lab-figure canvas')).toHaveCount(1);
  await page.locator('input[type=file]').setInputFiles(savedPath);await expect(page.getByText(es['lab.draftTitle'],{exact:true})).toBeVisible();await expect(page.locator('[data-position="2"]')).toHaveAttribute('data-protected','true');await expect(page.locator('[data-position="2"]')).toHaveText('R');
  await page.locator('input[type=file]').setInputFiles({name:'invalid-laboratory.json',mimeType:'application/json',buffer:Buffer.from('{"kind":"wrong"}')});await expect(page.getByRole('alert')).toHaveText(es['lab.errorWorkspace']);await expect(page.locator('[data-position="2"]')).toHaveText('R');
  await page.getByRole('button',{name:es['lab.unprotect'],exact:true}).click();await page.getByRole('tab', { name: es['lab.provenanceTab'] }).click();await page.getByRole('button',{name:es['lab.openExample']}).click();const dialog=page.getByRole('dialog',{name:es['lab.dialogTitle']});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:es['lab.keepCurrent']})).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(page.getByRole('button',{name:es['lab.openExample']})).toBeFocused();
});

test('laboratory English copy and offline-compatible example resources',async({page})=>{
  const external:string[]=[];page.on('request',request=>{if(request.url().startsWith('http')&&!['127.0.0.1','localhost'].includes(new URL(request.url()).hostname))external.push(request.url());});
  await page.goto(ROUTES.laboratory);await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);await page.getByRole('radio',{name:'English',exact:true}).check();await expect(page.getByRole('heading',{level:1})).toHaveText('Ubiquitin variants');await expect(page.getByRole('button',{name:en['lab.saveFile']})).toBeVisible();await expect(page.getByText(en['lab.meanConfidence'])).toBeVisible();expect(external).toEqual([]);
});

test('imports the actual verified Colab campaign when local evidence is provided',async({page})=>{
  const path=process.env.E2E_LAB_ARCHIVE;test.skip(!path,'Local Colab evidence is not shipped in Git');if(!path)return;
  await page.goto(ROUTES.laboratory);await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);await page.locator('input[type=file]').setInputFiles(path);await expect(page.getByText(es['lab.importScope'])).toBeVisible();
  await page.getByRole('button',{name:message('lab.variant',{sample:3}),exact:true}).click();await expect(page.locator('.lab-metrics strong')).toHaveText(['92,92','1,211 Å']);
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:es['lab.exportPdb']}).click();const download=await promise;const output='artifacts/laboratory-imported-variant-3.pdb';await download.saveAs(output);
  const fixture=JSON.parse(readFileSync('src/features/design-lab/fixtures/ubiquitin.json','utf8')) as {samples:{sample:number;sourcePdbSha256:string}[]};expect(createHash('sha256').update(readFileSync(output)).digest('hex')).toBe(fixture.samples.find(sample=>sample.sample===3)?.sourcePdbSha256);
  const workspacePromise=page.waitForEvent('download');await page.getByRole('button',{name:es['lab.saveFile']}).click();const workspace=await workspacePromise;await workspace.saveAs('artifacts/laboratory-imported-workspace.json');expect(readFileSync('artifacts/laboratory-imported-workspace.json').length).toBeLessThan(C.maximumWorkspaceBytes);
  await page.reload();await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);await page.locator('input[type=file]').setInputFiles('artifacts/laboratory-imported-workspace.json');await expect(page.getByText(es['lab.importScope'])).toBeVisible();await expect(page.getByRole('button',{name:message('lab.variant',{sample:3}),exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.lab-metrics strong')).toHaveText(['92,92','1,211 Å']);
});

test('reopens the actual constrained Colab result and retains its executed constraints',async({page})=>{
  const archive=process.env.E2E_LAB_CONSTRAINED_ARCHIVE;test.skip(!archive,'Local constrained evidence is not shipped in Git');if(!archive)return;
  await page.setViewportSize({width:360,height:900});await page.goto(ROUTES.laboratory);await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);await page.locator('input[type=file]').setInputFiles(archive);
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(1);await expect(page.getByText(message('lab.executedConstraints',{count:3}))).toBeVisible();
  for(const [index,aa] of [[1,'R'],[6,'F'],[41,'R']] as const){await expect(page.locator(`[data-position="${String(index)}"]`)).toHaveText(aa);await expect(page.locator(`[data-position="${String(index)}"]`)).toHaveAttribute('data-protected','true');}
  const pdbPromise=page.waitForEvent('download');await page.getByRole('button',{name:es['lab.exportPdb']}).click();const pdb=await pdbPromise;await pdb.saveAs('artifacts/laboratory-constrained-export.pdb');
  expect(createHash('sha256').update(readFileSync('artifacts/laboratory-constrained-export.pdb')).digest('hex')).toBe('b58add32d2222c46e5a2981a90e3be5c295917a8e20991e3fd21d256c3d7ed42');
  for(const width of [360,1280])for(const theme of ['light','dark'] as const){
    await page.setViewportSize({width,height:900});await chooseTheme(page,theme);await page.evaluate(()=>{window.scrollTo(0,0);});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
    await page.screenshot({path:`artifacts/laboratory-constrained-${String(width)}-${theme}.png`,fullPage:true});
  }
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:es['lab.saveFile']}).click();const file=await promise;await file.saveAs('artifacts/laboratory-constrained-workspace.json');
  await page.reload();await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);await page.locator('input[type=file]').setInputFiles('artifacts/laboratory-constrained-workspace.json');await expect(page.locator('.lab-table tbody tr')).toHaveCount(1);await expect(page.locator('[data-position="1"]')).toHaveAttribute('data-protected','true');
});
