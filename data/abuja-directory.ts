import {ABUJA_AGENCIES} from './abuja-agencies';
import {ABUJA_MORE} from './abuja-more';
export const ABUJA_DIRECTORY=[...ABUJA_AGENCIES,...ABUJA_MORE.map((x,i)=>({...x,id:`more-${i}-${x.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}))];
