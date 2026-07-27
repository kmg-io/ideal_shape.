function showScreen(screenId){

    // 全画面を取得
    const screens = document.querySelectorAll(".screen");

    // 全部非表示
    screens.forEach(screen=>{

        screen.classList.remove("active");

    });

    // 指定した画面だけ表示
    document.getElementById(screenId).classList.add("active");

}
// 今どちらを選択しているか
let selectingParent = "";

function openSelect(type){

    selectingParent = type;

    const title = document.getElementById("selectTitle");

    if(type === "female"){

        title.textContent = "雌犬を選択";

    }else{

        title.textContent = "雄犬を選択";

    }

    showScreen("selectScreen");

}

function selectDog(name){

    alert(name + " を選択しました");

    showScreen("breedScreen");

}