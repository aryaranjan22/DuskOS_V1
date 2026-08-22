/*AuraOS*/
const bootScreen = document.getElementById("boot-screen");
const loadingBar = document.getElementById("loading-bar");
const desktop = document.getElementById("desktop");
let progress =0;
const book = setInterval(() => {
    
progress += Math.random()*9;
if (progress >=100) {
    progress = 100;
    clearInterval(boot);
    setTimeout(() => {
        
    bootScreen.classList.add("hidden");
    desktop.classList.add("Launching");
}, 500);
}
loadingBar.style.width=`${progress}%`;
}, 120);
const auraButton =
document.getElementById("aura-button");
const auraMenu =
document.getElementById("aura-menu");
auraButton.addEventListener("click",(event)=> {
    event.stopPropagation();
    auraMenu.classList.toggle("toggle");
});
function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
    const date = now.toLocaleDateString([],{
        weekday: "short",
        day: "numeric",
        month: "short"
    });
    document.getElementById("clock").textContent = 
    time;
    document.getElementById("date").textContent = 
    date;
}
updateClock();
setInterval(updateClock, 1000);