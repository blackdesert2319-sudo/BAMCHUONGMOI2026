// ============================================================
//  BUZZER NEON - Firebase config (giữ nguyên cấu hình của bạn)
// ============================================================

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
  red: { name: 'Đội Đỏ', code: '#E74C3C' },
  blue: { name: 'Đội Xanh Dương', code: '#3498DB' },
  green: { name: 'Đội Xanh Lá', code: '#2ECC71' },
  yellow: { name: 'Đội Vàng', code: '#F1C40F' },
  purple: { name: 'Đội Tím', code: '#9B59B6' }
};

// ============================================================
// Âm thanh neon
// ============================================================
const sounds = {
  bip: new Audio('neon_ping.mp3'),
  ping: new Audio('energy_pulse.mp3'),
  click: new Audio('electric_click.mp3'),
  lock: new Audio('neon_lock.mp3')
};

// unlock audio context khi người dùng click
document.body.addEventListener('click', function unlockAudio() {
  Object.values(sounds).forEach(a => { a.play().catch(()=>{}); a.pause(); a.currentTime=0; });
  document.body.removeEventListener('click', unlockAudio);
});

// ============================================================
//  Vai trò và trạng thái người dùng
// ============================================================
let userRole = null;
let studentTeam = null;
let buzzerAllowed = false;
let isFrozen = false;

// ============================================================
//  Chọn vai trò
// ============================================================
document.getElementById('btn-teacher').onclick = () => {
  userRole = 'teacher';
  showScreen('teacher-screen');
  setupTeacher();
};

document.querySelectorAll('#student-role-buttons .btn-role').forEach(btn=>{
  btn.onclick = async e=>{
    const color = e.target.dataset.color;
    const teamInfo = TEAM_COLORS[color];
    const ref = playersRef.child(color);
    const snap = await ref.once('value');
    if(snap.exists()){ alert("Đội đã có người chọn!"); return; }

    await ref.set({ team_name: teamInfo.name, color, state:'waiting', press_time:0 });
    studentTeam = color;
    userRole = 'student';
    showScreen('student-screen');
    setupStudent(teamInfo);
  };
});

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.style.display='none');
  document.getElementById(id).style.display='flex';
}

// ============================================================
//  Giáo viên
// ============================================================
function setupTeacher(){
  const startBtn = document.getElementById('start-button');
  const endBtn = document.getElementById('end-round-button');
  const resetBtn = document.getElementById('master-reset-button');
  const result = document.getElementById('result-display');
  const countdown = document.getElementById('countdown-display');
  const teamDiv = document.getElementById('teams-status');

  teacherStatusRef.set(true);
  teacherStatusRef.onDisconnect().set(false);

  startBtn.onclick = async ()=>{
    startBtn.disabled = true;
    result.textContent = "";
    await gameRef.set({status:'countdown', last_start_time:Date.now()});
    const snap = await playersRef.once('value');
    snap.forEach(ch => playersRef.child(ch.key).update({state:'waiting', press_time:0}));
    let count = 3;
    const timer = setInterval(()=>{
      if(count>0){
        gameRef.child('status').set(count);
        count--;
      } else {
        clearInterval(timer);
        gameRef.child('status').set('press_allowed');
        startBtn.style.display='none';
        endBtn.style.display='inline-block';
        startBtn.disabled = false;
      }
    }, 1000);
  };

  endBtn.onclick = async ()=>{
    await gameRef.set({status:'waiting'});
    startBtn.style.display='inline-block';
    endBtn.style.display='none';
    result.textContent = "CHỜ LỆNH";
  };

  resetBtn.onclick = async ()=>{
    if(!confirm("Reset toàn bộ?")) return;
    await playersRef.remove();
    await gameRef.set({status:'waiting'});
    teacherStatusRef.set(false);
    location.reload();
  };

  // hiển thị trạng thái đội
  playersRef.on('value', snap=>{
    const data = snap.val()||{};
    teamDiv.innerHTML='';
    const pressed = Object.values(data).filter(p=>p.state==='pressed').sort((a,b)=>a.press_time-b.press_time);
    if(pressed[0]) result.textContent = `🥇 ${pressed[0].team_name} đã bấm trước!`;
    Object.values(data).forEach(p=>{
      const box = document.createElement('div');
      box.className='team-box';
      box.style.backgroundColor = TEAM_COLORS[p.color].code;
      box.textContent = `${p.team_name} - ${p.state}`;
      if(pressed[0] && pressed[0].team_name===p.team_name) box.style.boxShadow='0 0 25px gold';
      teamDiv.appendChild(box);
    });
  });

  gameRef.child('status').on('value',snap=>{
    const s=snap.val();
    if(s==='press_allowed') countdown.textContent='BẤM!';
    else if(s==='waiting') countdown.textContent='CHỜ LỆNH';
    else countdown.textContent=s;
  });
}

// ============================================================
//  Học sinh
// ============================================================
function setupStudent(team){
  const buzzer=document.getElementById('buzzer-button');
  const freeze=document.getElementById('freeze-overlay');
  const status=document.getElementById('buzzer-status');
  buzzer.style.setProperty('--team-color', team.code);
  buzzer.style.setProperty('--team-color-transparent', team.code+'55');
  buzzer.style.backgroundColor = team.code;

  gameRef.child('status').on('value',async snap=>{
    const s=snap.val();
    if(s==='press_allowed'){
      sounds.bip.play();
      buzzer.disabled=false;
      buzzer.textContent='BẤM!';
      buzzer.classList.add('active','shake');
      setTimeout(()=>buzzer.classList.remove('shake'),500);
      buzzerAllowed=true;
    } else if(!isNaN(parseInt(s))){
      buzzer.textContent=s;
      buzzer.disabled=true;
    } else if(s==='waiting'){
      buzzer.textContent='CHỜ GIÁO VIÊN';
      buzzer.disabled=true;
      buzzer.classList.remove('active');
      if(isFrozen){
        freeze.classList.remove('active');
        sounds.ping.play();
        isFrozen=false;
      }
    }
  });

  buzzer.onclick=async ()=>{
    if(!buzzerAllowed) return;
    buzzer.classList.add('pulse-once');
    sounds.click.play();
    setTimeout(()=>buzzer.classList.remove('pulse-once'),800);
    const now=Date.now();
    await playersRef.child(studentTeam).update({state:'pressed',press_time:now});
    freeze.classList.add('active');
    isFrozen=true;
    buzzerAllowed=false;
    status.textContent='ĐÃ BẤM - CHỜ KẾT QUẢ';
  };
}
