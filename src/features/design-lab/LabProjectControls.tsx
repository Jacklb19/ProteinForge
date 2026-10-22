import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { ROUTES } from '../../shared/navigation';
import { useAuth } from '../auth/authContext';
import { useProjects } from '../projects/projectContext';
import { MAX_PROJECT_NAME_LENGTH } from '../projects/config';
import { ProjectFeedback } from '../projects/ProjectControls';
import { useLab } from './context';

function SaveDialog({onClose}:{onClose:()=>void}):React.JSX.Element {
  const {t}=useTranslation(), projects=useProjects(), auth=useAuth(), lab=useLab();
  const [name,setName]=useState(projects.laboratory?.name??'');
  const [reload,setReload]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const busy=projects.busy || lab.status==='loading' || lab.status==='exporting';
  useLayoutEffect(()=>{const element=dialog.current, previous=document.activeElement; element?.showModal();return()=>{element?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};},[]);
  function save(copy=false):void{void projects.saveLaboratory(name,copy).then(done=>{if(done)onClose();});}
  return <dialog ref={dialog} className="project-dialog" aria-labelledby="lab-project-title" aria-describedby="lab-project-help" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <form className="project-confirm" onSubmit={event=>{event.preventDefault();save();}}>
      <h2 id="lab-project-title">{t('lab.saveProject')}</h2><p id="lab-project-help">{t('lab.projectHelp')}</p>
      {auth.status==='loading'?<p>{t('projects.sessionLoading')}</p>:auth.status!=='signed-in'?<div className="project-empty"><p>{t('projects.signInHelp')}</p><div className="actions"><Link className="button button-primary" state={{from:ROUTES.laboratory}} to={ROUTES.signIn}>{t('shell.signIn')}</Link><Link className="button button-secondary" state={{from:ROUTES.laboratory}} to={ROUTES.signUp}>{t('auth.signUpAction')}</Link></div></div>:!projects.enabled?<p className="notice">{t('projects.config')}</p>:<>
        <div className="field"><label htmlFor="lab-project-name">{t('projects.name')}</label><input autoFocus className="text-input" id="lab-project-name" value={name} onChange={event=>{setName(event.target.value);}} required maxLength={MAX_PROJECT_NAME_LENGTH} disabled={busy}/></div>
        <ProjectFeedback/>
        {projects.laboratory && <><p className="field-help">{t('lab.projectBound',{name:projects.laboratory.name})}</p><button type="button" className="button button-quiet" disabled={busy} onClick={()=>{setReload(true);}}>{t('projects.reload')}</button></>}
        {reload && projects.laboratory && <div className="project-confirm"><p>{t('projects.replaceWarning')}</p><div className="actions"><button type="button" className="button button-secondary" disabled={busy} onClick={()=>{setReload(false);}}>{t('projects.cancel')}</button><button type="button" className="button button-primary" disabled={busy} onClick={()=>{if(projects.laboratory)void projects.open(projects.laboratory.id,'laboratory').then(opened=>{if(opened)onClose();});}}>{t('projects.confirmOpen')}</button></div></div>}
      </>}
      <div className="actions"><button type="button" autoFocus={auth.status!=='signed-in'} className="button button-secondary" disabled={busy} onClick={onClose}>{t('projects.cancel')}</button>{auth.status==='signed-in'&&projects.enabled&&<><button type="submit" className="button button-primary" disabled={busy||!name.trim()}>{t(projects.laboratory?'projects.update':'projects.create')}</button>{projects.laboratory&&<button type="button" className="button button-secondary" disabled={busy||!name.trim()} onClick={()=>{save(true);}}>{t('projects.saveCopy')}</button>}</>}</div>
    </form>
  </dialog>;
}

export function LabProjectControls():React.JSX.Element {
  const lab=useLab(),projects=useProjects(),{t}=useTranslation();const [open,setOpen]=useState(false);
  return <><button type="button" className="button button-primary" disabled={!lab.dataset||projects.busy||lab.status==='loading'||lab.status==='exporting'} onClick={()=>{setOpen(true);}}>{t('lab.saveProject')}</button>{open&&<SaveDialog onClose={()=>{setOpen(false);}}/>}{!open&&projects.laboratory&&projects.notice==='saved'&&<p className="field-help" role="status">{t('lab.projectSaved',{name:projects.laboratory.name})}</p>}</>;
}
