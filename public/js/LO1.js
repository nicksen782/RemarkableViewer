var LO1 = {
    // FOR: document.getElementById
    "DOM":{
        'menu'    : 'LO1_menu_button',
        'sidebar' : 'LO1_sidebar',
    },
    // FOR: document.querySelector
    "DOM_qs":{
        'menuIcon': '.LO1_sidebar_icon span',
    },
    // FOR: document.querySelectorAll
    "DOM_qsa":{
    },
    init: function(){
        // Cache the DOM.
        for(let key in this.DOM){
            this.DOM[key] = document.getElementById(this.DOM[key]);
        }
        for(let key in this.DOM_qs){
            this.DOM[key] = document.querySelector(this.DOM_qs[key]);
        }
        for(let key in this.DOM_qsa){
            this.DOM[key] = document.querySelectorAll(this.DOM_qsa[key]);
        }

        // Menu event listener.
        this.DOM['menu'].addEventListener("click", ()=>{
            let isActive = this.DOM['sidebar'].classList.contains("active") ? true : false;
            if(isActive == true){
                this.DOM['sidebar'] .classList.remove("active");
                this.DOM['menuIcon'].classList.remove("mdi-menu-open");
                this.DOM['menuIcon'].classList.add   ("mdi-menu");
            }
            else{
                this.DOM['sidebar'] .classList.add   ("active");
                this.DOM['menuIcon'].classList.remove("mdi-menu");
                this.DOM['menuIcon'].classList.add   ("mdi-menu-open");
            }
            // 
        }, false);
    },
};