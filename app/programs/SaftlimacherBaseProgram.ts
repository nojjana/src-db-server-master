import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies } from "matter-js";
import { SrcSocket } from "../SrcSocket";

export abstract class SaftlimacherBaseProgram implements Program {

  // basic program setup
  protected lobbyController: LobbyController;
  protected controller1?: SrcSocket;
  protected controller2?: SrcSocket;
  protected controllers?: SrcSocket[];
  protected readyDisplays = 0;
  protected readyControllers = 0;

  // basic game setup
  protected playing: boolean = false;
  protected endedTutorial = 0;
  protected gameLoop: any;
  protected engine?: Matter.Engine;
  protected gameTimerId?: NodeJS.Timeout;
  protected countdownInterval: any;
  protected startCountdownSeconds = 5;
  protected gameOverCountdownSeconds = 10;

  // basic game variables
  protected secondsOfPlayTime: number = 60;
  protected score: number = 0;
  protected scoreInc: number = 5;

  // säftlimacher world dimensions
  protected width = 2560;
  protected height = 1440;
  protected worldSideMargin = 600;

  // list
  protected allIngredientNumbersOnList: number[] = new Array();

  constructor(lobbyController: LobbyController) {
    this.lobbyController = lobbyController;
    this.setControllerReadyListener();
    this.setDisplayReadyListener();
    // this.setQuitGameListener();
  }

  /* -------------------- BASIC SÄFTLIMACHER GAME METHODS --------------------*/
  
  private setUpGame() {
    this.engine = Matter.Engine.create();
    this.createWorldBounds();
    this.initLevelData();
    this.initMatterEventCollision();
    this.generateIngredientListNumbers();
    this.sendLevelInfoToDisplay();
  }

  // protected createWorldBounds(): void {
  //   if (this.engine == null) return;

  //   Matter.World.add(this.engine.world, [
  //     // Top
  //     // Matter.Bodies.rectangle(this.width / 2, 0, this.width, 10, {
  //     //   isStatic: true
  //     // }),
  //     // Left
  //     Matter.Bodies.rectangle(this.worldSideMargin, this.height / 2, 10, this.height, {
  //       isStatic: true,
  //       // render: { 
  //       //   visible: true, 
  //       // }
  //     }),
  //     // Bottom
  //     // not visible, further down. trigger for respawning fruit
  //     Matter.Bodies.rectangle(this.width / 2, this.height+400, this.width, 10, {
  //       label: 'Floor',
  //       isStatic: true,
  //       isSensor: true
  //     }),
  //     // Right
  //     Matter.Bodies.rectangle(this.width - this.worldSideMargin, this.height / 2, 10, this.height, {
  //       isStatic: true
  //     })
  //   ])
  // }

  protected generateIngredientListNumbers() {
    let lastRandomInt = -1;
    for (let index = 0; index < 2; index++) {
      // generate 2 random numbers between 0 and 2 (for example: 0, 2)
      let currentRandomInt = this.getRandomInt(3);
      while (lastRandomInt == currentRandomInt) {
        currentRandomInt = this.getRandomInt(3);
      }
      this.allIngredientNumbersOnList.push(currentRandomInt);
      lastRandomInt = currentRandomInt;
    }

    this.allIngredientNumbersOnList.forEach(n => {
      console.log("number on list: " + n);
    });

    return this.allIngredientNumbersOnList;
  }

  protected isInedible(ingredientNr: number) {
    // 3 is a beatle iiiiih
    return ingredientNr == 3;
  }

  // send level data to browser BEFORE starting game loop
  protected sendLevelInfoToDisplay(): void {
    let data: any[] = this.collectLevelData();
    this.setDisplayGameViewBuildListener();
    this.lobbyController.sendToDisplays('levelData', data);
  }

  /* -------------------- ABSTRACT SÄFTLIMACHER GAME METHODS -> INDIVIDUAL IMPLEMENTATION --------------------*/

  abstract setControllerDataPlayer1(controllerData: number[]): void;
  abstract setControllerDataPlayer2(controllerData: number[]): void;
  
  abstract createWorldBounds(): void;
  abstract initLevelData(): void;
  abstract initIngredients(): void;
  abstract initMatterEventCollision(): void;
  abstract collectLevelData(): any[];
  // abstract respawnIngredient(body: Matter.Body): void
  abstract initGameLoop(fps: number):void; 
  abstract clearInGameTimers(): void;

  /* -------------------- BASIC GAME METHODS --------------------*/

