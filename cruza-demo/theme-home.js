/* Keep the existing slideshow behind the whole home dashboard. */
(()=>{function place(){const photos=document.getElementById('home-backdrop');if(photos&&photos.parentElement!==document.body)document.body.prepend(photos);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',place);else place();})();
