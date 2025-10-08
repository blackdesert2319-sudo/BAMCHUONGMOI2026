// =================================================================
// 1. CẤU HÌNH & KHỞI TẠO FIREBASE
// =================================================================

// DÁN MÃ CẤU HÌNH CỦA BẠN VÀO ĐÂY
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

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const gameRef = db.ref('game_session');
const playersRef = db.ref('players');
const teacherStatusRef = db.ref('teacher_status/online'); 

// =================================================================
// 2. KHAI BÁO BIẾN & CẤU HÌNH CỤC BỘ
// =================================================================

const TEAM_COLORS = {
    red: { name: 'Đội Đỏ', code: '#E74C3C' },
    blue: { name: 'Đội Xanh Dương', code: '#3498DB' },
    green: { name: 'Đội Xanh Lá', code: '#2ECC71' },
    yellow: { name: 'Đội Vàng', code: '#F1C40F' },
    purple: { name: 'Đội Tím', code: '#9B59B6' }
};

let userRole = null; 
let studentTeam = null; 
let buzzerAllowed = false; 

let pressCountBeforeBuzzer = 0; 
let isFrozen = false; 

const audioBip = new Audio('bip.mp3'); 
const audioPing = new Audio('ping.mp3'); 


// Hàm cố gắng mở khóa audio VÀ rung bằng cách phát một âm thanh
async function unlockAudio() {
    try {
        audioBip.volume = 1.0; 
        audioPing.volume = 1.0; 
        
        // Cố gắng phát âm thanh để mở khóa AudioContext
        await audioBip.play();
        audioBip.pause(); 
        audioBip.currentTime = 0;
        
        // Kích hoạt rung (thử nghiệm)
        navigator.vibrate(50); 

        console.log("Audio and Vibration unlocked successfully!");
        return true;
    } catch (e) {
        console.warn("Audio unlock failed, waiting for user interaction.");
        return false;
    }
}


// =================================================================
// 3. LOGIC CHỌN VAI TRÒ & GÁN ĐỘI
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('role-selection-screen').style.display = 'block';

    // Xử lý chọn Giáo viên
    document.getElementById('btn-teacher').onclick = () => {
        userRole = 'teacher';
        showScreen('teacher-screen');
        setupTeacherLogic();
    };

    // Xử lý chọn Học sinh
    document.querySelectorAll('#student-role-buttons .btn-role').forEach(button => {
        button.onclick = async (e) => {
            const color = e.target.dataset.color;
            const teamInfo = TEAM_COLORS[color];
            const playerPath = `players/${color}`;

            const snapshot = await db.ref(playerPath).once('value');
            if (snapshot.exists()) {
                alert(`Đội ${teamInfo.name} đã có người chọn. Vui lòng chọn đội khác!`);
                return;
            }

            await db.ref(playerPath).set({
                team_name: teamInfo.name,
                color: color,
                state: 'waiting',
                press_time: 0,
                press_count: 0, 
                yellow_cards: 0 
            });

            studentTeam = color;
            userRole = 'student';
            showScreen('student-screen');
            
            // KHÔNG GỌI unlockAudio() ở đây nữa, mà chờ nút bấm trên màn hình HS
            
            setupStudentLogic(teamInfo);
        };
    });
    
    // Đồng bộ trạng thái các nút
    playersRef.on('value', (snapshot) => {
        const selectedTeams = snapshot.val() || {};
        document.querySelectorAll('#student-role-buttons .btn-role').forEach(button => {
            const color = button.dataset.color;
            if (selectedTeams[color] && selectedTeams[color].state !== 'waiting' && !studentTeam) { 
                button.disabled = true;
                button.textContent = TEAM_COLORS[color].name + ' (ĐÃ CHỌN)';
            } else if (studentTeam && button.dataset.color === studentTeam) {
                 button.disabled = true; 
            } else {
                button.disabled = false;
                button.textContent = TEAM_COLORS[color].name;
            }
        });
    });
});

function showScreen(screenId) {
    document.getElementById('role-selection-screen').style.display = 'none';
    document.getElementById('teacher-screen').style.display = 'none';
    document.getElementById('student-screen').style.display = 'none';
    document.getElementById(screenId).style.display = 'flex';
}

