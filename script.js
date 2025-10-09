// BUZZER NEON PRO - script.js
// Giữ nguyên firebase config của bạn
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

// Audio files (đặt cùng thư mục)
const sounds = {
  bip: new Audio('neon_ping.mp3'),        // khi BẤM! xuất hiện
  ping: new Audio('energy_pulse.mp3'),   // khi mở lượt mới
  click: new Audio('electric_click.mp3'),// khi HS bấm
  lock: new Audio('neon_lock.mp3')       // khi bị loại (nếu muốn)
};

// unlock audio context on first user interaction
document.body.addEventListener('click', function unlockAudio() {
  Object.values(sounds).forEach(a => { a.play().catch(()=>{}); a.pause(); a.currentTime = 0; });
  document.body.removeEventListener('click', unlockAudio);
}, { once: true });

let userRole = null;
let studentTeam = null;
let buzzerAllowed = false;
let isFrozen = false;
let localEarlyPressCount = 0; // đếm số lần bấm sớm trong cùng một lượt (local per client)

// UI refs
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

// role buttons
document.getElementById('btn-teacher').onclick = () => { userRole = 'teacher'; showScreen('teacher'); setupTeacher(); };
document.querySelectorAll('.btn-role-team').forEach(btn => {
  btn.onclick = async (e) => {
    const color = e.target.dataset.color;
    const team = TEAM_COLORS[color];
    if (!team) return;
    // reserve team in firebase (if exists block)
    const snap = await playersRef.child(color).once('value');
    if (snap.exists()) { alert('Đội đã có người chọn'); return; }
    await playersRef.child(color).set({ team_name: team.name, color, state:'waiting', press_time:0, yellow_cards:0 });
    userRole = 'student'; studentTeam = color;
    showScreen('student'); setupStudent(team);
  };
});

function showScreen(mode){
  roleScreen.style.display = (mode==='teacher' || mode==='student') ? 'none' : 'flex';
  if(mode === 'teacher') { teacherScreen.style.display='block'; studentScreen.style.display='none'; }
  else if(mode === 'student') { teacherScreen.style.display='none'; studentScreen.style.display='block'; }
  else { teacherScreen.style.display='none'; studentScreen.style.display='none'; roleScreen.style.display='flex'; }
}

