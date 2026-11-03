const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:0;
const text=(v:unknown,max=160)=>typeof v==='string'?v.slice(0,max):'';
export function cleanSnapshot(input:any){
 if(!input||!Array.isArray(input.games)||input.games.length>30||!Array.isArray(input.ranking)||input.ranking.length>100||!Array.isArray(input.matchups)||input.matchups.length>100)throw Error('invalid_snapshot');
 const totals=Object.fromEntries(['games','finished','running','blocked','white_wins','black_wins','draws'].map(k=>[k,number(input.totals?.[k])]));
 const ranking=input.ranking.map((r:any)=>({card:text(r.card,40),games:number(r.games),wins:number(r.wins),draws:number(r.draws)}));
 const matchups=input.matchups.map((r:any)=>({white_card:text(r.white_card,40),black_card:text(r.black_card,40),games:number(r.games),white_wins:number(r.white_wins),black_wins:number(r.black_wins),draws:number(r.draws)}));
 const games=input.games.map((g:any)=>{
  const board=JSON.parse(g.board);if(!Array.isArray(board)||board.length!==64)throw Error('board');
  return {id:text(g.id,80),white_card:text(g.white_card,40),black_card:text(g.black_card,40),started:number(g.started),updated:number(g.updated),seq:number(g.seq),status:['running','finished','blocked'].includes(g.status)?g.status:'blocked',winner:['w','b','draw'].includes(g.winner)?g.winner:null,reason:text(g.reason,300),rules:text(g.rules,128),ply:number(g.ply),approximate:1,board:JSON.stringify(board.map(p=>p&&['w','b'].includes(p.color)&&['p','n','b','r','q','k'].includes(p.kind)?{color:p.color,kind:p.kind}:null))};
 });
 const source=input.training??{},training:Record<string,unknown>={state:['waiting','loading','training','validating','ready','rejected','failed'].includes(source.state)?source.state:'waiting'};
 for(const k of ['completedGames','trainGames','validationGames','testGames','examples','epoch','epochs','validationLoss','baselineLoss','testLoss','testValueLoss','trainLoss','processed','updated','workers','busyWorkers'])if(typeof source[k]==='number'&&Number.isFinite(source[k]))training[k]=source[k];
 for(const k of ['activeModel','modelId','rules','reason','backend','device'])if(typeof source[k]==='string')training[k]=text(source[k]);
 return {totals,ranking,matchups,games,training,lastEvent:input.lastEvent===null?null:number(input.lastEvent)};
}
