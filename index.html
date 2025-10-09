<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="format-detection" content="telephone=no" />
  <title>Buzzer Neon Pro</title>

  <script src="https://www.gstatic.com/firebasejs/7.19.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/7.19.1/firebase-database.js"></script>

  <style>
    :root{
      --bg1: #121216;
      --bg2: #181824;
      --accent1: #00d4ff;
      --accent2: #9b6bff;
      --glass: rgba(255,255,255,0.04);
    }
    html,body{
      height:100%; margin:0; padding:0;
      font-family: Inter, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(180deg,var(--bg2),var(--bg1));
      overflow:hidden; touch-action:none;
      -webkit-font-smoothing:antialiased;
    }

    .neon-bg {
      position:fixed; inset:0; z-index:0;
      filter: blur(60px); opacity:0.45;
      background:
        radial-gradient(30% 30% at 20% 30%, rgba(0,212,255,0.14), transparent 12%),
        radial-gradient(25% 25% at 80% 70%, rgba(155,107,255,0.12), transparent 15%),
        radial-gradient(20% 20% at 50% 20%, rgba(0,212,255,0.08), transparent 12%);
      animation: bgFloat 18s linear infinite;
    }
    @keyframes bgFloat {
      0% { transform: translate(0,0) scale(1); }
      50% { transform: translate(-4%, 3%) scale(1.03); }
      100% { transform: translate(0,0) scale(1); }
    }

    .app {
      position:relative; z-index:2;
      width:100%; height:100%;
      display:flex; align-items:center; justify-content:center;
      padding:20px; box-sizing:border-box;
    }

    .card {
      width:100%; max-width:780px;
      border-radius:16px; padding:18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      color:#e8eef6; display:flex; flex-direction:column; align-items:center;
    }

    h1 { margin:6px 0 0 0; font-size:1.2rem; color:#dff7ff;}
    .sub { color:#bcdff0; font-size:0.9rem; opacity:0.9; }

    .roles { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:6px; }
    .btn-role {
      padding:12px 18px; border-radius:10px; border:none; cursor:pointer;
      font-weight:600; font-size:0.95rem; transition:transform .18s, box-shadow .18s;
      box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    }
    .btn-role:active { transform: translateY(2px); }
    .btn-teal{ background:#00d4ff; color:#012; }

    .teacher-controls { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:8px; }
    .teacher-controls button {
      padding:10px 14px; border-radius:10px; border:none; cursor:pointer; font-weight:600;
      background:linear-gradient(180deg,#3b82f6,#2256d6); color:#fff;
      box-shadow:0 8px 24px rgba(35,82,150,0.28);
    }

    #countdown-display { font-size:2.2rem; font-weight:800; color:var(--accent1); text-shadow:0 6px 18px rgba(0,212,255,0.12); }
    #teams-status { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:12px; width:100%; }

    .team-box {
      min-width:110px; padding:10px; border-radius:10px; text-align:center; color:#041018;
      font-weight:700; box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      background:linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.75));
    }

    /* ==== Nút BẤM cải tiến ==== */
    #buzzer-button {
      width:78vw; max-width:360px; height:78vw; max-height:360px;
      border-radius:50%; border:6px solid rgba(255,255,255,0.06);
      display:flex; align-items:center; justify-content:center;
      font-weight:900; text-transform:uppercase;
      letter-spacing:1.5px;
      font-size:clamp(2rem,8vw,3rem);
      transition:all 0.3s ease;
      text-shadow:0 0 15px rgba(255,255,255,0.3);
    }
    #buzzer-button.disabled { opacity:0.5; pointer-events:none; }

    #buzzer-button.ready {
      background: radial-gradient(circle at center, #00e1ff 0%, #0099ff 60%, #007acc 100%);
      color:#fff;
      text-shadow:
        0 0 25px rgba(0,240,255,0.8),
        0 0 50px rgba(0,240,255,0.5),
        0 0 80px rgba(0,240,255,0.4);
      animation:pulseGlow 1.3s infinite alternate;
    }
    @keyframes pulseGlow {
      from{transform:scale(1);filter:brightness(1);}
      to{transform:scale(1.08);filter:brightness(1.4);}
    }

    #buzzer-button.countdown {
      background: radial-gradient(circle at center, #ffd86b 0%, #ffb84d 60%, #ff9a00 100%);
      color:#222;
      text-shadow:0 0 10px rgba(255,255,255,0.6);
      font-size:clamp(1.8rem,7vw,2.6rem);
      animation:countdownBlink 0.8s infinite alternate;
    }
    @keyframes countdownBlink {
      from{opacity:1;transform:scale(1);}
      to{opacity:0.8;transform:scale(1.05);}
    }

    #buzzer-button.waiting {
      background: radial-gradient(circle at center, #444 0%, #333 70%);
      color:#ccc;
      font-size:clamp(1.6rem,6vw,2.3rem);
      text-shadow:0 0 8px rgba(255,255,255,0.1);
    }

    #freeze-overlay {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:linear-gradient(180deg, rgba(4,8,16,0.72), rgba(2,4,8,0.82));
      color:#e6fbff; font-weight:800; font-size:1.05rem; border-radius:12px;
      opacity:0; pointer-events:none; transition:opacity .25s;
      z-index:6;
    }
    #freeze-overlay.active { opacity:1; pointer-events:auto; }

  </style>
