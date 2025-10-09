const firebaseConfig={
  apiKey:"AIzaSyCDEa_NKenTTQqSj1CKYJP02Al1VQC29K",
  authDomain:"bamchuong26.firebaseapp.com",
  databaseURL:"https://bamchuong26-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"bamchuong26",
  storageBucket:"bamchuong26.appspot.com",
  messagingSenderId:"1836167181367",
  appId:"1:1836167181367:web:3882d805c836164908a4232"
};
firebase.initializeApp(firebaseConfig);
const db=firebase.database(),gameRef=db.ref("game_session"),playersRef=db.ref("players");

const TEAM_COLORS={blue:{name:"Đội Xanh Dương",code:"#00d4ff",glow:"#00d4ff"}};
const sounds={bip:new Audio("neon_ping.mp3"),ping:new Audio("energy_pulse.mp3"),click:new Audio("electric_click.mp3"),lock:new Audio("neon_lock.mp3")};

let role=null,team=null,isFrozen=false,localEarly=0;
const btnTeacher=document.getElementById("btn-teacher"),
      btnBlue=document.getElementById("btn-blue"),
      roleSel=document.getElementById("role-selection"),
      tea=document.getElementById("teacher-screen"),
      stu=document.getElementById("student-screen"),
      startBtn=document.getElementById("start-button"),
      endBtn=document.getElementById("end-round-button"),
      cd=document.getElementById("countdown-display"),
      buz=document.getElementById("buzzer-button"),
      freeze=document.getElementById("freeze-overlay"),
      statusTxt=document.getElementById("buzzer-status");

btnTeacher.onclick=()=>{role="teacher";roleSel.style.display="none";tea.style.display="block";};
btnBlue.onclick=async()=>{
  const color="blue";
  if((await playersRef.child(color).once("value")).exists()){alert("Đội đã có người");return;}
  await playersRef.child(color).set({team_name:"Đội Xanh Dương",color,state:"waiting",yellow_cards:0});
  role="student";team=color;roleSel.style.display="none";stu.style.display="block";
  buz.style.setProperty("--team-glow",TEAM_COLORS[color].glow);buz.style.background=TEAM_COLORS[color].code;
};

/* -------- Teacher -------- */
startBtn.onclick=async()=>{
  startBtn.disabled=true;endBtn.style.display="none";
  await gameRef.set({status:"countdown"});
  let step=4,reveal=Math.floor(Math.random()*4)+1,count=0;
  while(step>=1){
    await gameRef.child("status").set(step);
    await new Promise(r=>setTimeout(r,500+Math.random()*1000));
    count++;if(count===reveal){await gameRef.child("status").set("press_allowed");break;}
    step--;
  }
  endBtn.style.display="inline-block";startBtn.disabled=false;
};
endBtn.onclick=()=>gameRef.child("status").set("waiting");

/* -------- Student -------- */
gameRef.child("status").on("value",snap=>{
  const s=snap.val();
  if(s==="press_allowed"){
    sounds.bip.play().catch(()=>{});
    glowText("BẤM!");
    buz.classList.remove("disabled");isFrozen=false;
  }else if(["4","3","2","1"].includes(String(s))){
    glowText(String(s));
  }else if(s==="waiting"||s==="countdown"){
    glowText("CHỜ GIÁO VIÊN");
    buz.classList.add("disabled");
    if(isFrozen){freeze.classList.remove("active");isFrozen=false;}
    localEarly=0;
  }
});
function glowText(t){
  buz.innerHTML=t;
  buz.classList.add("glow");
  setTimeout(()=>buz.classList.remove("glow"),400);
}

buz.onclick=async()=>{
  if(isFrozen)return;
  const s=(await gameRef.child("status").once("value")).val();
  if(s==="press_allowed"){
    sounds.click.play().catch(()=>{});
    freeze.classList.add("active");isFrozen=true;
  }else{
    localEarly++;
    if(localEarly===1){
      statusTxt.textContent="⚠️ Thẻ vàng (1)";
      await playersRef.child(team).child("yellow_cards").transaction(v=>(v||0)+1);
    }else if(localEarly>=2){
      statusTxt.textContent="🚫 Bị loại!";
      freeze.classList.add("active");isFrozen=true;
      sounds.lock.play().catch(()=>{});
    }
  }
};
