import Matter from "matter-js";
import { LobbyController } from "../LobbyController";
import { SrcSocket } from "../SrcSocket";
import { Program, ProgramName } from "./Program";

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

  controllerQuitGame = false;

  constructor(lobbyController: LobbyController) {
    this.lobbyController = lobbyController;
    this.setControllerReadyListener();
    this.setDisplayReadyListener();
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
  abstract initGameLoop(fps: number): void;
  abstract clearInGameTimers(): void;

  /* -------------------- BASIC GAME METHODS --------------------*/

  protected startGame(): void {
    this.gameTimerId = setTimeout(() => this.doGameOverCountdown(), (this.secondsOfPlayTime * 1000) - (this.gameOverCountdownSeconds * 1000));

    this.lobbyController.sendToControllers('startSendingData', null);
    this.playing = true;
    this.lobbyController.sendToDisplays('playing', this.playing);

    let fps = 60;
    this.initGameLoop(fps);
  }

  protected gameOver() {
    this.cleanUp();
    this.playing = false;

    this.lobbyController.sendToDisplays('playing', this.playing);
    this.lobbyController.sendToDisplays('gameOver', true);

    // true: main player, controls lobby
    if (this.controller1 && this.controller2) {
      this.controller1.emit('stopSendingData', true);
      this.controller2.emit('stopSendingData', false);

      if (!this.controllerQuitGame) {
        this.controller1.addSocketOnce('goToMainMenu', this.goToMainMenu.bind(this));
      }
    }
  }

  protected cleanUp(): void {
    if (this.gameTimerId != null) clearTimeout(this.gameTimerId);
    this.clearInGameTimers();

    if (this.countdownInterval != null) clearInterval(this.countdownInterval);
    if (this.gameLoop != null) clearInterval(this.gameLoop);

    if (this.engine != null) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  protected goToMainMenu() {
    this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }

  protected shutDownGame(): void {
    this.controllerQuitGame = true;
    this.gameOver();

    this.goToMainMenu(); // not needed? test 

    // this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }

  /* -------------------- BASIC CONTROLLER/DISPLAY METHODS --------------------*/

  private setControllerReadyListener(): void {
    this.controllers = this.lobbyController.getControllers();

    for (let controller of this.controllers) {
      controller.addSocketOnce('controllerReady', this.controllerIsReady.bind(this));
    }
  }

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

    this.controller1.emit('controllerResponsibility', { tutorial: true, controllerId: 1 });
    this.controller2.emit('controllerResponsibility', { tutorial: true, controllerId: 2 });

    for (let controller of this.controllers) {
      controller.addSocketOnce('endedTutorial', this.controllerEndedTutorial.bind(this));
    }
  }

  private controllerEndedTutorial(): void {
    this.endedTutorial++;
    this.lobbyController.sendToDisplays('controllerEndedTutorial', this.endedTutorial);

    if (this.endedTutorial == this.controllers?.length) {
      this.setUpGame();
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

  // allows main controller to quit game
  private setControllerListenerOnExitClicked(): void {
    if (this.controller1) {
      this.controller1.addSocketListener('quitGame', this.shutDownGame.bind(this));
    }
  }

  private removeControllerListenerOnExitClicked(): void {
    if (this.controller1) {
      this.controller1.removeSocketListener('quitGame');
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

}



/* -------------------- INGREDIENT TYPE ENUM --------------------*/

enum IngredientType {
  APPLE,
  BANANA,
  BERRY,
  BEATLE
}
