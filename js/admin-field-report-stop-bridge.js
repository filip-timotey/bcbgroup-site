const stop=document.querySelector('#time-stop');
if(stop){
  stop.addEventListener('click',()=>{
    const projectId=document.querySelector('#time-project')?.value||null;
    let attempts=0;
    const watch=setInterval(()=>{
      attempts++;
      const pill=document.querySelector('#time-state-pill');
      const stopped=pill&&/neînceput/i.test(pill.textContent||'');
      if(stopped){clearInterval(watch);window.dispatchEvent(new CustomEvent('bcb:workday-stopped',{detail:{projectId}}));}
      else if(attempts>=16)clearInterval(watch);
    },500);
  },true);
}
