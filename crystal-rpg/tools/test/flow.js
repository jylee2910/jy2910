window.__p = c => window.dispatchEvent(new KeyboardEvent('keydown',{code:c}));
window.__w = ms => new Promise(r=>setTimeout(r,ms));
window.__skip = async (n=10) => { for(let i=0;i<n;i++){ __p('Enter'); await __w(300);} };
window.__newgame = async () => { __p('Enter'); await __w(800); __p('Enter'); await __w(6000); await __skip(8); await __w(1000); };
window.__mash = async (cond, max=120000) => { const t0=performance.now(); while(!cond() && performance.now()-t0<max){ __p('Enter'); await __w(400);} return cond(); };