/* ---------------- Teacher logic ---------------- */
function setupTeacher(){
  // mark teacher online
  teacherStatusRef.set(true);
  teacherStatusRef.onDisconnect().set(false);

  // reset UI
  resultDisplay.textContent = '';
  countdownDisplay.textContent = 'CHỜ LỆNH';

  // start button logic: random countdown 4->1 with each number duration random 0.5-1.5s
  startButton.onclick = async () => {
    startButton.disabled = true;
    resultDisplay.textContent = '';
    // reset all players (hồi sinh: mỗi lượt đều hồi sinh theo yêu cầu A)
    const snap = await playersRef.once('value');
    const updates = {};
    snap.forEach(ch => {
      updates[ch.key + '/state'] = 'waiting';
      updates[ch.key + '/press_time'] = 0;
    });
    await playersRef.update(updates);
    // set game status to 'countdown'
    await gameRef.set({ status: 'countdown', last_start_time: Date.now() });
    // choose revealAfter: 1..4 meaning after that many numbers show "press_allowed"
    const revealAfter = Math.floor(Math.random()*4)+1;
    let step = 4;
    let doneSteps = 0;
    (async function runCountdown(){
      while(step >= 1){
        // show current number
        await gameRef.child('status').set(step);
        // wait random 0.5-1.5s
        const delay = 500 + Math.random()*1000;
        await new Promise(r=>setTimeout(r, delay));
        doneSteps++;
        // if we reach revealAfter -> show press_allowed
        if(doneSteps === revealAfter){
          // small extra random delay to make feel unpredictable
          const extra = 200 + Math.random()*1200;
          await new Promise(r=>setTimeout(r, extra));
          await gameRef.child('status').set('press_allowed');
          // play sound for teacher side as well (optional)
          startButton.style.display='none';
          endRoundButton.style.display='inline-block';
          startButton.disabled = false;
          return;
        }
        step--;
      }
      // if loop completes without reveal (fallback) -> set press_allowed
      await gameRef.child('status').set('press_allowed');
      startButton.style.display='none';
      endRoundButton.style.display='inline-block';
      startButton.disabled = false;
    })();
  };

  // end round
  endRoundButton.onclick = async () => {
    await gameRef.set({ status: 'waiting' });
    startButton.style.display='inline-block';
    endRoundButton.style.display='none';
    resultDisplay.textContent = 'CHỜ LỆNH';
  };

  // master reset
  masterResetButton.onclick = async () => {
    if(!confirm('Reset toàn bộ dữ liệu?')) return;
    await playersRef.remove();
    await gameRef.set({ status:'waiting' });
    teacherStatusRef.set(false);
    location.reload();
  };

  // listen players and show status
  playersRef.on('value', snap => {
    const data = snap.val() || {};
    teamsStatus.innerHTML = '';
    // find pressed earliest
    const arr = Object.entries(data).map(([k,v])=> ({ key:k, ...v }));
    const pressed = arr.filter(p=>p.state==='pressed' && p.press_time>0).sort((a,b)=>a.press_time-b.press_time);
    if(pressed[0]) resultDisplay.textContent = `🥇 ${pressed[0].team_name} đã bấm trước!`;
    else resultDisplay.textContent = 'Đang chờ bấm...';

    // display each team
    arr.forEach(p=>{
      const box = document.createElement('div');
      box.className='team-box';
      box.style.background = TEAM_COLORS[p.color]?.code || '#ddd';

      let statusText = '';
      if(p.state === 'pressed') {
        statusText = '🥇 ĐÃ BẤM!';
        box.style.boxShadow = '0 0 18px 6px gold';
      } else if(p.state === 'eliminated') {
        statusText = '❌ BỊ LOẠI!';
        box.style.background = '#333'; // Nền xám khi bị loại
        box.style.color = '#ff6b6b';
      } else {
        statusText = 'CHỜ';
      }

      // HIỂN THỊ THẺ VÀNG
      const yellowCardText = p.yellow_cards > 0 ? ` • 🟡 x${p.yellow_cards}` : '';
      
      box.textContent = `${p.team_name}\n${statusText}${yellowCardText}`;

      // Highlight the pressed team (if any)
      if(pressed[0] && pressed[0].team_name === p.team_name){
        box.style.boxShadow = '0 0 18px 6px gold';
      }
      teamsStatus.appendChild(box);
    });
  });

  // listen game status
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

  // reset local counters for new round
  localEarlyPressCount = 0;
  isFrozen = false;
  buzzerAllowed = false;

  // Listen teacher online status - if teacher disconnects, go back
  teacherStatusRef.on('value', snap => {
    if(snap.val() === false && userRole === 'student'){
      alert('Giáo viên đã thoát. Quay về chọn vai trò.');
      playersRef.child(studentTeam).remove();
      location.reload();
    }
  });

  // Listen game status
  gameRef.child('status').on('value', async snap => {
    const s = snap.val();
    if(s === 'press_allowed'){
      // Allowed to press
      sounds.bip.play().catch(()=>{});
      buzzerAllowed = true;
      buzzerButton.classList.remove('disabled');
      buzzerButton.classList.add('glow','shake');
      buzzerButton.textContent = 'BẤM!';
      buzzerStatus.textContent = 'TRẠNG THÁI: SẴN SÀNG';
      setTimeout(()=>buzzerButton.classList.remove('shake'),450);
    } else if(s === 'waiting'){
      // new round or waiting
      buzzerAllowed = false;
      buzzerButton.classList.remove('glow');
      buzzerButton.textContent = 'CHỜ GIÁO VIÊN';
      buzzerButton.classList.add('disabled');
      buzzerButton.setAttribute('aria-disabled','true');
      buzzerStatus.textContent = 'TRẠNG THÁI: CHỜ';
      if(isFrozen){
        // unfreeze when waiting (GV bắt đầu lượt mới will set waiting then they press start)
        freezeOverlay.classList.remove('active');
        sounds.ping.play().catch(()=>{});
        isFrozen = false;
      }
      // reset local early press counter for new round
      localEarlyPressCount = 0;
      // ensure state reset if had been eliminated previous round (teacher start also resets)
      await playersRef.child(studentTeam).child('state').once('value').then(snap => {
        const st = snap.val();
        if(st === 'eliminated'){
          playersRef.child(studentTeam).update({ state:'waiting' });
        }
      });
    } else if(s === 'countdown' || (!isNaN(parseInt(s)) && s !== 'waiting')){
      // during countdown numbers - treat these as "not yet press_allowed"
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

  // Click handler for buzzer
  buzzerButton.onclick = async (e) => {
    // if currently not allowed but not frozen => early press
    const statusSnapshot = await gameRef.child('status').once('value');
    const status = statusSnapshot.val();

    // If already frozen for this client, ignore clicks
    if(isFrozen) return;

    if(status === 'press_allowed'){
      // valid press
      sounds.click.play().catch(()=>{});
      buzzerButton.classList.add('pulse-once');
      setTimeout(()=>buzzerButton.classList.remove('pulse-once'),900);
      const now = Date.now();
      await playersRef.child(studentTeam).update({ state:'pressed', press_time: now });
      freezeOverlay.classList.add('active');
      isFrozen = true;
      buzzerAllowed = false;
      buzzerStatus.textContent = 'ĐÃ BẤM - CHỜ KẾT QUẢ';
      // optionally auto reset game status after 5s by one client (teacher can also end)
      setTimeout(async () => {
        const current = (await gameRef.child('status').once('value')).val();
        if(current === 'press_allowed') {
          await gameRef.child('status').set('waiting');
        }
      }, 5000);
    } 
    
    // --- BẮT ĐẦU PHẦN CHỈ ÁP DỤNG TRONG THỜI GIAN ĐẾM NGƯỢC ---
    else if (status === 'countdown' || (!isNaN(parseInt(status)) && status !== 'waiting')) {
      // Early press (during countdown numbers or 'countdown' phase) -> penalty logic
      localEarlyPressCount++;
      
      if(localEarlyPressCount === 1){
        // Lần 1: Cảnh cáo Thẻ Vàng
        buzzerStatus.textContent = '⚠️ CẢNH CÁO - THẺ VÀNG (1)';
        freezeOverlay.textContent = '⚠️ CẢNH CÁO - THẺ VÀNG (1)'; // Hiển thị cảnh báo trên overlay
        freezeOverlay.classList.add('active'); 
        await playersRef.child(studentTeam).child('yellow_cards').transaction(v => (v || 0) + 1);
        
        // Khóa nút bấm TẠM THỜI (3 giây) để ngăn spam tiếp ngay lập tức
        buzzerButton.classList.add('shake');
        setTimeout(()=>buzzerButton.classList.remove('shake'),400);

        isFrozen = true;
        setTimeout(() => {
          // Mở khóa sau 3 giây, cho phép bấm lại
          isFrozen = false;
          freezeOverlay.classList.remove('active');
          buzzerStatus.textContent = 'TRẠNG THÁI: ĐANG ĐẾM (CÓ THẺ VÀNG)';
        }, 3000); // 3-second temporary lock
        
      } else if(localEarlyPressCount >= 2){
        // Lần 2 trở lên: Bị Loại và Khóa Vĩnh viễn cho lượt này
        await playersRef.child(studentTeam).update({ state:'eliminated' });
        
        freezeOverlay.textContent = '❌ BỊ LOẠI! (2 lần phạm quy)';
        freezeOverlay.classList.add('active'); // Kích hoạt overlay Bị Loại
        sounds.lock.play().catch(()=>{});
        
        // KHÓA VĨNH VIỄN cho lượt chơi này
        isFrozen = true; 
        buzzerStatus.textContent = 'TRẠNG THÁI: BỊ LOẠI';
        buzzerButton.classList.add('disabled');
      }
    }
    // --- KẾT THÚC PHẦN CHỈ ÁP DỤNG TRONG THỜI GIAN ĐẾM NGƯỢC ---
  };
}
