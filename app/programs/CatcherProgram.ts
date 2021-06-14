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
  private worldSideMargin = 600;
  // fields where ingredients fall: left, center, right
  private xLeftField = 740;
  private xCenterField = 1280;
  private xRightField = 1820;
  // TODO 3 ebene für shaker/netze berechnen und speichern
  private yShakerFieldBottom = this.height * 0.8

  // säftlimacher visible objects
  private ingredientLeft?: Matter.Body;
  private ingredientCenter?: Matter.Body;
  private ingredientRight?: Matter.Body;
  private shakerContainer?: Matter.Body;
  private catcherNet1?: Matter.Body;
  
  // säftlimacher game variables
  private ingredientRadius = 50;
  private shakerContainerRadius = 5;
  private availableIngredientTypes = 3;
  private allIngredientNumbersOnList: number[] = new Array();
  private allIngredientsFalling: number[] = new Array();
  // private allIngrFalling: Ingredient[] = new Array();
  private gravityX: number = 0;
  private gravityY: number = 0.5;

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
      // if (valX > 0) {
      //   // Matter.Body.applyForce(this.shakerContainer, position, force)
      // } else {
      //   // Matter.Body.applyForce(this.shakerContainer, position, force)
      // }
    }
  }

  // private fallDown(body: Matter.Body, endY: number, pixelSteps: number): Matter.Vertices {
  //   // moving ingredients down
  //   let newY = body.position.y;
  //   if (body.position.y < endY) {
  //     // fall further down
  //     newY = body.position.y + pixelSteps;
  //   }
  //   // console.log("body.position.y, endY, dy, newY: ", body.position.y, endY, dy, newY);
  //   Matter.Body.setPosition(body, {
  //     x: body.position.x,
  //     y: newY
  //   });

  //   return {x: body.position.x, y: body.position.y};
  // }

  private forceMove(body: Matter.Body, endX: number, endY: number, pixelSteps: number): Matter.Vertices {
    // moving shaker left and right
    // doesnt work properly for ingredients

    // dx is the total distance to move in the X direction
    let dx = endX - body.position.x;

    // dy is the total distance to move in the Y direction
    let dy = endY - body.position.y;

    let newX = body.position.x
    if (dx > 0) {
    // if (dx > pixelSteps) {
      // a little bit to the right
      newX = body.position.x + pixelSteps;
    } else if (dx < 0) {
    // } else if (dx < -pixelSteps) {
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

    return {x: newX, y: newY};
  }

  // private fallAndRespawnIngredient(ingredient: Matter.Body) {
  //   if (ingredient != null) {
  //     // console.log(this.ingredient);
  //     // console.log("BEFORE this.ingredient.position.y: ", this.ingredient.position.y)
  //     if (ingredient.position.y > this.height-20) {
  //       console.log("ingredientPosY: ",ingredient.position.y);
  //       this.respawnIngredient(ingredient);   
  //      }
  //     this.fallDown(ingredient, this.height, 15);
  //     // console.log("AFTER this.ingredient.position.y: ", this.ingredient.position.y)
  //   }
  // }

  // private checkRespawn(ingr: Matter.Body) {
  //   if (ingr.position.y > this.height+200) {
  //     this.respawnIngredient(ingr);
  //   }
  // }

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
//TODO rect mode is center not left top!?
// and make ground thicker....

      // Top
      // Matter.Bodies.rectangle(this.width / 2, 0, this.width, 10, {
      //   isStatic: true
      // }),
      // Left
      Matter.Bodies.rectangle(this.worldSideMargin, this.height / 2, 10, this.height, {
        isStatic: true
      }),
      // Bottom
      // not visible, further down. trigger for respawning fruit
      Matter.Bodies.rectangle(this.width / 2, this.height, this.width+500, 10, {
        label: 'Floor',
        isStatic: true,
        isSensor: true
      }),
      // Right
      Matter.Bodies.rectangle(this.width - this.worldSideMargin, this.height / 2, 10, this.height, {
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
        label: 'Shaker0',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.shakerContainer);
  }

  private initIngredients(): void {
    if (this.engine == null) return;

    // this.ingredient = Matter.Bodies.circle(
    //   this.xCenterField,
    //   0,
    //   this.ingredientRadius,
    //   {
    //     label: 'Ingredient',
    //   });
    // Matter.World.add(this.engine.world, this.ingredient);


    
    // left ingredient
    // let iLeft = new Banana();
    // iLeft.setBody(this.xLeftField, 0);
    // this.ingredientLeft = iLeft.getBody();
    // Matter.World.add(this.engine.world, this.ingredientLeft);
    // this.lobbyController.sendToDisplays('newIngredient', [iLeft.getType(), iLeft.getX(), iLeft.getY(), iLeft.getName()]);

    // TODO: wrap and send NR of ingredient enum? iwie iwo
    this.ingredientLeft = Matter.Bodies.circle(
      this.xLeftField,
      0,
      this.ingredientRadius,
      {
        label: 'Ingredient0'
      });
    Matter.World.add(this.engine.world, this.ingredientLeft);

    this.ingredientRight = Matter.Bodies.circle(
      this.xRightField,
      0,
      this.ingredientRadius,
      {
        label: 'Ingredient1',
      });
    Matter.World.add(this.engine.world, this.ingredientRight);

    this.ingredientCenter = Matter.Bodies.circle(
      this.xCenterField,
      0,
      this.ingredientRadius,
      {
        label: 'Ingredient2',
      });
    Matter.World.add(this.engine.world, this.ingredientCenter);

    // // right ingredient
    // let iRight = new Banana();
    // iRight.setPosition(this.xRightField, 0);
    // this.ingredientRight = iRight.getBody();
    // Matter.World.add(this.engine.world, iRight.getBody());
    // this.allIngrFalling.push(iRight);
    // this.lobbyController.sendToDisplays('newIngredient', [iRight.getType(), iRight.getBody().position.x, iRight.getBody().position.y, iRight.getName()]);
    
    // // center ingredient
    // let iCenter = new Berry();
    // iCenter.setPosition(this.xCenterField, 0);
    // this.ingredientCenter = iCenter.getBody();
    // Matter.World.add(this.engine.world, iCenter.getBody());
    // this.allIngrFalling.push(iCenter);
    // // this.lobbyController.sendToDisplays('newIngredient', [iCenter.getType(), iCenter.getX(), iCenter.getY(), iCenter.getName()]);
    // this.lobbyController.sendToDisplays('newIngredient', [iCenter.getType(), iCenter.getBody().position.x,  iCenter.getBody().position.y, iCenter.getName()]);

  }

  private setUpGame() {
    this.engine = Matter.Engine.create();
    this.createWorldBounds();
    this.initShakerContainer();
    this.initIngredients();
    this.initMatterEventCollision();
    this.sendLevelInfoToDisplay();
  }

  initMatterEventCollision() {
    // TODO
    // Matter.Events.on(this.engine, 'collisionActive', (event) => {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        // TODO
        if (pair.bodyA.label.includes('Shaker') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Shaker') && pair.bodyA.label.includes('Ingredient')) {
            console.log('An Ingredient collided with Shaker!')

            let shakerBody = pair.bodyA;
            let ingredientBody = pair.bodyB;
            if (pair.bodyA.label.includes('Ingredient')) {
              shakerBody = pair.bodyB;
              ingredientBody = pair.bodyA;
            }
            // let ingredientType = ingredientBody.label.substring(0, ingredientBody.label.length-2);
            let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length -1));
            let shakerNr: number = parseInt(shakerBody.label.charAt(shakerBody.label.length -1));

            console.log("shaker: ", shakerBody.label, shakerNr);
            console.log("ingr: ", ingredientBody.label, ingredientTypeNr);
            
            if (this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
              // good catch
              console.log('catched a good ingredient, +50 points!!');
              this.score += this.scoreInc;
              this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);  // TODO in browser!
              this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [this.scoreInc, ingredientTypeNr]); 
            } else {
              // bad catch
              console.log('catched a wrong ingredient, NOT on list!!! -50 points.');
              this.score -= this.scoreInc;
              this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [-this.scoreInc, ingredientTypeNr]); 
            }
            this.respawnIngredient(ingredientBody);


            // irgendwie bild an shaer hängen? (apfel soll in shaker bleiben)
            // Matter.Body.setStatic(pair.bodyB, true);
            // Matter.Composite.add(pair.bodyA, pair.bodyB);
            // if (this.isOnList(...)) { 
              // this.score += this.scoreInc;
            // }
        
          // else if (pair.bodyB.label === 'Banana') {
          //   console.log('Banana collided with Shaker!');
          // }
          // else if (pair.bodyB.label === 'Berry') {
          //   console.log('Berry collided with Shaker!');
          // } 
          // else if (pair.bodyB.label === 'Apple') {
          //   console.log('Apple collided with Shaker!');
          // }
          
        }
        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient') ) {
          console.log('An Ingredient fell on the floor!');
            if (pair.bodyB.label.includes('Ingredient')) {
              this.respawnIngredient(pair.bodyB);
            } else {
              this.respawnIngredient(pair.bodyA);
            }
          }

        // TODO collision detection and score inc
        // if (pair.bodyA.label === 'Ingredient' || pair.bodyB.label === 'Ingredient') {
        //   if (pair.bodyA.label === 'Shaker') {
        //     console.log('Collision 1!')
        //     // TODO
        //     // this.score += this.scoreInc;
        //   } 
        //   else if (pair.bodyB.label === 'Shaker') {
        //     console.log('Collision 2!')
        //     // this.score += this.scoreInc;
        //   }
        // }
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
    console.log("respawnIngredient: ");
    let newNumber = this.getRandomInt(this.availableIngredientTypes);;
    let newlabel = "Ingredient"+newNumber;

    body.label = newlabel;
    Matter.Body.setPosition(body, {
      x: body.position.x,
      y: -500
    });
    
     switch (body.position.x) {
       case this.xLeftField:
        this.lobbyController.sendToDisplays('changeImageIngredientLeft', [newNumber]);
        break;
        case this.xCenterField:
          this.lobbyController.sendToDisplays('changeImageIngredientCenter', [newNumber]);
          break;
        case this.xRightField:
          this.lobbyController.sendToDisplays('changeImageIngredientRight', [newNumber]);
          break;     
       default:
         break;
     }
    console.log("body.label =", body.label);
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
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('catcherNet1Position', [this.shakerContainer.position.x, this.shakerContainer.position.y]);
      this.lobbyController.sendToDisplays('updateScore', this.score);

      // if (this.ingredient != null) {
      //   this.fallAndRespawnIngredient(this.ingredient);
      //   this.lobbyController.sendToDisplays('updateIngredientPosition', [this.ingredient.position.x, this.ingredient.position.y]);
      // }

      if (this.ingredientLeft != null) {
        // this.fallAndRespawnIngredient(this.ingredientLeft);
        this.lobbyController.sendToDisplays('updateIngredientLeft', [this.ingredientLeft.position.x, this.ingredientLeft.position.y, 0]);
        // this.checkRespawn(this.ingredientLeft);
      }

      if (this.ingredientRight != null) {
        // Matter.Body.applyForce(this.ingredientRight, {x: this.ingredientRight.position.x, y: this.ingredientRight.position.y}, {x: 0, y: 0.02});
        this.lobbyController.sendToDisplays('updateIngredientRight', [this.ingredientRight.position.x, this.ingredientRight.position.y, 1]);
        // this.checkRespawn(this.ingredientRight);
      }

      if (this.ingredientCenter != null) {
        // this.fallAndRespawnIngredient(this.ingredientCenter);
        this.lobbyController.sendToDisplays('updateIngredientCenter', [this.ingredientCenter.position.x, this.ingredientCenter.position.y, 2]);
        // this.checkRespawn(this.ingredientCenter);
      }

    //   if (this.allIngrFalling?.length > 0) {
    //     this.allIngrFalling.forEach(ingr => {
    //       // let ingr = this.allIngrFalling[0];
    //  // console.log("BEFORE: ", ingr.getY());
    //     // TODO: achtung fixen: methode ändert x und y von body, aber nicht von x und y fields.
    //     this.fallDown(ingr.getBody(), this.height, 15);
    //     // console.log("AFTER: ", ingr.getY());
    //     this.lobbyController.sendToDisplays('newIngredient', [ingr.getType(), ingr.getBody().position.x, ingr.getBody().position.y, ingr.getName()]);

    //     });
    //   }


    }, 1000 / fps);

    // this.testClasses();
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
        
        


