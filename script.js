// BUZZER NEON PRO - script.js
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

const sounds = {
  bip: new Audio('neon_ping.mp3'),
  ping: new Audio('energy_pulse.mp3'),
  click: new Audio('electric_click.mp3'),
  lock: new Audio('neon_lock.mp3')
};

document.body.addEventListener('click', function unlockAudio() {
  Object.values(sounds).forEach(a => { a.play().catch(()=>{}); a.pause(); a.currentTime = 0; });
  document.body.removeEventListener('click', unlockAudio);
}, { once: true });

let userRole = null, studentTeam = null, buzzerAllowed = false, isFrozen = false, localEarlyPressCount = 0;

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

/* ---------------- Teacher logic ---------------- */
function setupTeacher(){
  teacherStatusRef.set(true);
  teacherStatusRef.onDisconnect().set(false);
  resultDisplay.textContent = '';
  countdownDisplay.textContent = 'CHỜ LỆNH';

  startButton.onclick = async () => {
    startButton.disabled = true;
    resultDisplay.textContent = '';
    const snap = await playersRef.once('value');
    const updates = {};
    snap.forEach(ch => {
      updates[ch.key + '/state'] = 'waiting';
      updates[ch.key + '/press_time'] = 0;
    });
    await playersRef.update(updates);
    await gameRef.set({ status: 'countdown', last_start_time: Date.now() });
    const revealAfter = Math.floor(Math.random()*4)+1;
    let step = 4, doneSteps = 0;
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

  endRoundButton.onclick = async () => {
    await gameRef.set({ status: 'waiting' });
    startButton.style.display='inline-block';
    endRoundButton.style.display='none';
    resultDisplay.textContent = 'CHỜ LỆNH
    resultDisplay.textContent = 'CHỜ LỆNH';
  };

  masterResetButton.onclick = async () => {
    if(!confirm('Reset toàn bộ dữ liệu?')) return;
    await playersRef.remove();
    await gameRef.set({ status:'waiting' });
    teacherStatusRef.set(false);
    location.reload();
  };

  playersRef.on('value', snap => {
    const data = snap.val() || {};
    teamsStatus.innerHTML = '';
    const arr = Object.entries(data).map(([k,v])=> ({ key:k, ...v }));
    const pressed = arr.filter(p=>p.state==='pressed' && p.press_time>0).sort((a,b)=>a.press_time-b.press_time);
    if(pressed[0]) resultDisplay.textContent = `🥇 ${pressed[0].team_name} đã bấm trước!`;
    else resultDisplay.textContent = 'Đang chờ bấm...';

    arr.forEach(p=>{
      const box = document.createElement('div');
      box.className='team-box';
      box.textContent = `${p.team_name}\n${p.state}${p.yellow_cards? (' • Thẻ Vàng:'+p.yellow_cards): ''}`;
      box.style.background = TEAM_COLORS[p.color]?.code || '#ddd';
      if(pressed[0] && pressed[0].team_name === p.team_name){
        box.style.boxShadow = '0 0 18px 6px gold';
      }
      teamsStatus.appendChild(box);
    });
  });

  gameRef.child('status').on('value', snap => {
    const s = snap.val();
    if(s === 'press_allowed') countdownDisplay.textContent = 'BẤM!';
    else if(s === 'waiting') countdownDisplay.textContent = 'CHỜ LỆNH';
    else if(s === 'countdown') countdownDisplay.textContent = 'ĐANG ĐẾM';
    else countdownDisplay.textContent = s;
  });
}

/* ---------------- Student logic ---------------- */
function setupStudent(teamInfo){
  teamNameDisplay.textContent = teamInfo.name;
  buzzerButton.style.setProperty('--team-glow', teamInfo.glow);
  buzzerButton.style.background = teamInfo.code;
  buzzerButton.classList.add('disabled');
  buzzerButton.setAttribute('aria-disabled','true');

  localEarlyPressCount = 0;
  isFrozen = false;
  buzzerAllowed = false;

  teacherStatusRef.on('value', snap => {
    if(snap.val() === false && userRole === 'student'){
      alert('Giáo viên đã thoát. Quay về chọn vai trò.');
      playersRef.child(studentTeam).remove();
      location.reload();
    }
  });

  gameRef.child('status').on('value', async snap => {
    const s = snap.val();
    if(s === 'press_allowed'){
      // Khi giáo viên cho phép bấm
      sounds.bip.play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(80); // rung nhẹ thông báo
      buzzerButton.animate(
        [{ filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }],
        { duration: 700, iterations: 2 }
      );
      buzzerAllowed = true;
      buzzerButton.classList.remove('disabled');
      buzzerButton.classList.add('glow','shake');
      buzzerButton.textContent = 'BẤM!';
      buzzerStatus.textContent = 'TRẠNG THÁI: SẴN SÀNG';
      setTimeout(()=>buzzerButton.classList.remove('shake'),450);

    } else if(s === 'waiting'){
      buzzerAllowed = false;
      buzzerButton.classList.remove('glow');
      buzzerButton.textContent = 'CHỜ GIÁO VIÊN';
      buzzerButton.classList.add('disabled');
      buzzerButton.setAttribute('aria-disabled','true');
      buzzerStatus.textContent = 'TRẠNG THÁI: CHỜ';

      if(isFrozen){
        freezeOverlay.classList.remove('active');
        sounds.ping.play().catch(()=>{});
        isFrozen = false;
      }
      localEarlyPressCount = 0;
      await playersRef.child(studentTeam).child('state').once('value').then(snap => {
        const st = snap.val();
        if(st === 'eliminated'){
          playersRef.child(studentTeam).update({ state:'waiting' });
        }
      });

    } else if(s === 'countdown' || (!isNaN(parseInt(s)) && s !== 'waiting')){
      buzzerAllowed = false;
      buzzerButton.classList.remove('glow');
      buzzerButton.classList.add('disabled');
      buzzerButton.setAttribute('aria-disabled','true');
      if(!isNaN(parseInt(s))){
        buzzerButton.textContent = s;
        buzzerStatus.textContent = 'ĐANG ĐẾM NGƯỢC';
      } else {
        buzzerButton.textContent = 'CHỜ...';
        buzzerStatus.textContent = 'ĐANG CHUẨN BỊ';
      }
    }
  });

  // ✅ Khi học sinh BẤM nút
  buzzerButton.onclick = async (e) => {
    const statusSnapshot = await gameRef.child('status').once('value');
    const status = statusSnapshot.val();

    if(isFrozen) return;

    if(status === 'press_allowed'){
      // Hợp lệ
      sounds.click.play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // rung mạnh khi bấm
      buzzerButton.style.filter = 'brightness(1.5)';
      setTimeout(()=>buzzerButton.style.filter = 'brightness(1)',300);
      buzzerButton.classList.add('pulse-once');
      setTimeout(()=>buzzerButton.classList.remove('pulse-once'),900);

      const now = Date.now();
      await playersRef.child(studentTeam).update({ state:'pressed', press_time: now });
      freezeOverlay.classList.add('active');
      isFrozen = true;
      buzzerAllowed = false;
      buzzerStatus.textContent = 'ĐÃ BẤM - CHỜ KẾT QUẢ';

      // tự động reset nếu GV chưa nhấn
      setTimeout(async () => {
        const current = (await gameRef.child('status').once('value')).val();
        if(current === 'press_allowed') {
          await gameRef.child('status').set('waiting');
        }
      }, 5000);

    } else {
      // Bấm sớm -> phạt
      localEarlyPressCount++;
      if(localEarlyPressCount === 1){
        buzzerStatus.textContent = '⚠️ CẢNH CÁO - THẺ VÀNG (1)';
        await playersRef.child(studentTeam).child('yellow_cards').transaction(v => (v || 0) + 1);
        buzzerButton.classList.add('shake');
        setTimeout(()=>buzzerButton.classList.remove('shake'),400);
      } else if(localEarlyPressCount >= 2){
        await playersRef.child(studentTeam).update({ state:'eliminated' });
        freezeOverlay.textContent = 'BỊ LOẠI! (2 lần phạm quy)';
        freezeOverlay.classList.add('active');
        sounds.lock.play().catch(()=>{});
        isFrozen = true;
        buzzerStatus.textContent = 'TRẠNG THÁI: BỊ LOẠI';
        buzzerButton.classList.add('disabled');
      }
    }
  };
}