  protected startGame(): void {
    this.gameTimerId = setTimeout(() => this.doGameOverCountdown(), (this.secondsOfPlayTime * 1000) - (this.gameOverCountdownSeconds * 1000));
    // this.gameTimerId = setTimeout(() => this.gameOver(), this.secondsOfPlayTime * 1000);

    this.lobbyController.sendToControllers('startSendingData', null);
    this.playing = true;
    this.lobbyController.sendToDisplays('playing', this.playing);

    let fps = 60;
    this.initGameLoop(fps);

    // this.lobbyController.getControllers()[0].addSocketOnce('quitGame', this.shutDownGame.bind(this));
    // this.lobbyController.getControllers()[1].addSocketOnce('quitGame', this.shutDownGame.bind(this));
  }

  protected gameOver() {
    console.log("SERVER: gameOver() called");

    this.cleanUp();
    this.playing = false;

    this.lobbyController.sendToDisplays('playing', this.playing);
    this.lobbyController.sendToDisplays('gameOver', true);

    // true: main player
    if (this.controller1 && this.controller2) {
          this.controller1.emit('stopSendingData', true);
          this.controller2.emit('stopSendingData', false);
          this.controller1.addSocketOnce('goToMainMenu', this.goToMainMenu.bind(this));
    }

    // this.lobbyController.getControllers()[0].emit('stopSendingData', true);
    // this.lobbyController.getControllers()[1].emit('stopSendingData', false);

    // this.lobbyController.getControllers()[0].addSocketOnce('quitGame', this.shutDownGame.bind(this));
    // this.lobbyController.getControllers()[1].addSocketOnce('quitGame', this.shutDownGame.bind(this));
  }
  protected cleanUp(): void {
    if (this.gameTimerId != null) clearTimeout(this.gameTimerId);
    this.clearInGameTimers();

    clearInterval(this.gameLoop);
    clearInterval(this.countdownInterval);

    if (this.engine != null) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  protected goToMainMenu() {
    this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }

  protected shutDownGame(): void {    
    console.log("SERVER: shutDownGame() called");

    this.gameOver();
    // this.cleanUp();
    // if (this.engine != null) {
    //   Matter.World.clear(this.engine.world, false);
    //   Matter.Engine.clear(this.engine);
    // }
    this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }

  /* -------------------- BASIC CONTROLLER/DISPLAY METHODS --------------------*/

  private setControllerReadyListener(): void {
    this.controllers = this.lobbyController.getControllers();

    for (let controller of this.controllers) {
      controller.addSocketOnce('controllerReady', this.controllerIsReady.bind(this));
    }
  }

  // private setQuitGameListener(): void {
  //   this.controllers = this.lobbyController.getControllers();

  //   for (let controller of this.controllers) {
  //     controller.addSocketOnce('quitGame', this.shutDownGame.bind(this));
  //   }
  // }

  private setDisplayReadyListener(): void {
    let displays = this.lobbyController.getDisplays();

    for (let display of displays) {
      display.addSocketOnce('displayReady', this.displayIsReady.bind(this));
    }
  }

  private displayIsReady(): void {
    this.readyDisplays++;
    if (this.readyControllers >= 2 && this.readyDisplays == this.lobbyController.getDisplays().length) {
      this.distributeResponsibilities();
    }
  }

  private controllerIsReady(): void {
    this.readyControllers++;
    if (this.readyControllers >= 2 && this.readyDisplays == this.lobbyController.getDisplays().length) {
      this.distributeResponsibilities();
    }
  }

  private distributeResponsibilities(): void {
    this.readyDisplays = 0;
    this.controllers = this.lobbyController.getControllers();
    this.controller1 = this.controllers[0];
    this.controller2 = this.controllers[1];

    this.controller1.emit('controllerResponsibility', {tutorial: true, controllerId: 1});
    this.controller2.emit('controllerResponsibility', {tutorial: true, controllerId: 2});

    for (let controller of this.controllers) {
      controller.addSocketOnce('endedTutorial', this.controllerEndedTutorial.bind(this));
    }
  }

  private controllerEndedTutorial(): void {
    this.endedTutorial++;
    this.lobbyController.sendToDisplays('controllerEndedTutorial', this.endedTutorial);

    if (this.endedTutorial == this.controllers?.length) {
      this.setUpGame();
      // this.lobbyController.sendToControllers('startSendingData', null);
    }
  }

  private setDisplayGameViewBuildListener(): void {
    let displays = this.lobbyController.getDisplays();

    for (let display of displays) {
      display.addSocketOnce('gameViewBuild', this.gameViewBuildCallback.bind(this));
    }
  }

  private gameViewBuildCallback(): void {
    this.readyDisplays++;
    if (this.readyDisplays === this.lobbyController.getDisplays().length) {
      this.doCountdown();
    }
    // this.setControllerListenerOnExitClicked();
  }

  private doCountdown(): void {
    if (this.controller1 == null || this.controller2 == null) return;
    this.removeControllerDataListeners();
    this.removeControllerListenerOnExitClicked();

    let i = this.startCountdownSeconds;
    this.lobbyController.sendToDisplays('countdown', i--);
    this.countdownInterval = setInterval(() => {
      this.lobbyController.sendToDisplays('countdown', i--);
      if (i == -1) {
        clearInterval(this.countdownInterval);
        this.setControllerDataListeners();
        this.setControllerListenerOnExitClicked();

        this.startGame();
      }
    }, 1000);
  }

  private doGameOverCountdown(): void {
    if (this.controller1 == null || this.controller2 == null) return;

    let i = this.gameOverCountdownSeconds;
    this.lobbyController.sendToDisplays('gameOverCountdown', i);
    this.countdownInterval = setInterval(() => {
      i--;
      this.lobbyController.sendToDisplays('gameOverCountdown', i);
      if (i == 0) {
        this.gameOver();
        clearInterval(this.countdownInterval);
      }
    }, 1000);

  }

  private setControllerDataListeners(): void {
    if (this.controller1 && this.controller2) {
      this.controller1.addSocketListener('controllerData', this.setControllerDataPlayer1.bind(this));
      this.controller2.addSocketListener('controllerData', this.setControllerDataPlayer2.bind(this));
    }
  }

  private removeControllerDataListeners(): void {
    if (this.controller1 && this.controller2) {
      this.controller1.removeSocketListener('controllerData');
      this.controller2.removeSocketListener('controllerData');
    }
  }

  // allows user to exit game
  private setControllerListenerOnExitClicked(): void{
    if (this.controller1 && this.controller2) {
      this.controller1.addSocketListener('quitGame', this.shutDownGame.bind(this));
      this.controller2.addSocketListener('quitGame', this.shutDownGame.bind(this));
    }
    // this.lobbyController.getControllers()[0].addSocketOnce('quitGame', this.shutDownGame.bind(this));
    // this.lobbyController.getControllers()[1].addSocketOnce('quitGame', this.shutDownGame.bind(this));
  }

  // allows user to exit game
  private removeControllerListenerOnExitClicked(): void{
    if (this.controller1 && this.controller2) {
      this.controller1.removeSocketListener('quitGame');
      this.controller2.removeSocketListener('quitGame');
    }
  }


  /* -------------------- PROGRAM INTERFACE METHODS --------------------*/

  controllerJoin(socket: SrcSocket): boolean {
    socket.emit('gameRunning', null);
    return false;
  }

  displayJoin(socket: SrcSocket): boolean {
    socket.emit('gameRunning', null);
    return false;
  }

  socketLeft(socketId: string): void {
    console.log("SERVER: socketLeft() called");
    let displays = this.lobbyController.getDisplays();
    let controllers = this.lobbyController.getControllers();

    /* If the socket is a display, all listeners are removed
    so that socket.on() listeners aren't added twice once the socket may reconnect
    If no displays are left, the game gets ended */
    for (let i = 0; i < displays.length; i++) {
      if (displays[i].id === socketId) {
        displays[i].removeAbsolutelyAllListeners();
        displays.splice(i, 1);

        if (displays.length == 0) {
          this.shutDownGame();
        }
        break;
      }
    }

    /* If the socket is a controller, all listeners are removed
    so that socket.on() listeners aren't added twice once the socket may reconnect 
    and the game ends */
    for (let i = 0; i < controllers.length; i++) {
      if (controllers[i].id === socketId) {
        controllers[i].removeAbsolutelyAllListeners();
        controllers.splice(i, 1);

        this.shutDownGame();
        break;
      }
    }
  }

  /* -------------------- BASIC HELPER METHODS --------------------*/

  getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.floor(max));
  }

  getRandomIntInterval(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }












  /* -------------------- TEST OF CLASSES --------------------*/
  

  testClasses() {
    // console.log("------------ test of falling objects from classes ------------");

    // const fallingIngredientTest = new Banana();
    // if (this.engine !== undefined) {
    //   Matter.World.add(this.engine?.world, fallingIngredientTest.getBody());
    //   console.log("Added banana to world. banana body.");
    //   // console.log(fallingIngredientTest.getBody());
    //   fallingIngredientTest.setPosition(1000, 1000);
    //   this.ingredient = fallingIngredientTest.getBody();
    // }



    console.log("------------ test of classes ------------");

    const firstPlant = new AppleTree();
    console.log("firstPlant: " + firstPlant.getName());

    const firstIngredient = new Apple();
    console.log("firstIngredient: " + firstIngredient.getName());
    console.log("firstIngredient is edible: " + firstIngredient.isEdible());

    firstPlant.addIngredient(firstIngredient);
    firstPlant.getIngredients().forEach(i => console.log(i.getName()));

    let listOfItems: Ingredient[] = [new Apple(), new Banana(), new Berry()];
    console.log("items on list: ");
    listOfItems.forEach(item => {
      console.log(item.getName());
    });

    console.log("firstIngredient '" + firstIngredient.getName() + "' is on list: " + this.isOnList(firstIngredient, listOfItems));

  }

  isOnList(firstIngredient: Ingredient, listOfItems: Ingredient[]) {
    return listOfItems.map(i => i.getType).includes(firstIngredient.getType);
  }

}

