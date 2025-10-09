// BUZZER NEON PRO - script.js (phiên bản A hoàn chỉnh - có hiển thị cảnh cáo & thẻ vàng cho giáo viên)
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
  red: { name: 'Đội Đỏ', code: '#ff6b6b', glow:'#ff6b6b' },
  blue: { name: 'Đội Xanh Dương', code: '#00d4ff', glow:'#00d4ff' },
  green: { name: 'Đội Xanh Lá', code: '#7ef0a6', glow:'#7ef0a6' },
  yellow: { name: 'Đội Vàng', code: '#ffd86b', glow:'#ffd86b' },
  purple: { name: 'Đội Tím', code: '#9b6bff', glow:'#9b6bff' }
};

// Âm thanh
const sounds = {
  bip: new Audio('neon_ping.mp3'),
  ping: new Audio('energy_pulse.mp3'),
  click: new Audio('electric_click.mp3'),
  lock: new Audio('neon_lock.mp3')
};

// Kích hoạt âm thanh lần đầu
document.body.addEventListener('click', function unlockAudio() {
  Object.values(sounds).forEach(a => { a.play().catch(()=>{}); a.pause(); a.currentTime = 0; });
  document.body.removeEventListener('click', unlockAudio);
}, { once: true });

let userRole = null;
let studentTeam = null;
let buzzerAllowed = false;
let isFrozen = false;
let localEarlyPressCount = 0;

// Tham chiếu UI
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

// Chọn vai trò
document.getElementById('btn-teacher').onclick = () => { userRole = 'teacher'; showScreen('teacher'); setupTeacher(); };
document.querySelectorAll('.btn-role-team').forEach(btn => {
  btn.onclick = async (e) => {
    const color = e.target.dataset.color;
    const team = TEAM_COLORS[color];
    if (!team) return;
    const snap = await playersRef.child(color).once('value');
    if (snap.exists()) { alert('Đội đã có người chọn'); return; }
    await playersRef.child(color).set({ team_name: team.name, color, state:'waiting', press_time:0, yellow_cards:0 });
    userRole = 'student'; studentTeam = color;
    showScreen('student'); setupStudent(team);
  };
});

function showScreen(mode){
  roleScreen.style.display = (mode==='teacher' || mode==='student') ? 'none' : 'flex';
  teacherScreen.style.display = (mode==='teacher') ? 'block' : 'none';
  studentScreen.style.display = (mode==='student') ? 'block' : 'none';
}

/* ================= GIÁO VIÊN ================= */
function setupTeacher(){
  teacherStatusRef.set(true);
  teacherStatusRef.onDisconnect().set(false);
  resultDisplay.textContent = '';
  countdownDisplay.textContent = 'CHỜ LỆNH';

  // Bắt đầu lượt chơi
  startButton.onclick = async () => {
    startButton.disabled = true;
    resultDisplay.textContent = '';
    // Reset tất cả học sinh về trạng thái "waiting"
    const snap = await playersRef.once('value');
    const updates = {};
    snap.forEach(ch => {
      updates[ch.key + '/state'] = 'waiting';
      updates[ch.key + '/press_time'] = 0;
    });
    await playersRef.update(updates);

    await gameRef.set({ status: 'countdown', last_start_time: Date.now() });
    const revealAfter = Math.floor(Math.random()*4)+1;
    let step = 4;
    let doneSteps = 0;

    (async function runCountdown(){
      while(step >= 1){
        await gameRef.child('status').set(step);
        const delay = 500 + Math.random()*1000;
        await new Promise(r=>setTimeout(r, delay));
        doneSteps++;
        if(doneSteps === revealAfter){
          const extra = 200 + Math.random()*1200;
          await new Promise(r=>setTimeout(r, extra));
          await gameRef.child('status').set('press_allowed');
          startButton.style.display='none';
          endRoundButton.style.display='inline-block';
          startButton.disabled = false;
          return;
        }
        step--;
      }
      await gameRef.child('status').set('press_allowed');
      startButton.style.display='none';
      endRoundButton.style.display='inline-block';
      startButton.disabled = false;
    })();
  };

  // Kết thúc lượt
  endRoundButton.onclick = async () => {
    await gameRef.set({ status: 'waiting' });
    startButton.style.display='inline-block';
    endRoundButton.style.display='none';
    resultDisplay.textContent = 'CHỜ LỆNH';
  };

  // Reset toàn bộ
  masterResetButton.onclick = async () => {
    if(!confirm('Reset toàn bộ dữ liệu?')) return;
    await playersRef.remove();
    await gameRef.set({ status:'waiting' });
    teacherStatusRef.set(false);
    location.reload();
  };

  /* --- HIỂN THỊ DANH SÁCH ĐỘI (ĐÃ CẬP NHẬT THẺ VÀNG & CẢNH CÁO THỜI GIAN THỰC) --- */
  function updateTeamsDisplay(snapshot) {
    const data = snapshot.val() || {};
    teamsStatus.innerHTML = '';

    const arr = Object.entries(data).map(([k,v])=> ({ key:k, ...v }));
    const pressed = arr
      .filter(p=>p.state==='pressed' && p.press_time>0)
      .sort((a,b)=>a.press_time-b.press_time);

    if(pressed[0]) resultDisplay.textContent = `🥇 ${pressed[0].team_name} đã bấm trước!`;
    else resultDisplay.textContent = 'Đang chờ bấm...';

    arr.forEach(p=>{
      const box = document.createElement('div');
      box.className='team-box';
      let stateLabel = p.state;
      if (p.state === 'warning') stateLabel = '⚠️ CẢNH CÁO';
      else if (p.state === 'eliminated') stateLabel = '❌ BỊ LOẠI';
      else if (p.state === 'pressed') stateLabel = '✅ ĐÃ BẤM';
      else if (p.state === 'waiting') stateLabel = '⏳ CHỜ';

      box.textContent = `${p.team_name}\n${stateLabel}${p.yellow_cards ? (' • Thẻ Vàng: '+p.yellow_cards) : ''}`;
      box.style.background = TEAM_COLORS[p.color]?.code || '#ddd';
      if(pressed[0] && pressed[0].team_name === p.team_name){
        box.style.boxShadow = '0 0 18px 6px gold';
      }
      teamsStatus.appendChild(box);
    });
  }

  // Cập nhật tức thời khi có thay đổi ở học sinh
  playersRef.on('value', updateTeamsDisplay);
  playersRef.on('child_changed', async () => {
    const snap = await playersRef.once('value');
    updateTeamsDisplay(snap);
  });

  // Trạng thái game
  gameRef.child('status').on('value', snap => {
    const s = snap.val();
    if(s === 'press_allowed') countdownDisplay.textContent = 'BẤM!';
    else if(s === 'waiting') countdownDisplay.textContent = 'CHỜ LỆNH';
    else if(!isNaN(parseInt(s))) countdownDisplay.textContent = s;
    else countdownDisplay.textContent = s;
  });
}

