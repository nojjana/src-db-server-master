import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies } from "matter-js";
import { SrcSocket } from "../SrcSocket";

export class ShakerProgram implements Program {

  private lobbyController: LobbyController;
  private readyDisplays = 0;
  private readyControllers = 0;
  private gameLoop: any;
  private hit = false;
  private engine?: Matter.Engine;
  private numberOfTilesWidth = 5;
  private numberOfTilesHeight = 4;
  private tileSize = 128;
  private width = this.tileSize * this.numberOfTilesWidth;
  private height = this.tileSize * this.numberOfTilesHeight;
  private halfTileSize = this.tileSize / 2;
  private holeRadius = 50;
  // private hammerPosX = this.halfTileSize;
  // private hammerPosX = (this.width/2) * 0.8;
  private hammerPosX = 1100;
  // private hammerPosY = this.halfTileSize;
  // private hammerPosY = (this.height/2) * 0.3;
  private hammerPosY = 300;

  private hammer?: Matter.Body;
  private hammerRadius = this.holeRadius;
  private gravityX: number = 0;
  private gravityY: number = 0;
  private moleRadius = this.holeRadius;
  private mole?: Matter.Body;
  private moleTimerId?: NodeJS.Timeout;
  private gameTimerId?: NodeJS.Timeout;

  private score: number = 0;
  private scoreInc: number = 50;
  private endedTutorial = 0;
  private countdownInterval: any;

  // Shaker data
  private controller1?: SrcSocket;
  private controller2?: SrcSocket;
  private controllers?: SrcSocket[];

  private shaking = false;
  private shakeCounter: number = 0;
  private shakePointsNeededForFalling: number = 55;   // 2 Personen am Handy
  // private shakePointsNeededForFalling: number = 10;   // testing mit smartphone sensor
  // private shakePointsNeededForFalling: number = 4;   // testing mit dev controls

  private shakeObjectChangeTimerId?: NodeJS.Timeout;
  private shakeObjectChangeAfterSeconds: number = 5;
  private maxAmountOfFallingObjects = 3;
  private currentRandomShakingObjectNumber = 0;
  private oldShakeObjectNumber = -1;

  // TODO set correct position
  private shakerContainer?: Matter.Body;
  private shakerContainerPosX = this.halfTileSize;
  private shakerContainerPosY = this.halfTileSize;
  private shakerContainerRadius = this.holeRadius;
  private ingredient?: Matter.Body;
  private ingredientPosX = this.halfTileSize;
  private ingredientPosY = this.halfTileSize;
  private ingredientRadius = this.holeRadius;

  private secondsOfPlayTime: number = 30;
  private playing: boolean = false;

  private allIngredientNumbersOnList: number[] = new Array();
  // secondsForFalling = 1.8;   // je nach Bildschirm. TODO: fix.
  secondsForFalling = 0.8;
  fallBlocked = false;



  constructor(lobbyController: LobbyController) {
    this.lobbyController = lobbyController;
    this.setControllerReadyListener();
    this.setDisplayReadyListener();

    // TODO only for testing classes
    this.testClasses();
  }

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
    // TODO multiple shake controllers
    this.readyDisplays = 0;

    this.controllers = this.lobbyController.getControllers();

    // we want no random distribution
    // let v = Math.round(Math.random());
    // this.moveController = controllers[v];
    // this.hitController = controllers[(v + 1) % 2];
    this.controller1 = this.controllers[0];
    this.controller2 = this.controllers[1];
    this.controllers.forEach(controller => {
      // TODO initialize ?
    });

    this.controller1.emit('controllerResponsibility', false);
    this.controller2.emit('controllerResponsibility', false);
    // true is move controller
    // this.moveController.emit('controllerResponsibility', true);