</head>
<body>
  <div class="neon-bg"></div>
  <div class="app">
    <div class="card">
      <h1>Buzzer Neon Pro</h1>
      <div class="sub">Chọn vai trò / Chọn đội — tối ưu cho mobile</div>

      <div id="role-selection">
        <div class="roles">
          <button id="btn-teacher" class="btn-role btn-teal">Giáo viên</button>
          <button class="btn-role btn-role-team" data-color="red" style="background:#ff6b6b;">Đội Đỏ</button>
          <button class="btn-role btn-role-team" data-color="blue" style="background:#00d4ff;">Đội Xanh</button>
          <button class="btn-role btn-role-team" data-color="green" style="background:#7ef0a6;">Đội Lá</button>
          <button class="btn-role btn-role-team" data-color="yellow" style="background:#ffd86b; color:#041018;">Đội Vàng</button>
          <button class="btn-role btn-role-team" data-color="purple" style="background:#9b6bff;">Đội Tím</button>
        </div>
      </div>

      <div id="teacher-screen" style="display:none;width:100%;margin-top:12px;">
        <div style="display:flex;flex-direction:column;align-items:center;width:100%;">
          <div id="result-display" style="min-height:28px;color:var(--accent2);font-weight:800;margin-bottom:6px;"></div>
          <div class="teacher-controls">
            <button id="start-button">Bắt đầu lượt</button>
            <button id="end-round-button" style="display:none;background:#00c2a8;">Kết thúc lượt</button>
            <button id="master-reset-button" style="background:#ff6b6b;">Reset tổng</button>
          </div>
          <div id="countdown-display" style="margin-top:8px;">CHỜ LỆNH</div>
          <div id="teams-status"></div>
        </div>
      </div>

      <div id="student-screen" style="display:none;width:100%;margin-top:12px;">
        <div class="student-area" style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;">
          <div id="team-name-display" style="font-size:1.1rem;font-weight:800;color:#dff7ff;">ĐỘI CỦA BẠN</div>
          <div style="position:relative;display:flex;justify-content:center;align-items:center;width:100%;">
            <div id="freeze-overlay">ĐÃ BẤM - CHỜ KẾT QUẢ</div>
            <button id="buzzer-button" class="waiting disabled">CHỜ GIÁO VIÊN</button>
          </div>
          <div id="buzzer-status" style="opacity:0.9;margin-top:6px;">TRẠNG THÁI: CHỜ</div>
        </div>
      </div>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>
