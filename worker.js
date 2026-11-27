const W = 1000, H = 560, GROUND = 475;

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.clients = new Map();
    this.hostCharacter = 'MELİS';
    this.state = this.initialState();
    this.timer = null;
    this.lastTick = 0;
    this.lastSend = 0;
  }
  initialState() {
    const player = (x, name, dir) => ({x,y:GROUND,vx:0,vy:0,r:32,name,dir,onGround:true,cool:0});
    return {p1:player(430,this.hostCharacter,1),p2:player(570,this.hostCharacter==='MELİS'?'KADİR':'MELİS',-1),ball:{x:W/2,y:GROUND-70,vx:0,vy:0,r:22},score1:0,score2:0,time:90,paused:true,ended:false,pauseVotes:{host:false,guest:false},message:'Rakip bekleniyor…',inputs:{host:{},guest:{}}};
  }
  resetPositions(){this.state.p1.x=430;this.state.p1.y=GROUND;this.state.p1.vx=this.state.p1.vy=0;this.state.p1.onGround=true;this.state.p2.x=570;this.state.p2.y=GROUND;this.state.p2.vx=this.state.p2.vy=0;this.state.p2.onGround=true;this.state.ball={x:W/2,y:GROUND-70,vx:0,vy:0,r:22};}
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Melka game room online', {status:200});
    const role=url.searchParams.get('role');
    const character=url.searchParams.get('character')||'MELİS';
    if(!['host','guest'].includes(role)) return new Response('Invalid role',{status:400});
    if(role==='host' && !this.clients.has('host')) {
      this.hostCharacter=character==='KADİR'?'KADİR':'MELİS';
      this.state=this.initialState();
    }
    if(this.clients.has(role)) return new Response('This role is already connected',{status:409});
    const pair=new WebSocketPair(); const client=pair[0],server=pair[1]; server.accept();
    this.clients.set(role,server);
    server.addEventListener('message',e=>this.onMessage(role,e.data));
    server.addEventListener('close',()=>this.onClose(role));
    server.addEventListener('error',()=>this.onClose(role));
    this.sendOne(role,'joined',{opponentPresent:this.clients.size===2});
    if(this.clients.size===2){
      this.state.paused=false;this.state.message='İki oyuncu bağlandı. Maç başladı!';
      const hostCharacter=this.hostCharacter,guestCharacter=hostCharacter==='MELİS'?'KADİR':'MELİS';
      this.broadcast('start',{hostCharacter,guestCharacter});this.broadcastState();
    }
    if(!this.timer){this.lastTick=Date.now();this.lastSend=0;this.timer=setInterval(()=>this.tick(),1000/30);}
    return new Response(null,{status:101,webSocket:client});
  }
  onClose(role){
    // 'leave' mesajı ve WebSocket close olayı peş peşe gelebilir;
    // aynı oyuncunun bağlantısını ikinci kez kapatmaya çalışma.
    if(!this.clients.has(role)) return;
    this.clients.delete(role);
    this.state.inputs[role]={};
    if(this.clients.size===0){
      if(this.timer){clearInterval(this.timer);this.timer=null;}
      return;
    }
    this.state.paused=true;
    this.state.pauseVotes={host:false,guest:false};
    this.state.message='Oyuncu bağlantısı kesildi. Oda koduyla tekrar bağlanılabilir.';
    this.broadcastState();
  }
  onMessage(role,raw){
    let msg;try{msg=JSON.parse(raw)}catch{return;}
    const event=msg.event,p=msg.payload||{};
    if(event==='input'){this.state.inputs[role]=p.keys||{};return;}
    if(event==='pause-request'){
      if(this.state.ended)return;
      this.state.paused=true;this.state.pauseVotes={host:false,guest:false};this.state.message='Oyun duraklatıldı. Devam etmek için iki oyuncunun da onayı gerekiyor.';this.broadcastState();return;
    }
    if(event==='resume-vote'&&this.state.paused){this.state.pauseVotes[role]=true;if(this.state.pauseVotes.host&&this.state.pauseVotes.guest){this.state.paused=false;this.state.pauseVotes={host:false,guest:false};this.state.message='Oyun devam ediyor! ⚽';}else this.state.message='Devam etmek için diğer oyuncunun onayı bekleniyor.';this.broadcastState();return;}
    if(event==='rematch-request'){
      this.state.message='Rakibin rövanş istiyor!';
      // broadcast(event, payload) iki ayrı argüman bekler.
      this.broadcast('rematch-request',{from:role});
      this.broadcastState();
      return;
    }
    if(event==='rematch-start'||event==='restart'){
      // Yeni maçı yalnızca oda sahibi başlatabilir.
      if(role==='host'&&this.clients.size===2){
        this.state=this.initialState();
        this.state.paused=false;
        this.state.message='Yeni maç başladı!';
        this.broadcast('start',{hostCharacter:this.hostCharacter,guestCharacter:this.hostCharacter==='MELİS'?'KADİR':'MELİS'});
        this.broadcastState();
      }
      return;
    }
    if(event==='leave'){this.onClose(role);}
  }
  sendOne(role,event,payload){const ws=this.clients.get(role);if(ws&&ws.readyState===1){try{ws.send(JSON.stringify({event,payload}));}catch{}}}
  broadcast(event,payload){for(const role of this.clients.keys())this.sendOne(role,event,payload);}
  publicState(){const s=this.state;return {p1:s.p1,p2:s.p2,ball:s.ball,score1:s.score1,score2:s.score2,time:s.time,paused:s.paused,ended:s.ended,pauseVotes:s.pauseVotes,message:s.message};}
  broadcastState(){this.broadcast('state',this.publicState());}
  collidePlayer(p){const ax=p.x,ay=p.y-78,by=p.y-27,qy=Math.max(ay,Math.min(by,this.state.ball.y));let dx=this.state.ball.x-ax,dy=this.state.ball.y-qy,d=Math.hypot(dx,dy),min=this.state.ball.r+29;if(d>=min)return;if(d<.001){dx=p.dir||1;dy=0;d=1;}const nx=dx/d,ny=dy/d,b=this.state.ball;b.x=ax+nx*min;b.y=qy+ny*min;const rvx=b.vx-(p.vx||0),rvy=b.vy-(p.vy||0),vn=rvx*nx+rvy*ny;if(vn<0){const impulse=-(1+.72)*vn/1.12;b.vx+=impulse*nx;b.vy+=impulse*ny;const tx=-ny,ty=nx,t=(b.vx-p.vx)*tx+(b.vy-p.vy)*ty;b.vx-=t*tx*.035;b.vy-=t*ty*.035;}}
  collideSegment(x1,y1,x2,y2){const b=this.state.ball,sx=x2-x1,sy=y2-y1,l=sx*sx+sy*sy,t=l?Math.max(0,Math.min(1,((b.x-x1)*sx+(b.y-y1)*sy)/l)):0,qx=x1+t*sx,qy=y1+t*sy,dx=b.x-qx,dy=b.y-qy,d=Math.hypot(dx,dy),min=b.r+7;if(d>=min)return;const nx=d<.001?0:dx/d,ny=d<.001?-1:dy/d;b.x=qx+nx*min;b.y=qy+ny*min;const vn=b.vx*nx+b.vy*ny;if(vn<0){b.vx-=1.72*vn*nx;b.vy-=1.72*vn*ny;}}
  goal(side){if(side==='left')this.state.score2++;else this.state.score1++;this.resetPositions();this.state.message=side==='left'?'Kadir gol attı! ⚡':'Melis gol attı! 💜';if(this.state.score1>=5||this.state.score2>=5){this.state.ended=true;this.state.message=this.state.score1>this.state.score2?'Melis maçı kazandı! 💜🏆':'Kadir maçı kazandı! ⚡🏆';}}
  tick(){if(this.clients.size!==2)return;const s=this.state;if(!s.paused&&!s.ended){const dt=1/30,step=dt*60,gravity=.52;
    s.time=Math.max(0,s.time-dt);if(s.time===0){s.ended=true;s.message=s.score1===s.score2?'Berabere! Rövanş zamanı.':s.score1>s.score2?'Melis kazandı! 💜🏆':'Kadir kazandı! ⚡🏆';}
    for(const [p,keys,left,right,jump,shot] of [[s.p1,s.inputs.host,'a','d','w','f'],[s.p2,s.inputs.guest,'ArrowLeft','ArrowRight','ArrowUp','l']]){
      p.cool=Math.max(0,p.cool-dt);let ax=0;if(keys[left])ax=-.72;if(keys[right])ax=.72;p.vx+=ax*step;p.vx*=Math.pow(.84,step);p.vx=Math.max(-7,Math.min(7,p.vx));p.x=Math.max(55,Math.min(W-55,p.x+p.vx*step));
      if(keys[jump]&&p.onGround){p.vy=-12.7;p.onGround=false;}p.vy+=gravity*step;p.y+=p.vy*step;if(p.y>=GROUND){p.y=GROUND;p.vy=0;p.onGround=true;}
      if(keys[shot]&&p.cool<=0){const dx=s.ball.x-p.x,dy=s.ball.y-(p.y-78),dist=Math.hypot(dx,dy);if(dist<125){const dir=dx===0?p.dir:Math.sign(dx);s.ball.vx+=dir*12+p.vx*.65;s.ball.vy-=10.5;p.cool=.32;}}
      this.collidePlayer(p);
    }
    const b=s.ball,prevX=b.x,prevY=b.y;b.vy+=gravity*.9*step;b.x+=b.vx*step;b.y+=b.vy*step;b.vx*=Math.pow(.9975,step);b.vy*=Math.pow(.999,step);this.collidePlayer(s.p1);this.collidePlayer(s.p2);
    if(b.y+b.r>GROUND){b.y=GROUND-b.r;if(Math.abs(b.vy)>1.7)b.vy*=-.62;else b.vy=0;b.vx*=.982;if(Math.abs(b.vx)<.035)b.vx=0;}if(b.y-b.r<15){b.y=15+b.r;b.vy=Math.abs(b.vy)*.8;}
    const gy=GROUND-145;this.collideSegment(8,gy,98,gy);this.collideSegment(W-98,gy,W-8,gy);
    const top=gy+b.r+7,bottom=GROUND-b.r+.5;
    if(prevX>=98&&b.x<98){const t=(prevX-98)/(prevX-b.x),y=prevY+(b.y-prevY)*t;if(y>=top&&y<=bottom)this.goal('left');}
    if(prevX<=W-98&&b.x>W-98){const line=W-98,t=(line-prevX)/(b.x-prevX),y=prevY+(b.y-prevY)*t;if(y>=top&&y<=bottom)this.goal('right');}
    if(b.x-b.r<8&&b.y>gy+b.r&&b.y<GROUND-b.r){b.x=8+b.r;if(b.vx<0)b.vx=Math.abs(b.vx)*.55;b.vy*=.9;}if(b.x+b.r>W-8&&b.y>gy+b.r&&b.y<GROUND-b.r){b.x=W-8-b.r;if(b.vx>0)b.vx=-Math.abs(b.vx)*.55;b.vy*=.9;}if(b.x-b.r<0){b.x=b.r;if(b.vx<0)b.vx=Math.abs(b.vx)*.5;}if(b.x+b.r>W){b.x=W-b.r;if(b.vx>0)b.vx=-Math.abs(b.vx)*.5;}
  }
  this.broadcastState();
  }
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==='/health')return new Response('MELKA game server OK');
    const match=url.pathname.match(/^\/room\/(\d{6})$/);
    if(!match)return new Response('MELKA Cloudflare game server. Use /room/123456',{status:200});
    const id=env.GAME_ROOM.idFromName(match[1]);
    return env.GAME_ROOM.get(id).fetch(request);
  }
};
