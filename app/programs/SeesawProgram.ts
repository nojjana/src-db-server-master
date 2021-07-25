import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies, Render } from "matter-js";
import { SrcSocket } from "../SrcSocket";
import { group } from "console";
import { platform } from "os";


export class SeesawProgram implements Program {

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
  //private worldSideMargin = 600;
  // fields where ingredients fall: left, center, right
  //private xLeftField = this.width * 0.25;
  //private xCenterField = this.width * 0.5;
  //private xRightField = this.width * 0.75;
  private xLeftField = 2000-200;   //860 - 200
  private xCenterField = 1760-200;   //1340-200
  private xRightField = 2240-200;    //1760 - 200

  // placement of seesaws
  // TODO: 3 teile berrechnen und speichern
  private xSeesawLeftPosition = 900;
  private xSeesawRightPosition = 1800;
  private ySeesawPosition = 1000;
  private seesawLength = 500;
  private seesawHeight = 40;
  private seesawBeamLenght = 20;
  private seesawBeamHeight = 100;
  private ySeesawBeamPosition = 1000;

  //bei lenght: 500 / left: 1200 und right: 2000 / lenght500 und -400 auf browser seite (zeile 372 und 390) 
  // die resultate: 1000 - 1400 und 1800 - 2200

  //ingredients -400 / left: 1200 / right: 2000 / length500 und weiterhin -400 auf browser seite
  // resultate: (1400-400)-(1800-400)    (2200-400)-(2600-400)
  // browser seite (zeile 372 und 390) angepasst auf: -200 -> gibt: 1200-200 - 1600-200   / 2000-200 - 2400-200

  //seesawLeft: 900 / right: 1800
  //left field: 860-200 bis 1340-200   //right: 1760-200 bis 2240-200
  // ingredients placement: 50 for radius -> f.e. 950 or 1850
  // on browser side: angepasst auf -240


  // säftlimacher visible objects
  private ingredientLeft?: Matter.Body;
  private ingredientCenter?: Matter.Body;
  private ingredientRight?: Matter.Body;
  private seesaw1?: Matter.Body;
  private seesawBeam1?: Matter.Body;
  private seesaw1Angle = 0;
  private seesaw2?: Matter.Body;
  private seesawBeam2?: Matter.Body;
  private seesaw2Angle = 0;

     
  
  // säftlimacher game variables
  private movePixelSteps = 30;  // möglichst in 10er Schritten, testen
  private ingredientRadius = 50;
  private shakerContainerRadius = 5;
  private availableIngredientTypes = 3;
  private allIngredientNumbersOnList: number[] = new Array();
  private allIngredientsFalling: number[] = new Array();
  // private allIngrFalling: Ingredient[] = new Array();
  private gravityX: number = 0;
  private gravityY: number = 0.4;
  private Constraint = Matter.Constraint;
  private Vector = Matter.Vector;
  private Composite = Matter.Composite;


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
    this.setControllerListenerOnExitClicked();
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

    let i = 5;
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

  /*Allows user to exit the game when ever liked.*/
  private setControllerListenerOnExitClicked(): void{
    this.lobbyController.getControllers()[0].addSocketOnce('quitGame', this.shutDownGame.bind(this));
    this.lobbyController.getControllers()[1].addSocketOnce('quitGame', this.shutDownGame.bind(this));
  }

    


  /* -------------------- SÄFTLIMACHER GAME METHODS WITH INDIVIDUAL IMPLEMENTATION --------------------*/


  // private setControllerData(controllerData: number[]): void {
  //   let moveToValX = controllerData[0];
  //   let controllerId = controllerData[1];
  //   console.log("controllerData arrived:", moveToValX, controllerId);
    
  //   if (moveToValX != null && controllerId != null) {
  //     // TODO
  //     // check which controller is sending
  //     switch (controllerId) {
  //       case 1:
  //         if (this.catcherNet1 != undefined) {
  //           this.setShakerPos(moveToValX, this.catcherNet1);
  //         }
  //       case 2:
  //         if (this.catcherNet2 != undefined) {
  //           this.setShakerPos(moveToValX, this.catcherNet2);
  //         }
  //       // case 3:
  //       //   if (this.catcherNet3 != undefined) {
  //       //     this.setShakerPos(moveToValX, this.catcherNet3);
  //       //   }
  //     }
  //   }
  // }

