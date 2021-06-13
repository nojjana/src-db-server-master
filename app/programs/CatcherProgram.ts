import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies } from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class CatcherProgram implements Program {

  // basic program setup
  private lobbyController: LobbyController;
  private controller1?: SrcSocket;
  private controller2?: SrcSocket;
  private controllers?: SrcSocket[];
  private readyDisplays = 0;
  private readyControllers = 0;

  // basic game setup
  private playing: boolean = false;
  private endedTutorial = 0;
  private gameLoop: any;
  private engine?: Matter.Engine;
  private gameTimerId?: NodeJS.Timeout;
  private countdownInterval: any;

  // basic game variables
  private secondsOfPlayTime: number = 30;
  private score: number = 0;
  private scoreInc: number = 50;

  // säftlimacher world dimensions
  private width = 2560;
  private height = 1440;
  /// ingredient list is in margin area (no shakerContainer or falling ingredients there)
  private worldSideMargin = 600;
  // field: left, center, right
  private xDiffToNextField = 340;
  private xLeftField = 940;      // 600 + 340
  private xCenterField = 1280;   // 600 + 340 + 340
  private xRightField = 1620;    // 600 + 340 + 340 + 340
  // TODO 3 ebene für shaker/netze berechnen und speichern
  private yShakerFieldBottom = this.height * 0.8
  private radius = 50;

  // säftlimacher visible objects
  private ingredient?: Matter.Body;
  private ingredientRadius = this.radius;
  private shakerContainer?: Matter.Body;
  private shakerContainerRadius = this.radius;

  // säftlimacher game variables
  private allIngredientNumbersOnList: number[] = new Array();
  private gravityX: number = 0;


  constructor(lobbyController: LobbyController) {
    this.lobbyController = lobbyController;
    this.setControllerReadyListener();
    this.setDisplayReadyListener();
  }


  /* -------------------- BASIC GAME METHODS --------------------*/

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
      this.distributeResponsibilites();
    }
  }

  private controllerIsReady(): void {
    this.readyControllers++;
    if (this.readyControllers >= 2 && this.readyDisplays == this.lobbyController.getDisplays().length) {
      this.distributeResponsibilites();
    }
  }

  private distributeResponsibilites(): void {
    this.readyDisplays = 0;
    this.controllers = this.lobbyController.getControllers();
    this.controller1 = this.controllers[0];
    this.controller2 = this.controllers[1];

    this.controller1.emit('controllerResponsibility', true);
    this.controller2.emit('controllerResponsibility', true);

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
  }

  private doGameOverCountdown(): void {
    if (this.controller1 == null || this.controller2 == null) return;

    let i = 10;

    this.lobbyController.sendToDisplays('gameOverCountdown', i);

    this.countdownInterval = setInterval(() => {
      i--;
      this.lobbyController.sendToDisplays('gameOverCountdown', i);
      if (i == 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }
  private doCountdown(): void {
    if (this.controller1 == null || this.controller2 == null) return;
    this.removeControllerDataListeners();

    let i = 3;
    this.lobbyController.sendToDisplays('countdown', i--);
    this.countdownInterval = setInterval(() => {
      this.lobbyController.sendToDisplays('countdown', i--);
      if (i == -1) {
        clearInterval(this.countdownInterval);
        this.setControllerDataListeners();
        this.startGame();
      }
    }, 1000);
  }


  /* -------------------- BASIC GAME METHODS WITH INDIVIDUAL IMPLEMENTATION --------------------*/

  private setControllerDataListeners(): void {
    if (this.controller1 && this.controller2) {
      this.controller1.addSocketListener('controllerData', this.setControllerData.bind(this));
      this.controller2.addSocketListener('controllerData', this.setControllerData.bind(this));
    }
  }


  private removeControllerDataListeners(): void {
    if (this.controller1 && this.controller2) {
      this.controller1.removeSocketListener('controllerData');
      this.controller2.removeSocketListener('controllerData');
    }
  }


  /* -------------------- SÄFTLIMACHER GAME METHODS WITH INDIVIDUAL IMPLEMENTATION --------------------*/


  private setControllerData(controllerData: number[]): void {
    // console.log("controllerData arrived:", controllerData[0]);

    if (controllerData[0] != null) {
      // this.gravityX = controllerData[0];  
      this.setShakerPos(controllerData[0]);
    }
  }
  private setShakerPos(valX: number) {
    // TODO animate movement to position instead of setting directly
    // like for example here: https://github.com/liabru/matter-js/issues/733
    if (this.shakerContainer != undefined && this.shakerContainer != null) {
      switch (valX) {
        case 1:
          // right
          // Matter.Body.applyForce(this.shakerContainer, {x: this.shakerContainer.position.x, y: this.shakerContainer.position.y}, {x: 0.05, y: 0});
          // Matter.Body.translate(this.shakerContainer, {x: this.xRightField, y:  0});
          // Matter.Body.setPosition(this.shakerContainer, {x: this.xRightField, y:  this.shakerContainer.position.y});
          this.forceMove(this.shakerContainer, this.xRightField, this.shakerContainer.position.y, 20);
          break;
        case -1:
          // left
          // Matter.Body.applyForce(this.shakerContainer, {x: this.shakerContainer.position.x, y: this.shakerContainer.position.y}, {x: -0.05, y: 0});
          // Matter.Body.translate(this.shakerContainer, {x: this.xLeftField, y:  0});
          // Matter.Body.setPosition(this.shakerContainer, {x: this.xLeftField, y:  this.shakerContainer.position.y});
          this.forceMove(this.shakerContainer, this.xLeftField, this.shakerContainer.position.y, 20);
          break;
        case 0:
          // center
          // Matter.Body.translate(this.shakerContainer, {x: this.xCenterField, y:  0});
          // Matter.Body.setPosition(this.shakerContainer, {x: this.xCenterField, y:  this.shakerContainer.position.y});
          this.forceMove(this.shakerContainer, this.xCenterField, this.shakerContainer.position.y, 20);
          break;
        default:
          break;
      }
      if (valX > 0) {
        // Matter.Body.applyForce(this.shakerContainer, position, force)
      } else {
        // Matter.Body.applyForce(this.shakerContainer, position, force)
      }
    }
  }

  private forceMove(body: Matter.Body, endX: number, endY: number, pixelSteps: number) {
    // dx is the total distance to move in the X direction
    let dx = endX - body.position.x;

    // dy is the total distance to move in the Y direction
    let dy = endY - body.position.y;

    // use dx & dy to calculate where the current [x,y] is at a given pct

    let newX = body.position.x
    if (dx > 0) {
      // a little bit to the right
      newX = body.position.x + pixelSteps;
    } else if (dx < 0) {
      // a little bit to the left
      newX = body.position.x - pixelSteps;
    }

    let newY = body.position.y;
    if (dy > 0) {
      // a little bit down
      newY = body.position.y + pixelSteps;
    } else if (dy < 0) {
      // a little bit up
      newY = body.position.y - pixelSteps;
    }
    // console.log("body.position.y, endY, dy, newY: ", body.position.y, endY, dy, newY);
    Matter.Body.setPosition(body, {
      x: newX,
      y: newY
    });
  }

  private ingredientRain() {
    if (this.ingredient != null) {
      // console.log(this.ingredient);
      // console.log("BEFORE this.ingredient.position.y: ", this.ingredient.position.y)
      if (this.ingredient.position.y > this.height) {
        console.log("ingredientPosY: ",this.ingredient.position.y);
        this.respawnIngredient(this.ingredient);   
       }
      this.forceMove(this.ingredient, this.xCenterField, this.height, 20);
      // console.log("AFTER this.ingredient.position.y: ", this.ingredient.position.y)
    }
  }

  private sendLevelInfoToDisplay(): void {
    let data: any[] = [];
    this.generateIngredientListNumbers();
    data.push(this.allIngredientNumbersOnList);
    data.push(this.shakerContainer?.position.x);
    data.push(this.shakerContainer?.position.y);

    this.setDisplayGameViewBuildListener();
    this.lobbyController.sendToDisplays('levelData', data);
  }

  private createWorldBounds(): void {
    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Top
      // Matter.Bodies.rectangle(10, 10, this.width, 1, {
      //   isStatic: true
      // }),
      // Left
      Matter.Bodies.rectangle(this.worldSideMargin, this.height - 10, 1, this.height, {
        isStatic: true
      }),
      // Bottom
      // Matter.Bodies.rectangle(10, this.height - 10, this.width, 1, {
      //   isStatic: true
      // }),
      // Right
      Matter.Bodies.rectangle(this.width - this.worldSideMargin, this.height - 10, 1, this.height, {
        isStatic: true
      })
    ])
  }



  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.xCenterField,
      this.yShakerFieldBottom,
      this.shakerContainerRadius,
      {
        label: 'Shaker',
        isSensor: true,
      });
    Matter.World.add(this.engine.world, this.shakerContainer);
  }

  private initIngredient(): void {
    if (this.engine == null) return;

    this.ingredient = Matter.Bodies.circle(
      this.xCenterField,
      0,
      this.ingredientRadius,
      {
        label: 'Ingredient',
      });
    Matter.World.add(this.engine.world, this.ingredient);
  }

  private setUpGame() {
    this.engine = Matter.Engine.create();
    this.createWorldBounds();
    this.initShakerContainer();
    this.initIngredient();
    this.initMatterEventCollision();
    this.sendLevelInfoToDisplay();
  }

  initMatterEventCollision() {
    // TODO
    Matter.Events.on(this.engine, 'collisionActive', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        // TODO collision detection and score inc
        if (pair.bodyA.label === 'Ingredient' || pair.bodyB.label === 'Ingredient') {
          if (pair.bodyA.label === 'Shaker') {
            console.log('Collision 1!')
            // TODO
            // this.score += this.scoreInc;
          } else if (pair.bodyB.label === 'Shaker') {
            console.log('Collision 2!')
            // this.score += this.scoreInc;
          }
        }
      }
    });
  }

  generateIngredientListNumbers() {
    let lastRandomInt = -1;
    for (let index = 0; index < 2; index++) {
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

  private respawnIngredient(body: Matter.Body) {
    console.log("respawnIngredient");
    Matter.Body.setPosition(body, {
      x: this.xCenterField,
      y: 0
    });  
  }


  /* -------------------- BASIC GAME METHODS WITH INDIVIDUAL IMPLEMENTATION --------------------*/

  private startGame(): void {
    this.gameTimerId = setTimeout(() => this.doGameOverCountdown(), (this.secondsOfPlayTime * 1000) - (10 * 1000));
    this.gameTimerId = setTimeout(() => this.gameOver(), this.secondsOfPlayTime * 1000);

    this.lobbyController.sendToControllers('startSendingData', null);
    this.playing = true;
    this.lobbyController.sendToDisplays('playing', this.playing);

    let fps = 60;


    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.shakerContainer == null) return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = 0;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('updateShakerPosition', [this.shakerContainer.position.x, this.shakerContainer.position.y]);
      this.lobbyController.sendToDisplays('updateScore', this.score);

      if (this.ingredient != null) {
        this.ingredientRain();
        this.lobbyController.sendToDisplays('updateIngredientPosition', [this.ingredient.position.x, this.ingredient.position.y]);
        // TODO handle ingredient fall...
      }
    }, 1000 / fps);

    // TODO handle ingredient fall...
    // setTimeout(() => this.generateNewIngredient(), 4 * 1000);
  }


  /* -------------------- BASIC GAME METHODS --------------------*/

  private gameOver() {
    this.cleanUp();

    this.playing = false;
    this.lobbyController.sendToDisplays('playing', this.playing);
    this.lobbyController.sendToDisplays('gameOver', true);

    this.lobbyController.getControllers()[0].emit('stopSendingData', true);
    this.lobbyController.getControllers()[1].emit('stopSendingData', false);

    this.lobbyController.getControllers()[0].addSocketOnce('goToMainMenu', this.goToMainMenu.bind(this));

    this.lobbyController.getControllers()[0].addSocketOnce('quitGame', this.quitGame.bind(this));
    this.lobbyController.getControllers()[1].addSocketOnce('quitGame', this.quitGame.bind(this));
  }
  private cleanUp(): void {
    if (this.gameTimerId != null) clearTimeout(this.gameTimerId);
    clearInterval(this.gameLoop);
    clearInterval(this.countdownInterval);

    if (this.engine != null) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  private goToMainMenu() {
    this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }

  private quitGame() {
    // TODO: game abbrechen option
    console.log("quitGame() called");
    this.shutDownGame();
    // this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }

  private shutDownGame(): void {
    this.cleanUp();
    if (this.engine != null) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }

    this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  }


  /* -------------------- BASIC PROGRAM METHODS --------------------*/

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


  private getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.floor(max));
  }

  private getRandomIntInterval(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }



  /* -------------------- TEST OF CLASSES --------------------*/

  testClasses() {
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
    super("Apfelbaum");
  }

}

class Ingredient {
  private name: string;
  private type: IngredientType;
  private edible = true;

  constructor(name: string, ingredientType: IngredientType, edible?: boolean) {
    this.name = name;
    this.type = ingredientType;

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

}

class Apple extends Ingredient {
  constructor() {
    super("Apfel", IngredientType.APPLE);
  }
}

class Banana extends Ingredient {
  constructor() {
    super("Banane", IngredientType.BANANA);
  }
}

class Berry extends Ingredient {
  constructor() {
    super("Himbeere", IngredientType.BERRY);
  }
}

// class Honey extends Ingredient {
//   constructor() {
//     super("Honig", IngredientType.HONEY);
//   }
// }

// class Bee extends Ingredient {
//   constructor() {
//     super("Biene", IngredientType.BEE, false);
//   }
// }



