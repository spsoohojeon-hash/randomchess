import { env } from "cloudflare:workers";
import { roomApi } from "@/lib/room-service";
export async function POST(req:Request){return roomApi((env as unknown as {DB:D1Database}).DB,req);}