enum IngredientType {
  APPLE,
  BANANA,
  BERRY,
  BEATLE
  // HONEY,
  // BEE
}

class ShakeObject {

  private name: string;
  private edible = true;
  private ingredients: Ingredient[] = new Array();


  constructor(name: string, edible?: boolean) {
    this.name = name;
    if (edible !== undefined) {
      this.edible = edible;
    }
  }

  getName() {
    return this.name;
  }

  isEdible() {
    return this.edible;
  }

  getIngredients() {
    return this.ingredients;
  }

  addIngredients(ingredients: Ingredient[]) {
    ingredients.forEach(i => {
      this.addIngredient(i);
    });
  }

  addIngredient(ingredient: Ingredient) {
    this.ingredients.push(ingredient);
  }

}

class AppleTree extends ShakeObject {

  constructor() {
    super("AppleTree");
  }

}

class Ingredient {
  private name: string;
  private type: IngredientType;
  private body: Matter.Body;
  private x = 0;
  private y = 0;
  private r = 50;
  private edible = true;

  constructor(name: string, ingredientType: IngredientType, x?: number, y?: number, r?: number, edible?: boolean) {
    this.name = name;
    this.type = ingredientType;

    if (x !== undefined && y !== undefined && r !== undefined) {
      this.x = x;
      this.y = y;
      this.r = r;
      this.body = Matter.Bodies.circle(
        this.x,
        this.y,
        this.r,
        {
          label: this.name,
        }
      );
    } else {
      // no values for body passed, setting defaults
      this.x = 0;
      this.y = 0;
      this.r = 50;
      this.body = Matter.Bodies.circle(
        this.x,
        this.y,
        this.r,
        {
          label: this.name,
        }
      );
    }

    if (edible !== undefined) {
      this.edible = edible;
    }
  }

