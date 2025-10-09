// BUZZER NEON PRO - script.js (bản có âm thanh & rung, chạy offline)
const firebaseConfig = {
  apiKey: "AIzaSyCDEa_NKenTTQqSj1CKYJP02Al1VQC29K",
  authDomain: "bamchuong26.firebaseapp.com",
  databaseURL: "https://bamchuong26-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bamchuong26",
  storageBucket: "bamchuong26.appspot.com",
  messagingSenderId: "1836167181367",
  appId: "1:1836167181367:web:3882d805c836164908a4232",
  measurementId: "G-Q7TT3TLYFV"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const gameRef = db.ref('game_session');
const playersRef = db.ref('players');
const teacherStatusRef = db.ref('teacher_status/online');

const TEAM_COLORS = {
  red: { name: 'Đội Đỏ', code: '#ff6b6b' },
  blue: { name: 'Đội Xanh Dương', code: '#00d4ff' },
  green: { name: 'Đội Xanh Lá', code: '#7ef0a6' },
  yellow: { name: 'Đội Vàng', code: '#ffd86b' },
  purple: { name: 'Đội Tím', code: '#9b6bff' }
};

// ==== ÂM THANH OFFLINE ====
const sounds = {
  bip: new Audio('neon_ping.mp3'),        // khi “BẤM!” xuất hiện
  click: new Audio('electric_click.mp3'), // khi học sinh bấm
  ping: new Audio('energy_pulse.mp3'),    // khi khởi động vòng
  lock: new Audio('neon_lock.mp3')        // khi bị loại
};

// Mở quyền phát âm thanh khi người dùng tương tác lần đầu
document.body.addEventListener("click", () => {
  Object.values(sounds).forEach(a => { a.play().catch(()=>{}); a.pause(); a.currentTime = 0; });
}, { once: true });

let userRole = null;
let studentTeam = null;

const roleScreen = document.getElementById('role-selection');
const teacherScreen = document.getElementById('teacher-screen');
const studentScreen = document.getElementById('student-screen');
const startButton = document.getElementById('start-button');
const endRoundButton = document.getElementById('end-round-button');
const masterResetButton = document.getElementById('master-reset-button');
const countdownDisplay = document.getElementById('countdown-display');
const resultDisplay = document.getElementById('result-display');
const teamsStatus = document.getElementById('teams-status');
const buzzerButton = document.getElementById('buzzer-button');
const teamNameDisplay = document.getElementById('team-name-display');
const buzzerStatus = document.getElementById('buzzer-status');
const freezeOverlay = document.getElementById('freeze-overlay');

// ===== Chọn vai trò =====
document.getElementById('btn-teacher').onclick = () => { userRole = 'teacher'; showScreen('teacher'); setupTeacher(); };
document.querySelectorAll('.btn-role-team').forEach(btn=>{
  btn.onclick=async e=>{
    const color=e.target.dataset.color;
    const team=TEAM_COLORS[color];
    if(!team)return;
    const snap=await playersRef.child(color).once('value');
    if(snap.exists()){alert('Đội đã có người chọn');return;}
    await playersRef.child(color).set({team_name:team.name,color,state:'waiting',press_time:0,yellow_cards:0});
    userRole='student'; studentTeam=color;
    showScreen('student'); setupStudent(team);
  };
});

function showScreen(mode){
  roleScreen.style.display=(mode==='teacher'||mode==='student')?'none':'flex';
  teacherScreen.style.display=(mode==='teacher')?'block':'none';
  studentScreen.style.display=(mode==='student')?'block':'none';
}

/* ===== TEACHER ===== */
function setupTeacher(){
  teacherStatusRef.set(true);
  teacherStatusRef.onDisconnect().set(false);

  startButton.onclick=async()=>{
    startButton.disabled=true; resultDisplay.textContent='';
    const snap=await playersRef.once('value'); const updates={};
    snap.forEach(ch=>{updates[ch.key+'/state']='waiting';updates[ch.key+'/press_time']=0;});
    await playersRef.update(updates);
    await gameRef.set({status:'countdown',last_start_time:Date.now()});

    const revealAfter=Math.floor(Math.random()*4)+1;
    let step=4,done=0;

    (async function runCountdown(){
      while(step>=1){
        await gameRef.child('status').set(step);
        await new Promise(r=>setTimeout(r,500+Math.random()*1000));
        done++;
        if(done===revealAfter){
          await new Promise(r=>setTimeout(r,200+Math.random()*1200));
          await gameRef.child('status').set('press_allowed');
          startButton.style.display='none';endRoundButton.style.display='inline-block';
          startButton.disabled=false;return;
        }
        step--;
      }
      await gameRef.child('status').set('press_allowed');
      startButton.style.display='none';endRoundButton.style.display='inline-block';
      startButton.disabled=false;
    })();
  };

  endRoundButton.onclick=async()=>{
    await gameRef.set({status:'waiting'});
    startButton.style.display='inline-block';endRoundButton.style.display='none';
    resultDisplay.textContent='CHỜ LỆNH';
  };

  masterResetButton.onclick=async()=>{
    if(!confirm('Reset toàn bộ dữ liệu?'))return;
    await playersRef.remove();await gameRef.set({status:'waiting'});teacherStatusRef.set(false);location.reload();
  };

  playersRef.on('value',snap=>{
    const data=snap.val()||{};teamsStatus.innerHTML='';
    const arr=Object.entries(data).map(([k,v])=>({key:k,...v}));
    const pressed=arr.filter(p=>p.state==='pressed'&&p.press_time>0).sort((a,b)=>a.press_time-b.press_time);
    if(pressed[0]) resultDisplay.textContent=`🥇 ${pressed[0].team_name} đã bấm trước!`;
    else resultDisplay.textContent='Đang chờ bấm...';
    arr.forEach(p=>{
      const box=document.createElement('div');
      box.className='team-box';
      box.textContent=`${p.team_name}\n${p.state}`;
      box.style.background=TEAM_COLORS[p.color]?.code||'#ddd';
      if(pressed[0]&&pressed[0].team_name===p.team_name){box.style.boxShadow='0 0 18px 6px gold';}
      teamsStatus.appendChild(box);
    });
  });

  gameRef.child('status').on('value',snap=>{
    const s=snap.val();
    if(s==='press_allowed') countdownDisplay.textContent='BẤM!';
    else if(s==='waiting') countdownDisplay.textContent='CHỜ LỆNH';
    else if(s==='countdown') countdownDisplay.textContent='ĐANG ĐẾM';
    else countdownDisplay.textContent=s;
  });
}

/* ===== STUDENT ===== */
function setupStudent(teamInfo){
  teamNameDisplay.textContent=teamInfo.name;
  buzzerButton.className='waiting disabled';
  buzzerButton.textContent='CHỜ GIÁO VIÊN';
  buzzerStatus.textContent='TRẠNG THÁI: CHỜ';

  teacherStatusRef.on('value',snap=>{
    if(snap.val()===false&&userRole==='student'){
      alert('Giáo viên đã thoát. Quay về chọn vai trò.'); playersRef.child(studentTeam).remove(); location.reload();
    }
  });

  gameRef.child('status').on('value',async snap=>{
    const s=snap.val();

    if(s==='press_allowed'){
      // 💥 Khi “BẤM!” xuất hiện
      buzzerButton.className='ready';
      buzzerButton.textContent='BẤM!';
      buzzerStatus.textContent='TRẠNG THÁI: SẴN SÀNG';
      sounds.bip.currentTime=0;
      sounds.bip.play().catch(()=>{});
      if(navigator.vibrate) navigator.vibrate([80, 40, 80]); // rung 2 nhịp ngắn

    } else if(!isNaN(parseInt(s))){
      buzzerButton.className='countdown disabled';
      buzzerButton.textContent=s;
      buzzerStatus.textContent='ĐANG ĐẾM NGƯỢC';

    } else if(s==='waiting'){
      buzzerButton.className='waiting disabled';
      buzzerButton.textContent='CHỜ GIÁO VIÊN';
      buzzerStatus.textContent='TRẠNG THÁI: CHỜ';
      freezeOverlay.classList.remove('active');
    }
  });

  // Khi học sinh bấm nút
  buzzerButton.onclick=async()=>{
    const statusSnapshot=await gameRef.child('status').once('value');
    const status=statusSnapshot.val();
    if(status==='press_allowed'){
      sounds.click.currentTime=0;
      sounds.click.play().catch(()=>{});
      if(navigator.vibrate) navigator.vibrate(120);
      const now=Date.now();
      await playersRef.child(studentTeam).update({state:'pressed',press_time:now});
      freezeOverlay.classList.add('active');
      buzzerStatus.textContent='ĐÃ BẤM - CHỜ KẾT QUẢ';
      setTimeout(async()=>{
        const current=(await gameRef.child('status').once('value')).val();
        if(current==='press_allowed')await gameRef.child('status').set('waiting');
      },5000);
    }
  };
}
