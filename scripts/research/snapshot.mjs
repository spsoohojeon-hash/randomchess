import {gunzipSync} from 'node:zlib';
// Aggregate from local SQLite. No per-action payload or private referee leaves the PC.
export function snapshot(db,training){
 const totals=db.prepare("SELECT COUNT(*) games, SUM(status='finished') finished, SUM(status='running') running, SUM(status='blocked') blocked, SUM(status='finished' AND winner='w') white_wins, SUM(status='finished' AND winner='b') black_wins, SUM(status='finished' AND winner='draw') draws FROM games").get();
 const ranking=db.prepare("SELECT card,COUNT(*) games,SUM(win) wins,SUM(draw) draws FROM (SELECT white_card card,winner='w' win,winner='draw' draw FROM games WHERE status='finished' UNION ALL SELECT black_card card,winner='b' win,winner='draw' draw FROM games WHERE status='finished') GROUP BY card").all();
 const matchups=db.prepare("SELECT white_card,black_card,COUNT(*) games,SUM(winner='w') white_wins,SUM(winner='b') black_wins,SUM(winner='draw') draws FROM games WHERE status='finished' GROUP BY white_card,black_card ORDER BY games DESC LIMIT 100").all();
 const games=db.prepare('SELECT * FROM games ORDER BY started DESC LIMIT 30').all().map(g=>{
  const row=db.prepare('SELECT summary,seq FROM records WHERE game_id=? ORDER BY seq DESC LIMIT 1').get(g.id);const s=JSON.parse(row.summary);
  return {...g,seq:row.seq,board:JSON.stringify(s.board),ply:s.ply,reason:s.reason,updated:g.started,approximate:1};
 });
 const last=db.prepare('SELECT payload FROM records ORDER BY rowid DESC LIMIT 1').get();
 const lastEvent=last?JSON.parse(gunzipSync(last.payload).toString()).at:null;
 return {totals,ranking,matchups,games,lastEvent,training};
}
