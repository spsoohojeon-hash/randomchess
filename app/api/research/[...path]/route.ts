import {env} from 'cloudflare:workers';
import {researchApi,type ResearchEnv} from '@/lib/research-service';
async function handle(req:Request){return researchApi(env as unknown as ResearchEnv,req,new URL(req.url).pathname.replace(/^\/api\/research\//,''));}
export const GET=handle;
export const POST=handle;
