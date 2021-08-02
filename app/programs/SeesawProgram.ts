import { Program, ProgramName } from "./Program";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies, Render } from "matter-js";
import { SrcSocket } from "../SrcSocket";
import { group, timeStamp } from "console";
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


  // säftlimacher visible objects
  private seesaw1?: Matter.Body;
  private seesawBeam1?: Matter.Body;
  private ingredientLeft0?: Matter.Body;
  private ingredientLeft1?: Matter.Body;
  private ingredientLeft2?: Matter.Body;
  private seesaw1TriggerSpaceLeft?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  private seesaw1TriggerSpaceRight?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  
  private ingredientRight0?: Matter.Body;
  private ingredientRight1?: Matter.Body;
  private ingredientRight2?: Matter.Body;
  private seesaw2?: Matter.Body;
  private seesawBeam2?: Matter.Body;
  private seesaw2TriggerSpaceLeft?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  private seesaw2TriggerSpaceRight?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  
  private shakerContainer?: Matter.Body;
  private garbageContainerLeft?: Matter.Body;
  private garbageContainerRight?: Matter.Body;   
  
      // placement of seesaws
  // TODO: 3 teile berrechnen und speichern
  private xSeesawLeftPosition = 900;
  private xSeesawRightPosition = 1800;
  private ySeesawPosition = 500; //1000

  private seesawLength = 500;
  private seesawHeight = 40;

  private seesawBeamLenght = 20;
  private seesawBeamHeight = 100;
  private ySeesawBeamPosition = 540; //1040

  //placment of containers
  private garbageContainerLeftX = 550;
  private shakerContainerLeftX = 1350; //800
  private garbageContainerRightX = 2250; //2400
  private shakerContainerY = 900;
  private garbageContainerY = 1000;

  //placement of ingredients
  // fields where ingredients fall: left, center, right
  //private xLeftField = this.width * 0.25;
  //private xCenterField = this.width * 0.5;
  //private xRightField = this.width * 0.75;

  private xLeftField0 = 900;   //860 - 200
  private xLeftField1 = 900;   //1000-200
  private xLeftField2 = 900;    //1340 - 200

  private xRightField0 = 1700;   //1760 - 200
  private xRightField1 = 1700;   //1760-200
  private xRightField2 = 1700;    //1760 - 200

    //seesawLeft: 900 / right: 1800
  //left field: 860-200 bis 1340-200   //right: 1760-200 bis 2240-200
  // ingredients placement: 50 for radius -> f.e. 950 or 1850
  // on browser side: angepasst auf -240
  
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
  private LeftLandedOnSeesaw = false;  //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  private RightLandedOnSeesaw = false;  //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  private RightLandedOnSeeasw = false;  

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

  // receiving data from ionic (controller)
  private setControllerDataPlayer1(controllerData: number[]): void {
    let seesaw1Angle = controllerData[0];
    let controllerId = controllerData[1];
    let seesaw1OldAngle = 0;
  //  console.log("IONIC -> SERVER: this.seesaw1Angle (controller Data) / controllerId:", seesaw1Angle, controllerId);
    
    if (seesaw1Angle != null && controllerId != null && this.seesaw1 != undefined) {
      if (controllerId != 1) return;
    //  console.log("---- seesaw1.angle update called")
      if (seesaw1Angle == 0){
        Matter.Body.setPosition(this.seesaw1, {x: this.xSeesawLeftPosition, y: this.ySeesawPosition})
    //    console.log("seesaw1OldAngle MINUS "+-seesaw1OldAngle);
        Matter.Body.rotate(this.seesaw1, -seesaw1OldAngle);
    //    console.log("AFTER ROTATION seesaw1.angle: "+this.seesaw1.angle, " controller Data: "+seesaw1Angle)
        this.seesaw1.angle = seesaw1Angle;
    //    console.log("AFTER ASSIGNING SEESAW1ANGLE: seesaw2.angle: "+this.seesaw1.angle+" controller Data: "+seesaw1Angle)
        seesaw1OldAngle = seesaw1Angle;
      }  else {
    //    console.log("seesaw1.angle: "+this.seesaw1.angle)
        Matter.Body.setAngularVelocity(this.seesaw1, this.seesaw1.angle);
        Matter.Body.rotate(this.seesaw1, this.seesaw1.angle);
    //    console.log("AFTER ROTATION: seesaw1.angle: "+this.seesaw1.angle+" controller Data: "+seesaw1Angle)
        this.seesaw1.angle = seesaw1Angle;
    //    console.log("AFTER ASSIGNING SEESAW1ANGLE: seesaw2.angle: "+this.seesaw1.angle+" controller Data: "+seesaw1Angle)
        seesaw1OldAngle = seesaw1Angle;
    //    console.log("seesaw1OldAngle= "+seesaw1OldAngle);
      } 
    }
  }

  private setControllerDataPlayer2(controllerData: number[]): void {
    console.log("IONIC -> SERVER (seesaw2): controller Data: "+controllerData[0])
    let seesaw2Angle = controllerData[0];
    let controllerId = controllerData[1];
    let seesaw2OldAngle = 0;

    if (seesaw2Angle != null && controllerId != null && this.seesaw2 != undefined) {
      if (controllerId != 2) return;
      //  console.log("seesaw2.angle update called")
      //  this.seesaw2.angle = seesaw2Angle;  // zuweisen des angles an matter.js element im server
         if (seesaw2Angle == 0){
          //console.log("------------ seesaw 0 called")
          Matter.Body.setPosition(this.seesaw2, {x: this.xSeesawRightPosition, y: this.ySeesawPosition})
          //console.log("seesaw2OldAngle MINUS "+-seesaw2OldAngle);
          Matter.Body.rotate(this.seesaw2, -seesaw2OldAngle);
          //console.log("AFTER ROTATION seesaw2.angle: "+this.seesaw2.angle, " controller Data: "+seesaw2Angle)
          this.seesaw2.angle = seesaw2Angle;
          //console.log("AFTER ASSIGNING SEESAW2ANGLE: seesaw2.angle: "+this.seesaw2.angle+" controller Data: "+seesaw2Angle)
          seesaw2OldAngle = seesaw2Angle;
        }  else {
          //console.log("seesaw2.angle: "+this.seesaw2.angle)
          Matter.Body.setAngularVelocity(this.seesaw2, this.seesaw2.angle);
          Matter.Body.rotate(this.seesaw2, this.seesaw2.angle);
          //console.log("AFTER ROTATION: seesaw2.angle: "+this.seesaw2.angle+" controller Data: "+seesaw2Angle)
          this.seesaw2.angle = seesaw2Angle;
          //console.log("AFTER ASSIGNING SEESAW2ANGLE: seesaw2.angle: "+this.seesaw2.angle+" controller Data: "+seesaw2Angle)
          seesaw2OldAngle = seesaw2Angle;
          //console.log("seesaw2OldAngle= "+seesaw2OldAngle);
        } 
    }
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

    data.push(this.ingredientLeft0?.position.x);
    data.push(this.ingredientLeft0?.position.y);
    data.push(this.ingredientLeft1?.position.x);
    data.push(this.ingredientLeft1?.position.y);
    data.push(this.ingredientLeft2?.position.x);
    data.push(this.ingredientLeft2?.position.y);
    data.push(this.ingredientRight0?.position.x);
    data.push(this.ingredientRight0?.position.y);
    data.push(this.ingredientRight1?.position.x);
    data.push(this.ingredientRight1?.position.y);
    data.push(this.ingredientRight2?.position.x);
    data.push(this.ingredientRight2?.position.y);

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
        isStatic: true,
        render: { 
          visible: true, }
      })
    ])
  }



  private initSeesaws(): void {
    if (this.engine == null) return;

    //seesaw1
    this.seesaw1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawPosition,
      this.seesawLength,  
      this.seesawHeight,
      {
        label: 'Seesaw1',
        isSensor: false,
        isStatic: true,
        restitution: 0,
        friction: 1,
      //  position: {x: this.xSeesawLeftPosition+0.5*this.seesawLength, y: this.ySeesawPosition+0.5*this.seesawHeight} // no inpact
      //  friction: 0,  
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
    
    //seesaw trigger space on the left side 
    this.seesaw1TriggerSpaceLeft = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition-320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw1TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1TriggerSpaceLeft);

    //seesaw trigger space on the left side 
    this.seesaw1TriggerSpaceRight = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition+320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw1TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1TriggerSpaceRight); 

  // Create a point constraint that pins the center of the platform to a fixed point in space, so it can't move
  //https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-5-matter-physics-platformer-d14d1f614557
  /*  const constraintSeesaw1 = this.Constraint.create({
     bodyA: this.seesaw1,
     pointB: { x: this.xSeesawLeftPosition, y: this.ySeesawBeamPosition-40},
     stiffness: 1,
     length: 0,
  })
  Matter.World.add(this.engine.world, constraintSeesaw1); */ 

  // ground stops seesaw of turning 360°
  /*  this.seesaw1Ground = Matter.Bodies.rectangle(
    this.xSeesawLeftPosition,
    this.ySeesawBeamPosition,
    this.seesawLength,
    this.seesawHeight,
    {
      label: 'Seesaw1Ground',
      isSensor: false,
      isStatic: true
    }
  )
  Matter.World.add(this.engine.world, this.seesaw1Ground); */
 
 
    //seesaw2
  this.seesaw2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawPosition,
      this.seesawLength,
      this.seesawHeight,
      {
        label: 'Seesaw2',
        isSensor: false,
        isStatic: true,
        restitution: 0,
        friction: 1
      //  friction: 0.005,  
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


    //seesaw trigger space on the left side 
    this.seesaw2TriggerSpaceLeft = Matter.Bodies.rectangle(
      this.xSeesawRightPosition-320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw2TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2TriggerSpaceLeft);

    //seesaw trigger space on the left side 
    this.seesaw2TriggerSpaceRight = Matter.Bodies.rectangle(
      this.xSeesawRightPosition+320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw2TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2TriggerSpaceRight);


  // Create a point constraint that pins the center of the platform to a fixed point in space, so it can't move
  //https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-5-matter-physics-platformer-d14d1f614557
  /*  const constraintSeesaw2 = this.Constraint.create({
    bodyA: this.seesaw2,
    pointB: { x: this.xSeesawRightPosition, y: this.ySeesawBeamPosition-40},
      stiffness: 1,//1 
      length: 0
      }
    )
    Matter.World.add(this.engine.world, constraintSeesaw2);   */


    // ground stops seesaw of turning 360°  
    /* this.seesaw2Ground = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawBeamPosition+100,
      this.seesawLength,
      this.seesawHeight,
      {
        label: 'Seesaw2Ground',
        isSensor: false,
        isStatic: true,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2Ground);     */
  }  

  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.shakerContainerLeftX,
      this.shakerContainerY,
      this.shakerContainerRadius,
      {
        label: 'Container',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.shakerContainer);

    this.garbageContainerLeft = Matter.Bodies.circle(
      this.garbageContainerLeftX,
      this.garbageContainerY,
      this.shakerContainerRadius,
      {
        label: 'Garbage',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.garbageContainerLeft);

    this.garbageContainerRight = Matter.Bodies.circle(
      this.garbageContainerRightX,
      this.garbageContainerY,
      this.shakerContainerRadius,
      {
        label: 'Garbage',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.garbageContainerRight);
  }
  

  private initIngredients(): void {
    if (this.engine == null) return;

    this.ingredientLeft0 = Matter.Bodies.circle(
      this.xLeftField0,
      -50,
      this.ingredientRadius,
      {
        label: 'IngredientLeft0',
        isSensor: false,
        restitution: 0,
//        friction: 0.005, 
        density: 1.0,
      });  
    Matter.World.add(this.engine.world, this.ingredientLeft0);
    //Matter.Body.setMass(this.ingredientLeft0, 100)
    // Matter.Body.setAngularVelocity(this.ingredientLeft, 0.15)


    this.ingredientLeft1 = Matter.Bodies.circle(
      this.xLeftField1,
      -2000,
      this.ingredientRadius,
      {
        label: 'IngredientLeft1',
        isSensor: false,
        restitution: 0,        
        density: 1,
//        friction: 0.005,
      });
    Matter.World.add(this.engine.world, this.ingredientLeft1);
    //Matter.Body.setMass(this.ingredientLeft1, 100)
    // Matter.Body.setAngularVelocity(this.ingredientCenter, 0.15)


    this.ingredientLeft2 = Matter.Bodies.circle(
      this.xLeftField2,
      -4000,
      this.ingredientRadius,
      {
        label: 'IngredientLeft2',
        isSensor: false,
        restitution: 0,
        density: 1.0,
//        friction: 0.005,
      });
    Matter.World.add(this.engine.world, this.ingredientLeft2);
    //Matter.Body.setMass(this.ingredientLeft2, 100)
    // Matter.Body.setAngularVelocity(this.ingredientRight, 0.15)
  

    this.ingredientRight0 = Matter.Bodies.circle(
      this.xRightField0,
      -50,
      this.ingredientRadius,
      {
        label: 'IngredientLeft0',
        isSensor: false,
        restitution: 0,
        friction: 0.005, 
      });  
    Matter.World.add(this.engine.world, this.ingredientRight0);
    // Matter.Body.setMass(this.ingredientLeft, 5)
    // Matter.Body.setAngularVelocity(this.ingredientLeft, 0.15)


    this.ingredientRight1 = Matter.Bodies.circle(
      this.xRightField1,
      -2000,
      this.ingredientRadius,
      {
        label: 'IngredientRight1',
        isSensor: false,
        restitution: 0,
        friction: 0.005,
      });
    Matter.World.add(this.engine.world, this.ingredientRight1);
    // Matter.Body.setMass(this.ingredientCenter, 5)
    // Matter.Body.setAngularVelocity(this.ingredientCenter, 0.15)


    this.ingredientRight2 = Matter.Bodies.circle(
      this.xRightField2,
      -4000,
      this.ingredientRadius,
      {
        label: 'IngredientRight2',
        isSensor: false,
        restitution: 0,
        //density: 0.01
        friction: 0.005,
      });
    Matter.World.add(this.engine.world, this.ingredientRight2);
    // Matter.Body.setMass(this.ingredientRight, 5)
    // Matter.Body.setAngularVelocity(this.ingredientRight, 0.15)
  }

  private setUpGame() {
    this.engine = Matter.Engine.create();
    this.createWorldBounds();
    this.initSeesaws();
    this.initShakerContainer();
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
 
        if (pair.bodyA.label.includes('Seesaw1') && pair.bodyB.label.includes('IngredientLeft0') || pair.bodyB.label.includes('Seesaw1') && pair.bodyA.label.includes('IngredientLeft0')) {
          // ingredient fallen onto seesaw
            this.LeftLandedOnSeesaw = true;
            console.log("Ingredient0 landet on seesaw 1: "+this.LeftLandedOnSeesaw);
          }

         if (pair.bodyA.label.includes('Seesaw2') && pair.bodyB.label.includes('IngredientRight0') || pair.bodyB.label.includes('Seesaw2') && pair.bodyA.label.includes('IngredientRight0')) {
          // ingredient fallen onto seesaw
            this.RightLandedOnSeesaw = true;
            console.log("Ingredient0 landet on seesaw 2: "+this.RightLandedOnSeeasw);
        }

        /*
        if (pair.bodyA.label.includes('Seesaw2') && pair.bodyB.label.includes('Ingredient2') || pair.bodyB.label.includes('Seesaw2') && pair.bodyA.label.includes('Ingredient2')) {
          // ingredient fallen onto seesaw
            console.log("Ingredient1 landet on seesaw");
            this.RightLandedOnSeeasw = true;
        } */ 

         if (pair.bodyA.label.includes('Seesaw1TriggerSpace') && pair.bodyB.label.includes('IngredientLeft0') || pair.bodyB.label.includes('Seesaw1TriggerSpace') && pair.bodyA.label.includes('IngredientLeft0')) {
          // ingredient fallen onto seesaw
          console.log("Set landed on Seesaw false");
          this.LeftLandedOnSeesaw = false;
          } 
         if (pair.bodyA.label.includes('Seesaw2TriggerSpace') && pair.bodyB.label.includes('IngredientRight0') || pair.bodyB.label.includes('Seesaw2TriggerSpace') && pair.bodyA.label.includes('IngredientRight0')) {
          // ingredient fallen onto seesaw
          console.log("Set landed on Seesaw false");
          this.RightLandedOnSeesaw = false;
          } 


 
          
        // Container - Ingredient catched
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
          //  console.log('catched a good ingredient, +50 points!!');
            this.score += this.scoreInc;
            this.lobbyController.sendToControllers('vibrate', [seesawNr]);
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
          //  console.log('catched a wrong ingredient, NOT on list!!! -50 points.');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }
          this.respawnIngredient(ingredientBody);
        }

        // Garbage - Ingredient catched
        if (pair.bodyA.label.includes('Garbage') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Garbage') && pair.bodyA.label.includes('Ingredient')) {
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
          //  console.log('thrown away a bad ingredient!! +50 points.  ');
            this.score += this.scoreInc;
            this.lobbyController.sendToControllers('vibrate', [seesawNr]);
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
          //  console.log('thrown away a good ingredient,, NOT on list!S -50 points!!');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }
          this.respawnIngredient(ingredientBody);
        }

        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient')) {
          // ingredient touched the floor -> respawn
        //  console.log("ingredient touched floor");
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

  //TODO: respawn image at trhe same place again
  private respawnIngredient(body: Matter.Body) {
  ////  console.log("respawnIngredient: ");
    let newNumber = this.getRandomInt(this.availableIngredientTypes);;
    let newlabel = "Ingredient"+newNumber;

    body.label = newlabel;
    Matter.Body.setPosition(body, {
      x: body.position.x,
      y: -500
    });
    
    switch (body.position.x) {
      case this.xLeftField0:
        this.lobbyController.sendToDisplays('changeImageIngredientLeft0', [newNumber]);
        break;
      case this.xLeftField1:
        this.lobbyController.sendToDisplays('changeImageIngredientLeft1', [newNumber]);
        break;
      case this.xLeftField2:
        this.lobbyController.sendToDisplays('changeImageIngredientLeft2', [newNumber]);
        break;
      case this.xRightField0:
        this.lobbyController.sendToDisplays('changeImageIngredientRight0', [newNumber]);
        break;  
      case this.xRightField1:
        this.lobbyController.sendToDisplays('changeImageIngredientRight1', [newNumber]);
        break;
      case this.xRightField2:
        this.lobbyController.sendToDisplays('changeImageIngredientRight2', [newNumber]);
        break;  
      default:
        break;
    }
//   console.log("body.label =", body.label);
  }



  /* -------------------- BASIC GAME METHODS WITH INDIVIDUAL IMPLEMENTATION --------------------*/

  private startGame(): void {
    this.gameTimerId = setTimeout(() => this.doGameOverCountdown(), (this.secondsOfPlayTime * 1000) - (10 * 1000));
    this.gameTimerId = setTimeout(() => this.gameOver(), this.secondsOfPlayTime * 1000);

    this.lobbyController.sendToControllers('startSendingData', null);
    this.playing = true;
    this.lobbyController.sendToDisplays('playing', this.playing);

    let fps = 60;    ///start value: 60
    this.gameLoop = setInterval(() => {
    if (this.engine == null || this.seesaw1 == null || this.seesaw2 == null) return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);   

      ////sending data to browser


    //  console.log("SERVER -> BROWSER - 1 pos X: "+this.seesaw1.position.x+" pos y: "+this.seesaw1.position.y+" angle: "+this.seesaw1.angle);
      this.lobbyController.sendToDisplays('seesaw1Position', [this.seesaw1.position.x, this.seesaw1.position.y, this.seesawLength, this.seesawHeight, this.seesaw1.angle]);
      //console.log("SERVER -> BROWSER - 2 pos X: "+this.seesaw2.position.x+" pos y: "+this.seesaw2.position.y+" angle: "+this.seesaw2.angle);
      this.lobbyController.sendToDisplays('seesaw2Position', [this.seesaw2.position.x, this.seesaw2.position.y, this.seesawLength, this.seesawHeight, this.seesaw2.angle]);
      //console.log("SERVER -> BROWSER - BEAM: pos X: "+this.seesawBeam1?.position.x+" pos y: "+this.seesawBeam1?.position.y+" axes "+this.seesawBeam1?.axes);
      this.lobbyController.sendToDisplays('seesawBeam1Position', [this.seesawBeam1?.position.x, this.seesawBeam1?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);
      //console.log("SERVER -> BROWSER - BEAM: pos X: "+this.seesawBeam1?.position.x+" pos y: "+this.seesawBeam1?.position.y+" axes "+this.seesawBeam1?.axes);
      this.lobbyController.sendToDisplays('seesawBeam2Position', [this.seesawBeam2?.position.x, this.seesawBeam2?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);
      
      this.lobbyController.sendToDisplays('seesaw1TriggerSpaceLeft', [this.seesaw1TriggerSpaceLeft?.position.x, this.seesaw1TriggerSpaceLeft?.position.y, 40, 400]);
      this.lobbyController.sendToDisplays('seesaw1TriggerSpaceRight', [this.seesaw1TriggerSpaceRight?.position.x, this.seesaw1TriggerSpaceRight?.position.y, 40, 400]);
      this.lobbyController.sendToDisplays('seesaw2TriggerSpaceLeft', [this.seesaw2TriggerSpaceLeft?.position.x, this.seesaw2TriggerSpaceLeft?.position.y, 40, 400]);
      this.lobbyController.sendToDisplays('seesaw2TriggerSpaceRight', [this.seesaw2TriggerSpaceRight?.position.x, this.seesaw2TriggerSpaceRight?.position.y, 40, 400]);
 
      this.lobbyController.sendToDisplays('updateScore', this.score);

      if (this.ingredientLeft0 != null) {
        Matter.Body.setPosition(this.ingredientLeft0, {x: this.ingredientLeft0.position.x, y: this.ingredientLeft0.position.y});   //no inpact so far
        Matter.Body.setAngle(this.ingredientLeft0, this.ingredientLeft0.angle);    //no inpact so far
        this.lobbyController.sendToDisplays('updateIngredientLeft0', [this.ingredientLeft0.position.x, this.ingredientLeft0.position.y, this.ingredientLeft0.angle]);
      //  console.log("SERVER -> BROWSER IngredientLeft X AFTER sending : "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y);
      }

      if (this.ingredientLeft1 != null) {
        //  console.log("IngredientLeft X before sending: "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y)
          this.lobbyController.sendToDisplays('updateIngredientLeft1', [this.ingredientLeft1.position.x, this.ingredientLeft1.position.y, this.ingredientLeft1.angle]);
      }

      if (this.ingredientLeft2 != null) {
        //  console.log("IngredientLeft X before sending: "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y)
          this.lobbyController.sendToDisplays('updateIngredientLeft2', [this.ingredientLeft2.position.x, this.ingredientLeft2.position.y, this.ingredientLeft2.angle]);
      }

      if (this.ingredientRight0 != null) {
          this.lobbyController.sendToDisplays('updateIngredientRight0', [this.ingredientRight0.position.x, this.ingredientRight0.position.y, this.ingredientRight0.angle]);
      }  

      if (this.ingredientRight1 != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight1', [this.ingredientRight1.position.x, this.ingredientRight1.position.y, this.ingredientRight1.angle]);
      } 

      if (this.ingredientRight2 != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight2', [this.ingredientRight2.position.x, this.ingredientRight2.position.y, this.ingredientRight2.angle]);
      }       

       if (this.ingredientLeft0 != null && this.LeftLandedOnSeesaw == true) {
      //  console.log("ingredientLeft on seesaw was called // this seesaw1 position: "+this.ingredientLeft0.position.x+" and Y: "+ this.seesaw1.position.y)
        this.lobbyController.sendToDisplays('updateIngredientLeft0', [this.ingredientLeft0.position.x, this.seesaw1.position.y, this.ingredientLeft0.angle]);
      } 
      
      if (this.ingredientRight0 != null && this.RightLandedOnSeesaw == true) {
          console.log("ingredientRight on seesaw was called // this seesaw2 position: "+this.ingredientRight0.position.x+" and Y: "+ this.seesaw2.position.y)
          this.lobbyController.sendToDisplays('updateIngredientRight0', [this.ingredientRight0.position.x, this.seesaw2.position.y, this.ingredientRight0.angle]);
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
        
        


