// Fond photographique de l'accueil : aucun chargement de compte ou traceur Instagram.
let homeSlideImages=[],homeSlideIndex=0,homeSlideTimer=null;
const homeSlideMotion=matchMedia('(prefers-reduced-motion: reduce)');
let homeSlidePaused=homeSlideMotion.matches;
function homeSlideVisible(){return document.body.classList.contains('home-mode')&&!document.hidden;}
function renderHomeSlide(){
 homeSlideImages.forEach((img,index)=>img.classList.toggle('active',index===homeSlideIndex));
 $('home-slide-position').textContent='Photo '+(homeSlideIndex+1)+' / '+homeSlideImages.length;
 $('home-slide-pause').textContent=homeSlidePaused?'Reprendre le défilement':'Mettre en pause';$('home-slide-pause').setAttribute('aria-pressed',String(homeSlidePaused));
 for(const id of ['home-slide-previous','home-slide-next','home-slide-pause'])$(id).disabled=homeSlideImages.length<2;
}
function updateHomeSlideTimer(){
 clearInterval(homeSlideTimer);homeSlideTimer=null;
 if(homeSlideImages.length>1&&!homeSlidePaused&&!document.body.classList.contains('coach-reduced-motion')&&homeSlideVisible())homeSlideTimer=setInterval(()=>changeHomeSlide(1),6000);
}
function changeHomeSlide(direction){if(!homeSlideImages.length)return;homeSlideIndex=(homeSlideIndex+direction+homeSlideImages.length)%homeSlideImages.length;renderHomeSlide();}
$('home-slide-previous').onclick=()=>{changeHomeSlide(-1);updateHomeSlideTimer();};$('home-slide-next').onclick=()=>{changeHomeSlide(1);updateHomeSlideTimer();};
$('home-slide-pause').onclick=()=>{homeSlidePaused=!homeSlidePaused;renderHomeSlide();updateHomeSlideTimer();};
homeSlideMotion.addEventListener('change',event=>{homeSlidePaused=event.matches;renderHomeSlide();updateHomeSlideTimer();});
document.addEventListener('visibilitychange',updateHomeSlideTimer);
new MutationObserver(updateHomeSlideTimer).observe(document.body,{attributes:true,attributeFilter:['class']});
let homeSlideRequest=0,homeSlideSources=[];
async function initializeHomeSlides(){
 const configured=Array.isArray(window.CLUB_HOME_SLIDES)?window.CLUB_HOME_SLIDES:[],seen=new Set();
 const candidates=configured.filter(photo=>{if(!photo||typeof photo.src!=='string'||!/^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(photo.src)||seen.has(photo.src))return false;seen.add(photo.src);return true;}).slice(0,12);
 const library = (window.clubPhotoLibrary?.cached() || [])
   .map(photo => photo.data)
   .filter(src => typeof src === 'string' && /^data:image\/jpeg;base64,/.test(src));
 const sources = [...new Set(library.length ? library : candidates.map(photo => photo.src))];
 if (sources.length === homeSlideSources.length && sources.every((src, index) => src === homeSlideSources[index])) return;
 homeSlideSources = sources;
 const request = ++homeSlideRequest;
 const previous = homeSlideImages[homeSlideIndex]?.getAttribute('src');
 if (previous && !sources.includes(previous)) $('home-backdrop').hidden = true;
 const loaded = await Promise.all(sources.map(async src => {
   const img = new Image();
   img.alt = '';
   img.decoding = 'async';
   img.src = src;
   try { await img.decode(); return img; } catch { return null; }
 }));
 if (request !== homeSlideRequest) return;
 homeSlideImages = loaded.filter(Boolean);
 homeSlideIndex = Math.max(0, homeSlideImages.findIndex(img => img.getAttribute('src') === previous));
 const hasPhotos = homeSlideImages.length > 0;
 $('home-backdrop').replaceChildren(...homeSlideImages);
 $('home-backdrop').hidden = !hasPhotos;
 $('home-slideshow-controls').hidden = homeSlideImages.length < 2;
 document.body.classList.toggle('home-has-slides', hasPhotos);
 document.querySelector('.home-club-life').hidden = hasPhotos;
 renderHomeSlide();
 updateHomeSlideTimer();
}
document.addEventListener('club-photos-updated', initializeHomeSlides);
document.addEventListener('club-session-ready', initializeHomeSlides);
const homeSlidesReady=initializeHomeSlides();