  //// receiving data from ionic (controller)

  private setControllerDataPlayer1(controllerData: number[]): void {
    let moveToValX = controllerData[0];
    let controllerId = controllerData[1];
    console.log("controllerData from Player 1 arrived:", moveToValX, controllerId);
    
    if (moveToValX != null && controllerId != null && this.seesaw1 != undefined) {
      if (controllerId != 1) return;
      this.setShakerPos(moveToValX, this.seesaw1);
    //  this.seesaw1.angle = moveToValX;
    }
  }

  private setControllerDataPlayer2(controllerData: number[]): void {
    this.seesaw2Angle = controllerData[0];
    let controllerId = controllerData[1];
    console.log("controllerData from Player 2 arrived:", this.seesaw2Angle, controllerId);
    console.log("seesaw 2 angle: "+this.seesaw2?.angle)
    if (this.seesaw2Angle != null && controllerId != null && this.seesaw2 != undefined) {
      if (controllerId != 2) return;
    //  this.setShakerPos(moveToValY, this.seesaw2);
      this.seesaw2.angle = this.seesaw2Angle; // zuweisen des angles an matter.js element im server

    }
  }  


  private setShakerPos(valX: number, netBody: Matter.Body) {
    if (netBody != undefined && netBody != null) {
      switch (valX) {
        case 1:
          // right
          // Matter.Body.applyForce(this.shakerContainer, {x: this.shakerContainer.position.x, y: this.shakerContainer.position.y}, {x: 0.05, y: 0});
          // Matter.Body.translate(this.shakerContainer, {x: this.xRightField, y:  0});
          // Matter.Body.setPosition(this.shakerContainer, {x: this.xRightField, y:  this.shakerContainer.position.y});
          this.forceMove(netBody, this.xRightField, netBody.position.y, this.movePixelSteps);
          break;
        case -1:
          // left
          // Matter.Body.applyForce(this.shakerContainer, {x: this.shakerContainer.position.x, y: this.shakerContainer.position.y}, {x: -0.05, y: 0});
          // Matter.Body.translate(this.shakerContainer, {x: this.xLeftField, y:  0});
          // Matter.Body.setPosition(this.shakerContainer, {x: this.xLeftField, y:  this.shakerContainer.position.y});
          this.forceMove(netBody, this.xLeftField, netBody.position.y, this.movePixelSteps);
          break;
        case 0:
          // center
          // Matter.Body.translate(this.shakerContainer, {x: this.xCenterField, y:  0});
          // Matter.Body.setPosition(this.shakerContainer, {x: this.xCenterField, y:  this.shakerContainer.position.y});
          this.forceMove(netBody, this.xCenterField, netBody.position.y, this.movePixelSteps);
          break;
        default:
          break;
      }
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
    Matter.Body.setPosition(body, {
      x: newX,
      y: newY
    });

    return {x: newX, y: newY};
  } 

  private sendLevelInfoToDisplay(): void {
    let data: any[] = [];
    this.generateIngredientListNumbers();
    // 0
    data.push(this.allIngredientNumbersOnList);
    // 1 2
    data.push(this.seesaw1?.position.x);
    data.push(this.seesaw1?.position.y);
    // 3 4
    data.push(this.seesaw2?.position.x);
    data.push(this.seesaw2?.position.y);

    this.setDisplayGameViewBuildListener();
    this.lobbyController.sendToDisplays('levelData', data);
  }

  private createWorldBounds(): void {
    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Top
      // Matter.Bodies.rectangle(this.width / 2, 0, this.width, 10, {
      //   isStatic: true
      // }),
      // Left
      //Matter.Bodies.rectangle(this.worldSideMargin, this.height / 2, 10, this.height, {
      Matter.Bodies.rectangle(0, this.height / 2, 10, this.height, {
        isStatic: true,
        render: { 
          visible: true, }
      }),
      // Bottom
      // not visible, further down. trigger for respawning fruit
      Matter.Bodies.rectangle(this.width / 2, this.height+400, this.width, 10, {
        label: 'Floor',
        isStatic: true,
        isSensor: true,
        render: { 
          visible: true, }
      }),
      // Right
      Matter.Bodies.rectangle(this.width, this.height / 2, 10, this.height, {

      //Matter.Bodies.rectangle(this.width - this.worldSideMargin, this.height / 2, 10, this.height, {
        isStatic: true,
        render: { 
          visible: true, }
      })
    ])
  }



  private initSeesaws(): void {
    if (this.engine == null) return;

    
  //  console.log("seesaw left position x: "+this.xSeesawLeftPosition)
  //  console.log("seesaw right position x: "+this.xSeesawRightPosition)

    //seesaw1
    this.seesaw1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawPosition,
      this.seesawLength,  
      this.seesawHeight,
      {
        label: 'Seesaw1',
        isSensor: false,
        isStatic: false,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1); 
   
    this.seesawBeam1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawBeamPosition,
      this.seesawBeamLenght,
      this.seesawBeamHeight,
      {
        label: 'SeesawBeam1',
        isSensor: false,
        isStatic: true
      }
    )

    Matter.World.add(this.engine.world, this.seesawBeam1); 

  // Create a point constraint that pins the center of the platform to a fixed point in space, so
  // it can't move
  //https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-5-matter-physics-platformer-d14d1f614557
   const constraintSeesaw1 = this.Constraint.create({
     //bodyA: this.seesaw1,
     //pointA: {x: this.xSeesawLeftPosition, y: this.ySeesawPosition},
     bodyA: this.seesaw1,
     //bodyB: this.seesawBeam1,
     //pointB: { x: (this.xSeesawLeftPosition+this.seesawLength*0.5), y: this.ySeesawPosition+this.seesawHeight*0.5},
     //pointB: this.Vector.clone(this.seesaw1.position),
     pointB: { x: this.xSeesawLeftPosition, y: this.ySeesawBeamPosition-40},
     stiffness: 1,
     length: 0,
  })
  Matter.World.add(this.engine.world, constraintSeesaw1); 

 
    //seesaw2
    this.seesaw2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawPosition,
      this.seesawLength,
      this.seesawHeight,
      {
        label: 'Seesaw2',
        isSensor: false,
        isStatic: false,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2); 
    

      
    this.seesawBeam2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawBeamPosition,
      this.seesawBeamLenght,
      this.seesawBeamHeight,
      {
        label: 'SeesawBeam2',
        isSensor: false,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesawBeam2);  


  // Create a point constraint that pins the center of the platform to a fixed point in space, so
  // it can't move
  //https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-5-matter-physics-platformer-d14d1f614557
  const constraintSeesaw2 = this.Constraint.create({
    bodyA: this.seesaw2,
    pointB: { x: this.xSeesawRightPosition, y: this.ySeesawBeamPosition-40},
    //bodyB: this.seesawBeam2,
    //pointB: { x: (this.xSeesawRightPosition+this.seesawLength*0.5), y: this.ySeesawPosition+this.seesawHeight*0.5},
    //pointB: this.Vector.clone(this.seesaw2.position),
    //pointA: {x: this.seesawBeam2.position.x, y: this.seesawBeam2.position.y},
    //bodyB: this.seesaw2,
    stiffness: 1, 
    length: 0
      }
    )
    Matter.World.add(this.engine.world, constraintSeesaw2); 
  }
  

  private initIngredients(): void {
    if (this.engine == null) return;

    this.ingredientLeft = Matter.Bodies.circle(
      this.xLeftField,
      -50,
      this.ingredientRadius,
      {
        label: 'Ingredient0',
        isSensor: false,
      });
    Matter.World.add(this.engine.world, this.ingredientLeft);

    this.ingredientCenter = Matter.Bodies.circle(
      this.xCenterField,
      -1000,
      this.ingredientRadius,
      {
        label: 'Ingredient1',
        isSensor: false,
      });
    Matter.World.add(this.engine.world, this.ingredientCenter);

    this.ingredientRight = Matter.Bodies.circle(
      this.xRightField,
      -600,
      this.ingredientRadius,
      {
        label: 'Ingredient2',
        isSensor: false,
      });
    Matter.World.add(this.engine.world, this.ingredientRight);
  }

  private setUpGame() {
    this.engine = Matter.Engine.create();
    this.createWorldBounds();
    this.initSeesaws();
    this.initIngredients();
    this.initMatterEventCollision();
    this.sendLevelInfoToDisplay();
  }

  //TODO: instaed of seesaw add a the mixer container and a bucket
  initMatterEventCollision() {
    // Matter.Events.on(this.engine, 'collisionActive', (event) => {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];

        if (pair.bodyA.label.includes('Seesaw') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Seesaw') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient fallen onto seesaw
          console.log("Ingredient landet on seesaw");

          }
        // TODO
        if (pair.bodyA.label.includes('Container') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Container') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient catched
          let containerBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            containerBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }
          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          // TODO
          let seesawNr: number = parseInt(containerBody.label.charAt(containerBody.label.length - 1));

          if (this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
            console.log('catched a good ingredient, +50 points!!');
            this.score += this.scoreInc;
            this.lobbyController.sendToControllers('vibrate', [seesawNr]);
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
            console.log('catched a wrong ingredient, NOT on list!!! -50 points.');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }
          this.respawnIngredient(ingredientBody);
        }

        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient')) {
          // ingredient touched the floor -> respawn
          if (pair.bodyB.label.includes('Ingredient')) {
            this.respawnIngredient(pair.bodyB);
          } else {
            this.respawnIngredient(pair.bodyA);
          }
        }
      }
    });
  }

  private generateIngredientListNumbers() {
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
    if (this.engine == null || this.seesaw1 == null || this.seesaw2 == null) return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      ////sending data to browser
      this.lobbyController.sendToDisplays('seesaw1Position', [this.seesaw1.position.x, this.seesaw1.position.y, this.seesawLength, this.seesawHeight, this.seesaw1Angle]);
      console.log("SEESAW2POSITION angle before sending to browser: "+this.seesaw2?.angle+" and withouth ?: "+this.seesaw2.angle+" and seesaw2Angle:" +this.seesaw2Angle)
      this.lobbyController.sendToDisplays('seesaw2Position', [this.seesaw2.position.x, this.seesaw2.position.y, this.seesawLength, this.seesawHeight, this.seesaw2Angle]);
      this.lobbyController.sendToDisplays('seesawBeam1Position', [this.seesawBeam1?.position.x, this.seesawBeam1?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);
      this.lobbyController.sendToDisplays('seesawBeam2Position', [this.seesawBeam2?.position.x, this.seesawBeam2?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);

      this.lobbyController.sendToDisplays('updateScore', this.score);

      if (this.ingredientLeft != null) {
    //    console.log("IngredientLeft X before sending: "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y)
        this.lobbyController.sendToDisplays('updateIngredientLeft', [this.ingredientLeft.position.x, this.ingredientLeft.position.y, 0]);
      }

      if (this.ingredientCenter != null) {
    //    console.log("IngredientCenter X before sending: "+this.ingredientCenter.position.x+" and Y"+ this.ingredientCenter.position.y)
        this.lobbyController.sendToDisplays('updateIngredientCenter', [this.ingredientCenter.position.x, this.ingredientCenter.position.y, 2]);
      }

      if (this.ingredientRight != null) {
    //    console.log("IngredientRight X before sending: "+this.ingredientRight.position.x+" and Y"+ this.ingredientRight.position.y)
        this.lobbyController.sendToDisplays('updateIngredientRight', [this.ingredientRight.position.x, this.ingredientRight.position.y, 1]);
      }

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

    this.lobbyController.getControllers()[0].addSocketOnce('quitGame', this.shutDownGame.bind(this));
    this.lobbyController.getControllers()[1].addSocketOnce('quitGame', this.shutDownGame.bind(this));
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

  /* private quitGame() {
    // TODO: game abbrechen option
    console.log("quitGame() called");
    this.shutDownGame();
    // this.lobbyController.changeProgram(ProgramName.MAIN_MENU);
  } */

  private shutDownGame(): void {    
    console.log("SERVER: shutDownGame() called");
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
      this.r = 600;
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
        render: {
          visible: true,
          opacity: 1          
        },
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
        
        


