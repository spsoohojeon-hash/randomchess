const SERVER = "wss://randomchess.onrender.com";

let board, turn, selected, moves;
let ws = null;
let online = false;
let myColor = null;

const imgs = {
  wp:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png",
  wr:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png",
  wn:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png",
  wb:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png",
  wq:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png",
  wk:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png",
  bp:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png",
  br:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png",
  bn:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png",
  bb:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png",
  bq:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png",
  bk:"https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png"
};

function init(){
  board = createBoard();
  turn = "white";
  selected = null;
  moves = [];
}

function createBoard(){
  return [
    ["br","bn","bb","bq","bk","bb","bn","br"],
    ["bp","bp","bp","bp","bp","bp","bp","bp"],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["wp","wp","wp","wp","wp","wp","wp","wp"],
    ["wr","wn","wb","wq","wk","wb","wn","wr"]
  ];
}

function startLocal(){
  online=false;
  init();
  showGame();
  render();
}

function makeRoom(){
  const code=Math.random().toString(36).substring(2,7).toUpperCase();
  document.getElementById("room").value=code;
  joinOnline();
}

function joinOnline(){
  const room=document.getElementById("room").value;
  if(!room) return alert("코드 입력");

  ws=new WebSocket(SERVER);

  ws.onopen=()=>{
    ws.send(JSON.stringify({type:"join",roomId:room}));
  };

  ws.onmessage=e=>{
    const d=JSON.parse(e.data);

    if(d.type==="start"){
      myColor=d.color;
      init();
      online=true;
      showGame();
      render();
    }

    if(d.type==="move"){
      applyMove(d.from,d.to);
      render();
    }
  };
}

function applyMove(f,t){
  board[t.r][t.c]=board[f.r][f.c];
  board[f.r][f.c]="";
  turn=turn==="white"?"black":"white";
}

function showGame(){
  document.getElementById("menu").style.display="none";
  document.getElementById("game").style.display="block";
}

function backMenu(){
  document.getElementById("game").style.display="none";
  document.getElementById("menu").style.display="block";
}

function render(){
  const b=document.getElementById("board");
  b.innerHTML="";
  document.getElementById("info").innerText=turn+" 턴";

  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const div=document.createElement("div");
      div.className="cell "+((r+c)%2?"black":"white");

      const p=board[r][c];
      if(p){
        const img=document.createElement("img");
        img.src=imgs[p];
        div.appendChild(img);
      }

      div.onclick=()=>click(r,c);

      b.appendChild(div);
    }
  }
}

function click(r,c){
  if(selected){
    move(selected,{r,c});
    selected=null;
    render();
  } else {
    if(board[r][c]){
      selected={r,c};
    }
  }
}

function move(f,t){
  applyMove(f,t);

  if(online){
    ws.send(JSON.stringify({type:"move",from:f,to:t}));
  }
}

init();