/* ================= HỌC SINH ================= */
function setupStudent(teamInfo){
  teamNameDisplay.textContent = teamInfo.name;
  buzzerButton.style.setProperty('--team-glow', teamInfo.glow);
  buzzerButton.style.background = teamInfo.code;

  localEarlyPressCount = 0;
  isFrozen = false;
  buzzerAllowed = false;
  buzzerButton.classList.add('disabled', 'no-pointer');
  buzzerButton.disabled = true;

  // Nếu giáo viên thoát
  teacherStatusRef.on('value', snap => {
    if(snap.val() === false && userRole === 'student'){
      alert('Giáo viên đã thoát. Quay về chọn vai trò.');
      playersRef.child(studentTeam).remove();
      location.reload();
    }
  });

  // Lắng nghe trạng thái game
  gameRef.child('status').on('value', async snap => {
    const s = snap.val();

    if(s === 'press_allowed'){
      sounds.bip.play().catch(()=>{});
      buzzerAllowed = true;
      buzzerButton.classList.remove('disabled','no-pointer');
      buzzerButton.disabled = false;
      buzzerButton.textContent = 'BẤM!';
      buzzerStatus.textContent = 'TRẠNG THÁI: SẴN SÀNG';
    } 
    else if(s === 'waiting'){
      buzzerAllowed = false;
      buzzerButton.classList.add('disabled','no-pointer');
      buzzerButton.disabled = true;
      buzzerButton.textContent = 'CHỜ GIÁO VIÊN';
      buzzerStatus.textContent = 'TRẠNG THÁI: CHỜ';
      freezeOverlay.classList.remove('active');
      isFrozen = false;
      localEarlyPressCount = 0;
      await playersRef.child(studentTeam).update({ state:'waiting' });
    }
    else if(!isNaN(parseInt(s))){ 
      buzzerAllowed = false;
      buzzerButton.classList.add('disabled');
      buzzerButton.classList.remove('no-pointer');
      buzzerButton.disabled = false;
      buzzerButton.textContent = s;
      buzzerStatus.textContent = 'ĐANG ĐẾM NGƯỢC';
    }
  });

  // Xử lý bấm nút
  buzzerButton.onclick = async () => {
    if(isFrozen) return;
    const statusSnapshot = await gameRef.child('status').once('value');
    const status = statusSnapshot.val();
    const now = Date.now();

    if(status === 'press_allowed'){
      sounds.click.play().catch(()=>{});
      await playersRef.child(studentTeam).update({ state:'pressed', press_time: now });
      freezeOverlay.classList.add('active');
      buzzerStatus.textContent = 'ĐÃ BẤM - CHỜ KẾT QUẢ';
      isFrozen = true;
      buzzerButton.classList.add('disabled','no-pointer');
      buzzerButton.disabled = true;
    } else {
      localEarlyPressCount++;
      if(localEarlyPressCount === 1){
        buzzerStatus.textContent = '⚠️ CẢNH CÁO - THẺ VÀNG (1)';
        await playersRef.child(studentTeam).update({
          state: 'warning',
          yellow_cards: firebase.database.ServerValue.increment(1),
          early_press_time: now
        });
        buzzerButton.classList.add('shake');
        setTimeout(()=>buzzerButton.classList.remove('shake'),400);
      } else if(localEarlyPressCount >= 2){
        await playersRef.child(studentTeam).update({
          state: 'eliminated',
          early_press_time: now
        });
        freezeOverlay.textContent = 'BỊ LOẠI! (2 lần phạm quy)';
        freezeOverlay.classList.add('active');
        sounds.lock.play().catch(()=>{});
        isFrozen = true;
        buzzerStatus.textContent = 'TRẠNG THÁI: BỊ LOẠI';
        buzzerButton.classList.add('disabled','no-pointer');
        buzzerButton.disabled = true;
      }
    }
  };
}
