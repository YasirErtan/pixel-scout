/** One row at a time. Cancellation prevents stale timers from revealing a new round. */
export const REVEAL_INTERVAL = 720;
export const REVEAL_LEAD = 240;
export const REVEAL_DURATION = 560;
export function revealSequence({count=5,onReveal,onComplete,interval=REVEAL_INTERVAL,lead=REVEAL_LEAD,duration=REVEAL_DURATION,schedule=setTimeout,unschedule=clearTimeout}) {
  let cancelled=false;
  const timers=[];
  for(let index=0;index<count;index++)timers.push(schedule(()=>{if(!cancelled)onReveal(index);},lead+index*interval));
  timers.push(schedule(()=>{if(!cancelled)onComplete();},lead+Math.max(0,count-1)*interval+duration));
  return ()=>{cancelled=true;timers.forEach(unschedule);};
}