  getName() {
    return this.name;
  }

  isEdible() {
    return this.edible;
  }

  getType(): IngredientType {
    return this.type;
  }

  getBody(): Matter.Body {
    return this.body;
  }

  getX(): number {
    return this.body.position.x;
  }

  getY(): number {
    return this.body.position.y;
  }

  setX(x: number) {
    this.x = x;
    Matter.Body.setPosition(this.body, {x: this.x, y: this.y});
  }

  setY(y: number) {
    this.y = y;
    Matter.Body.setPosition(this.body, {x: this.x, y: this.y});
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    Matter.Body.setPosition(this.body, {x: this.x, y: this.y});
  }

  setBody(x: number, y: number, r?: number) {
    if (r == undefined) { r = 50; }
    this.body = Matter.Bodies.circle(
      x,
      y,
      r,
      {
        label: this.name,
      }
    );
  }

}

class Apple extends Ingredient {
  constructor() {
    super("Apple", IngredientType.APPLE);
  }
}

class Banana extends Ingredient {
  constructor() {
    super("Banana", IngredientType.BANANA);
  }
}

class Berry extends Ingredient {
  constructor() {
    super("Berry", IngredientType.BERRY);
  }
}


// class Honey extends Ingredient {
  //   constructor() {
    //     super("Honey", IngredientType.HONEY);
    //   }
    // }
    
    // class Bee extends Ingredient {
      //   constructor() {
        //     super("Bee", IngredientType.BEE, false);
        //   }
        // }
        
        


