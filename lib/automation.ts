export type RescanJob={state:string;city?:string;kind?:string};
export function buildRescanPlan(states:string[], kinds=['travel agency','tour operator','visa consultant']){return states.flatMap(state=>kinds.map(kind=>({state,kind})))}
export function outreachLinks(phone:string,email=''){const digits=phone.replace(/\D/g,''); return {whatsapp:digits?`https://wa.me/${digits}`:'',email:email?`mailto:${email}`:''};}
