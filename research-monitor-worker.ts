import {checkResearch,type MonitorEnv} from './lib/research-monitor';
export default {
 async scheduled(_controller:ScheduledController,env:MonitorEnv){await checkResearch(env);},
 // No public status, manual trigger or credentials endpoint.
 async fetch(){return new Response('Not found',{status:404});},
};
