//========================
// 犬データ
//========================

const dogs = [
    {
        id: 1,
        color: "白",
        ears: "立ち耳",
        personality: "活発"
    },
    {
        id: 2,
        color: "黒",
        ears: "垂れ耳",
        personality: "温厚"
    },
    {
        id: 3,
        color: "茶",
        ears: "立ち耳",
        personality: "人懐っこい"
    }
];


//========================
// ゲームの状態
//========================

let selectingParent = "";

let femaleDog = null;
let maleDog = null;

let generation = 1;
const maxGeneration = 5;


//========================
// 画面切替
//========================

function showScreen(screenId){

    const screens = document.querySelectorAll(".screen");

    screens.forEach(screen=>{
        screen.classList.remove("active");
    });

    document.getElementById(screenId).classList.add("active");

}


//========================
// 親犬選択画面を開く
//========================

function openSelect(type){

    selectingParent = type;

    const title = document.getElementById("selectTitle");

    if(type === "female"){

        title.textContent = "雌犬を選択";

    }else{

        title.textContent = "雄犬を選択";

    }

    createSelectCards();

    showScreen("selectScreen");

}


//========================
// 犬一覧を表示
//========================

function createSelectCards(){

    const container = document.getElementById("selectContainer");

    container.innerHTML = "";

    dogs.forEach(dog=>{

        container.innerHTML += `

            <div class="dog-card">

                <div class="dog-image"></div>

                <p>毛色：${dog.color}</p>

                <p>耳：${dog.ears}</p>

                <p>性格：${dog.personality}</p>

                <button onclick="selectDog(${dog.id})">

                    選択

                </button>

            </div>

        `;

    });

}


//========================
// 犬を選択
//========================

function selectDog(id){

    const dog = dogs.find(d=>d.id===id);

    if(selectingParent==="female"){

        femaleDog = dog;

    }else{

        maleDog = dog;

    }

    updateParentCards();

    showScreen("breedScreen");

}


//========================
// 親犬カード更新
//========================

function updateParentCards(){

    const femaleInfo = document.getElementById("femaleInfo");

    if(femaleDog){

        femaleInfo.innerHTML = `

            <p>毛色：${femaleDog.color}</p>

            <p>耳：${femaleDog.ears}</p>

            <p>性格：${femaleDog.personality}</p>

        `;

    }

    const maleInfo = document.getElementById("maleInfo");

    if(maleDog){

        maleInfo.innerHTML = `

            <p>毛色：${maleDog.color}</p>

            <p>耳：${maleDog.ears}</p>

            <p>性格：${maleDog.personality}</p>

        `;

    }

}

//========================
// 世代更新
//========================

function updateGeneration(){

    document.getElementById("generationText").textContent =
        `現在 ${generation} / ${maxGeneration} 世代`;

}

function nextGeneration(){

    generation++;

    if(generation > maxGeneration){

        showScreen("endingScreen");
        return;

    }

    updateGeneration();

    // 次世代なので親犬を未選択に戻す
    femaleDog = null;
    maleDog = null;

    resetParentCards();

    showScreen("breedScreen");

}

function resetParentCards(){

    document.getElementById("femaleInfo").innerHTML =
        "<p>個体未選択</p>";

    document.getElementById("maleInfo").innerHTML =
        "<p>個体未選択</p>";

}