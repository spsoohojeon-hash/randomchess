import { applyAction, createGame, drawCards, publicGame, normalizeCardPool } from "./game.ts";
import type { Game, Side, Action, CardPool } from "./game.ts";

type Row = {code:string;white_token:string;black_token:string|null;game:string;version:number;pool:string;last_request:string|null;rematch:string;created_at:number;expires_at:number};
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode=()=>{const nums=new Uint8Array(6);crypto.getRandomValues(nums);return Array.from(nums,n=>alphabet[n%alphabet.length]).join("");};
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,"0")).join("");
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function storedPool(value:string):CardPool{return normalizeCardPool(value==="all"||value==="classic"?value:JSON.parse(value));}
function view(row:Row,side:Side){return {code:row.code,side,game:publicGame(JSON.parse(row.game),side),version:row.version,waiting:!row.black_token,pool:storedPool(row.pool),rematch:JSON.parse(row.rematch),expiresAt:row.expires_at};}
async function body(req:Request){const txt=await req.text();if(txt.length>5000)throw new Error("요청이 너무 큽니다.");const p=JSON.parse(txt);if(!p||typeof p!=="object"||Array.isArray(p))throw new Error("요청 내용을 확인해 주세요.");return p;}

export async function roomApi(db:D1Database,req:Request,code?:string):Promise<Response>{
  try{
    if(req.method!=="GET"&&req.headers.get("origin")&&req.headers.get("origin")!==new URL(req.url).origin)return json({error:"요청 출처를 확인해 주세요."},403);
    if(!code){
      if(req.method!=="POST")return json({error:"지원하지 않는 요청입니다."},405);
      const p=await body(req);let pool:CardPool;
      try{pool=normalizeCardPool(p.pool);}catch{return json({error:"능력을 1개 이상 중복 없이 선택해 주세요."},400);}
      const token=crypto.randomUUID()+crypto.randomUUID(),hash=await digest(token),now=Date.now();
      const game=createGame(...drawCards(pool),pool);
      for(let attempt=0;attempt<4;attempt++){
        const roomCode=randomCode();
        const res=await db.prepare("INSERT OR IGNORE INTO chess_rooms (code, white_token, game, pool, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(roomCode,hash,JSON.stringify(game),pool==="all"?pool:JSON.stringify(pool),now,now+7*86400000).run();
        if(res.meta.changes){const row=await db.prepare("SELECT * FROM chess_rooms WHERE code = ?").bind(roomCode).first<Row>();return json({...view(row!,"w"),token},201);}
      }return json({error:"방을 만들지 못했습니다. 다시 시도해 주세요."},503);
    }
    if(!/^[A-Z2-9]{6}$/.test(code))return json({error:"방 코드는 영문과 숫자 6자리입니다."},400);
    let row=await db.prepare("SELECT * FROM chess_rooms WHERE code = ?").bind(code).first<Row>();
    if(!row)return json({error:"방을 찾을 수 없습니다. 코드를 확인해 주세요."},404);
    if(row.expires_at<Date.now())return json({error:"7일이 지나 만료된 방입니다. 새 방을 만들어 주세요."},410);
    const p=req.method==="POST"?await body(req):null;
    if(p?.type==="join"){
      if(row.black_token)return json({error:"이미 두 명이 참가한 방입니다."},409);
      const token=crypto.randomUUID()+crypto.randomUUID();
      const result=await db.prepare("UPDATE chess_rooms SET black_token = ?, version = version + 1 WHERE code = ? AND black_token IS NULL").bind(await digest(token),code).run();
      if(!result.meta.changes)return json({error:"다른 플레이어가 먼저 참가했습니다."},409);
      row=await db.prepare("SELECT * FROM chess_rooms WHERE code = ?").bind(code).first<Row>();return json({...view(row!,"b"),token});
    }
    const token=req.headers.get("Authorization")?.replace(/^Bearer /,"")??"";
    if(token.length<32||token.length>200)return json({error:"이 방의 참가 정보가 없습니다."},401);
    const hash=await digest(token);const side:Side|null=hash===row.white_token?"w":hash===row.black_token?"b":null;
    if(!side)return json({error:"이 방에 접근할 수 없습니다."},403);
    if(req.method==="GET")return json(view(row,side));
    if(req.method!=="POST")return json({error:"지원하지 않는 요청입니다."},405);
    if(!row.black_token)return json({error:"상대가 참가할 때까지 기다려 주세요."},409);
    if(typeof p.requestId!=="string"||!/^[-a-zA-Z0-9]{8,80}$/.test(p.requestId))return json({error:"요청 식별자가 올바르지 않습니다."},400);
    if(row.last_request===side+":"+p.requestId)return json(view(row,side));
    if(!Number.isInteger(p.version)||p.version!==row.version)return json({...view(row,side),error:"상대의 새 행동을 반영했습니다. 다시 선택해 주세요."},409);
    let game:Game=JSON.parse(row.game),rematch:Side[]=JSON.parse(row.rematch);
    if(p.type==="rematch"){
      if(game.phase!=="over")return json({error:"대국이 끝난 뒤 다시 할 수 있습니다."},400);
      if(!rematch.includes(side))rematch.push(side);
      if(rematch.length===2){const pool=storedPool(row.pool);game=createGame(...drawCards(pool),pool);game.revision=JSON.parse(row.game).revision+1;rematch=[];}
    }else if(p.type==="action"){
      try{game=applyAction(game,side,p.action as Action);}catch(e){return json({error:e instanceof Error?e.message:"둘 수 없는 수입니다."},400);}
    }else return json({error:"지원하지 않는 동작입니다."},400);
    const update=await db.prepare("UPDATE chess_rooms SET game = ?, version = version + 1, last_request = ?, rematch = ? WHERE code = ? AND version = ?").bind(JSON.stringify(game),side+":"+p.requestId,JSON.stringify(rematch),code,p.version).run();
    row=await db.prepare("SELECT * FROM chess_rooms WHERE code = ?").bind(code).first<Row>();
    if(!update.meta.changes)return json({...view(row!,side),error:"동시에 진행된 행동을 반영했습니다. 다시 선택해 주세요."},409);
    return json(view(row!,side));
  }catch(e){
    if(e instanceof SyntaxError)return json({error:"요청 형식이 올바르지 않습니다."},400);
    if(e instanceof Error&&["요청이 너무 큽니다.","요청 내용을 확인해 주세요."].includes(e.message))return json({error:e.message},400);
    console.error("Room service unavailable",e);return json({error:"온라인 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요. 로컬 대전은 계속 사용할 수 있습니다."},503);
  }
}
