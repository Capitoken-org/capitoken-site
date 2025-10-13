(function(){
  const $ = (s, r=document)=>r.querySelector(s);

  // Countdown
  function toParts(diff){
    const d=Math.floor(diff/86400);
    const h=Math.floor((diff%86400)/3600);
    const m=Math.floor((diff%3600)/60);
    const s=Math.floor(diff%60);
    return {d,h,m,s};
  }
  function startCountdown(){
    const target=new Date("2025-10-17T19:17:17Z").getTime()/1000;
    const update=()=>{
      const now=Date.now()/1000;
      let diff=target-now;if(diff<0)diff=0;
      const p=toParts(diff);
      $("#d").textContent=p.d;$("#h").textContent=p.h;
      $("#m").textContent=p.m;$("#s").textContent=p.s;
    };
    update();setInterval(update,1000);
  }

  // Animación de aparición
  function revealOnScroll(){
    const els=document.querySelectorAll('.fadein,.step');
    const trigger=window.innerHeight*0.9;
    els.forEach(el=>{
      const top=el.getBoundingClientRect().top;
      if(top<trigger){el.classList.add('visible');}
    });
  }

  // Tokenomics gráfico
  function drawChart(){
    const c=$("#tokenChart");
    if(!c)return;
    const ctx=c.getContext("2d");
    const slices=[40,25,15,10,10];
    const colors=["#20c997","#14a086","#f59f0b","#fbbf24","#9ca3af"];
    let start=0;
    slices.forEach((v,i)=>{
      const end=start+(v/100)*2*Math.PI;
      ctx.beginPath();
      ctx.moveTo(130,130);
      ctx.arc(130,130,120,start,end);
      ctx.closePath();
      ctx.fillStyle=colors[i];
      ctx.fill();
      start=end;
    });
  }

  document.addEventListener("DOMContentLoaded",()=>{
    startCountdown();
    drawChart();
    revealOnScroll();
    window.addEventListener('scroll',revealOnScroll);
  });
})();
