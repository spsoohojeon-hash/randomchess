import { env } from "cloudflare:workers";
import { roomApi } from "@/lib/room-service";
type Context={params:Promise<{code:string}>};
export async function GET(req:Request,ctx:Context){return roomApi((env as unknown as {DB:D1Database}).DB,req,(await ctx.params).code);}
export async function POST(req:Request,ctx:Context){return roomApi((env as unknown as {DB:D1Database}).DB,req,(await ctx.params).code);}
