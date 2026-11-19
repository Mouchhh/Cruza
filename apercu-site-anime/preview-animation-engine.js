/* Only the animation layer is replaced. All original click handlers remain in use. */
(() => {
  'use strict';
  if(window.originalMotionEngine)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let enabled=true,transition=null,ticket=0,forwarding=false,frame=0,muted=false,ready=false;
  const animations=new Set(),named=new Set();
  const stats={transitions:0,entries:0,lastView:'',cancelled:0};
  const navigationSelector='#workspace-navigation>button,.app-navigation>button,#task-section-navigation button,.flow-tabs button,.flow-nav button,.mode-switch button,#report-tabs button,.tactic-tabs button,.training-wizard-nav button,.training-tabs button,#report-next,#report-previous,#terrain-next,#terrain-previous,#agenda-next,#agenda-previous,#training-next,#training-previous,.sidebar [data-tab],.section-tabs [data-tab]';
  const on=()=>enabled&&!reduced.matches&&!document.body.classList.contains('coach-reduced-motion');
  const visible=node=>node instanceof HTMLElement&&!node.hidden&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
  function current(){
    const gate=document.getElementById('club-auth-gate');if(visible(gate)&&document.documentElement.classList.contains('club-private-request'))return {root:gate,panel:gate,key:'connexion-locale'};
    if(window.workspaceFraming){const view=window.workspaceFraming.current(),root=document.getElementById(view.rootId),panel=document.getElementById(view.panelId);return {root, panel:visible(panel)?panel:root,key:view.view+':'+view.panelId+':'+document.querySelector('#report-tabs [aria-current="step"]')?.id};}
    const root=document.getElementById('content')||document.querySelector('main');return {root,panel:root,key:'page:'+document.querySelector('[data-tab].selected')?.dataset.tab};
  }
  function stop(){cancelAnimationFrame(frame);frame=0;for(const a of animations)a.cancel();animations.clear();}
  function run(node,frames,options){if(!on()||!visible(node)||typeof node.animate!=='function')return;const a=node.animate(frames,{duration:550,easing:'cubic-bezier(.16,.8,.2,1)',...options});animations.add(a);a.finished.catch(()=>{}).finally(()=>{animations.delete(a);a.cancel();});return a;}
  function candidates(root,panel){
    const specific=[...root.querySelectorAll('.home-hero,.home-live-card,.home-section-card,.resource-card,.coach-resource-card,.report-panel,.training-card,.manager-card,.metric,.metrics>.card,.overview-grid>.card')].filter(visible);
    const all=specific.length?specific:[...(panel||root).children].filter(visible);
    return all.filter(node=>{const rect=node.getBoundingClientRect();return rect.height>24&&rect.width>50&&!['SCRIPT','STYLE','DIALOG'].includes(node.tagName);}).slice(0,9);
  }
  function entry({layer=true}={}){
    stop();if(!on())return;const {root,panel,key}=current();if(!visible(root))return;stats.entries++;stats.lastView=key;
    if(layer)run(root,[{opacity:.3,transform:'translateY(15px) rotateX(3deg)',filter:'blur(7px)'},{opacity:1,transform:'translateY(0) rotateX(0)',filter:'blur(0)'}],{duration:600});
    candidates(root,panel).forEach((node,i)=>run(node,[{opacity:.08,transform:'translateY(14px)',filter:'blur(5px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:570,delay:55+i*48}));
    root.querySelectorAll('.home-live-value,.metric-value,.stat-value,.metrics strong').forEach(node=>run(node,[{opacity:.35,transform:'translateY(5px) scale(.96)'},{opacity:1,transform:'none'}],{duration:700,delay:180}));
  }
  function clearNames(){for(const node of named)node.style.removeProperty('view-transition-name');named.clear();}
  function name(node){if(visible(node)){node.style.viewTransitionName='cruza-original-content';named.add(node);}}
  function updateToggle(){document.documentElement.classList.toggle('motion-preview-on',on());const control=document.getElementById('original-motion-enabled');if(control){control.checked=enabled&&!reduced.matches;control.disabled=reduced.matches;control.title=reduced.matches?'Mouvement réduit activé dans votre système.':'';}}
  function changeMode(value){enabled=value;try{localStorage.setItem('preview-animations',String(value));}catch{}ticket++;transition?.skipTransition();transition=null;muted=false;clearNames();stop();updateToggle();}
  function preserveFraming(kind){if(window.workspaceFraming)workspaceFraming.request({scope:kind==='main'?'main':kind==='tools'?'tools':'sub'});}
  // Existing scripts can continue calling the previous presentation API.
  window.animateNavigation=function(kind){preserveFraming(kind);if(muted||forwarding||!ready)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>entry());};
  window.stopNavigationMotion=stop;
  window.navigationContent=()=>current().root;
  window.originalMotionEngine={stats,entry:()=>entry(),current,enabled:on,setEnabled:changeMode};
  window.addEventListener('click',event=>{
    if(!ready||forwarding||!on()||(typeof workspaceNavigationRouting!=='undefined'&&workspaceNavigationRouting))return;
    const button=event.target.closest?.(navigationSelector);
    if(!button||button.disabled||button.id==='view-management'||button.closest('#original-motion-controls')||button.closest('dialog')||!visible(button))return;
    if(button.getAttribute('aria-current')==='page'||button.getAttribute('aria-current')==='step'||button.getAttribute('aria-pressed')==='true'||button.classList.contains('selected'))return;
    if(typeof document.startViewTransition!=='function'){
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>requestAnimationFrame(()=>entry()));return;
    }
    const before=current();if(!visible(before.root))return;
    event.preventDefault();event.stopImmediatePropagation();
    const generation=++ticket;transition?.skipTransition();stop();clearNames();name(before.root);
    const active=document.startViewTransition(async()=>{
      if(generation!==ticket)return;
      forwarding=true;muted=true;
      try{
        // Use the application's own router: it preserves draft guards and avoids
        // treating a deferred click as an unrelated programmatic navigation.
        if(button.matches('#workspace-navigation>button,.app-navigation>button')&&button.id&&window.workspaceNavigation&&button.id!=='workspace-settings-entry')window.workspaceNavigation.run(button.id);
        else button.click();
      }finally{forwarding=false;}
      // View-transition capture suppresses rendering: never await requestAnimationFrame here.
      await new Promise(resolve=>setTimeout(resolve,25));
      if(generation!==ticket)return;
      const after=current();clearNames();name(after.root);
      if(after.key===before.key&&after.root===before.root&&button.closest('#workspace-navigation,.app-navigation')){active.skipTransition();return;}
      stats.transitions++;stats.lastView=after.key;
    });
    transition=active;
    active.ready.catch(()=>{});
    active.finished.catch(()=>{}).finally(()=>{
      if(generation!==ticket){stats.cancelled++;return;}
      clearNames();transition=null;muted=false;entry({layer:false});
    });
  },true);
  // In-app links and programmatic page changes still receive an entry animation.
  let lastView='';const observe=()=>{
    const view=current();if(view.key===lastView)return;lastView=view.key;
    updateToggle();if(!ready||muted||forwarding||!on())return;
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>entry());
  };
  function initialize(){
    if(ready)return;ready=true;
    try{enabled=localStorage.getItem('preview-animations')!=='false';}catch{}
    const controls=document.createElement('aside');controls.id='original-motion-controls';controls.setAttribute('aria-label','Commandes de l’aperçu des animations');
    controls.innerHTML='<strong>APERÇU ANIMATIONS</strong><label><input id="original-motion-enabled" type="checkbox" checked>Animations</label><button id="original-motion-replay" type="button">Rejouer</button><button id="original-motion-help" type="button" aria-label="À propos de cet aperçu">?</button><a href="../" target="_blank" rel="noopener">Vrai site ↗</a>';
    const info=document.createElement('dialog');info.id='original-motion-info';info.setAttribute('aria-labelledby','original-motion-title');
    info.innerHTML='<h2 id="original-motion-title">Le vrai site, avec du mouvement.</h2><p>Cet aperçu reprend les pages, les textes, les outils et la disposition du site actuel. Seule la couche d’animation est ajoutée.</p><ul><li>Transition de sortie et d’entrée entre les onglets.</li><li>Apparition progressive des éléments de chaque page.</li><li>Réaction discrète au clic.</li><li>Animations désactivables et respect du mouvement réduit.</li></ul><p>Les comptes et les données privées ne sont pas connectés. Les essais restent dans un stockage séparé sur cet appareil. L’espace Responsable utilise sa démonstration existante.</p><button type="button" id="original-motion-close">Fermer</button>';
    document.body.append(controls,info);
    document.getElementById('original-motion-enabled').onchange=event=>changeMode(event.target.checked);
    document.getElementById('original-motion-replay').onclick=()=>entry();
    document.getElementById('original-motion-help').onclick=()=>info.showModal();document.getElementById('original-motion-close').onclick=()=>info.close();
    updateToggle();lastView=current().key;
    new MutationObserver(observe).observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click',event=>{const button=event.target.closest('button');if(!on()||!button||button.disabled||button.closest('#original-motion-controls')||button.matches(navigationSelector))return;run(button,[{transform:'scale(.96)'},{transform:'scale(1)'}],{duration:210});});
    // Original local start page, without a separate authentication requirement.
    setTimeout(()=>{if(typeof window.workspaceFraming==='object'&&document.getElementById('view-home')&&!history.state?.clubNavigation){document.getElementById('view-home').click();}lastView=current().key;entry();window.originalMotionPreviewReady=true;},150);
  }
  reduced.addEventListener('change',()=>{if(reduced.matches){ticket++;transition?.skipTransition();clearNames();stop();}updateToggle();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0));else initialize();
})();