// Hàm thoát chung cho học sinh
function exitStudentRole() {
    // Xóa dữ liệu của đội này (tùy chọn)
    if (studentTeam) {
        playersRef.child(studentTeam).remove();
    }
    // Chuyển về màn hình chọn vai trò
    showScreen('role-selection-screen');
    studentTeam = null;
    userRole = null;
    isFrozen = false;
    // Tải lại trang để reset listener
    window.location.reload(); 
}


// =================================================================
// 4. LOGIC MÁY GIÁO VIÊN 
// =================================================================

function setupTeacherLogic() {
    const startButton = document.getElementById('start-button');
    const endRoundButton = document.getElementById('end-round-button'); // Nút KẾT THÚC LƯỢT
    const masterResetButton = document.getElementById('master-reset-button'); // Nút RESET TỔNG
    const countdownDisplay = document.getElementById('countdown-display');
    const resultDisplay = document.getElementById('result-display');
    
    // Báo hiệu GV online và đăng ký onDisconnect
    teacherStatusRef.set(true);
    teacherStatusRef.onDisconnect().set(false); 
    
    // Theo dõi trạng thái các đội (Hiển thị & Xác định người chiến thắng)
    playersRef.on('value', (snapshot) => {
        const teamsData = snapshot.val() || {};
        const teamsStatusDiv = document.getElementById('teams-status');
        teamsStatusDiv.innerHTML = '';
        
        let allPlayers = Object.values(teamsData);
        
        // 1. Sắp xếp và tìm người bấm hợp lệ đầu tiên
        let pressedPlayers = allPlayers
            .filter(p => p.state === 'pressed' && p.press_time > 0)
            .sort((a, b) => a.press_time - b.press_time);

        // 2. Cập nhật màn hình kết quả
        if (pressedPlayers.length > 0) {
            const winner = pressedPlayers[0];
            resultDisplay.innerHTML = `🥇 **${winner.team_name}** ĐÃ BẤM TRƯỚC!`;
            
            // Khi có người bấm, hiện nút KẾT THÚC LƯỢT và ẩn nút BẮT ĐẦU
            startButton.style.display = 'none';
            endRoundButton.style.display = 'block';
        } else {
            resultDisplay.textContent = 'Đang chờ bấm...';
            // Logic ẩn/hiện nút START/END ROUND
            gameRef.child('status').once('value').then(snap => {
                const status = snap.val();
                if (status === 'press_allowed') {
                    startButton.style.display = 'none';
                    endRoundButton.style.display = 'block';
                } else if (status === 'waiting') {
                    startButton.style.display = 'block';
                    endRoundButton.style.display = 'none';
                }
            });
        }

        // 3. Hiển thị trạng thái các đội 
        const teamsToDisplay = [...pressedPlayers, ...allPlayers.filter(p => p.state !== 'pressed')];

        teamsToDisplay.forEach(player => {
            if (!player || !player.color) return;
            const teamBox = document.createElement('div');
            teamBox.className = 'team-box';
            
            if (player.state === 'pressed' && player.team_name === pressedPlayers[0]?.team_name) {
                teamBox.style.backgroundColor = 'gold'; 
                teamBox.style.color = '#333';
            } else {
                teamBox.style.backgroundColor = TEAM_COLORS[player.color].code;
            }
            
            let statusText = '';
            if (player.state === 'waiting') statusText = 'CHỜ';
            else if (player.state === 'pressed') statusText = 'ĐÃ BẤM';
            else if (player.state === 'eliminated') statusText = 'BỊ LOẠI';
            
            let cardText = player.yellow_cards > 0 ? ` (Thẻ Vàng: ${player.yellow_cards})` : '';

            teamBox.innerHTML = `
                <div class="team-name">${player.team_name}</div>
                <div class="team-state">${statusText}${cardText}</div>
            `;
            teamsStatusDiv.appendChild(teamBox);
        });
    });
    
    // Theo dõi trạng thái đếm ngược từ Firebase
    gameRef.child('status').on('value', (snapshot) => {
        const status = snapshot.val();
        if (status === 'press_allowed') {
            countdownDisplay.innerHTML = '<span style="color: red; animation: pulse 0.5s infinite;">BẤM!</span>';
        } else if (status === 'waiting') {
            countdownDisplay.textContent = 'CHỜ LỆNH';
        } else if (status) {
            countdownDisplay.textContent = status; 
        }
    });

    // Xử lý nút KẾT THÚC LƯỢT (Đưa game về trạng thái chờ, giữ nguyên dữ liệu người chơi)
    endRoundButton.onclick = async () => {
        await gameRef.set({ status: 'waiting', last_start_time: 0 });
        resultDisplay.textContent = 'CHỜ LỆNH';
        startButton.style.display = 'block';
        endRoundButton.style.display = 'none';
    };

    // Xử lý nút RESET TỔNG (KẾT THÚC CUỘC THI)
    masterResetButton.onclick = async () => {
        if (!confirm('BẠN CÓ CHẮC CHẮN MUỐN RESET TỔNG? Điều này sẽ xóa TẤT CẢ dữ liệu người chơi và thẻ phạt.')) {
            return;
        }

        // Xóa tất cả dữ liệu người chơi
        await playersRef.remove(); 
        // Xóa trạng thái game
        await gameRef.set({ status: 'waiting', last_start_time: 0 });
        // Tắt cờ online của Giáo viên
        await teacherStatusRef.set(false);
        
        // Tải lại trang để reset giao diện
        window.location.reload();
    };

    // Xử lý BẮT ĐẦU lượt chơi 
    startButton.onclick = () => { 
        gameRef.set({ status: 'countdown', last_start_time: Date.now() })
        
        .then(() => { 
            // Reset trạng thái chơi của tất cả các đội về 'waiting'
            return playersRef.once('value');
        })
        .then(snapshot => {
            const updates = {};
            snapshot.forEach(child => {
                updates[child.key + '/state'] = 'waiting';
                updates[child.key + '/press_time'] = 0;
            });
            return playersRef.update(updates);
        })
        
        .then(() => { 
            startButton.disabled = true;
            let countdown = 4;
            let timer;
            
            const runCountdown = () => {
                if (countdown >= 0) {
                    const displayNum = countdown === 0 ? '1' : countdown.toString();
                    gameRef.child('status').set(displayNum);
                    countdown--;
                    
                    const delay = Math.random() * (1500 - 500) + 500;
                    
                    if (Math.random() < 0.3 || countdown === -1) { 
                        clearTimeout(timer);
                        setTimeout(() => {
                            gameRef.child('status').set('press_allowed');
                            startButton.style.display = 'none'; 
                            endRoundButton.style.display = 'block';
                            startButton.disabled = false;
                        }, delay);
                        return;
                    }
                    
                    timer = setTimeout(runCountdown, 1500);
                }
            };
            
            timer = setTimeout(runCountdown, 1500); 
        })
        .catch(error => {
            console.error("Lỗi khi bắt đầu lượt chơi:", error);
            alert("Lỗi kết nối Firebase, kiểm tra Console!");
            startButton.disabled = false;
        });
    };
}