    for (let controller of this.controllers) {
      controller.addSocketOnce('endedTutorial', this.controllerEndedTutorial.bind(this));

      // Tutorial überspringen für Debugging
      // TODO tutorial (skip waiting): wieder rückgängig machen!
      // (2 Zeilen mit setup und sendtocontrollers löschen - kommen erst wenn all controllerendedtutorial)
      // this.setUpGame();
      // this.lobbyController.sendToControllers('startSendingData', null);
    }
  }

  private controllerEndedTutorial(): void {
    this.endedTutorial++;

    this.lobbyController.sendToDisplays('controllerEndedTutorial', this.endedTutorial);

    if (this.endedTutorial == this.controllers?.length) {
      this.setUpGame();
      this.lobbyController.sendToControllers('startSendingData', null);
    }
  }

  private setControllerDataListeners(): void {
    if (this.controller1 && this.controller2) {
      // this.moveController.addSocketListener('controllerData', this.setGravity.bind(this));
      this.controller1.addSocketListener('controllerData', this.hammerHit.bind(this));  // controllerData kommt an -> hammerHit wird ausgeführt (hit = true)
      this.controller2.addSocketListener('controllerData', this.hammerHit.bind(this));

      this.controller2.addSocketListener('controllerData', this.shakeMovement.bind(this));
      this.controller1.addSocketListener('controllerData', this.shakeMovement.bind(this));
      // stop not necessary and not working properly
      // this.hitController.addSocketListener('controllerData', this.stopShaking.bind(this));
      // this.moveController.addSocketListener('controllerData', this.stopShaking.bind(this));
    }
  }

  
  private removeControllerDataListeners(): void {
    if (this.controller1 && this.controller2) {
      // this.moveController.addSocketListener('controllerData', this.setGravity.bind(this));
      this.controller1.removeSocketListener('controllerData');
      this.controller2.removeSocketListener('controllerData');
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

    this.gravityX = 0;
    this.gravityY = 0;

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

  private setGravity(gravity: number[]): void {
    this.gravityX = gravity[0];
    this.gravityY = gravity[1];
  }

  private hammerHit(): void {
    this.hit = true;
    // console.log('hammerHit. hit = ' + this.hit);
    setTimeout(() => { this.hit = false; }, 300);
  }


  private shakeMovement(): void {
    this.shaking = true;
    console.log('Controllers are shaking. Counter: ' + this.shakeCounter);
    if (this.shakeCounter < this.shakePointsNeededForFalling) {
      this.shakeCounter++;
    } else if (this.shakeCounter >= this.shakePointsNeededForFalling) {
      // console.log('shakeCounter: ' + this.shakeCounter);
      this.shakeCounter = this.shakePointsNeededForFalling;
      if (!this.fallBlocked) {
        this.fallBlocked = true;
              setTimeout(() => { 
                this.triggerFallOfIngredient(this.currentRandomShakingObjectNumber);
                this.shakeCounter = this.shakeCounter * 0.6;
                this.fallBlocked = false;
              }, 100);
         }
        // setTimeout(() => { this.shakeCounter = 0; }, 50);

    }
    setTimeout(() => { this.shaking = false; }, 50);
  }

  // private stopShaking(): void {
  //     this.shaking = false;
  //     console.log('stopShaking. shaking = '+this.shaking);
  // }

  private triggerFallOfIngredient(ingredientNumber: number): void {
    console.log("Ingredient shall fall, number: "+ingredientNumber);
    // TODO: send number
    this.lobbyController.sendToDisplays('updateFall', true);

    // after some seconds (test!) the fruit reached shaker -> give points 
    // TODO: solve with collision!! not with estimating seconds for falling...
    
    if (this.allIngredientNumbersOnList.includes(ingredientNumber)) {

      setTimeout(() => { 
        this.score += this.scoreInc;
        this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientNumber);
        this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [this.scoreInc, ingredientNumber]); 
      }, this.secondsForFalling * 1000);

   } else {
    // TODO: wrong ingredient! descrease score? display message?
    setTimeout(() => { 
      console.log('catched a wrong ingredient, NOT on list!!! -50 Punkte.');
      this.score -= this.scoreInc;
      this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [-this.scoreInc, ingredientNumber]); 
    }, this.secondsForFalling * 1000);

  }
    
  }

  private triggerChangeShakeObject(): void {
    console.log('Time for a new plant!');

    this.oldShakeObjectNumber = this.currentRandomShakingObjectNumber;
    this.currentRandomShakingObjectNumber = this.getRandomInt(this.maxAmountOfFallingObjects);
    while (this.oldShakeObjectNumber == this.currentRandomShakingObjectNumber) {
      // avoid changing to the same shakeObject (i.e. 2x apple tree)
      this.currentRandomShakingObjectNumber = this.getRandomInt(this.maxAmountOfFallingObjects);
    }

    this.lobbyController.sendToDisplays('changeShakeObject', this.currentRandomShakingObjectNumber);

    if (this.shakeObjectChangeTimerId != null) {
      this.shakeObjectChangeTimerId.refresh();
    }

    // new plant -> shake effect back to 0
    this.shakeCounter = 0;

  }

  private setDisplayShakerBuildListener(): void {
    let displays = this.lobbyController.getDisplays();

    for (let display of displays) {
      display.addSocketOnce('shakerBuild', this.shakerBuild.bind(this));
    }
  }

  private shakerBuild(): void {
    this.readyDisplays++;
    if (this.readyDisplays === this.lobbyController.getDisplays().length) {
      this.doCountdown();
    }
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

  private sendLevelInfoToDisplay(): void {
    if (this.mole == null) return;

    let data = [];
    data.push(this.numberOfTilesWidth);
    data.push(this.numberOfTilesHeight);
    // Hammer Start Position to left upper corner hole
    data.push(this.hammerPosX);
    data.push(this.hammerPosY);
    // Mole Start Position
    data.push(this.mole.position.x);
    data.push(this.mole.position.y);

    this.generateIngredientListNumbers();
    data.push(this.allIngredientNumbersOnList);
    // this.lobbyController.sendToDisplays('allIngredientNumbersOnList', this.allIngredientNumbersOnList);
    data.push(this.shakePointsNeededForFalling);

    this.setDisplayShakerBuildListener();
    this.lobbyController.sendToDisplays('shakerData', data);
  }

  private createWorldBounds(): void {
    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Top
      Matter.Bodies.rectangle(this.width / 2, 0, this.width, 1, {
        isStatic: true
      }),
      // Left
      Matter.Bodies.rectangle(0, this.height / 2, 1, this.height, {
        isStatic: true
      }),
      // Bottom
      Matter.Bodies.rectangle(this.width / 2, this.height, this.width, 1, {
        isStatic: true
      }),
      // Right
      Matter.Bodies.rectangle(this.width, this.height / 2, 1, this.height, {
        isStatic: true
      })
    ])
  }

  private getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.floor(max));
  }

  private getRandomIntInterval(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private initMole(): void {
    if (this.engine == null) return;

    this.mole = Matter.Bodies.circle(
      this.halfTileSize + this.getRandomInt(this.numberOfTilesWidth) * this.tileSize,
      this.halfTileSize + this.getRandomInt(this.numberOfTilesHeight) * this.tileSize,
      this.moleRadius,
      {
        label: 'Mole',
        isSensor: true,
        isStatic: true
      }
    );
    Matter.World.add(this.engine.world, this.mole);
    this.moleTimerId = setInterval(() => this.resetMole(), this.getRandomIntInterval(3000, 5000));
  }

  private resetMole(): void {
    if (this.mole == null || this.moleTimerId == null) return;

    Matter.Body.setPosition(this.mole,
      {
        x: this.halfTileSize + this.getRandomInt(this.numberOfTilesWidth) * this.tileSize,
        y: this.halfTileSize + this.getRandomInt(this.numberOfTilesHeight) * this.tileSize
      });
    this.moleTimerId.refresh();
  }

  private initHammer(): void {
    if (this.engine == null) return;

    this.hammer = Matter.Bodies.circle(
      this.hammerPosX, this.hammerPosY, this.hammerRadius,
      {
        label: 'Hammer',
        mass: 100
      });
    Matter.World.add(this.engine.world, this.hammer);
  }


  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.shakerContainerPosX,
      this.shakerContainerPosY,
      this.shakerContainerRadius,
      {
        label: 'Shaker',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.shakerContainer);
  }

  private initIngredient(): void {
    if (this.engine == null) return;

    this.ingredient = Matter.Bodies.circle(
      this.ingredientPosX,
      this.ingredientPosY,
      this.ingredientRadius,
      {
        label: 'Ingredient',
      });
    Matter.World.add(this.engine.world, this.ingredient);
  }

  private setUpGame() {
    this.engine = Matter.Engine.create();
    this.createWorldBounds();
    this.initHammer();
    this.initMole();
    this.initShakerContainer();
    this.initIngredient();
    
    Matter.Events.on(this.engine, 'collisionActive', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        // TODO collision detection and score inc
        if (pair.bodyA.label === 'Ingredient' || pair.bodyB.label === 'Ingredient') {
          if (pair.bodyA.label === 'Shaker') {
            // console.log('Collision 1!')
            // TODO
            // this.score += this.scoreInc;
          } else if (pair.bodyB.label === 'Shaker') {
            // console.log('Collision 2!')
            // this.score += this.scoreInc;
          }
        }

        // if (pair.bodyA.label === 'Hammer' || pair.bodyB.label === 'Hammer') {
        //   if (pair.bodyA.label === 'Mole') {
        //     if (this.hit) {
        //       // TODO fruit falls
        //       // TODO catch fruit -> später
        //       // TODO reset    
        //       this.resetMole();
        //       this.score += this.scoreInc;
        //     }
        //   } else if (pair.bodyB.label === 'Mole') {
        //     if (this.hit) {
        //       this.resetMole();
        //       this.score += this.scoreInc;
        //     }
        //   }
        // }
      }
    });

    this.sendLevelInfoToDisplay();
  }

  generateIngredientListNumbers() {
    let lastRandomInt = -1;
    for (let index = 0; index < 2; index++) {      
      let thisRandomInt = this.getRandomInt(3);
      while (lastRandomInt == thisRandomInt) {
        thisRandomInt = this.getRandomInt(3);
      }
      this.allIngredientNumbersOnList.push(thisRandomInt);
      lastRandomInt = thisRandomInt;
    }
    this.allIngredientNumbersOnList.forEach(n => {
      console.log("number on list: "+n);
    });
  }

  private startGame(): void {
    this.gameTimerId = setTimeout(() => this.doGameOverCountdown(), (this.secondsOfPlayTime * 1000) - (10 * 1000));
    this.gameTimerId = setTimeout(() => this.gameOver(), this.secondsOfPlayTime * 1000);
    
    this.playing = true;
    this.lobbyController.sendToDisplays('playing', this.playing);

    // change shakeObject after X seconds
    this.shakeObjectChangeTimerId = setTimeout(() => this.triggerChangeShakeObject(), this.shakeObjectChangeAfterSeconds * 1000);

    let fps = 60;

    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.hammer == null || this.mole == null) return;

      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('updateHammer', [this.hammer.position.x, this.hammer.position.y, this.mole.position.x, this.mole.position.y, this.hit, this.score]);
      this.lobbyController.sendToDisplays('updateShaking', this.shaking);
      this.lobbyController.sendToDisplays('updateScore', this.score);  
      this.lobbyController.sendToDisplays('updateShakeCounter', this.shakeCounter);  
      
      // if nobody shakes, shakecounter decreases (progressbar empties)
      // this.shakeCounter = this.shakeCounter - 0.01;
      this.shakeCounter = this.shakeCounter - 0.1;
      if (this.shakeCounter < 0) {
        this.shakeCounter = 0;
      }
        
    }, 1000 / fps);
  }

  private cleanUp(): void {
    if (this.moleTimerId != null) clearInterval(this.moleTimerId);
    if (this.gameTimerId != null) clearTimeout(this.gameTimerId);
    if (this.shakeObjectChangeTimerId != null) clearTimeout(this.shakeObjectChangeTimerId);

    clearInterval(this.gameLoop);
    clearInterval(this.countdownInterval);

    if (this.engine != null) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

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

  controllerJoin(socket: SrcSocket): boolean {
    socket.emit('gameRunning', null);
    return false;
  }

  displayJoin(socket: SrcSocket): boolean {
    socket.emit('gameRunning', null);
    return false;
  }




  // TEST. CLASSES.

  testClasses() {
    console.log("------------ test of classes ------------");

    const firstPlant = new AppleTree();
    console.log("firstPlant: "+firstPlant.getName());

    const firstIngredient = new Apple();
    console.log("firstIngredient: "+firstIngredient.getName());
    console.log("firstIngredient is edible: "+firstIngredient.isEdible());
    
    firstPlant.addIngredient(firstIngredient);
    firstPlant.getIngredients().forEach(i => console.log(i.getName()));

    let listOfItems: Ingredient[] = [new Apple(), new Banana(), new Berry()];
    console.log("items on list: ");
    listOfItems.forEach(item => {
      console.log(item.getName());
    });

    console.log("firstIngredient '"+firstIngredient.getName()+"' is on list: "+ this.isOnList(firstIngredient, listOfItems));

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



