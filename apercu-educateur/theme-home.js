/* Confine the existing slideshow to its welcome card. No document/storage changes. */
(()=>{function place(){const hero=document.querySelector('#home-page-0 .home-hero'),photos=document.getElementById('home-backdrop');if(hero&&photos)hero.append(photos);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',place);else place();})();