// =================================================================
// 5. LOGIC MÁY HỌC SINH 
// =================================================================

function setupStudentLogic(teamInfo) {
    const buzzerButton = document.getElementById('buzzer-button');
    const teamNameDisplay = document.getElementById('team-name-display');
    const buzzerStatus = document.getElementById('buzzer-status');
    const freezeOverlay = document.getElementById('freeze-overlay');
    const audioUnlockOverlay = document.getElementById('audio-unlock-overlay'); // NEW
    const unlockAudioButton = document.getElementById('unlock-audio-button');     // NEW
    const playerPath = `players/${studentTeam}`;

    teamNameDisplay.textContent = teamInfo.name;
    buzzerButton.style.backgroundColor = teamInfo.code;
    
    // HIỂN THỊ LỚP PHỦ MỞ KHÓA NGAY KHI VÀO MÀN HÌNH HS
    audioUnlockOverlay.style.display = 'flex'; 

    // XỬ LÝ NÚT MỞ KHÓA AUDIO
    unlockAudioButton.onclick = async () => {
        await unlockAudio();
        audioUnlockOverlay.style.display = 'none'; // Ẩn lớp phủ sau khi mở khóa
    };

    // Theo dõi trạng thái GV và buộc thoát
    teacherStatusRef.on('value', (snapshot) => {
        if (snapshot.val() === false && userRole === 'student') {
            alert('Giáo viên đã thoát khỏi phiên. Bạn sẽ được đưa về màn hình chọn vai trò.');
            // Dừng theo dõi trạng thái player trước khi thoát
            playersRef.child(studentTeam).off(); 
            exitStudentRole();
        }
    });

    gameRef.child('status').on('value', async (snapshot) => {
        const status = snapshot.val();
        
        // --- 1. TRẠNG THÁI: BẤM! (KHI NÚT BẤM XUẤT HIỆN) ---
        if (status === 'press_allowed') {
            // GỌI RUNG VÀ ÂM THANH KHI NÚT BẤM XUẤT HIỆN
            audioBip.play(); 
            navigator.vibrate(100); 
            
            document.body.classList.add('flashing-bg');
            setTimeout(() => document.body.classList.remove('flashing-bg'), 500);

            let currentState = (await db.ref(playerPath + '/state').once('value')).val();
            if (currentState !== 'eliminated' && !isFrozen) { 
                buzzerAllowed = true;
                buzzerButton.disabled = false;
                buzzerButton.textContent = 'BẤM!';
                pressCountBeforeBuzzer = 0; 
            }
        
        // --- 2. TRẠNG THÁI: ĐANG ĐẾM NGƯỢC
        } else if (!isNaN(parseInt(status)) && status !== 'waiting') {
            buzzerButton.textContent = status;
            buzzerButton.disabled = false; 
            buzzerStatus.textContent = 'TRẠNG THÁI: ĐANG ĐẾM';
            buzzerAllowed = false;
            
        // --- 3. TRẠNG THÁI: CHỜ (Sau khi bấm hoặc GV reset lượt)
        } else if (status === 'waiting') {
            // Mở băng khi lượt mới bắt đầu (Hồi sinh)
            if (isFrozen) {
                // GỌI RUNG VÀ ÂM THANH KHI ĐƯỢC HỒI SINH/KẾT THÚC LƯỢT
                audioPing.play();
                navigator.vibrate([50, 50, 50]); 
                freezeOverlay.classList.remove('active'); 
                
                buzzerButton.style.backgroundColor = teamInfo.code;
                buzzerButton.style.color = 'white';
                buzzerStatus.textContent = 'TRẠNG THÁI: CHỜ';
            }
            isFrozen = false;
            buzzerAllowed = false;
            buzzerButton.disabled = true;
            buzzerButton.textContent = 'CHỜ GIÁO VIÊN';
        }
    });

    // Xử lý Bấm Chuông
    buzzerButton.onclick = async () => {
        const currentTime = Date.now();
        
        if (buzzerAllowed && !isFrozen) {
            // LUẬT 1: Bấm Hợp Lệ
            isFrozen = true;
            buzzerAllowed = false;
            
            await db.ref(playerPath).update({
                state: 'pressed',
                press_time: currentTime 
            });
            
            // Học sinh tự động reset game_session/status sau 5 giây (đúng theo yêu cầu bạn muốn)
            setTimeout(async () => {
                const status = (await gameRef.child('status').once('value')).val();
                if (status === 'press_allowed') {
                    await gameRef.child('status').set('waiting');
                }
            }, 5000);

            buzzerButton.disabled = true;
            freezeOverlay.classList.add('active'); 
            freezeOverlay.textContent = 'ĐÃ BẤM - CHỜ KẾT QUẢ';
            buzzerStatus.textContent = 'ĐÃ BẤM - CHỜ KẾT QUẢ';
            
        } else if (!buzzerAllowed && !isFrozen) {
            // LUẬT 2: Kiểm soát hành vi spam 
            
            let gameStatus = (await gameRef.child('status').once('value')).val();

            if (!isNaN(parseInt(gameStatus))) { 
                
                pressCountBeforeBuzzer++;
                
                if (pressCountBeforeBuzzer === 1) {
                    buzzerStatus.textContent = 'CẢNH CÁO THẺ VÀNG! (1 lần phạm quy)';
                    db.ref(playerPath + '/yellow_cards').transaction((current) => (current || 0) + 1);
                    
                } else if (pressCountBeforeBuzzer >= 2) {
                    isFrozen = true;
                    buzzerButton.disabled = true;
                    freezeOverlay.classList.add('active');
                    freezeOverlay.textContent = 'BỊ LOẠI! (2 lần phạm quy liên tiếp)';
                    buzzerStatus.textContent = 'TRẠNG THÁI: BỊ LOẠI';
                    await db.ref(playerPath).update({ state: 'eliminated' });
                }
            } 
        }
    };
}
